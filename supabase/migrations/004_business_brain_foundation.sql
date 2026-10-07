-- ==============================================================================
-- VANNI — Autonomous AI Employee Platform
-- Migration 004: Business Brain & Industry Template Foundation
-- Target: PostgreSQL 16+ / Supabase
-- ==============================================================================

-- 1. Locations Table (Multi-branch / location support)
CREATE TABLE IF NOT EXISTS public.business_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    landmark TEXT,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL DEFAULT 'Karnataka',
    pincode VARCHAR(20) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED', 'EXPIRED', 'PENDING_REVIEW')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_business_locations_org ON public.business_locations(organization_id);

-- 2. Knowledge Sources (Traceable provenance layer)
CREATE TABLE IF NOT EXISTS public.knowledge_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL DEFAULT 'MANUAL' CHECK (source_type IN (
        'MANUAL', 'STRUCTURED_BUSINESS_DATA', 'FAQ', 'WEBSITE', 'DOCUMENT', 'POLICY', 'IMPORT', 'SYSTEM'
    )),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    uri_or_identifier TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED', 'EXPIRED', 'PENDING_REVIEW')),
    authority VARCHAR(50) NOT NULL DEFAULT 'AUTHORITATIVE' CHECK (authority IN ('AUTHORITATIVE', 'APPROVED', 'REFERENCE', 'UNVERIFIED')),
    last_verified_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_org ON public.knowledge_sources(organization_id);

-- 3. Structured Business Policies (Cancellations, emergencies, AI restrictions)
CREATE TABLE IF NOT EXISTS public.business_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'CANCELLATION', 'APPOINTMENT', 'REFUND', 'EMERGENCY', 'ESCALATION', 'AI_RESTRICTION', 'PRIVACY', 'GENERAL'
    )),
    title VARCHAR(255) NOT NULL,
    policy_statement TEXT NOT NULL,
    kannada_statement TEXT,
    enforcement_level VARCHAR(50) NOT NULL DEFAULT 'STRICT_BLOCK' CHECK (enforcement_level IN ('STRICT_BLOCK', 'ESCALATE_TO_STAFF', 'INFORMATIONAL')),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED', 'EXPIRED', 'PENDING_REVIEW')),
    authority VARCHAR(50) NOT NULL DEFAULT 'AUTHORITATIVE' CHECK (authority IN ('AUTHORITATIVE', 'APPROVED', 'REFERENCE', 'UNVERIFIED')),
    source_id UUID REFERENCES public.knowledge_sources(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_business_policies_org ON public.business_policies(organization_id);

-- 4. Structured Bilingual FAQs
CREATE TABLE IF NOT EXISTS public.business_faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    kannada_question TEXT,
    kannada_answer TEXT,
    language VARCHAR(20) NOT NULL DEFAULT 'KANGLISH' CHECK (language IN ('EN', 'KN', 'KANGLISH')),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED', 'EXPIRED', 'PENDING_REVIEW')),
    authority VARCHAR(50) NOT NULL DEFAULT 'AUTHORITATIVE' CHECK (authority IN ('AUTHORITATIVE', 'APPROVED', 'REFERENCE', 'UNVERIFIED')),
    source_id UUID REFERENCES public.knowledge_sources(id) ON DELETE SET NULL,
    last_verified_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_business_faqs_org ON public.business_faqs(organization_id);

-- 5. Business Facts (Flexible Key/Value facts for specific domain metrics)
CREATE TABLE IF NOT EXISTS public.business_facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    key VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    kannada_value TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED', 'EXPIRED', 'PENDING_REVIEW')),
    authority VARCHAR(50) NOT NULL DEFAULT 'AUTHORITATIVE' CHECK (authority IN ('AUTHORITATIVE', 'APPROVED', 'REFERENCE', 'UNVERIFIED')),
    source_id UUID REFERENCES public.knowledge_sources(id) ON DELETE SET NULL,
    effective_from TIMESTAMPTZ,
    effective_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, category, key)
);
CREATE INDEX IF NOT EXISTS idx_business_facts_org ON public.business_facts(organization_id);

-- 6. Knowledge Conflicts (Contradiction detection registry)
CREATE TABLE IF NOT EXISTS public.knowledge_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('SERVICE_PRICE', 'HOURS', 'STAFF', 'POLICY', 'FACT')),
    entity_id VARCHAR(255) NOT NULL,
    field VARCHAR(100) NOT NULL,
    source_a JSONB NOT NULL,
    source_b JSONB NOT NULL,
    resolved_value TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'IGNORED')),
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_knowledge_conflicts_org ON public.knowledge_conflicts(organization_id);

-- 7. Versioned Business Brain Snapshots (Deterministic runtime bundles)
CREATE TABLE IF NOT EXISTS public.business_brain_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    snapshot_data JSONB NOT NULL,
    compiled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, version)
);
CREATE INDEX IF NOT EXISTS idx_brain_snapshots_org_ver ON public.business_brain_snapshots(organization_id, version DESC);

-- 8. Alter existing business_services and business_staff for bilingual & provenance support
DO $$
BEGIN
    -- Services additions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_services' AND column_name = 'kannada_name') THEN
        ALTER TABLE public.business_services ADD COLUMN kannada_name VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_services' AND column_name = 'conversational_alias') THEN
        ALTER TABLE public.business_services ADD COLUMN conversational_alias VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_services' AND column_name = 'status') THEN
        ALTER TABLE public.business_services ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_services' AND column_name = 'authority') THEN
        ALTER TABLE public.business_services ADD COLUMN authority VARCHAR(50) NOT NULL DEFAULT 'AUTHORITATIVE';
    END IF;

    -- Staff additions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_staff' AND column_name = 'kannada_name') THEN
        ALTER TABLE public.business_staff ADD COLUMN kannada_name VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_staff' AND column_name = 'status') THEN
        ALTER TABLE public.business_staff ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_staff' AND column_name = 'authority') THEN
        ALTER TABLE public.business_staff ADD COLUMN authority VARCHAR(50) NOT NULL DEFAULT 'AUTHORITATIVE';
    END IF;
END $$;

-- ==============================================================================
-- 9. ROW-LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.business_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_brain_snapshots ENABLE ROW LEVEL SECURITY;

-- Helper check if user is member of organization
-- (Uses is_org_member defined in 003_auth_and_multitenancy.sql)

-- 9.1 Locations
CREATE POLICY rls_business_locations_select ON public.business_locations
    FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY rls_business_locations_insert ON public.business_locations
    FOR INSERT WITH CHECK (public.is_org_member(organization_id) AND public.get_org_role(organization_id) IN ('OWNER', 'ADMIN', 'MANAGER'));
CREATE POLICY rls_business_locations_update ON public.business_locations
    FOR UPDATE USING (public.is_org_member(organization_id) AND public.get_org_role(organization_id) IN ('OWNER', 'ADMIN', 'MANAGER'));
CREATE POLICY rls_business_locations_delete ON public.business_locations
    FOR DELETE USING (public.is_org_member(organization_id) AND public.get_org_role(organization_id) IN ('OWNER', 'ADMIN'));

-- 9.2 Knowledge Sources
CREATE POLICY rls_knowledge_sources_select ON public.knowledge_sources
    FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY rls_knowledge_sources_insert ON public.knowledge_sources
    FOR INSERT WITH CHECK (public.is_org_member(organization_id) AND public.get_org_role(organization_id) IN ('OWNER', 'ADMIN', 'MANAGER'));
CREATE POLICY rls_knowledge_sources_update ON public.knowledge_sources
    FOR UPDATE USING (public.is_org_member(organization_id) AND public.get_org_role(organization_id) IN ('OWNER', 'ADMIN', 'MANAGER'));
CREATE POLICY rls_knowledge_sources_delete ON public.knowledge_sources
    FOR DELETE USING (public.is_org_member(organization_id) AND public.get_org_role(organization_id) IN ('OWNER', 'ADMIN'));

-- 9.3 Policies
CREATE POLICY rls_business_policies_select ON public.business_policies
    FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY rls_business_policies_insert ON public.business_policies
    FOR INSERT WITH CHECK (public.is_org_member(organization_id) AND public.get_org_role(organization_id) IN ('OWNER', 'ADMIN'));
CREATE POLICY rls_business_policies_update ON public.business_policies
    FOR UPDATE USING (public.is_org_member(organization_id) AND public.get_org_role(organization_id) IN ('OWNER', 'ADMIN'));
CREATE POLICY rls_business_policies_delete ON public.business_policies
    FOR DELETE USING (public.is_org_member(organization_id) AND public.get_org_role(organization_id) IN ('OWNER', 'ADMIN'));

-- 9.4 FAQs
CREATE POLICY rls_business_faqs_select ON public.business_faqs
    FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY rls_business_faqs_insert ON public.business_faqs
    FOR INSERT WITH CHECK (public.is_org_member(organization_id) AND public.get_org_role(organization_id) IN ('OWNER', 'ADMIN', 'MANAGER'));
CREATE POLICY rls_business_faqs_update ON public.business_faqs
    FOR UPDATE USING (public.is_org_member(organization_id) AND public.get_org_role(organization_id) IN ('OWNER', 'ADMIN', 'MANAGER'));
CREATE POLICY rls_business_faqs_delete ON public.business_faqs
    FOR DELETE USING (public.is_org_member(organization_id) AND public.get_org_role(organization_id) IN ('OWNER', 'ADMIN'));

-- 9.5 Facts
CREATE POLICY rls_business_facts_select ON public.business_facts
    FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY rls_business_facts_insert ON public.business_facts
    FOR INSERT WITH CHECK (public.is_org_member(organization_id) AND public.get_org_role(organization_id) IN ('OWNER', 'ADMIN', 'MANAGER'));
CREATE POLICY rls_business_facts_update ON public.business_facts
    FOR UPDATE USING (public.is_org_member(organization_id) AND public.get_org_role(organization_id) IN ('OWNER', 'ADMIN', 'MANAGER'));
CREATE POLICY rls_business_facts_delete ON public.business_facts
    FOR DELETE USING (public.is_org_member(organization_id) AND public.get_org_role(organization_id) IN ('OWNER', 'ADMIN'));

-- 9.6 Conflicts
CREATE POLICY rls_knowledge_conflicts_select ON public.knowledge_conflicts
    FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY rls_knowledge_conflicts_modify ON public.knowledge_conflicts
    FOR ALL USING (public.is_org_member(organization_id) AND public.get_org_role(organization_id) IN ('OWNER', 'ADMIN'));

-- 9.7 Snapshots
CREATE POLICY rls_brain_snapshots_select ON public.business_brain_snapshots
    FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY rls_brain_snapshots_insert ON public.business_brain_snapshots
    FOR INSERT WITH CHECK (public.is_org_member(organization_id) AND public.get_org_role(organization_id) IN ('OWNER', 'ADMIN'));
