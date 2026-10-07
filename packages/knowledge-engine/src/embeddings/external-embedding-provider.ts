/**
 * @vanni/knowledge-engine — External Embedding Provider Adapter
 * Pluggable adapter for cloud embedding APIs (OpenAI, Gemini, Sarvam AI).
 */

import { IEmbeddingProvider } from './types.js';

export interface ExternalProviderConfig {
  providerName: 'openai' | 'gemini' | 'sarvam' | 'custom';
  apiKey?: string;
  modelName: string;
  dimensions?: number;
  endpointUrl?: string;
}

export class ExternalEmbeddingProvider implements IEmbeddingProvider {
  private config: ExternalProviderConfig;
  private dims: number;

  constructor(config: ExternalProviderConfig) {
    this.config = config;
    this.dims = config.dimensions || 384;
  }

  dimensions(): number {
    return this.dims;
  }

  modelName(): string {
    return this.config.modelName;
  }

  modelVersion(): string {
    return '1.0.0';
  }

  async embedText(text: string): Promise<number[]> {
    if (!this.config.apiKey) {
      throw new Error(`API key not configured for provider ${this.config.providerName}`);
    }
    // Pluggable integration point for OpenAI / Sarvam / Gemini
    // For now, if no live key, fallback to empty or throw explicit config error
    throw new Error(`External provider ${this.config.providerName} not connected in development environment.`);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => this.embedText(t)));
  }
}
