/**
 * Real-Time Latency Dashboard & Monitoring
 * Tracks the 750ms invariant and provides sub-component metrics
 */

export interface LatencyMetrics {
  timestamp: string;
  vadLatency: number;
  sttLatency: number;
  llmLatency: number;
  ttsLatency: number;
  totalLatency: number;
  meetsInvariant: boolean;
  metadata?: {
    callSessionId?: string;
    tenantId?: string;
    dialect?: string;
  };
}

export interface LatencyAlert {
  id: string;
  timestamp: string;
  type: 'INVARIANT_VIOLATION' | 'HIGH_LATENCY' | 'COMPONENT_TIMEOUT';
  message: string;
  metrics: LatencyMetrics;
  acknowledged: boolean;
}

export class LatencyMonitor {
  private metrics: LatencyMetrics[] = [];
  private alerts: LatencyAlert[] = [];
  private readonly MAX_SAMPLES = 10000;
  private readonly INVARIANT_THRESHOLD_MS = 750;

  /**
   * Record a latency measurement
   */
  recordLatency(metrics: Omit<LatencyMetrics, 'timestamp' | 'meetsInvariant'>): void {
    const entry: LatencyMetrics = {
      ...metrics,
      timestamp: new Date().toISOString(),
      meetsInvariant: metrics.totalLatency <= this.INVARIANT_THRESHOLD_MS,
    };

    this.metrics.push(entry);

    // Trim old metrics
    if (this.metrics.length > this.MAX_SAMPLES) {
      this.metrics.shift();
    }

    // Check invariant violation
    if (!entry.meetsInvariant) {
      this.createAlert({
        type: 'INVARIANT_VIOLATION',
        message: `Total latency ${metrics.totalLatency}ms exceeds 750ms invariant`,
        metrics: entry,
      });
    }
  }

  /**
   * Create a latency alert
   */
  private createAlert(input: {
    type: LatencyAlert['type'];
    message: string;
    metrics: LatencyMetrics;
  }): void {
    const alert: LatencyAlert = {
      id: `alert_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: input.type,
      message: input.message,
      metrics: input.metrics,
      acknowledged: false,
    };

    this.alerts.unshift(alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.pop();
    }

    // In production, send to alerting system (Slack, PagerDuty, etc.)
    this.notifyAlert(alert);
  }

  /**
   * Send alert notification
   */
  private notifyAlert(alert: LatencyAlert): void {
    console.error(`[LATENCY ALERT] ${alert.type}: ${alert.message}`);
    // Integration point for Slack webhook, PagerDuty, etc.
  }

  /**
   * Get average latency over time window
   */
  getAverageLatency(windowMinutes: number = 5): {
    avgTotal: number;
    avgVAD: number;
    avgSTT: number;
    avgLLM: number;
    avgTTS: number;
    p95Total: number;
    samples: number;
  } {
    const cutoff = Date.now() - windowMinutes * 60 * 1000;
    const recentMetrics = this.metrics.filter(
      m => new Date(m.timestamp).getTime() > cutoff
    );

    if (recentMetrics.length === 0) {
      return {
        avgTotal: 0,
        avgVAD: 0,
        avgSTT: 0,
        avgLLM: 0,
        avgTTS: 0,
        p95Total: 0,
        samples: 0,
      };
    }

    const totals = recentMetrics.map(m => m.totalLatency).sort((a, b) => a - b);
    const p95Index = Math.floor(totals.length * 0.95);

    return {
      avgTotal: totals.reduce((a, b) => a + b, 0) / totals.length,
      avgVAD: this.average(recentMetrics.map(m => m.vadLatency)),
      avgSTT: this.average(recentMetrics.map(m => m.sttLatency)),
      avgLLM: this.average(recentMetrics.map(m => m.llmLatency)),
      avgTTS: this.average(recentMetrics.map(m => m.ttsLatency)),
      p95Total: totals[p95Index] || 0,
      samples: recentMetrics.length,
    };
  }

  /**
   * Get invariant compliance rate
   */
  getInvariantCompliance(windowMinutes: number = 5): {
    compliant: number;
    violations: number;
    complianceRate: number;
  } {
    const cutoff = Date.now() - windowMinutes * 60 * 1000;
    const recentMetrics = this.metrics.filter(
      m => new Date(m.timestamp).getTime() > cutoff
    );

    const compliant = recentMetrics.filter(m => m.meetsInvariant).length;
    const violations = recentMetrics.length - compliant;
    const complianceRate = recentMetrics.length > 0 
      ? (compliant / recentMetrics.length) * 100 
      : 100;

    return {
      compliant,
      violations,
      complianceRate,
    };
  }

  /**
   * Get unacknowledged alerts
   */
  getUnacknowledgedAlerts(): LatencyAlert[] {
    return this.alerts.filter(a => !a.acknowledged);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  /**
   * Get dashboard data for UI
   */
  getDashboardData(): {
    current: LatencyMetrics | null;
    averages: ReturnType<LatencyMonitor['getAverageLatency']>;
    compliance: ReturnType<LatencyMonitor['getInvariantCompliance']>;
    recentAlerts: LatencyAlert[];
  } {
    return {
      current: this.metrics[this.metrics.length - 1] || null,
      averages: this.getAverageLatency(5),
      compliance: this.getInvariantCompliance(5),
      recentAlerts: this.alerts.slice(0, 10),
    };
  }

  /**
   * Helper: calculate average
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Export metrics for external monitoring (Prometheus, etc.)
   */
  exportPrometheusMetrics(): string {
    const avg = this.getAverageLatency(1);
    const compliance = this.getInvariantCompliance(1);

    return `
# HELP voice_latency_total_ms Total voice pipeline latency
# TYPE voice_latency_total_ms gauge
voice_latency_total_ms{quantile="avg"} ${avg.avgTotal}
voice_latency_total_ms{quantile="p95"} ${avg.p95Total}

# HELP voice_latency_vad_ms Voice Activity Detection latency
# TYPE voice_latency_vad_ms gauge
voice_latency_vad_ms ${avg.avgVAD}

# HELP voice_latency_stt_ms Speech-to-Text latency
# TYPE voice_latency_stt_ms gauge
voice_latency_stt_ms ${avg.avgSTT}

# HELP voice_latency_llm_ms LLM response latency
# TYPE voice_latency_llm_ms gauge
voice_latency_llm_ms ${avg.avgLLM}

# HELP voice_latency_tts_ms Text-to-Speech latency
# TYPE voice_latency_tts_ms gauge
voice_latency_tts_ms ${avg.avgTTS}

# HELP voice_invariant_compliance_rate Percentage of calls meeting 750ms invariant
# TYPE voice_invariant_compliance_rate gauge
voice_invariant_compliance_rate ${compliance.complianceRate}

# HELP voice_invariant_violations_total Total invariant violations
# TYPE voice_invariant_violations_total counter
voice_invariant_violations_total ${compliance.violations}
    `.trim();
  }
}

// Global singleton
export const globalLatencyMonitor = new LatencyMonitor();
