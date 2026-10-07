import {
  IEmbeddingProvider,
  EmbeddingRequest,
  BatchEmbeddingRequest,
  EmbeddingResult,
  BatchEmbeddingResult,
  ProviderError,
} from '@vanni/provider-sdk';

export interface GoogleEmbeddingConfig {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

export class GoogleEmbeddingProvider implements IEmbeddingProvider {
  public readonly providerName = 'google-embedding';
  public readonly modelName: string;
  public readonly dimensions = 768;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(config: GoogleEmbeddingConfig = {}) {
    this.apiKey = config.apiKey || process.env.GEMINI_API_KEY || '';
    this.modelName = config.model || 'text-embedding-004';
    this.timeoutMs = config.timeoutMs || 10000;
  }

  async embedText(request: EmbeddingRequest, signal?: AbortSignal): Promise<EmbeddingResult> {
    if (!this.apiKey) {
      throw new ProviderError('PROVIDER_AUTH_ERROR', 'Google API key is missing (set GEMINI_API_KEY)', {
        providerName: this.providerName,
        isRetryable: false,
      });
    }

    const text = request.text;
    if (!text || text.trim() === '') {
      throw new ProviderError('INVALID_REQUEST', 'Cannot generate embedding for empty text', {
        providerName: this.providerName,
        isRetryable: false,
      });
    }

    const startTime = Date.now();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:embedContent?key=${this.apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    if (signal) {
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${this.modelName}`,
          content: { parts: [{ text }] },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        const statusCode = response.status;
        const isRateLimited = statusCode === 429;
        const isAuth = statusCode === 401 || statusCode === 403;

        throw new ProviderError(
          isRateLimited ? 'PROVIDER_RATE_LIMITED' : isAuth ? 'PROVIDER_AUTH_ERROR' : 'PROVIDER_UNAVAILABLE',
          `Google embedding failed with status ${statusCode}: ${errorText}`,
          {
            providerName: this.providerName,
            statusCode,
            rawResponse: errorText,
            isRetryable: isRateLimited || statusCode >= 500,
          }
        );
      }

      const data = (await response.json()) as {
        embedding?: { values?: number[] };
      };

      const values = data.embedding?.values || [];
      const latencyMs = Date.now() - startTime;

      return {
        embedding: {
          values,
          dimensions: values.length || this.dimensions,
          model: this.modelName,
          provider: this.providerName,
        },
        usage: {
          inputTokens: Math.ceil(text.length / 4),
          totalTokens: Math.ceil(text.length / 4),
        },
        latencyMs,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof ProviderError) throw err;

      const isAbort = (err as Error)?.name === 'AbortError';
      throw new ProviderError(
        isAbort ? 'PROVIDER_TIMEOUT' : 'UNKNOWN_PROVIDER_ERROR',
        `Google embedding error: ${(err as Error)?.message || String(err)}`,
        {
          providerName: this.providerName,
          underlyingError: err,
          isRetryable: isAbort,
        }
      );
    }
  }

  async embedBatch(request: BatchEmbeddingRequest, signal?: AbortSignal): Promise<BatchEmbeddingResult> {
    if (!this.apiKey) {
      throw new ProviderError('PROVIDER_AUTH_ERROR', 'Google API key is missing (set GEMINI_API_KEY)', {
        providerName: this.providerName,
        isRetryable: false,
      });
    }

    const texts = request.texts;
    if (!texts || texts.length === 0) {
      return { embeddings: [], latencyMs: 0 };
    }

    const startTime = Date.now();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:batchEmbedContents?key=${this.apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs * 2);

    if (signal) {
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      const requests = texts.map((text) => ({
        model: `models/${this.modelName}`,
        content: { parts: [{ text }] },
      }));

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        const statusCode = response.status;
        throw new ProviderError(
          statusCode === 429 ? 'PROVIDER_RATE_LIMITED' : 'PROVIDER_UNAVAILABLE',
          `Google batch embedding failed: ${errorText}`,
          {
            providerName: this.providerName,
            statusCode,
            rawResponse: errorText,
            isRetryable: statusCode === 429 || statusCode >= 500,
          }
        );
      }

      const data = (await response.json()) as {
        embeddings?: Array<{ values?: number[] }>;
      };

      const embeddings = (data.embeddings || []).map((e) => ({
        values: e.values || [],
        dimensions: e.values?.length || this.dimensions,
        model: this.modelName,
        provider: this.providerName,
      }));

      const totalTokens = texts.reduce((acc, t) => acc + Math.ceil(t.length / 4), 0);
      const latencyMs = Date.now() - startTime;

      return {
        embeddings,
        usage: {
          inputTokens: totalTokens,
          totalTokens,
        },
        latencyMs,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof ProviderError) throw err;

      const isAbort = (err as Error)?.name === 'AbortError';
      throw new ProviderError(
        isAbort ? 'PROVIDER_TIMEOUT' : 'UNKNOWN_PROVIDER_ERROR',
        `Google batch embedding error: ${(err as Error)?.message || String(err)}`,
        {
          providerName: this.providerName,
          underlyingError: err,
          isRetryable: isAbort,
        }
      );
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const result = await this.embedText({ text: 'health check' });
      return result.embedding.values.length > 0;
    } catch {
      return false;
    }
  }
}
