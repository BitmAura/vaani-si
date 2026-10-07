-- ==============================================================================
-- Migration 005: Knowledge Ingestion, Chunking, Vectors & Retrieval Engine
-- Multi-Tenant RLS, Document Versioning, and Atomic Knowledge Publishing
-- ==============================================================================

-- Enable pgvector extension if supported on the host
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension not available on this host. Falling back to native float arrays.';
END $$;

-- 1. KNOWLEDGE DOCUMENTS (Source-linked, versioned, status-tracked)
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.knowledge_sources(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'TXT',
  content_status TEXT NOT NULL DEFAULT 'PENDING',
  storage_path TEXT,
  raw_content TEXT,
  normalized_content TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'EN',
  checksum TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  supersedes_id UUID REFERENCES public.knowledge_documents(id) ON DELETE SET NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  char_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. KNOWLEDGE CHUNKS (Semantic segments with embeddings and citations)
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.knowledge_sources(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  heading TEXT,
  page_number INTEGER,
  language TEXT NOT NULL DEFAULT 'EN',
  authority TEXT NOT NULL DEFAULT 'REFERENCE',
  token_count INTEGER NOT NULL DEFAULT 0,
  char_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding float8[] DEFAULT NULL,
  embedding_model TEXT DEFAULT 'vanni-multilingual-384',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. KNOWLEDGE INGESTION JOBS (Async state, progress, and failure tracking)
CREATE TABLE IF NOT EXISTS public.knowledge_ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.knowledge_sources(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.knowledge_documents(id) ON DELETE SET NULL,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  progress INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. PERFORMANCE & SEARCH INDEXES
CREATE INDEX IF NOT EXISTS idx_kdocs_org_status ON public.knowledge_documents(organization_id, content_status);
CREATE INDEX IF NOT EXISTS idx_kdocs_source ON public.knowledge_documents(source_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_kchunks_org_doc ON public.knowledge_chunks(organization_id, document_id);
CREATE INDEX IF NOT EXISTS idx_kchunks_authority ON public.knowledge_chunks(organization_id, authority);
CREATE INDEX IF NOT EXISTS idx_kchunks_fts ON public.knowledge_chunks USING gin(to_tsvector('simple', content));
CREATE INDEX IF NOT EXISTS idx_kjobs_org_status ON public.knowledge_ingestion_jobs(organization_id, status);

-- 5. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_ingestion_jobs ENABLE ROW LEVEL SECURITY;

-- 6. STRICT MULTI-TENANT POLICIES (knowledge_documents)
CREATE POLICY kdocs_select ON public.knowledge_documents
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'ACTIVE'
    )
  );

CREATE POLICY kdocs_insert ON public.knowledge_documents
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'ACTIVE' AND role IN ('OWNER', 'ADMIN', 'MANAGER')
    )
  );

CREATE POLICY kdocs_update ON public.knowledge_documents
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'ACTIVE' AND role IN ('OWNER', 'ADMIN', 'MANAGER')
    )
  );

CREATE POLICY kdocs_delete ON public.knowledge_documents
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'ACTIVE' AND role IN ('OWNER', 'ADMIN')
    )
  );

-- 7. STRICT MULTI-TENANT POLICIES (knowledge_chunks)
CREATE POLICY kchunks_select ON public.knowledge_chunks
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'ACTIVE'
    )
  );

CREATE POLICY kchunks_insert ON public.knowledge_chunks
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'ACTIVE' AND role IN ('OWNER', 'ADMIN', 'MANAGER')
    )
  );

CREATE POLICY kchunks_delete ON public.knowledge_chunks
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'ACTIVE' AND role IN ('OWNER', 'ADMIN')
    )
  );

-- 8. STRICT MULTI-TENANT POLICIES (knowledge_ingestion_jobs)
CREATE POLICY kjobs_select ON public.knowledge_ingestion_jobs
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'ACTIVE'
    )
  );

CREATE POLICY kjobs_all ON public.knowledge_ingestion_jobs
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'ACTIVE' AND role IN ('OWNER', 'ADMIN', 'MANAGER')
    )
  );
