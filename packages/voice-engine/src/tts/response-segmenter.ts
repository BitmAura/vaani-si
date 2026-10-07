export interface ResponseSegmenterConfig {
  minWordsPerSegment?: number; // Minimum words before triggering segment emit (default 3)
  maxWaitMs?: number; // Maximum ms to hold partial buffer before forced emit
}

/**
 * Natural Speech Response Segmenter.
 * Buffers streamed tokens from LLM and identifies natural spoken sentence/clause boundaries:
 * - Sentence terminators: ., ?, !, ।, \n
 * - Natural pause clauses: ,, ;, :, - (when buffer has at least minWordsPerSegment)
 * Prevents word-by-word TTS choppiness while minimizing latency.
 */
export class ResponseSegmenter {
  private buffer = '';
  private minWords: number;

  constructor(config: ResponseSegmenterConfig = {}) {
    this.minWords = config.minWordsPerSegment || 3;
  }

  /**
   * Push incoming token delta from streaming LLM.
   * Returns complete sentence/clause segments ready for TTS synthesis, if any.
   */
  pushDelta(tokenDelta: string): string[] {
    this.buffer += tokenDelta;
    const readySegments: string[] = [];

    // Regex for strong sentence boundaries: . ? ! । or newline
    const strongBoundaryRegex = /([.?!।\n]+)(\s+|$)/;
    // Regex for pause boundary: , ; : - (only if word count >= minWords)
    const pauseBoundaryRegex = /([,;:\-—]+)(\s+)/;

    while (this.buffer.length > 0) {
      const strongMatch = strongBoundaryRegex.exec(this.buffer);
      if (strongMatch && strongMatch.index !== undefined) {
        const endIndex = strongMatch.index + strongMatch[1].length;
        const segment = this.buffer.substring(0, endIndex).trim();
        if (segment.length > 0) {
          readySegments.push(segment);
        }
        this.buffer = this.buffer.substring(endIndex + strongMatch[2].length);
        continue;
      }

      // Check pause boundaries if word count allows
      const words = this.buffer.trim().split(/\s+/);
      if (words.length >= this.minWords) {
        const pauseMatch = pauseBoundaryRegex.exec(this.buffer);
        if (pauseMatch && pauseMatch.index !== undefined) {
          const endIndex = pauseMatch.index + pauseMatch[1].length;
          const segment = this.buffer.substring(0, endIndex).trim();
          if (segment.length > 0) {
            readySegments.push(segment);
          }
          this.buffer = this.buffer.substring(endIndex + pauseMatch[2].length);
          continue;
        }
      }

      break;
    }

    return readySegments;
  }

  /**
   * Flush remaining text at the end of LLM response stream.
   */
  flush(): string | null {
    const remaining = this.buffer.trim();
    this.buffer = '';
    return remaining.length > 0 ? remaining : null;
  }

  reset(): void {
    this.buffer = '';
  }
}
