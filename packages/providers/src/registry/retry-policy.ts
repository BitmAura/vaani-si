import { ProviderError, ProviderErrorCode } from '@vanni/provider-sdk';

export interface RetryPolicy {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  retryableErrorCodes?: ProviderErrorCode[];
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  backoffFactor: 2,
  retryableErrorCodes: ['PROVIDER_TIMEOUT', 'PROVIDER_RATE_LIMITED', 'PROVIDER_UNAVAILABLE'],
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new Error('Operation aborted during retry backoff'));
    }

    const timer = setTimeout(() => {
      resolve();
    }, ms);

    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new Error('Operation aborted during retry backoff'));
    }, { once: true });
  });
}

/**
 * Execute an operation with exponential backoff retry.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  policy: Partial<RetryPolicy> = {},
  signal?: AbortSignal
): Promise<T> {
  const finalPolicy: RetryPolicy = { ...DEFAULT_RETRY_POLICY, ...policy };
  let attempt = 0;
  let delay = finalPolicy.initialDelayMs;

  while (true) {
    attempt++;
    try {
      if (signal?.aborted) {
        throw new Error('Operation aborted before execution');
      }
      return await operation();
    } catch (err: unknown) {
      const isRetryable =
        err instanceof ProviderError
          ? err.isRetryable || (finalPolicy.retryableErrorCodes?.includes(err.code) ?? false)
          : false;

      if (!isRetryable || attempt > finalPolicy.maxRetries) {
        throw err;
      }

      // Check if provider sent a Retry-After header hint
      const customDelay = err instanceof ProviderError && err.retryAfterMs ? err.retryAfterMs : delay;
      const actualDelay = Math.min(customDelay, finalPolicy.maxDelayMs);

      // Add small jitter (±15%)
      const jitter = actualDelay * (0.85 + Math.random() * 0.3);
      await sleep(jitter, signal);

      delay = Math.min(delay * finalPolicy.backoffFactor, finalPolicy.maxDelayMs);
    }
  }
}
