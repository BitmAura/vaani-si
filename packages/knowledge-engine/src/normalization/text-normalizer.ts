/**
 * @vanni/knowledge-engine — Text Normalization & Multilingual Unicode Preserver
 * Cleans excessive whitespace, normalizes line breaks, and strictly preserves authentic
 * Kannada script (U+0C80 to U+0CFF) and Kanglish phonetic expressions without transliteration.
 */

export class TextNormalizer {
  /**
   * Normalizes document text without corrupting Kannada Unicode glyphs
   */
  normalize(rawText: string): string {
    if (!rawText) return '';

    return rawText
      // 1. Normalize line endings (\r\n -> \n)
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // 2. Remove non-printable control characters, but preserve tabs, newlines, and Kannada Unicode
      // Kannada Unicode block: \u0C80-\u0CFF
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // 3. Normalize horizontal whitespace
      .replace(/[ \t]+/g, ' ')
      // 4. Clean line-trailing whitespace
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      // 5. Collapse excessive vertical blank lines (>2 blank lines -> 1 blank line)
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Detects whether text is primarily English, Kannada, or Mixed Kanglish
   */
  detectLanguage(text: string): 'EN' | 'KN' | 'KANGLISH' {
    if (!text) return 'EN';

    const kannadaMatches = text.match(/[\u0C80-\u0CFF]/g);
    const kannadaCount = kannadaMatches ? kannadaMatches.length : 0;
    const totalChars = text.replace(/\s+/g, '').length;

    if (totalChars === 0) return 'EN';

    const kannadaRatio = kannadaCount / totalChars;

    if (kannadaRatio > 0.40) {
      return 'KN';
    } else if (kannadaRatio > 0.05) {
      return 'KANGLISH';
    }

    // Check for common Kanglish phonetic markers
    const kanglishPattern = /\b(namaskara|hegiddira|banni|siguththe|beku|illa|haudu|madona|aguththe|thumba|dhanyavadagalu|swalpa)\b/i;
    if (kanglishPattern.test(text)) {
      return 'KANGLISH';
    }

    return 'EN';
  }
}

export const globalTextNormalizer = new TextNormalizer();
