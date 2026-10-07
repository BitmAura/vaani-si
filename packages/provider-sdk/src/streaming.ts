export type StreamEventType = 'data' | 'partial' | 'final' | 'error' | 'done';

export interface StreamChunk<T> {
  type: StreamEventType;
  data?: T;
  isFinal: boolean;
  timestamp: number;
}

export interface LLMStreamChunk {
  deltaText: string;
  accumulatedText: string;
  isFinal: boolean;
  finishReason?: string;
}

export interface STTStreamChunk {
  transcript: string;
  isFinal: boolean;
  confidence?: number;
  wordTimestamps?: Array<{ word: string; startMs: number; endMs: number }>;
}

export interface TTSStreamChunk {
  audioChunk: Buffer | Uint8Array;
  chunkIndex: number;
  isFinal: boolean;
  sampleRate?: number;
}

/**
 * Common async iterator controller for streaming responses with cancellation
 */
export interface IStreamController {
  abort(): void;
  readonly isAborted: boolean;
}
