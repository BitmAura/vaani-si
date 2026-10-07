/**
 * VANNI Provider SDK — Embedding Provider Abstraction Contract
 * Used by Knowledge Engine (Prompt 07) for vector indexing and retrieval.
 */

export interface EmbeddingVector {
  values: number[];
  dimensions: number;
  model: string;
  provider: string;
}

export interface EmbeddingRequest {
  text: string;
  organizationId?: string;
  language?: 'en' | 'kn' | 'kn-en';
}

export interface BatchEmbeddingRequest {
  texts: string[];
  organizationId?: string;
  language?: 'en' | 'kn' | 'kn-en';
}

export interface EmbeddingUsage {
  inputTokens: number;
  totalTokens: number;
}

export interface EmbeddingResult {
  embedding: EmbeddingVector;
  usage?: EmbeddingUsage;
  latencyMs: number;
}

export interface BatchEmbeddingResult {
  embeddings: EmbeddingVector[];
  usage?: EmbeddingUsage;
  latencyMs: number;
}

export interface IEmbeddingProvider {
  readonly providerName: string;
  readonly modelName: string;
  readonly dimensions: number;

  /**
   * Embed a single text string into a dense vector.
   * Used for per-chunk indexing during knowledge ingestion.
   */
  embedText(request: EmbeddingRequest, signal?: AbortSignal): Promise<EmbeddingResult>;

  /**
   * Embed multiple text strings in a single batched request.
   * Significantly more efficient for bulk indexing.
   */
  embedBatch(request: BatchEmbeddingRequest, signal?: AbortSignal): Promise<BatchEmbeddingResult>;

  /**
   * Health probe — returns true if the provider is reachable and auth is valid.
   */
  healthCheck(): Promise<boolean>;
}
