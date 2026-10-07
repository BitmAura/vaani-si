/**
 * @vanni/knowledge-engine — Semantic Text Chunker
 * Chunks documents respecting semantic boundaries (headings, paragraphs, section breaks)
 * with configurable overlap and full traceability metadata.
 */

import { KnowledgeChunkDTO, KnowledgeAuthority } from '@vanni/shared';

export interface ChunkerOptions {
  chunkSize?: number; // Target chunk character size (default 500)
  chunkOverlap?: number; // Overlap characters (default 80)
  minChunkSize?: number; // Minimum characters for a standalone chunk (default 100)
  maxChunkSize?: number; // Maximum hard limit before force splitting (default 1000)
}

export class SemanticChunker {
  private defaultOptions: Required<ChunkerOptions> = {
    chunkSize: 500,
    chunkOverlap: 80,
    minChunkSize: 100,
    maxChunkSize: 1000,
  };

  /**
   * Convenience wrapper for chunkDocument
   */
  chunk(
    content: string,
    params: {
      documentId: string;
      sourceId: string;
      organizationId: string;
      authority?: KnowledgeAuthority;
      language?: 'EN' | 'KN' | 'KANGLISH';
      title?: string;
      pages?: Array<{ pageNumber: number; text: string }>;
    },
    options?: ChunkerOptions
  ): KnowledgeChunkDTO[] {
    return this.chunkDocument(
      {
        documentId: params.documentId,
        sourceId: params.sourceId,
        organizationId: params.organizationId,
        normalizedContent: content,
        authority: params.authority ?? 'APPROVED',
        language: params.language,
        pages: params.pages,
      },
      options
    );
  }

  /**
   * Splits normalized text into semantically coherent, metadata-tagged KnowledgeChunkDTOs
   */
  chunkDocument(
    params: {
      documentId: string;
      sourceId: string;
      organizationId: string;
      normalizedContent: string;
      authority: KnowledgeAuthority;
      language?: 'EN' | 'KN' | 'KANGLISH';
      pages?: Array<{ pageNumber: number; text: string }>;
    },
    options?: ChunkerOptions
  ): KnowledgeChunkDTO[] {
    const opts = { ...this.defaultOptions, ...options };
    const { documentId, sourceId, organizationId, normalizedContent, authority, language } = params;

    if (!normalizedContent || normalizedContent.trim().length === 0) {
      return [];
    }

    // If page markers are present, process page by page to guarantee accurate page numbers
    if (params.pages && params.pages.length > 0) {
      const allChunks: KnowledgeChunkDTO[] = [];
      let globalIndex = 0;

      for (const page of params.pages) {
        const pageChunks = this.splitTextIntoBlocks(page.text, opts);
        for (const block of pageChunks) {
          allChunks.push(
            this.buildChunkDTO({
              chunkIndex: globalIndex++,
              content: block.text,
              heading: block.heading,
              pageNumber: page.pageNumber,
              organizationId,
              sourceId,
              documentId,
              authority,
              language: language || 'EN',
            })
          );
        }
      }

      return allChunks;
    }

    // Otherwise split text across paragraphs and headings
    const blocks = this.splitTextIntoBlocks(normalizedContent, opts);
    return blocks.map((block, idx) =>
      this.buildChunkDTO({
        chunkIndex: idx,
        content: block.text,
        heading: block.heading,
        organizationId,
        sourceId,
        documentId,
        authority,
        language: language || 'EN',
      })
    );
  }

  private splitTextIntoBlocks(
    text: string,
    opts: Required<ChunkerOptions>
  ): Array<{ text: string; heading?: string }> {
    const paragraphs = text.split(/\n\s*\n/);
    const blocks: Array<{ text: string; heading?: string }> = [];

    let currentHeading: string | undefined = undefined;
    let currentBuffer = '';

    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();
      if (!trimmed) continue;

      // Detect heading (# Heading, ## Heading, or short title ending with colon)
      const headingMatch = trimmed.match(/^#{1,3}\s+(.+)$/m);
      if (headingMatch && headingMatch[1]) {
        currentHeading = headingMatch[1].trim();
      } else if (trimmed.length < 60 && !trimmed.endsWith('.') && (trimmed.endsWith(':') || trimmed.toUpperCase() === trimmed)) {
        currentHeading = trimmed.replace(/:$/, '');
      }

      // Check if adding paragraph exceeds target chunk size
      if (currentBuffer.length + trimmed.length > opts.chunkSize) {
        if (currentBuffer.length >= opts.minChunkSize) {
          blocks.push({ text: currentBuffer.trim(), heading: currentHeading });
          // Preserve overlap from the end of the current buffer
          const overlapText = currentBuffer.slice(-opts.chunkOverlap);
          currentBuffer = overlapText + ' ' + trimmed;
        } else {
          currentBuffer = currentBuffer ? `${currentBuffer}\n\n${trimmed}` : trimmed;
        }
      } else {
        currentBuffer = currentBuffer ? `${currentBuffer}\n\n${trimmed}` : trimmed;
      }

      // Hard maxChunkSize guard: Force split if oversized paragraph
      if (currentBuffer.length >= opts.maxChunkSize) {
        blocks.push({ text: currentBuffer.trim(), heading: currentHeading });
        currentBuffer = '';
      }
    }

    if (currentBuffer.trim().length > 0) {
      blocks.push({ text: currentBuffer.trim(), heading: currentHeading });
    }

    return blocks;
  }

  private buildChunkDTO(params: {
    chunkIndex: number;
    content: string;
    heading?: string;
    pageNumber?: number;
    organizationId: string;
    sourceId: string;
    documentId: string;
    authority: KnowledgeAuthority;
    language: 'EN' | 'KN' | 'KANGLISH';
  }): KnowledgeChunkDTO {
    const charCount = params.content.length;
    // Standard approximation: ~4 characters per token
    const tokenCount = Math.ceil(charCount / 4);

    return {
      id: `chunk-${params.documentId}-${params.chunkIndex}`,
      organizationId: params.organizationId,
      sourceId: params.sourceId,
      documentId: params.documentId,
      chunkIndex: params.chunkIndex,
      content: params.content,
      heading: params.heading,
      pageNumber: params.pageNumber,
      language: params.language,
      authority: params.authority,
      tokenCount,
      charCount,
      metadata: {
        heading: params.heading,
        pageNumber: params.pageNumber,
      },
      createdAt: new Date().toISOString(),
    };
  }
}

export const globalSemanticChunker = new SemanticChunker();
