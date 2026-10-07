/**
 * @vanni/knowledge-engine — Embedding Providers Barrel
 */

import { IEmbeddingProvider } from './types.js';
import { MockMultilingualEmbeddingProvider } from './mock-embedding-provider.js';

export * from './types.js';
export * from './mock-embedding-provider.js';
export * from './external-embedding-provider.js';

// Default global embedding provider (Deterministic, 384-dimensional unit vectors)
export const globalEmbeddingProvider: IEmbeddingProvider = new MockMultilingualEmbeddingProvider();
