import { TranscriptEvent } from './streaming-stt-session.js';

export interface AccumulatorState {
  currentPartial: string;
  committedFinals: string[];
  fullTurnText: string;
  detectedLanguage: string;
  confidence: number;
}

/**
 * Intelligent Transcript Accumulator.
 * Deduplicates partial results, commits final segments, handles corrections,
 * and builds a single coherent user turn for the Conversation Orchestrator.
 */
export class TranscriptAccumulator {
  private committedFinals: string[] = [];
  private currentPartial = '';
  private detectedLanguage = 'kn-IN';
  private runningConfidence = 0.95;

  processEvent(event: TranscriptEvent): AccumulatorState {
    if (event.languageCode) {
      this.detectedLanguage = event.languageCode;
    }

    if (event.confidence !== undefined) {
      this.runningConfidence = event.confidence;
    }

    const cleanText = event.text.trim();
    if (!cleanText) {
      return this.getState();
    }

    if (event.type === 'FINAL' || event.isFinal) {
      // If final text already ends with or is contained in committed segments, avoid duplicate repetition
      const lastCommitted = this.committedFinals[this.committedFinals.length - 1];
      if (!lastCommitted || !lastCommitted.includes(cleanText)) {
        this.committedFinals.push(cleanText);
      }
      this.currentPartial = '';
    } else if (event.type === 'PARTIAL') {
      this.currentPartial = cleanText;
    } else if (event.type === 'CORRECTION') {
      // Replace last partial
      this.currentPartial = cleanText;
    }

    return this.getState();
  }

  getCommittedTurnText(): string {
    const parts = [...this.committedFinals];
    if (this.currentPartial && !parts.some((p) => p.includes(this.currentPartial))) {
      parts.push(this.currentPartial);
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  getState(): AccumulatorState {
    return {
      currentPartial: this.currentPartial,
      committedFinals: [...this.committedFinals],
      fullTurnText: this.getCommittedTurnText(),
      detectedLanguage: this.detectedLanguage,
      confidence: this.runningConfidence,
    };
  }

  reset(): void {
    this.committedFinals = [];
    this.currentPartial = '';
    this.runningConfidence = 0.95;
  }
}
