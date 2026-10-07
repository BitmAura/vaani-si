/**
 * @vanni/knowledge-engine — Safe Website Content Ingestor
 * Fetches website pages with full SSRF protection, redirect verification,
 * response size limits, and HTML text extraction.
 */

import { globalSsrfValidator } from './ssrf-validator.js';
import { HtmlParser } from '../parsers/html-parser.js';

export interface WebsiteIngestResult {
  success: boolean;
  url: string;
  finalUrl: string;
  title: string;
  content: string;
  headings: string[];
  wordCount: number;
  charCount: number;
  httpStatus: number;
  errorMessage?: string;
}

export class WebsiteIngestor {
  private htmlParser = new HtmlParser();
  private maxResponseSizeBytes = 2 * 1024 * 1024; // 2 MB limit
  private timeoutMs = 6000;

  async ingestUrl(targetUrl: string): Promise<WebsiteIngestResult> {
    // 1. Initial SSRF Pre-flight Validation
    const validation = await globalSsrfValidator.validateUrl(targetUrl);
    if (!validation.isSafe) {
      return {
        success: false,
        url: targetUrl,
        finalUrl: targetUrl,
        title: '',
        content: '',
        headings: [],
        wordCount: 0,
        charCount: 0,
        httpStatus: 400,
        errorMessage: `SSRF Security Block: ${validation.reason}`,
      };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'VANNI-Knowledge-Sync/1.0 (+https://vanni.ai/crawler)',
          'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9',
        },
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timer);

      // 2. Post-fetch Redirect SSRF Verification
      if (response.url && response.url !== targetUrl) {
        const redirectValidation = await globalSsrfValidator.validateUrl(response.url);
        if (!redirectValidation.isSafe) {
          return {
            success: false,
            url: targetUrl,
            finalUrl: response.url,
            title: '',
            content: '',
            headings: [],
            wordCount: 0,
            charCount: 0,
            httpStatus: 403,
            errorMessage: `SSRF Security Block on Redirect: Target redirected to disallowed destination (${redirectValidation.reason})`,
          };
        }
      }

      if (!response.ok) {
        return {
          success: false,
          url: targetUrl,
          finalUrl: response.url || targetUrl,
          title: '',
          content: '',
          headings: [],
          wordCount: 0,
          charCount: 0,
          httpStatus: response.status,
          errorMessage: `HTTP Error: Server returned status ${response.status} ${response.statusText}`,
        };
      }

      // 3. Content-Type Header Verification
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/xhtml+xml')) {
        return {
          success: false,
          url: targetUrl,
          finalUrl: response.url || targetUrl,
          title: '',
          content: '',
          headings: [],
          wordCount: 0,
          charCount: 0,
          httpStatus: 415,
          errorMessage: `Unsupported Content-Type '${contentType}'. Only text/html and text/plain web pages are supported.`,
        };
      }

      // 4. Response Size Bounded Read
      const rawText = await response.text();
      if (Buffer.byteLength(rawText, 'utf-8') > this.maxResponseSizeBytes) {
        return {
          success: false,
          url: targetUrl,
          finalUrl: response.url || targetUrl,
          title: '',
          content: '',
          headings: [],
          wordCount: 0,
          charCount: 0,
          httpStatus: 413,
          errorMessage: `Web page exceeds maximum allowed response size of 2 MB`,
        };
      }

      // 5. HTML Parsing & Sanitization
      const parseResult = await this.htmlParser.parse(rawText, { filename: targetUrl });

      return {
        success: true,
        url: targetUrl,
        finalUrl: response.url || targetUrl,
        title: parseResult.title,
        content: parseResult.rawText,
        headings: parseResult.headings || [],
        wordCount: parseResult.wordCount,
        charCount: parseResult.charCount,
        httpStatus: response.status,
      };
    } catch (err: any) {
      const isAbort = err.name === 'AbortError';
      return {
        success: false,
        url: targetUrl,
        finalUrl: targetUrl,
        title: '',
        content: '',
        headings: [],
        wordCount: 0,
        charCount: 0,
        httpStatus: isAbort ? 504 : 500,
        errorMessage: isAbort ? `Request timed out after ${this.timeoutMs}ms` : `Fetch failed: ${err.message}`,
      };
    }
  }
}

export const globalWebsiteIngestor = new WebsiteIngestor();
