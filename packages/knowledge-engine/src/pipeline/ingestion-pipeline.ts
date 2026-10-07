/**
 * @vanni/knowledge-engine — Knowledge Ingestion & Atomic Publishing Pipeline
 * Orchestrates parsing -> normalization -> semantic chunking -> vector embedding -> atomic activation.
 * Guarantees zero downtime: previous document version remains ACTIVE until new version passes all stages.
 */

import crypto from 'node:crypto';
import {
  KnowledgeDocumentDTO,
  KnowledgeDocumentType,
  KnowledgeAuthority,
  KnowledgeIngestionJobDTO,
} from '@vanni/shared';
import { IDatabaseService, globalDb } from '@vanni/database';
import { globalParserRegistry } from '../parsers/index.js';
import { globalTextNormalizer } from '../normalization/text-normalizer.js';
import { globalSemanticChunker } from '../chunking/semantic-chunker.js';
import { globalEmbeddingProvider } from '../embeddings/index.js';
import { IEmbeddingProvider } from '../embeddings/types.js';

export interface IngestionInput {
  organizationId: string;
  sourceId: string;
  title: string;
  documentType: KnowledgeDocumentType;
  content: Buffer | string;
  filename?: string;
  authority?: KnowledgeAuthority;
  language?: 'EN' | 'KN' | 'KANGLISH';
  storagePath?: string;
}

export interface IngestionResult {
  success: boolean;
  document: KnowledgeDocumentDTO;
  job: KnowledgeIngestionJobDTO;
  chunksCreated: number;
  wordCount: number;
  charCount: number;
  supersededVersion?: number;
  errorMessage?: string;
}

export class KnowledgeIngestionPipeline {
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
   * Executes atomic document ingestion with versioning and fallback preservation
   */
  async ingestDocument(input: IngestionInput): Promise<IngestionResult> {
    const {
      organizationId,
      sourceId,
      title,
      documentType,
      content,
      filename,
      authority = 'REFERENCE',
      storagePath,
    } = input;

    // 1. Verify Source and Check for Existing Active Versions
    const existingDocs = await this.db.getDocuments(organizationId, sourceId);
    existingDocs.sort((a, b) => b.version - a.version);
    const activePreviousDoc = existingDocs.find(d => d.contentStatus === 'READY');
    const newVersion = existingDocs.length > 0 ? existingDocs[0].version + 1 : 1;

    const docId = `doc-${sourceId}-${newVersion}-${Date.now()}`;
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // 2. Register Ingestion Job (QUEUED -> RUNNING)
    const job: KnowledgeIngestionJobDTO = {
      id: jobId,
      organizationId,
      sourceId,
      documentId: docId,
      jobType: documentType === 'PDF' ? 'PDF_PARSE' : documentType === 'WEBSITE_PAGE' ? 'WEBSITE_FETCH' : 'TEXT_INGEST',
      status: 'RUNNING',
      progress: 10,
      metadata: { newVersion, filename },
      startedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    await this.db.saveJob(job);

    // Initial Document state: PROCESSING
    const docDraft: KnowledgeDocumentDTO = {
      id: docId,
      organizationId,
      sourceId,
      title,
      documentType,
      contentStatus: 'PROCESSING',
      storagePath,
      rawContent: '',
      normalizedContent: '',
      language: input.language || 'EN',
      checksum: '',
      version: newVersion,
      supersedesId: activePreviousDoc?.id,
      wordCount: 0,
      charCount: 0,
      metadata: { authority },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.db.saveDocument(docDraft);

    try {
      // 3. Document Parsing
      const parser = globalParserRegistry.getParser(filename || documentType);
      const parseResult = await parser.parse(content, { filename });

      if (parseResult.isScannedOrEmpty && documentType === 'PDF') {
        throw new Error('PDF contains no extractable text stream. Document appears scanned or image-only and requires OCR processing.');
      }

      await this.db.updateJobProgress(jobId, 'RUNNING', 30, organizationId);

      // 4. Text Normalization
      const normalized = globalTextNormalizer.normalize(parseResult.rawText);
      if (!normalized) {
        throw new Error('Document content is empty after normalization');
      }

      const detectedLang = input.language || globalTextNormalizer.detectLanguage(normalized);
      const checksum = crypto.createHash('sha256').update(normalized, 'utf-8').digest('hex');

      await this.db.updateJobProgress(jobId, 'RUNNING', 50, organizationId);

      // 5. Semantic Chunking
      const chunks = globalSemanticChunker.chunkDocument({
        documentId: docId,
        sourceId,
        organizationId,
        normalizedContent: normalized,
        authority,
        language: detectedLang,
        pages: parseResult.pages,
      });

      await this.db.updateJobProgress(jobId, 'RUNNING', 70, organizationId);

      // 6. Batch Vector Embeddings
      const textsToEmbed = chunks.map(c => c.content);
      const vectors = await this.embeddingProvider.embedBatch(textsToEmbed);

      for (let i = 0; i < chunks.length; i++) {
        chunks[i].embedding = vectors[i];
        chunks[i].embeddingModel = this.embeddingProvider.modelName();
      }

      await this.db.updateJobProgress(jobId, 'RUNNING', 90, organizationId);

      // 7. Atomic Activation
      // Save all chunks
      await this.db.saveChunks(chunks);

      // Update new document to READY
      docDraft.contentStatus = 'READY';
      docDraft.rawContent = parseResult.rawText.slice(0, 5000); // Preserve preview snippet
      docDraft.normalizedContent = normalized;
      docDraft.language = detectedLang;
      docDraft.checksum = checksum;
      docDraft.wordCount = parseResult.wordCount;
      docDraft.charCount = parseResult.charCount;
      docDraft.metadata = {
        ...docDraft.metadata,
        ...parseResult.metadata,
        chunkCount: chunks.length,
        embeddingModel: this.embeddingProvider.modelName(),
      };
      await this.db.saveDocument(docDraft);

      // Supersede previous version: Mark ARCHIVED
      if (activePreviousDoc) {
        await this.db.updateDocumentStatus(activePreviousDoc.id, 'ARCHIVED', organizationId);
      }

      // Complete Job
      await this.db.updateJobProgress(jobId, 'COMPLETED', 100, organizationId);
      job.status = 'COMPLETED';
      job.progress = 100;

      return {
        success: true,
        document: docDraft,
        job,
        chunksCreated: chunks.length,
        wordCount: parseResult.wordCount,
        charCount: parseResult.charCount,
        supersededVersion: activePreviousDoc?.version,
      };
    } catch (err: any) {
      // Failure Handling: Preserve previous active version!
      await this.db.updateDocumentStatus(docId, 'FAILED', organizationId, err.message);
      await this.db.updateJobProgress(jobId, 'FAILED', 0, organizationId, err.message);

      docDraft.contentStatus = 'FAILED';
      docDraft.errorMessage = err.message;
      job.status = 'FAILED';
      job.errorMessage = err.message;

      return {
        success: false,
        document: docDraft,
        job,
        chunksCreated: 0,
        wordCount: 0,
        charCount: 0,
        errorMessage: err.message,
      };
    }
  }
}

export const globalIngestionPipeline = new KnowledgeIngestionPipeline();
