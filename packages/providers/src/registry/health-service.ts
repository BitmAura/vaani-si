import { ProviderHealthResult, ProviderHealthStatus, IHealthCheckable } from '@vanni/provider-sdk';

export interface HealthCheckOptions {
  cacheTtlMs?: number;
  timeoutMs?: number;
}

interface CacheEntry {
  result: ProviderHealthResult;
  expiresAt: number;
}

export class ProviderHealthService {
  private cache = new Map<string, CacheEntry>();
  private readonly defaultTtlMs: number;

  constructor(options: HealthCheckOptions = {}) {
    this.defaultTtlMs = options.cacheTtlMs || 60000; // 60 seconds TTL default
  }

  async checkProvider(
    provider: { providerName: string } & Partial<IHealthCheckable>,
    category: ProviderHealthResult['category'],
    options: HealthCheckOptions = {}
  ): Promise<ProviderHealthResult> {
    const ttl = options.cacheTtlMs ?? this.defaultTtlMs;
    const now = Date.now();
    const cached = this.cache.get(provider.providerName);

    if (cached && cached.expiresAt > now) {
      return cached.result;
    }

    const startTime = Date.now();
    let status: ProviderHealthStatus = 'UNKNOWN';
    let errorMessage: string | undefined;

    if (typeof provider.healthCheck === 'function') {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 5000);
        const result = await provider.healthCheck(controller.signal);
        clearTimeout(timeout);
        this.cache.set(provider.providerName, { result, expiresAt: now + ttl });
        return result;
      } catch (err: unknown) {
        status = 'UNAVAILABLE';
        errorMessage = (err as Error)?.message || String(err);
      }
    } else {
      // Passive check: Provider instantiated cleanly
      status = 'HEALTHY';
    }

    const latencyMs = Date.now() - startTime;
    const result: ProviderHealthResult = {
      providerName: provider.providerName,
      category,
      status,
      latencyMs,
      checkedAt: new Date().toISOString(),
      errorMessage,
    };

    this.cache.set(provider.providerName, { result, expiresAt: now + ttl });
    return result;
  }

  clearCache(providerName?: string): void {
    if (providerName) {
      this.cache.delete(providerName);
    } else {
      this.cache.clear();
    }
  }
}
