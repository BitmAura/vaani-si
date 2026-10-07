/**
 * VANNI Provider SDK — Text-to-Speech (TTS) Abstraction Contract
 */

export interface AudioPayload {
  audioBuffer: Buffer;
  audioBase64: string;
  sampleRate: number;
  durationMs: number;
  format: 'wav' | 'pcm' | 'mp3';
}

export interface TTSOptions {
  speaker?: string; // e.g. 'meera', 'pavithra', 'mahesh'
  targetLanguageCode?: 'kn-IN' | 'te-IN' | 'hi-IN' | 'ta-IN' | 'en-IN';
  sampleRate?: 8000 | 16000 | 22050; // 8000 for PSTN cellular, 16000 for Web
  pace?: number; // 0.8 to 1.4 (default 1.05)
  pitch?: number;
  loudness?: number;
  model?: string;
}

export interface ITTSProvider {
  readonly providerName: string;

  /**
   * Synthesize full sentence or phrase into audio
   */
  synthesize(text: string, options?: TTSOptions): Promise<AudioPayload>;

  /**
   * Stream audio chunks as text tokens arrive from LLM
   */
  createStreamSession?(options?: TTSOptions): {
    pushTextChunk(textChunk: string): void;
    onAudioChunk(callback: (chunk: Buffer) => void): void;
    finish(): Promise<void>;
  };
}
