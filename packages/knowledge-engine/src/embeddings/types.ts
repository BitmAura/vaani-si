/**
 * @vanni/knowledge-engine — Embedding Provider Abstraction
 */

export interface IEmbeddingProvider {
  embedText(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  dimensions(): number;
  modelName(): string;
  modelVersion(): string;
}
