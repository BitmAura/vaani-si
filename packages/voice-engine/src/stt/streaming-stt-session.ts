export type TranscriptEventType =
  | 'PARTIAL'
  | 'FINAL'
  | 'CORRECTION'
  | 'LANGUAGE_DETECTED'
  | 'ERROR';

export interface TranscriptEvent {
  type: TranscriptEventType;
  text: string;
  normalizedText?: string;
  languageCode: string;
  confidence: number;
  isFinal: boolean;
  startTimeMs?: number;
  endTimeMs?: number;
  speaker?: string;
  error?: Error;
}

export interface IStreamingSTTSession {
  start(): Promise<void>;
  pushAudio(chunk: Buffer): void;
  onTranscript(callback: (event: TranscriptEvent) => void): void;
  onError(callback: (error: Error) => void): void;
  stop(): Promise<void>;
  cancel(): void;
  resetTurnBuffer?(): void;
}
