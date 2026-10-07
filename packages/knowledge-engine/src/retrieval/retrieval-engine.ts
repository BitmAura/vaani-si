/**
 * @vanni/knowledge-engine — Hybrid Vector + Keyword Retrieval Engine
 * Combines 384-dimensional dense vector similarity with lexical matching, authority boosting,
 * and Kannada dialect weighting to deliver grounded, hallucination-free knowledge.
 */

import {
  KnowledgeQueryResultDTO,
  KnowledgeRetrievalItemDTO,
  KnowledgeAuthority,
  KnowledgeAnswerability,
} from '@vanni/shared';
import { IDatabaseService, globalDb } from '@vanni/database';
import { IEmbeddingProvider } from '../embeddings/types.js';
import { globalEmbeddingProvider } from '../embeddings/index.js';

export interface RetrievalOptions {
  sourceId?: string;
  documentId?: string;
  language?: 'EN' | 'KN' | 'KANGLISH' | 'ALL';
  topK?: number;
  includeArchived?: boolean;
}

export class KnowledgeRetrievalEngine {
  private db: IDatabaseService;
  private embeddingProvider: IEmbeddingProvider;

  constructor(
    db: IDatabaseService = globalDb,
    embeddingProvider: IEmbeddingProvider = globalEmbeddingProvider
  ) {
    this.db = db;
    this.embeddingProvider = embeddingProvider;
  }

  /**
   * Convenience lookup for agent runtime prompt assembling
   */
  async searchRelevantFacts(organizationId: string, query: string): Promise<string> {
    const res = await this.retrieveKnowledge(organizationId, query, { topK: 3 });
    if (res.results.length === 0) return '';
    return res.results.map(r => r.content).join('\n');
  }

  /**
   * Performs hybrid semantic and keyword retrieval against an organization's active knowledge
   */
  async retrieveKnowledge(
    orgIdOrParams:
      | string
      | {
          organizationId: string;
          query: string;
          topK?: number;
          sourceId?: string;
          documentId?: string;
          language?: 'EN' | 'KN' | 'KANGLISH' | 'ALL';
          includeArchived?: boolean;
        },
    queryOrOptions?: string | RetrievalOptions,
    maybeOptions?: RetrievalOptions
  ): Promise<KnowledgeQueryResultDTO & { items: KnowledgeRetrievalItemDTO[] }> {
    let organizationId: string;
    let query: string;
    let options: RetrievalOptions | undefined;

    if (typeof orgIdOrParams === 'object') {
      organizationId = orgIdOrParams.organizationId;
      query = orgIdOrParams.query;
      options = {
        topK: orgIdOrParams.topK,
        sourceId: orgIdOrParams.sourceId,
        documentId: orgIdOrParams.documentId,
        language: orgIdOrParams.language,
        includeArchived: orgIdOrParams.includeArchived,
      };
    } else {
      organizationId = orgIdOrParams;
      query = typeof queryOrOptions === 'string' ? queryOrOptions : '';
      options = typeof queryOrOptions === 'object' ? queryOrOptions : maybeOptions;
    }

    const startTime = Date.now();
    const cleanQuery = (query || '').trim();
    const topK = options?.topK || 5;

    if (!cleanQuery) {
      return {
        query,
        organizationId,
        answerability: 'UNSUPPORTED',
        topScore: 0,
        results: [],
        items: [],
        citations: [],
      };
    }

    // 1. Fetch Organization Documents & Sources for strict tenant isolation
    const [documents, sources, chunks] = await Promise.all([
      this.db.getDocuments(organizationId),
      this.db.getKnowledgeSources(organizationId),
      this.db.getChunks(organizationId, options?.documentId),
    ]);

    const activeDocIds = new Set(
      documents
        .filter(d => options?.includeArchived || (d.contentStatus && d.contentStatus.toUpperCase() === 'READY'))
        .map(d => d.id)
    );

    const docMap = new Map(documents.map(d => [d.id, d]));
    const sourceMap = new Map(sources.map(s => [s.id, s]));

    // Filter candidate chunks belonging strictly to valid, active documents
    const candidateChunks = chunks.filter(c => {
      if (c.organizationId !== organizationId) return false;
      if (!activeDocIds.has(c.documentId)) return false;
      if (options?.sourceId && c.sourceId !== options.sourceId) return false;
      if (options?.language && options.language !== 'ALL' && c.language && c.language.toUpperCase() !== options.language.toUpperCase()) return false;
      return true;
    });

    if (candidateChunks.length === 0) {
      return {
        query,
        organizationId,
        answerability: 'UNSUPPORTED',
        topScore: 0,
        results: [],
        items: [],
        citations: [],
        trace: {
          executionTimeMs: Date.now() - startTime,
          totalCandidateChunks: 0,
          totalCandidates: 0,
          filteredCandidates: 0,
          filtersApplied: { ...options },
          appliedFilters: { organizationId, ...options },
          modelName: this.embeddingProvider.modelName(),
        } as any,
      };
    }

    // 2. Generate Query Embedding
    const queryVector = await this.embeddingProvider.embedText(cleanQuery);
    const queryTokens = this.tokenize(cleanQuery);
    const hasKannadaInQuery = /[\u0C80-\u0CFF]/.test(cleanQuery);

    // 3. Compute Hybrid Relevance Scores for each chunk
    const scoredItems: KnowledgeRetrievalItemDTO[] = [];

    for (const chunk of candidateChunks) {
      const doc = docMap.get(chunk.documentId);
      const source = sourceMap.get(chunk.sourceId);

      // Semantic Cosine Similarity (Dot product of unit-normalized vectors)
      let semanticScore = 0;
      if (chunk.embedding && chunk.embedding.length === queryVector.length) {
        semanticScore = this.cosineSimilarity(queryVector, chunk.embedding);
      } else {
        // Fallback: Compute on-the-fly embedding if chunk lacks pre-computed vector
        const chunkVector = await this.embeddingProvider.embedText(chunk.content);
        semanticScore = this.cosineSimilarity(queryVector, chunkVector);
      }

      // Keyword / Lexical Match Score
      const keywordScore = this.computeKeywordScore(queryTokens, chunk.content, chunk.heading);

      // Authority Boost (Applies when there is a relevance signal for the query)
      const relevanceSignal = Math.max(semanticScore, keywordScore);
      const authorityBoost = relevanceSignal > 0.25 ? this.getAuthorityBoost(chunk.authority) : 0;

      // Language Match Boost
      const langBoost = (hasKannadaInQuery && (chunk.language === 'KN' || chunk.language === 'KANGLISH')) ? 0.05 : 0;

      // Combined Hybrid Score (Bounded between 0.0 and 1.0)
      const rawCombined = (0.55 * Math.max(0, semanticScore)) + (0.30 * keywordScore) + authorityBoost + langBoost;
      const finalScore = Math.max(0, Math.min(1.0, Math.round(rawCombined * 1000) / 1000));

      scoredItems.push({
        chunkId: chunk.id,
        documentId: chunk.documentId,
        sourceId: chunk.sourceId,
        sourceTitle: source?.title || 'Unknown Source',
        documentTitle: doc?.title || 'Document',
        content: chunk.content,
        score: finalScore,
        semanticScore: Math.round(semanticScore * 1000) / 1000,
        keywordScore: Math.round(keywordScore * 1000) / 1000,
        authority: chunk.authority,
        authorityBoost,
        language: chunk.language,
        pageNumber: chunk.pageNumber,
        heading: chunk.heading,
      });
    }

    // 4. Sort Descending by Final Score
    scoredItems.sort((a, b) => b.score - a.score);
    const topResults = scoredItems.slice(0, topK);
    const topScore = topResults.length > 0 ? topResults[0].score : 0;

    // 5. Determine Answerability
    let answerability: KnowledgeAnswerability = 'UNSUPPORTED';
    if (topScore >= 0.55) {
      answerability = 'SUPPORTED';
    } else if (topScore >= 0.35) {
      answerability = 'PARTIALLY_SUPPORTED';
    } else {
      answerability = 'UNSUPPORTED';
    }

    // 6. Generate Citations for traceability
    const citations = topResults.map(r => ({
      sourceName: r.sourceTitle,
      documentTitle: r.documentTitle,
      section: r.heading,
      pageNumber: r.pageNumber,
      chunkId: r.chunkId,
      authority: r.authority,
    }));

    return {
      query,
      organizationId,
      answerability,
      topScore,
      results: topResults,
      items: topResults,
      citations,
      trace: {
        executionTimeMs: Date.now() - startTime,
        totalCandidateChunks: candidateChunks.length,
        totalCandidates: candidateChunks.length,
        filteredCandidates: topResults.length,
        filtersApplied: { ...options },
        appliedFilters: { organizationId, ...options },
        modelName: this.embeddingProvider.modelName(),
      } as any,
    };
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dot = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
    }
    return dot;
  }

  private computeKeywordScore(queryTokens: string[], content: string, heading?: string): number {
    if (queryTokens.length === 0) return 0;
    const lowerContent = content.toLowerCase();
    const lowerHeading = (heading || '').toLowerCase();

    let matched = 0;
    for (const token of queryTokens) {
      if (lowerHeading.includes(token)) {
        matched += 1.5; // Extra weight for heading matches
      } else if (lowerContent.includes(token)) {
        matched += 1.0;
      }
    }

    return Math.min(1.0, matched / queryTokens.length);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[\s,.;:!?()"-]+/)
      .filter(t => t.length > 2);
  }

  private getAuthorityBoost(authority: KnowledgeAuthority): number {
    switch (authority) {
      case 'AUTHORITATIVE':
        return 0.20;
      case 'APPROVED':
        return 0.10;
      case 'REFERENCE':
        return 0.00;
      case 'UNVERIFIED':
        return -0.10;
      default:
        return 0.00;
    }
  }
}

export const globalRetrievalEngine = new KnowledgeRetrievalEngine();
