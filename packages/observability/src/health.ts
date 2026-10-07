/**
 * @vanni/observability — System Health, Readiness & Metrics Tracker
 */

export interface SystemHealthReport {
  status: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
  service: string;
  uptimeSeconds: number;
  timestamp: string;
  checks: {
    database: { status: 'UP' | 'DOWN'; latencyMs?: number };
    memory: { rssMb: number; heapUsedMb: number };
    providers?: Record<string, 'HEALTHY' | 'DEGRADED' | 'DOWN'>;
  };
}

export class MetricsCollector {
  private static counters = new Map<string, number>();
  private static gauges = new Map<string, number>();
  private static startEpoch = Date.now();

  static increment(metric: string, count: number = 1) {
    const current = this.counters.get(metric) || 0;
    this.counters.set(metric, current + count);
  }

  static setGauge(metric: string, value: number) {
    this.gauges.set(metric, value);
  }

  static getMetrics() {
    const mem = process.memoryUsage();
    return {
      uptimeSeconds: Math.floor((Date.now() - this.startEpoch) / 1000),
      memory: {
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      },
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
    };
  }

  static async getHealth(dbPing?: () => Promise<boolean>): Promise<SystemHealthReport> {
    const mem = process.memoryUsage();
    let dbStatus: 'UP' | 'DOWN' = 'UP';
    let dbLatency = 0;

    if (dbPing) {
      const t0 = Date.now();
      try {
        const ok = await dbPing();
        dbLatency = Date.now() - t0;
        dbStatus = ok ? 'UP' : 'DOWN';
      } catch {
        dbStatus = 'DOWN';
      }
    }

    const isHealthy = dbStatus === 'UP';

    return {
      status: isHealthy ? 'HEALTHY' : 'DEGRADED',
      service: 'VANNI Core Services',
      uptimeSeconds: Math.floor((Date.now() - this.startEpoch) / 1000),
      timestamp: new Date().toISOString(),
      checks: {
        database: { status: dbStatus, latencyMs: dbLatency },
        memory: {
          rssMb: Math.round(mem.rss / 1024 / 1024),
          heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        },
      },
    };
  }
}
