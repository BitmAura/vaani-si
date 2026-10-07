# Embedding Provider Abstraction & Vector Storage

## 1. Provider Interface

The knowledge engine isolates all vector operations behind a strict interface (`IEmbeddingProvider`):

```typescript
export interface IEmbeddingProvider {
  embedText(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  dimensions(): number;
  modelName(): string;
}
```

This guarantees zero tight coupling to any single vendor (OpenAI, Google Gemini, Sarvam, Cohere, or local ONNX runtimes).

---

## 2. Included Adapters

### 2.1 MockMultilingualEmbeddingProvider (Development & Local CI)
- **Model Name**: `vanni-multilingual-e5-v1-mock`
- **Dimensions**: `384`
- **Properties**:
  - Deterministic: Identical text always yields identical vectors.
  - Semantic Topic Clustering: Assigns weighted base vectors for domain clusters (Real Estate, Healthcare, Booking, Pricing, Timings, Kannada terms) and modulates them with text-length and character-frequency signatures.
  - L2 Unit-Normalized: All vectors have $||\mathbf{v}||_2 = 1.0$, allowing exact cosine similarity via fast dot product ($\cos(\mathbf{u}, \mathbf{v}) = \mathbf{u} \cdot \mathbf{v}$).

### 2.2 ExternalEmbeddingProvider (Production Cloud AI)
- Configurable for REST endpoints (e.g. OpenAI `/v1/embeddings` or Sarvam Multilingual API).
- Supports batch requests with exponential backoff retries.

---

## 3. Vector Storage Architecture

### PostgreSQL pgvector Integration
Stored in the `knowledge_chunks` table:

```sql
CREATE TABLE knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    heading TEXT,
    page_number INT,
    content TEXT NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'EN',
    authority VARCHAR(20) NOT NULL DEFAULT 'APPROVED',
    token_count INT NOT NULL DEFAULT 0,
    char_count INT NOT NULL DEFAULT 0,
    embedding vector(384),
    embedding_model VARCHAR(50) NOT NULL DEFAULT 'vanni-multilingual-e5-v1-mock',
    embedding_dimensions INT NOT NULL DEFAULT 384,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cosine distance IVFFlat index partitioned by tenant
CREATE INDEX idx_knowledge_chunks_embedding 
ON knowledge_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### Version Awareness & Re-Embedding Safety
Every chunk stores `embedding_model` and `embedding_dimensions`. If a model upgrade occurs (e.g., migrating from 384 to 768 dimensions), queries against old vectors are rejected with an explicit migration error, preventing vector space corruption.
