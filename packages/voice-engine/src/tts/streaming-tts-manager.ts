import { ITTSProvider, TTSOptions, AudioPayload } from '@vanni/provider-sdk';
import { VoiceTextPreparation } from '@vanni/conversation-engine';

export interface TTSStreamItem {
  segmentIndex: number;
  text: string;
  audioPayload: AudioPayload;
}

/**
 * Universal Streaming TTS Manager.
 * Uses VoiceTextPreparation for Kannada numbers/currency/time formatting,
 * then dispatches segments to the ITTSProvider.
 * Fully cancellable via AbortController on barge-in.
 */
export class StreamingTTSManager {
  private provider: ITTSProvider;
  private voicePrep = new VoiceTextPreparation();
  private abortController: AbortController | null = null;
  private isCancelled = false;

  constructor(provider: ITTSProvider) {
    this.provider = provider;
  }

  /**
   * Synthesizes a list of text segments as they arrive, yielding audio payloads in sequence.
   */
  async *synthesizeSegments(
    segments: string[],
    options: TTSOptions = {},
    languageMode: 'kn' | 'en' | 'kn-en' = 'kn-en'
  ): AsyncIterable<TTSStreamItem> {
    this.isCancelled = false;
    this.abortController = new AbortController();

    let segmentIndex = 0;
    for (const rawSegment of segments) {
      if (this.isCancelled) break;

      // 1. Language preparation: Expand ₹, Dr., PM/AM, OPD, BHK
      const prepped = this.voicePrep.prepareSpeechText(rawSegment, languageMode);
      const textToSpeak = languageMode === 'en' ? prepped.spokenTextEnglish : prepped.spokenTextKannada;

      if (!textToSpeak.trim()) continue;

      try {
        const payload = await this.provider.synthesize(textToSpeak, {
          targetLanguageCode: languageMode === 'en' ? 'en-IN' : 'kn-IN',
          sampleRate: options.sampleRate || 16000,
          ...options,
        });

        if (this.isCancelled) break;

        yield {
          segmentIndex: segmentIndex++,
          text: textToSpeak,
          audioPayload: payload,
        };
      } catch (err: unknown) {
        if (this.isCancelled) break;
        throw err;
      }
    }
  }

  cancel(): void {
    this.isCancelled = true;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}
