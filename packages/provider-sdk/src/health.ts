export type ProviderHealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'UNKNOWN';

export interface ProviderHealthResult {
  providerName: string;
  category: 'llm' | 'stt' | 'tts' | 'telephony' | 'messaging' | 'embeddings' | 'calendar' | 'crm';
  status: ProviderHealthStatus;
  latencyMs: number;
  checkedAt: string; // ISO string
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Optional interface for providers to support active self-checks without performing heavy operations.
 */
export interface IHealthCheckable {
  healthCheck(signal?: AbortSignal): Promise<ProviderHealthResult>;
}
