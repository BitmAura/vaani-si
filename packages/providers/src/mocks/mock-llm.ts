import {
  ILLMProvider,
  LLMMessage,
  LLMTurnResponse,
  LLMOptions,
  LLMToolCall,
  ProviderError,
  ProviderErrorCode,
} from '@vanni/provider-sdk';

export interface MockLLMConfig {
  defaultResponse?: string;
  simulatedLatencyMs?: number;
  failureErrorCode?: ProviderErrorCode;
}

export class MockLLMProvider implements ILLMProvider {
  public readonly providerName = 'mock-llm';
  private defaultResponse: string;
  private latencyMs: number;
  private failureCode?: ProviderErrorCode;

  constructor(config: MockLLMConfig = {}) {
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_MOCK_PROVIDERS) {
      throw new Error('MockLLMProvider must NOT be instantiated in production environments');
    }
    this.defaultResponse = config.defaultResponse || 'ನಮಸ್ಕಾರ, ನಾನು ವಾಣಿ ಸಹಾಯಕ. (Hello, I am Vanni assistant)';
    this.latencyMs = config.simulatedLatencyMs || 10;
    this.failureCode = config.failureErrorCode;
  }

  simulateFailure(code?: ProviderErrorCode): void {
    this.failureCode = code;
  }

  simulateLatency(ms: number): void {
    this.latencyMs = ms;
  }

  setResponse(text: string): void {
    this.defaultResponse = text;
  }

  private async delay(): Promise<void> {
    if (this.latencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.latencyMs));
    }
  }

  async generateTurn(
    systemPrompt: string,
    history: LLMMessage[],
    userUtterance: string,
    options?: LLMOptions
  ): Promise<LLMTurnResponse> {
    await this.delay();

    if (this.failureCode) {
      throw new ProviderError(this.failureCode, `Simulated LLM failure: ${this.failureCode}`, {
        providerName: this.providerName,
        isRetryable: this.failureCode === 'PROVIDER_TIMEOUT' || this.failureCode === 'PROVIDER_RATE_LIMITED',
      });
    }

    return {
      content: this.defaultResponse,
      totalDurationMs: this.latencyMs,
      timeToFirstTokenMs: 5,
      usage: {
        promptTokens: Math.ceil((systemPrompt.length + userUtterance.length) / 4),
        completionTokens: Math.ceil(this.defaultResponse.length / 4),
        totalTokens: Math.ceil((systemPrompt.length + userUtterance.length + this.defaultResponse.length) / 4),
      },
    };
  }

  async *streamTurn(
    systemPrompt: string,
    history: LLMMessage[],
    userUtterance: string,
    options?: LLMOptions
  ): AsyncIterable<{ textChunk?: string; toolCall?: LLMToolCall }> {
    await this.delay();

    if (this.failureCode) {
      throw new ProviderError(this.failureCode, `Simulated streaming failure: ${this.failureCode}`, {
        providerName: this.providerName,
      });
    }

    const words = this.defaultResponse.split(' ');
    for (const word of words) {
      yield { textChunk: word + ' ' };
      await new Promise((r) => setTimeout(r, 5));
    }
  }
}
