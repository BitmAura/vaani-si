/**
 * @vanni/knowledge-engine — Mock Multilingual Embedding Provider
 * Produces deterministic, unit-normalized 384-dimensional dense vectors
 * supporting English, authentic Kannada (U+0C80-U+0CFF), and Kanglish terms.
 * Enables 100% offline, reproducible vector search and CI testing without external API keys.
 */

import { IEmbeddingProvider } from './types.js';

export class MockMultilingualEmbeddingProvider implements IEmbeddingProvider {
  private readonly DIMENSIONS = 384;
  private readonly MODEL_NAME = 'vanni-multilingual-e5-v1-mock';
  private readonly MODEL_VERSION = '1.0.0';

  dimensions(): number {
    return this.DIMENSIONS;
  }

  modelName(): string {
    return this.MODEL_NAME;
  }

  modelVersion(): string {
    return this.MODEL_VERSION;
  }

  async embedText(text: string): Promise<number[]> {
    return this.generateDeterministicVector(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map(t => this.generateDeterministicVector(t));
  }

  /**
   * Generates a deterministic, unit-normalized 384-dimensional vector
   */
  private generateDeterministicVector(text: string): number[] {
    const vector = new Array<number>(this.DIMENSIONS).fill(0);
    const cleaned = text.toLowerCase().trim();

    if (!cleaned) {
      vector[0] = 1.0;
      return vector;
    }

    // 1. Semantic Topic Clustering (boosts specific dimension bands for related concepts)
    this.applySemanticClusters(cleaned, vector);

    // 2. Character Trigram Hashing
    for (let i = 0; i <= cleaned.length - 3; i++) {
      const trigram = cleaned.slice(i, i + 3);
      const hash = this.murmurHash(trigram);
      const dim = Math.abs(hash) % this.DIMENSIONS;
      const sign = (hash & 1) === 0 ? 1 : -1;
      vector[dim] += sign * 0.5;
    }

    // 3. Word Token Hashing
    const words = cleaned.split(/[\s,.;:!?()"-]+/).filter(Boolean);
    for (const word of words) {
      const hash = this.murmurHash(word);
      const dim = Math.abs(hash) % this.DIMENSIONS;
      const sign = (hash & 1) === 0 ? 1 : -1;
      vector[dim] += sign * 1.5;
    }

    // 4. L2 Normalization (Unit Length: ||v|| = 1.0)
    let sumSq = 0;
    for (let i = 0; i < this.DIMENSIONS; i++) {
      sumSq += vector[i] * vector[i];
    }

    const norm = Math.sqrt(sumSq);
    if (norm > 0) {
      for (let i = 0; i < this.DIMENSIONS; i++) {
        vector[i] = vector[i] / norm;
      }
    } else {
      vector[0] = 1.0;
    }

    return vector;
  }

  private applySemanticClusters(text: string, vector: number[]): void {
    // Topic: Timings & Schedule (Band 10 - 29)
    if (/timing|hour|open|close|sunday|bhanuvara|samaya|time|schedule|holiday/.test(text)) {
      for (let i = 10; i < 30; i++) vector[i] += 2.0;
    }

    // Topic: Pricing & Fees (Band 30 - 49)
    if (/price|cost|fee|charge|bele|daragalu|rupees|inr|rate|expensive|cheap|affordable/.test(text)) {
      for (let i = 30; i < 50; i++) vector[i] += 2.0;
    }

    // Topic: Real Estate / Plots (Band 50 - 69)
    if (/plot|layout|site|buda|square|phase|amenity|property|land|dimensions/.test(text)) {
      for (let i = 50; i < 70; i++) vector[i] += 2.0;
    }

    // Topic: Medical / Clinic (Band 70 - 89)
    if (/doctor|clinic|treatment|cardiologist|consultation|root canal|opd|hospital|patient/.test(text)) {
      for (let i = 70; i < 90; i++) vector[i] += 2.0;
    }

    // Topic: Appointments & Booking (Band 90 - 109)
    if (/appointment|book|schedule|slot|visit|meet|consult/.test(text)) {
      for (let i = 90; i < 110; i++) vector[i] += 2.0;
    }

    // Topic: Loans & Bank Approvals (Band 110 - 129)
    if (/loan|bank|sbi|hdfc|finance|emi|approval|interest/.test(text)) {
      for (let i = 110; i < 130; i++) vector[i] += 2.0;
    }
  }

  private murmurHash(key: string): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  }
}
