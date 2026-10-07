import {
  ISTTProvider,
  SpeechTranscript,
  STTOptions,
  ProviderError,
  ProviderErrorCode,
} from '@vanni/provider-sdk';

export interface MockSTTConfig {
  defaultTranscript?: string;
  simulatedLatencyMs?: number;
  failureErrorCode?: ProviderErrorCode;
}

export class MockSTTProvider implements ISTTProvider {
  public readonly providerName = 'mock-stt';
  private defaultTranscript: string;
  private latencyMs: number;
  private failureCode?: ProviderErrorCode;

  constructor(config: MockSTTConfig = {}) {
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_MOCK_PROVIDERS) {
      throw new Error('MockSTTProvider must NOT be instantiated in production environments');
    }
    this.defaultTranscript = config.defaultTranscript || 'ನನಗೆ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಬುಕ್ ಮಾಡಬೇಕು';
    this.latencyMs = config.simulatedLatencyMs || 10;
    this.failureCode = config.failureErrorCode;
  }

  simulateFailure(code?: ProviderErrorCode): void {
    this.failureCode = code;
  }

  simulateLatency(ms: number): void {
    this.latencyMs = ms;
  }

  setTranscript(text: string): void {
    this.defaultTranscript = text;
  }

  private async delay(): Promise<void> {
    if (this.latencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.latencyMs));
    }
  }

  async transcribe(audioBuffer: Buffer, options?: STTOptions): Promise<SpeechTranscript> {
    await this.delay();

    if (this.failureCode) {
      throw new ProviderError(this.failureCode, `Simulated STT failure: ${this.failureCode}`, {
        providerName: this.providerName,
        isRetryable: this.failureCode === 'PROVIDER_TIMEOUT',
      });
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return {
        text: '',
        confidence: 0,
        isFinal: true,
        languageCode: options?.languageCode || 'kn-IN',
        durationMs: 0,
      };
    }

    return {
      text: this.defaultTranscript,
      confidence: 0.98,
      isFinal: true,
      languageCode: options?.languageCode || 'kn-IN',
      durationMs: 2000,
    };
  }
}
