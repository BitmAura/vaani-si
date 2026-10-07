/**
 * @vanni/knowledge-engine — Text & Markdown Document Parser
 */

import { IDocumentParser, ParseResult } from './types.js';

export class TextParser implements IDocumentParser {
  supportedTypes = ['text/plain', 'text/markdown', 'txt', 'md'];

  async parse(content: Buffer | string, options?: { filename?: string }): Promise<ParseResult> {
    const rawText = (Buffer.isBuffer(content) ? content.toString('utf-8') : content).trim();

    // Infer title from first markdown header # Title or filename
    let title = options?.filename ? options.filename.replace(/\.(txt|md)$/i, '') : 'Text Document';
    const firstH1 = rawText.match(/^#\s+(.+)$/m);
    if (firstH1 && firstH1[1]) {
      title = firstH1[1].trim();
    }

    // Extract Markdown headings
    const headings: string[] = [];
    const headingMatches = rawText.matchAll(/^#{1,3}\s+(.+)$/gm);
    for (const m of headingMatches) {
      if (m[1] && !headings.includes(m[1].trim())) {
        headings.push(m[1].trim());
      }
    }

    const words = rawText ? rawText.split(/\s+/).filter(Boolean).length : 0;

    return {
      title,
      rawText,
      headings,
      isScannedOrEmpty: rawText.length === 0,
      wordCount: words,
      charCount: rawText.length,
      metadata: {
        parser: 'vanni-text-markdown-parser',
      },
    };
  }
}
