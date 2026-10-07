import {
  IEmbeddingProvider,
  EmbeddingRequest,
  BatchEmbeddingRequest,
  EmbeddingResult,
  BatchEmbeddingResult,
  ProviderError,
  ProviderErrorCode,
} from '@vanni/provider-sdk';

export interface MockEmbeddingConfig {
  dimensions?: number;
  simulatedLatencyMs?: number;
  failureErrorCode?: ProviderErrorCode;
}

export class MockEmbeddingProvider implements IEmbeddingProvider {
  public readonly providerName = 'mock-embedding';
  public readonly modelName = 'mock-embedding-v1';
  public readonly dimensions: number;
  private latencyMs: number;
  private failureCode?: ProviderErrorCode;

  constructor(config: MockEmbeddingConfig = {}) {
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_MOCK_PROVIDERS) {
      throw new Error('MockEmbeddingProvider must NOT be instantiated in production environments');
    }
    this.dimensions = config.dimensions || 768;
    this.latencyMs = config.simulatedLatencyMs || 10;
    this.failureCode = config.failureErrorCode;
  }

  simulateFailure(code?: ProviderErrorCode): void {
    this.failureCode = code;
  }

  private async delay(): Promise<void> {
    if (this.latencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.latencyMs));
    }
  }

  private generateDeterministicVector(text: string): number[] {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }

    const vector = new Array(this.dimensions);
    for (let i = 0; i < this.dimensions; i++) {
      vector[i] = Math.sin(hash + i);
    }
    return vector;
  }

  async embedText(request: EmbeddingRequest, signal?: AbortSignal): Promise<EmbeddingResult> {
    await this.delay();

    if (this.failureCode) {
      throw new ProviderError(this.failureCode, `Simulated Embedding failure: ${this.failureCode}`, {
        providerName: this.providerName,
        isRetryable: this.failureCode === 'PROVIDER_TIMEOUT',
      });
    }

    const vector = this.generateDeterministicVector(request.text);
    return {
      embedding: {
        values: vector,
        dimensions: this.dimensions,
        model: this.modelName,
        provider: this.providerName,
      },
      usage: {
        inputTokens: Math.ceil(request.text.length / 4),
        totalTokens: Math.ceil(request.text.length / 4),
      },
      latencyMs: this.latencyMs,
    };
  }

  async embedBatch(request: BatchEmbeddingRequest, signal?: AbortSignal): Promise<BatchEmbeddingResult> {
    await this.delay();

    if (this.failureCode) {
      throw new ProviderError(this.failureCode, `Simulated Embedding failure: ${this.failureCode}`, {
        providerName: this.providerName,
        isRetryable: this.failureCode === 'PROVIDER_TIMEOUT',
      });
    }

    const embeddings = request.texts.map((t) => ({
      values: this.generateDeterministicVector(t),
      dimensions: this.dimensions,
      model: this.modelName,
      provider: this.providerName,
    }));

    const totalTokens = request.texts.reduce((acc, t) => acc + Math.ceil(t.length / 4), 0);

    return {
      embeddings,
      usage: {
        inputTokens: totalTokens,
        totalTokens,
      },
      latencyMs: this.latencyMs,
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
