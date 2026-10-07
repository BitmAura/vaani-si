/**
 * @vanni/knowledge-engine — Document Parsers Export
 */

import { IDocumentParser } from './types.js';
import { PdfParser } from './pdf-parser.js';
import { HtmlParser } from './html-parser.js';
import { TextParser } from './text-parser.js';

export * from './types.js';
export * from './pdf-parser.js';
export * from './html-parser.js';
export * from './text-parser.js';

export class ParserRegistry {
  private parsers: IDocumentParser[] = [
    new PdfParser(),
    new HtmlParser(),
    new TextParser(),
  ];

  getParser(mimeOrExtension: string): IDocumentParser {
    const clean = mimeOrExtension.toLowerCase().replace(/^\./, '').trim();
    for (const parser of this.parsers) {
      if (parser.supportedTypes.includes(clean)) {
        return parser;
      }
    }
    if (['txt', 'text', 'text/plain', 'md', 'text/markdown', 'markdown', 'manual_article', 'policy_document', 'faq_collection', 'text_ingest'].includes(clean)) {
      return new TextParser();
    }
    if (['html', 'htm', 'text/html', 'website_page', 'website_fetch'].includes(clean)) {
      return new HtmlParser();
    }
    if (['pdf', 'application/pdf', 'pdf_parse'].includes(clean)) {
      return new PdfParser();
    }
    throw new Error(`Unsupported document format: ${mimeOrExtension}`);
  }

  async parse(content: Buffer | string, options: { filename?: string; mimeType?: string }): Promise<import('./types.js').ParseResult> {
    const ext = options.filename ? options.filename.split('.').pop() || '' : '';
    const lookup = options.mimeType || ext;
    const parser = this.getParser(lookup);
    return parser.parse(content, options);
  }
}

export const globalParserRegistry = new ParserRegistry();
