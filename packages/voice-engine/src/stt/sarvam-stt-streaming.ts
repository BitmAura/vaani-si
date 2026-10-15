/**
 * Sarvam Saaras v3 Streaming STT WebSocket Session
 * 
 * Provides real-time bidirectional streaming speech-to-text with partial hypotheses,
 * turn buffer management, silence flush, and instant barge-in reset.
 */

import WebSocket from 'ws';
import { IStreamingSTTSession, TranscriptEvent } from './streaming-stt-session.js';

export interface SarvamStreamingOptions {
  languageCode?: string;
  sampleRate?: number;
  encoding?: string;
  highFidelity?: boolean;
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (err: Error) => void;
  onClose?: () => void;
}

export class SarvamSTTStreamingSession implements IStreamingSTTSession {
  private apiKey: string;
  private endpointUrl: string;
  private ws: WebSocket | null = null;
  private options: SarvamStreamingOptions = {};
  private currentTranscript = '';
  private isTurnFlushing = false;
  private flushResolver: ((transcript: string) => void) | null = null;
  private transcriptCallbacks: ((event: TranscriptEvent) => void)[] = [];
  private errorCallbacks: ((error: Error) => void)[] = [];

  constructor(
    apiKey?: string,
    endpointUrl: string = 'wss://api.sarvam.ai/streaming/stt'
  ) {
    this.apiKey = apiKey || process.env.SARVAM_API_KEY || '';
    this.endpointUrl = endpointUrl;
  }

  public async connect(options?: SarvamStreamingOptions): Promise<void> {
    this.options = {
      languageCode: 'kn-IN',
      sampleRate: 16000,
      encoding: 'LINEAR16',
      ...options,
    };

    return new Promise<void>((resolve, reject) => {
      try {
        const headers: Record<string, string> = {};
        if (this.apiKey) {
          headers['api-subscription-key'] = this.apiKey;
        }

        this.ws = new WebSocket(this.endpointUrl, { headers });

        this.ws.on('open', () => {
          // Send initial configuration handshake
          const configPayload = {
            type: 'config',
            language_code: this.options.languageCode || 'kn-IN',
            sample_rate: this.options.sampleRate || 16000,
            encoding: this.options.encoding || 'LINEAR16',
            high_fidelity: this.options.highFidelity ?? true,
          };
          this.ws?.send(JSON.stringify(configPayload));
          resolve();
        });

        this.ws.on('message', (data: WebSocket.RawData) => {
          this.handleIncomingMessage(data);
        });

        this.ws.on('error', (err: Error) => {
          this.emitError(err);
          if (this.options.onError) {
            this.options.onError(err);
          }
        });

        this.ws.on('close', () => {
          if (this.options.onClose) {
            this.options.onClose();
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  public async start(): Promise<void> {
    if (!this.ws || this.ws.readyState !== 1) {
      await this.connect(this.options);
    }
  }

  public sendAudioChunk(chunk: Buffer): void {
    if (!this.ws || this.ws.readyState !== 1) {
      return;
    }

    const payload = JSON.stringify({
      type: 'audio',
      data: chunk.toString('base64'),
    });
    this.ws.send(payload);
  }

  public pushAudio(chunk: Buffer): void {
    this.sendAudioChunk(chunk);
  }

  public async flushTurn(timeoutMs = 1500): Promise<string> {
    if (!this.ws || this.ws.readyState !== 1) {
      return this.currentTranscript;
    }

    this.isTurnFlushing = true;
    this.ws.send(JSON.stringify({ type: 'flush' }));

    return new Promise<string>((resolve) => {
      const timer = setTimeout(() => {
        this.isTurnFlushing = false;
        this.flushResolver = null;
        resolve(this.currentTranscript);
      }, timeoutMs);

      this.flushResolver = (finalText: string) => {
        clearTimeout(timer);
        this.isTurnFlushing = false;
        this.flushResolver = null;
        resolve(finalText);
      };
    });
  }

  public resetTurnBuffer(): void {
    this.currentTranscript = '';
    this.isTurnFlushing = false;
    this.flushResolver = null;
  }

  public getCurrentTranscript(): string {
    return this.currentTranscript;
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === 1;
  }

  public onTranscript(callback: (event: TranscriptEvent) => void): void {
    this.transcriptCallbacks.push(callback);
  }

  public onError(callback: (error: Error) => void): void {
    this.errorCallbacks.push(callback);
  }

  public async stop(): Promise<void> {
    await this.flushTurn();
    this.close();
  }

  public cancel(): void {
    this.resetTurnBuffer();
    this.close();
  }

  public close(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }

  private handleIncomingMessage(rawData: WebSocket.RawData): void {
    try {
      const msg = JSON.parse(rawData.toString());
      const type = msg.type || (msg.is_final ? 'final' : 'partial');
      const text = msg.transcript || msg.text || '';

      if (type === 'partial') {
        this.currentTranscript = text;
        if (this.options.onPartial) {
          this.options.onPartial(text);
        }
        this.emitTranscript({
          type: 'PARTIAL',
          text,
          languageCode: msg.language_code || this.options.languageCode || 'kn-IN',
          confidence: msg.confidence || 0.9,
          isFinal: false,
        });
      } else if (type === 'final') {
        this.currentTranscript = text;
        if (this.options.onFinal) {
          this.options.onFinal(text);
        }
        this.emitTranscript({
          type: 'FINAL',
          text,
          languageCode: msg.language_code || this.options.languageCode || 'kn-IN',
          confidence: msg.confidence || 0.98,
          isFinal: true,
        });

        if (this.flushResolver) {
          this.flushResolver(text);
        }
      }
    } catch (err) {
      this.emitError(err as Error);
    }
  }

  private emitTranscript(event: TranscriptEvent): void {
    for (const cb of this.transcriptCallbacks) {
      try {
        cb(event);
      } catch {
        // preserve loop
      }
    }
  }

  private emitError(err: Error): void {
    for (const cb of this.errorCallbacks) {
      try {
        cb(err);
      } catch {
        // preserve loop
      }
    }
  }
}
