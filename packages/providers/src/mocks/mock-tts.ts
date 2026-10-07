import {
  ITTSProvider,
  AudioPayload,
  TTSOptions,
  ProviderError,
  ProviderErrorCode,
} from '@vanni/provider-sdk';

export interface MockTTSConfig {
  simulatedLatencyMs?: number;
  failureErrorCode?: ProviderErrorCode;
}

export class MockTTSProvider implements ITTSProvider {
  public readonly providerName = 'mock-tts';
  private latencyMs: number;
  private failureCode?: ProviderErrorCode;

  constructor(config: MockTTSConfig = {}) {
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_MOCK_PROVIDERS) {
      throw new Error('MockTTSProvider must NOT be instantiated in production environments');
    }
    this.latencyMs = config.simulatedLatencyMs || 10;
    this.failureCode = config.failureErrorCode;
  }

  simulateFailure(code?: ProviderErrorCode): void {
    this.failureCode = code;
  }

  simulateLatency(ms: number): void {
    this.latencyMs = ms;
  }

  private async delay(): Promise<void> {
    if (this.latencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.latencyMs));
    }
  }

  async synthesize(text: string, options?: TTSOptions): Promise<AudioPayload> {
    await this.delay();

    if (this.failureCode) {
      throw new ProviderError(this.failureCode, `Simulated TTS failure: ${this.failureCode}`, {
        providerName: this.providerName,
        isRetryable: this.failureCode === 'PROVIDER_TIMEOUT',
      });
    }

    if (!text || text.trim() === '') {
      throw new ProviderError('INVALID_REQUEST', 'Cannot synthesize empty text', {
        providerName: this.providerName,
        isRetryable: false,
      });
    }

    const dummyAudio = Buffer.alloc(100, 0x7f);

    return {
      audioBuffer: dummyAudio,
      audioBase64: dummyAudio.toString('base64'),
      format: 'wav',
      sampleRate: options?.sampleRate || 16000,
      durationMs: Math.max(500, text.length * 50),
    };
  }
}
