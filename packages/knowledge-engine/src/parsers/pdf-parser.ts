/**
 * @vanni/knowledge-engine — Server-Side PDF Stream Text Extractor
 * Pure Node.js flate-stream parser for secure, memory-safe PDF extraction.
 * Detects scanned/empty PDFs and handles malformed documents gracefully without crashing.
 */

import zlib from 'node:zlib';
import { IDocumentParser, ParseResult, DocumentPage } from './types.js';

export class PdfParser implements IDocumentParser {
  supportedTypes = ['application/pdf', 'pdf'];

  async parse(content: Buffer | string, options?: { filename?: string }): Promise<ParseResult> {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');

    // 1. Basic PDF Signature Verification
    if (buffer.length < 5 || buffer.toString('ascii', 0, 5) !== '%PDF-') {
      throw new Error('Invalid PDF: Missing %PDF- header signature');
    }

    try {
      const pdfText = buffer.toString('binary');
      let extractedTitle = options?.filename ? options.filename.replace(/\.pdf$/i, '') : 'Uploaded Document';

      // Try reading Title from /Info dict
      const titleMatch = pdfText.match(/\/Title\s*\(([^)]+)\)/);
      if (titleMatch && titleMatch[1]) {
        extractedTitle = this.unescapePdfString(titleMatch[1]).trim();
      }

      // Count pages via /Type /Page
      const pageMatches = pdfText.match(/\/Type\s*\/Page\b/g);
      const estimatedPages = Math.max(1, pageMatches ? pageMatches.length : 1);

      // 2. Extract Streams & FlateDecode
      const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
      let match: RegExpExecArray | null;
      const textFragments: string[] = [];

      while ((match = streamRegex.exec(pdfText)) !== null) {
        const streamData = match[1];
        let decompressedText = '';

        // Check if stream is FlateDecode compressed
        const streamHeaderStart = Math.max(0, match.index - 300);
        const headerSnippet = pdfText.slice(streamHeaderStart, match.index);
        const isFlate = headerSnippet.includes('/FlateDecode');

        if (isFlate) {
          try {
            const rawBytes = Buffer.from(streamData, 'binary');
            const uncompressed = zlib.inflateSync(rawBytes);
            decompressedText = uncompressed.toString('latin1');
          } catch {
            try {
              const rawBytes = Buffer.from(streamData, 'binary');
              const uncompressed = zlib.inflateRawSync(rawBytes);
              decompressedText = uncompressed.toString('latin1');
            } catch {
              // Non-fatal: Skip unparseable stream (e.g. image stream / font raster)
              continue;
            }
          }
        } else {
          decompressedText = streamData;
        }

        // Extract PDF text operators from stream (BT ... ET)
        const extracted = this.extractTextFromPdfStream(decompressedText);
        if (extracted) {
          textFragments.push(extracted);
        }
      }

      // Fallback: If stream parsing yielded nothing, look for literal strings in raw PDF
      if (textFragments.length === 0) {
        const directText = this.extractTextFromPdfStream(pdfText);
        if (directText) {
          textFragments.push(directText);
        }
      }

      const fullText = textFragments.join('\n\n').trim();
      const isScannedOrEmpty = fullText.length < 20;

      // Group into approximate pages
      const pages: DocumentPage[] = [];
      if (fullText.length > 0) {
        const pageSize = Math.ceil(fullText.length / estimatedPages);
        for (let p = 0; p < estimatedPages; p++) {
          const start = p * pageSize;
          const end = Math.min(fullText.length, start + pageSize);
          const pageText = fullText.slice(start, end).trim();
          if (pageText) {
            pages.push({ pageNumber: p + 1, text: pageText });
          }
        }
      }

      const words = fullText ? fullText.split(/\s+/).filter(Boolean).length : 0;

      return {
        title: extractedTitle,
        rawText: fullText,
        pages,
        isScannedOrEmpty,
        wordCount: words,
        charCount: fullText.length,
        metadata: {
          estimatedPages,
          isScanned: isScannedOrEmpty,
          parser: 'vanni-safe-pdf-stream-parser',
          note: isScannedOrEmpty
            ? 'PDF contains no usable text stream. Document appears scanned or image-only and requires OCR.'
            : undefined,
        },
      };
    } catch (err: any) {
      throw new Error(`Failed to parse PDF: ${err.message}`);
    }
  }

  private extractTextFromPdfStream(stream: string): string {
    const result: string[] = [];

    // Match (string) Tj
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let match: RegExpExecArray | null;
    while ((match = tjRegex.exec(stream)) !== null) {
      const text = this.unescapePdfString(match[1]);
      if (text.trim()) result.push(text);
    }

    // Match [(string) num (string)] TJ
    const arrayTjRegex = /\[(.*?)\]\s*TJ/g;
    while ((match = arrayTjRegex.exec(stream)) !== null) {
      const inner = match[1];
      const partRegex = /\(([^)]*)\)/g;
      let partMatch: RegExpExecArray | null;
      const combinedParts: string[] = [];
      while ((partMatch = partRegex.exec(inner)) !== null) {
        combinedParts.push(this.unescapePdfString(partMatch[1]));
      }
      const combined = combinedParts.join('');
      if (combined.trim()) result.push(combined);
    }

    return result.join(' ').replace(/\s+/g, ' ').trim();
  }

  private unescapePdfString(str: string): string {
    return str
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\')
      .replace(/\\(\d{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
  }
}
