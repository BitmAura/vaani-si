# Ingestion Pipeline Architecture

## 1. Pipeline Stages

The ingestion pipeline (`KnowledgeIngestionPipeline`) transforms raw files or text inputs into verified, indexed knowledge chunks through a 7-stage sequential workflow:

```
[Raw Input] ──> [1. Format Validation] ──> [2. Stream Parsing]
                     │
                     ▼
           [3. Text Normalization] ──> [4. Semantic Chunking]
                     │
                     ▼
           [5. Dense Vector Embedding] ──> [6. Batch DB Persistence]
                     │
                     ▼
           [7. Atomic Version Promotion]
```

### Stage 1: Format Validation
- Inspects both MIME types and file extensions via `ParserRegistry`.
- Allowed formats: PDF (`application/pdf`), Plain Text (`text/plain`, `.txt`), Markdown (`text/markdown`, `.md`), HTML/Website (`text/html`), Manual Articles, and FAQs.
- Unsupported formats (e.g. `.exe`, `.bin`, `.zip`) are rejected synchronously with an explanatory HTTP 400 error.

### Stage 2: Stream Parsing
- **PDF Parser (`PdfParser`)**: Implements pure Node.js flate-stream decompression (`zlib.inflateSync` / `zlib.inflateRawSync`) to extract PDF text operators (`Tj`, `TJ`). Handles multi-page documents and detects empty or scanned image-only PDFs (`isScannedOrEmpty = true`), flagging them for future OCR without crashing or stalling worker threads.
- **HTML Parser (`HtmlParser`)**: Strips `<script>`, `<style>`, `<noscript>`, and `<svg>` elements. Extracts document title, hierarchical headings (`h1`-`h3`), and body text while filtering repetitive boilerplate navigation headers and footers.
- **Text Parser (`TextParser`)**: Reads UTF-8 text and extracts Markdown headers to establish hierarchical chunk contexts.

### Stage 3: Text Normalization & Multilingual Preserver
- Normalizes carriage returns (`\r\n` -> `\n`).
- Strips non-printable ASCII control characters (`\x00-\x1F`) while strictly preserving Kannada Unicode code points (`\u0C80-\u0CFF`).
- Detects predominant language: `EN` (English), `KN` (Kannada), or `KANGLISH` (mixed vernacular/colloquial speech).
- Computes SHA-256 content checksum for deduplication and historical change tracking.

### Stage 4: Semantic Chunking
- Segments normalized text into coherent blocks using `SemanticChunker`.
- Uses heading and paragraph boundaries rather than naive character slicing.
- Preserves chunk sequence index, page numbers, character counts, and estimated token counts.

### Stage 5: Dense Vector Embedding
- Embeds all generated chunks via `IEmbeddingProvider`.
- Default runtime adapter: `MockMultilingualEmbeddingProvider`, generating unit-normalized 384-dimensional dense vectors with semantic topic clustering for English, Kannada, and Kanglish.
- Production ready for external neural embedding providers (e.g., Sarvam multilingual, OpenAI `text-embedding-3-small`, or BGE-M3).

### Stage 6: Batch Database Persistence
- Persists chunks in batch via `db.saveChunks()`.
- Records embedding dimensions, model version tag, and source document metadata.

### Stage 7: Atomic Version Promotion
- Transitions new document from `PROCESSING` to `READY`.
- Finds previous active document for the same source (`contentStatus === 'READY'`) and updates it to `ARCHIVED` (superseded).
- Updates ingestion job status to `COMPLETED` with 100% progress.
- If any failure occurs during parsing, chunking, or embedding:
  - Document is marked `FAILED` with sanitized error message.
  - Active previous document remains untouched in `READY` status.
