import {
  ILLMProvider,
  ISTTProvider,
  IEmbeddingProvider,
} from '@vanni/provider-sdk';

export interface BenchmarkMetrics {
  providerName: string;
  category: 'llm' | 'stt' | 'tts' | 'embeddings';
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  errors: string[];
}

export class ProviderBenchmarkHarness {
  private calculateStats(latencies: number[]): { avg: number; p95: number; min: number; max: number } {
    if (latencies.length === 0) return { avg: 0, p95: 0, min: 0, max: 0 };
    latencies.sort((a, b) => a - b);
    const sum = latencies.reduce((acc, curr) => acc + curr, 0);
    const avg = Math.round(sum / latencies.length);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p95 = latencies[p95Index] ?? latencies[latencies.length - 1];
    return {
      avg,
      p95,
      min: latencies[0],
      max: latencies[latencies.length - 1],
    };
  }

  async benchmarkLLM(
    provider: ILLMProvider,
    testPrompts: string[],
    iterationsPerPrompt = 1
  ): Promise<BenchmarkMetrics> {
    const latencies: number[] = [];
    const errors: string[] = [];
    let success = 0;
    let failed = 0;

    for (const prompt of testPrompts) {
      for (let i = 0; i < iterationsPerPrompt; i++) {
        const start = Date.now();
        try {
          await provider.generateTurn('You are a helpful assistant.', [], prompt);
          latencies.push(Date.now() - start);
          success++;
        } catch (err: unknown) {
          failed++;
          errors.push((err as Error)?.message || String(err));
        }
      }
    }

    const stats = this.calculateStats(latencies);
    return {
      providerName: provider.providerName,
      category: 'llm',
      totalRequests: testPrompts.length * iterationsPerPrompt,
      successfulRequests: success,
      failedRequests: failed,
      avgLatencyMs: stats.avg,
      p95LatencyMs: stats.p95,
      minLatencyMs: stats.min,
      maxLatencyMs: stats.max,
      errors,
    };
  }

  async benchmarkEmbedding(
    provider: IEmbeddingProvider,
    testTexts: string[]
  ): Promise<BenchmarkMetrics> {
    const latencies: number[] = [];
    const errors: string[] = [];
    let success = 0;
    let failed = 0;

    for (const text of testTexts) {
      const start = Date.now();
      try {
        await provider.embedText({ text });
        latencies.push(Date.now() - start);
        success++;
      } catch (err: unknown) {
        failed++;
        errors.push((err as Error)?.message || String(err));
      }
    }

    const stats = this.calculateStats(latencies);
    return {
      providerName: provider.providerName,
      category: 'embeddings',
      totalRequests: testTexts.length,
      successfulRequests: success,
      failedRequests: failed,
      avgLatencyMs: stats.avg,
      p95LatencyMs: stats.p95,
      minLatencyMs: stats.min,
      maxLatencyMs: stats.max,
      errors,
    };
  }
}
