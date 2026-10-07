/**
 * Normalized Provider Error Codes
 */
export type ProviderErrorCode =
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_RATE_LIMITED'
  | 'PROVIDER_AUTH_ERROR'
  | 'PROVIDER_UNAVAILABLE'
  | 'INVALID_REQUEST'
  | 'UNSUPPORTED_LANGUAGE'
  | 'UNSUPPORTED_OPERATION'
  | 'AUDIO_FORMAT_ERROR'
  | 'CIRCUIT_OPEN'
  | 'UNKNOWN_PROVIDER_ERROR';

export interface ProviderErrorDetails {
  providerName: string;
  statusCode?: number;
  rawResponse?: string;
  isRetryable?: boolean;
  retryAfterMs?: number;
  underlyingError?: unknown;
}

/**
 * Standardized error thrown across all VANNI Provider Adapters.
 * Core engines can catch and switch on `code` or `isRetryable` safely.
 */
export class ProviderError extends Error {
  public readonly code: ProviderErrorCode;
  public readonly providerName: string;
  public readonly statusCode?: number;
  public readonly rawResponse?: string;
  public readonly isRetryable: boolean;
  public readonly retryAfterMs?: number;
  public readonly underlyingError?: unknown;

  constructor(
    code: ProviderErrorCode,
    message: string,
    details: ProviderErrorDetails
  ) {
    super(`[${details.providerName}] ${code}: ${message}`);
    this.name = 'ProviderError';
    this.code = code;
    this.providerName = details.providerName;
    this.statusCode = details.statusCode;
    this.rawResponse = details.rawResponse;
    this.retryAfterMs = details.retryAfterMs;
    this.underlyingError = details.underlyingError;

    if (details.isRetryable !== undefined) {
      this.isRetryable = details.isRetryable;
    } else {
      this.isRetryable = (
        code === 'PROVIDER_TIMEOUT' ||
        code === 'PROVIDER_RATE_LIMITED' ||
        code === 'PROVIDER_UNAVAILABLE'
      );
    }

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ProviderError);
    }
  }
}
