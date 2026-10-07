# Semantic Chunking Architecture

## 1. Design Rationale

Arbitrary fixed-window character or token chunking splits sentences in half, severs context across headings, and degrades retrieval quality. The VANNI `SemanticChunker` respects natural document boundaries:
1. Markdown headings (`#`, `##`, `###`)
2. Capitalized section labels and colon-terminated titles
3. Paragraph breaks (`\n\n`)
4. Explicit page boundaries for PDF documents

## 2. Configuration Parameters

The chunker exposes configurable thresholds:

| Parameter | Default | Purpose |
| :--- | :--- | :--- |
| `chunkSize` | `500` characters | Target chunk size for optimal semantic density. |
| `chunkOverlap` | `80` characters | Overlap window prepended from previous chunk to preserve inter-boundary context. |
| `minChunkSize` | `100` characters | Minimum length for a block before being merged with adjacent text. |
| `maxChunkSize` | `1000` characters | Hard upper threshold forcing a split if a single paragraph is oversized. |

## 3. Chunk DTO Specification

Each chunk produced implements the `KnowledgeChunkDTO` interface:

```typescript
export interface KnowledgeChunkDTO {
  id: string;               // Deterministic format: chunk-{documentId}-{index}
  organizationId: string;   // Tenant isolation guarantee
  sourceId: string;         // Origin knowledge source
  documentId: string;       // Parent document version
  chunkIndex: number;       // Sequential order (0, 1, 2...)
  content: string;          // Normalized textual content
  heading?: string;         // Nearest enclosing section heading
  pageNumber?: number;      // Source page number (for PDFs)
  language: 'EN' | 'KN' | 'KANGLISH';
  authority: KnowledgeAuthority; // AUTHORITATIVE | APPROVED | REFERENCE | UNVERIFIED
  tokenCount: number;       // Estimated tokens (~4 chars per token)
  charCount: number;        // Exact character count
  metadata: Record<string, any>;
  embedding?: number[];     // 384-dimensional vector
  embeddingModel?: string;  // e.g., 'vanni-multilingual-e5-v1-mock'
  createdAt: string;
}
```

## 4. Metadata Traceability

Retained metadata ensures that when an AI employee cites a source or underwriter inspects a call transcript, the exact originating document title, section heading, and page number are immediately available.
