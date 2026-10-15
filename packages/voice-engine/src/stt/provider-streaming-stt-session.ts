import { ISTTProvider, STTOptions } from '@vanni/provider-sdk';
import { IStreamingSTTSession, TranscriptEvent } from './streaming-stt-session.js';

export interface ProviderStreamingSTTOptions {
  provider: ISTTProvider;
  options?: STTOptions;
  discreteBurstFlushIntervalMs?: number; // For non-streaming providers, flush audio bursts every X ms (default 800ms)
}

/**
 * Universal Streaming STT Session adapter.
 * If provider natively supports `.createStreamSession()`, it connects directly.
 * If provider is discrete (`.transcribe()`), it aggregates speech burst frames and emits partials/finals.
 */
export class ProviderStreamingSTTSession implements IStreamingSTTSession {
  private provider: ISTTProvider;
  private options: STTOptions;
  private transcriptCallbacks: ((event: TranscriptEvent) => void)[] = [];
  private errorCallbacks: ((error: Error) => void)[] = [];
  private isRunning = false;

  // Native stream session handle (if provider supports it)
  private nativeSession?: {
    write(chunk: Buffer): void;
    onTranscript(callback: (t: any) => void): void;
    onError(callback: (e: Error) => void): void;
    end(): Promise<void>;
  };

  // Burst fallback buffer (if provider does not support bidirectional streaming)
  private burstBuffer: Buffer[] = [];
  private burstIntervalId?: NodeJS.Timeout;
  private burstIntervalMs: number;
  private isProcessingBurst = false;

  constructor(opts: ProviderStreamingSTTOptions) {
    this.provider = opts.provider;
    this.options = opts.options || { languageCode: 'kn-IN', sampleRate: 16000, encoding: 'LINEAR16' };
    this.burstIntervalMs = opts.discreteBurstFlushIntervalMs || 800;
  }

  async start(): Promise<void> {
    this.isRunning = true;

    if (typeof this.provider.createStreamSession === 'function') {
      this.nativeSession = this.provider.createStreamSession(this.options);
      this.nativeSession.onTranscript((t) => {
        this.emitTranscript({
          type: t.isFinal ? 'FINAL' : 'PARTIAL',
          text: t.text,
          languageCode: t.languageCode || this.options.languageCode || 'kn-IN',
          confidence: t.confidence || 0.95,
          isFinal: t.isFinal,
        });
      });
      this.nativeSession.onError((err) => {
        this.emitError(err);
      });
    } else {
      // Periodic burst transcription loop
      this.burstIntervalId = setInterval(() => {
        this.flushBurstBuffer(false);
      }, this.burstIntervalMs);
    }
  }

  pushAudio(chunk: Buffer): void {
    if (!this.isRunning) return;

    if (this.nativeSession) {
      this.nativeSession.write(chunk);
    } else {
      this.burstBuffer.push(chunk);
    }
  }

  /**
   * Resets the active turn buffer (called on SPEECH_STOPPED or new turn)
   */
  public resetTurnBuffer(): void {
    this.burstBuffer = [];
  }

  private async flushBurstBuffer(isFinal = false): Promise<void> {
    if (this.burstBuffer.length === 0 || this.isProcessingBurst) return;

    // Splice out the chunks to process so we do not re-send audio from t=0
    // Any newly arriving chunks during transcription will collect for the next burst
    const chunksToProcess = this.burstBuffer.splice(0, this.burstBuffer.length);
    const audioToProcess = Buffer.concat(chunksToProcess);

    if (isFinal) {
      this.burstBuffer = [];
    }

    this.isProcessingBurst = true;
    try {
      const result = await this.provider.transcribe(audioToProcess, this.options);
      if (result.text && result.text.trim()) {
        this.emitTranscript({
          type: isFinal ? 'FINAL' : 'PARTIAL',
          text: result.text,
          languageCode: result.languageCode || this.options.languageCode || 'kn-IN',
          confidence: result.confidence || 0.95,
          isFinal,
        });
      }
    } catch (err: unknown) {
      this.emitError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      this.isProcessingBurst = false;
    }
  }

  onTranscript(callback: (event: TranscriptEvent) => void): void {
    this.transcriptCallbacks.push(callback);
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallbacks.push(callback);
  }

  private emitTranscript(event: TranscriptEvent): void {
    for (const cb of this.transcriptCallbacks) {
      cb(event);
    }
  }

  private emitError(error: Error): void {
    for (const cb of this.errorCallbacks) {
      cb(error);
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.burstIntervalId) {
      clearInterval(this.burstIntervalId);
    }

    if (this.nativeSession) {
      await this.nativeSession.end();
    } else {
      await this.flushBurstBuffer(true);
    }
  }

  cancel(): void {
    this.isRunning = false;
    if (this.burstIntervalId) {
      clearInterval(this.burstIntervalId);
    }
    this.burstBuffer = [];
    if (this.nativeSession) {
      this.nativeSession.end().catch(() => {});
    }
  }
}
