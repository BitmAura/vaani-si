/**
 * @vanni/knowledge-engine — Parser Types
 */

export interface DocumentPage {
  pageNumber: number;
  text: string;
}

export interface ParseResult {
  title: string;
  rawText: string;
  pages?: DocumentPage[];
  headings?: string[];
  isScannedOrEmpty?: boolean;
  wordCount: number;
  charCount: number;
  metadata?: Record<string, any>;
}

export interface IDocumentParser {
  supportedTypes: string[];
  parse(content: Buffer | string, options?: { filename?: string; mimeType?: string }): Promise<ParseResult>;
}
