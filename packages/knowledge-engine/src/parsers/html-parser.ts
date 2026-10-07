/**
 * @vanni/knowledge-engine — Safe HTML Content Extractor
 * Strips active scripts/styles/navigation and extracts clean text blocks with headings.
 */

import { IDocumentParser, ParseResult } from './types.js';

export class HtmlParser implements IDocumentParser {
  supportedTypes = ['text/html', 'html'];

  async parse(content: Buffer | string, options?: { filename?: string }): Promise<ParseResult> {
    const rawHtml = Buffer.isBuffer(content) ? content.toString('utf-8') : content;

    // 1. Extract Title
    let title = options?.filename || 'Web Page';
    const titleMatch = rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      title = this.decodeHtmlEntities(titleMatch[1]).trim();
    }

    // 2. Extract Headings (h1 - h3)
    const headings: string[] = [];
    const headingRegex = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
    let hMatch: RegExpExecArray | null;
    while ((hMatch = headingRegex.exec(rawHtml)) !== null) {
      const cleanHeading = this.stripTags(hMatch[1]).trim();
      if (cleanHeading && !headings.includes(cleanHeading)) {
        headings.push(cleanHeading);
      }
    }

    // 3. Strip Unwanted Elements (<script>, <style>, <nav>, <header>, <footer>, <svg>, <noscript>)
    let cleaned = rawHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    // 4. Convert structural breaks to newlines
    cleaned = cleaned
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<\/div>/gi, '\n');

    // 5. Strip remaining HTML tags and decode entities
    const rawText = this.decodeHtmlEntities(this.stripTags(cleaned))
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      .trim();

    const words = rawText ? rawText.split(/\s+/).filter(Boolean).length : 0;

    return {
      title,
      rawText,
      headings,
      isScannedOrEmpty: rawText.length === 0,
      wordCount: words,
      charCount: rawText.length,
      metadata: {
        headingsFound: headings.length,
        parser: 'vanni-safe-html-parser',
      },
    };
  }

  private stripTags(html: string): string {
    return html.replace(/<[^>]*>/g, ' ');
  }

  private decodeHtmlEntities(str: string): string {
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }
}
