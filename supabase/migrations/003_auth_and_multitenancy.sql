-- ==============================================================================
-- VANNI — Autonomous AI Employee Platform
-- Migration 003: Secure SaaS Identity, Profiles, Organizations & Multi-Tenant RLS
-- Target: PostgreSQL 16+ / Supabase
-- ==============================================================================

-- 1. Ensure Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create auth schema mock if running standalone in test environments
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE,
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 2. FOUNDATIONAL MULTI-TENANT TABLES
-- ==============================================================================

-- 2.1 User Profiles (Strictly mapped 1:1 to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    phone VARCHAR(50),
    timezone VARCHAR(100) NOT NULL DEFAULT 'Asia/Kolkata',
    locale VARCHAR(50) NOT NULL DEFAULT 'en-IN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.2 Organizations (The fundamental multi-tenant boundary)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    logo_url TEXT,
    industry VARCHAR(100) NOT NULL DEFAULT 'REAL_ESTATE',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED')),
    timezone VARCHAR(100) NOT NULL DEFAULT 'Asia/Kolkata',
    onboarding_status VARCHAR(50) NOT NULL DEFAULT 'created' CHECK (onboarding_status IN ('created', 'business_setup', 'agent_setup', 'ready')),
    billing_tier VARCHAR(50) NOT NULL DEFAULT 'STARTER' CHECK (billing_tier IN ('STARTER', 'GROWTH', 'BUSINESS')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast slug lookups
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);

-- 2.3 Organization Memberships (User to Org many-to-many relationship)
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'VIEWER' CHECK (role IN ('OWNER', 'ADMIN', 'MANAGER', 'VIEWER')),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INVITED', 'SUSPENDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);

-- 2.4 Immutable Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON public.audit_logs(organization_id, created_at DESC);

-- ==============================================================================
-- 3. TENANT RESOURCE TABLES WITH EXPLICIT organization_id
-- ==============================================================================

-- 3.1 AI Agents
CREATE TABLE IF NOT EXISTS public.agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    language VARCHAR(50) NOT NULL DEFAULT 'KANGLISH_BUSINESS',
    status VARCHAR(50) NOT NULL DEFAULT 'LIVE',
    system_prompt TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agents_org ON public.agents(organization_id);

-- 3.2 Calls & Audio Telemetry
CREATE TABLE IF NOT EXISTS public.calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    caller_phone VARCHAR(50) NOT NULL,
    caller_name VARCHAR(255),
    direction VARCHAR(20) NOT NULL DEFAULT 'INBOUND',
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    intent VARCHAR(255),
    outcome VARCHAR(255),
    lead_rating VARCHAR(50) NOT NULL DEFAULT 'WARM',
    recording_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_calls_org_created ON public.calls(organization_id, created_at DESC);

-- 3.3 Leads Dossier
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    call_id UUID REFERENCES public.calls(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    city VARCHAR(100),
    requirement_summary TEXT,
    budget_or_fee VARCHAR(100),
    lead_rating VARCHAR(50) NOT NULL DEFAULT 'WARM',
    status VARCHAR(50) NOT NULL DEFAULT 'NEW',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leads_org ON public.leads(organization_id);

-- 3.4 Appointments & Consultations
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    service_type VARCHAR(255) NOT NULL,
    scheduled_time TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    status VARCHAR(50) NOT NULL DEFAULT 'CONFIRMED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_appointments_org ON public.appointments(organization_id);

-- 3.5 Knowledge Sources & Documents
CREATE TABLE IF NOT EXISTS public.knowledge_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    source_type VARCHAR(50) NOT NULL DEFAULT 'TEXT_DOCUMENT',
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_knowledge_org ON public.knowledge_sources(organization_id);

-- ==============================================================================
-- 4. ROW-LEVEL SECURITY (RLS) HELPER FUNCTIONS
-- ==============================================================================

-- Helper 1: Check if current auth user is an ACTIVE member of the given organization
CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Service role bypasses RLS for system operations
    IF NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
        RETURN TRUE;
    END IF;

    -- Standard authenticated user membership check
    RETURN EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = org_id
          AND user_id = auth.uid()
          AND status = 'ACTIVE'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper 2: Check if current auth user has at least the required role in the organization
CREATE OR REPLACE FUNCTION public.has_org_role(org_id UUID, required_role VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    user_role VARCHAR;
BEGIN
    -- Service role bypasses RLS
    IF NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
        RETURN TRUE;
    END IF;

    SELECT role INTO user_role
    FROM public.organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND status = 'ACTIVE';

    IF user_role IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Strict Role Hierarchy: OWNER (4) > ADMIN (3) > MANAGER (2) > VIEWER (1)
    IF required_role = 'VIEWER' THEN
        RETURN user_role IN ('OWNER', 'ADMIN', 'MANAGER', 'VIEWER');
    ELSIF required_role = 'MANAGER' THEN
        RETURN user_role IN ('OWNER', 'ADMIN', 'MANAGER');
    ELSIF required_role = 'ADMIN' THEN
        RETURN user_role IN ('OWNER', 'ADMIN');
    ELSIF required_role = 'OWNER' THEN
        RETURN user_role = 'OWNER';
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ==============================================================================
-- 5. ENABLE ROW-LEVEL SECURITY (RLS) & DEFINE STRICT POLICIES
-- ==============================================================================

-- 5.1 Profiles RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_policy" ON public.profiles
    FOR SELECT USING (
        id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.organization_members m1
            JOIN public.organization_members m2 ON m1.organization_id = m2.organization_id
            WHERE m1.user_id = auth.uid() AND m2.user_id = public.profiles.id
        )
        OR NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    );

CREATE POLICY "profiles_update_policy" ON public.profiles
    FOR UPDATE USING (
        id = auth.uid()
        OR NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    );

-- 5.2 Organizations RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizations_select_policy" ON public.organizations
    FOR SELECT USING (
        public.is_org_member(id)
        OR NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    );

CREATE POLICY "organizations_update_policy" ON public.organizations
    FOR UPDATE USING (
        public.has_org_role(id, 'ADMIN')
        OR NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    );

CREATE POLICY "organizations_delete_policy" ON public.organizations
    FOR DELETE USING (
        public.has_org_role(id, 'OWNER')
        OR NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    );

-- 5.3 Organization Members RLS
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_policy" ON public.organization_members
    FOR SELECT USING (
        public.is_org_member(organization_id)
        OR NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    );

CREATE POLICY "members_insert_policy" ON public.organization_members
    FOR INSERT WITH CHECK (
        public.has_org_role(organization_id, 'ADMIN')
        OR NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    );

CREATE POLICY "members_update_policy" ON public.organization_members
    FOR UPDATE USING (
        public.has_org_role(organization_id, 'ADMIN')
        OR NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    );

CREATE POLICY "members_delete_policy" ON public.organization_members
    FOR DELETE USING (
        public.has_org_role(organization_id, 'ADMIN')
        OR NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    );

-- 5.4 Audit Logs RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select_policy" ON public.audit_logs
    FOR SELECT USING (
        public.is_org_member(organization_id)
        OR NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    );

CREATE POLICY "audit_logs_insert_policy" ON public.audit_logs
    FOR INSERT WITH CHECK (
        NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    );

-- 5.5 Agents RLS
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents_select_policy" ON public.agents
    FOR SELECT USING (
        public.is_org_member(organization_id)
        OR NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    );

CREATE POLICY "agents_mutation_policy" ON public.agents
    FOR ALL USING (
        public.has_org_role(organization_id, 'MANAGER')
        OR NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    );

-- 5.6 Calls RLS
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calls_select_policy" ON public.calls
    FOR SELECT USING (
        public.is_org_member(organization_id)
        OR NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    );

CREATE POLICY "calls_insert_policy" ON public.calls
    FOR INSERT WITH CHECK (
        public.is_org_member(organization_id)
        OR NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    );

-- 5.7 Leads RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_select_policy" ON public.leads
    FOR SELECT USING (
        public.is_org_member(organization_id)
        OR NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    );

CREATE POLICY "leads_mutation_policy" ON public.leads
    FOR ALL USING (
        public.has_org_role(organization_id, 'MANAGER')
        OR NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    );

-- 5.8 Appointments RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointments_select_policy" ON public.appointments
    FOR SELECT USING (
        public.is_org_member(organization_id)
        OR NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    );

CREATE POLICY "appointments_mutation_policy" ON public.appointments
    FOR ALL USING (
        public.has_org_role(organization_id, 'MANAGER')
        OR NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    );

-- 5.9 Knowledge Sources RLS
ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_select_policy" ON public.knowledge_sources
    FOR SELECT USING (
        public.is_org_member(organization_id)
        OR NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    );

CREATE POLICY "knowledge_mutation_policy" ON public.knowledge_sources
    FOR ALL USING (
        public.has_org_role(organization_id, 'ADMIN')
        OR NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    );
