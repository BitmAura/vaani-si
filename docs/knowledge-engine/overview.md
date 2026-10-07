# VANNI Knowledge Engine — System Overview

## 1. Executive Summary

The **VANNI Knowledge Engine** (`@vanni/knowledge-engine`) is an enterprise-grade ingestion, semantic indexing, and hybrid retrieval engine designed specifically for local Karnataka enterprises and multi-tenant voice-first AI agents. It bridges the gap between raw unstructured business knowledge (PDF brochures, website pages, plain-text policy documents, FAQs, manual articles) and the deterministic **Business Brain** runtime context assembler.

The engine operates on a strict **No-Hallucination Contract**: rather than delegating knowledge retrieval to broad LLM parametric memory, the Knowledge Engine grounds voice agents with precise citations, authority-weighted chunk scoring, authentic Kannada script preservation (`\u0C80-\u0CFF`), and anti-SSRF protections.

```
                           KNOWLEDGE SOURCES
       [PDF Documents]  [Website URLs]  [Manual FAQs]  [Policy Articles]
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Ingestion Pipeline (@vanni/knowledge-engine)                             │
│ 1. Format Detection & MIME Validation                                    │
│ 2. Server-side Stream Parsing (Zero Native Crash Vector)                 │
│ 3. Text Normalization & Kannada Preserver                                │
│ 4. Semantic Chunking (Heading & Paragraph-aware, 500-char target)        │
│ 5. Dense Multilingual Embedding (384-dimensional Unit Vectors)           │
│ 6. Atomic Version Promotion (v1 active -> v2 ready -> v1 archived)       │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ PostgreSQL / Supabase Storage & pgvector Index                           │
│ • knowledge_sources (Multi-tenancy, Authority, Sync State)               │
│ • knowledge_documents (Immutable versions, Checksums, Status)           │
│ • knowledge_chunks (Embeddings, Tokens, Headings, Page Indices)          │
│ • knowledge_ingestion_jobs (Queued, Running, Completed, Failed)         │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Hybrid Retrieval & Ranking Engine                                        │
│ • 0.55 Cosine Semantic Similarity                                        │
│ • 0.30 Token/Heading Lexical Match                                       │
│ • +0.20 Authority Boost (Gated on Relevance Signal)                      │
│ • +0.05 Kannada Script Match Boost                                       │
│ • Answerability Classification: SUPPORTED | PARTIALLY_SUPPORTED | UNSUPP  │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ VANNI Business Brain & Voice Agent Runtime (@vanni/agent-core)           │
│ Real-time conversational synthesis with sub-750ms latency SLA            │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Key Architecture Pillars

### 2.1 Strict Multi-Tenant Isolation
All sources, documents, chunks, and storage files are strictly partitioned by `organization_id`. PostgreSQL Row Level Security (RLS) ensures that tenant organizations can never access, query, or infer another organization's vectors or documents.

### 2.2 Atomic Versioning & Resilient Fallback
When a business re-ingests a document or syncs a website URL, the existing active document remains in `READY` status. The new document processes independently in `PROCESSING` status. Only upon successful extraction, normalization, chunking, and embedding does the new version transition to `READY`, atomically marking the previous version as `ARCHIVED` (superseded). If ingestion fails at any stage, the active version is untouched.

### 2.3 Kannada & Multilingual Native Fidelity
Extracted content preserves authentic Kannada glyphs (`\u0C80-\u0CFF`), Kanglish colloquialisms, and mixed bilingual formatting. Whitespace normalization collapses excessive blank lines without mangling Unicode combining characters or transliterating vernacular names.

### 2.4 Hybrid Ranking with Authority Gate
Retrieval balances dense vector similarity (384-dim normalized cosine dot product) with exact keyword tokens and heading matches. Verified internal policies (`AUTHORITATIVE`) receive a boost over reference documents (`REFERENCE`), but only when the content is genuinely relevant to the query—preventing irrelevant authoritative documents from hijacking unrelated queries.
