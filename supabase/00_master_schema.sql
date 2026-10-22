-- ==============================================================================
-- VANNI SI: CONSOLIDATED MASTER PRODUCTION SCHEMA (001 - 026)
-- Run this single file in Supabase Dashboard -> SQL Editor -> Click 'Run'
-- ==============================================================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ------------------------------------------------------------------------------
-- MIGRATION: 001_initial_schema.sql
-- ------------------------------------------------------------------------------
-- ==============================================================================
-- VANNI — Autonomous AI Employee Platform
-- Migration 001: Initial Multi-Tenant Schema & Row-Level Security (RLS)
-- Target: PostgreSQL 16+ / Supabase
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. TENANCY & ACCESS CONTROL DOMAIN
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    industry_type VARCHAR(50) NOT NULL DEFAULT 'REAL_ESTATE',
    billing_tier VARCHAR(50) NOT NULL DEFAULT 'GROWTH',
    monthly_minute_limit INTEGER NOT NULL DEFAULT 3000,
    minutes_used_current_month INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- Corresponds to auth.users(id) in Supabase
    role VARCHAR(50) NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('OWNER', 'ADMIN', 'OPERATOR', 'VIEWER')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- ==============================================================================
-- 2. BUSINESS BRAIN (SOURCE OF TRUTH) DOMAIN
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.business_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    legal_name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    primary_phone VARCHAR(20) NOT NULL,
    owner_whatsapp VARCHAR(20) NOT NULL,
    support_email VARCHAR(255),
    emergency_contact VARCHAR(20),
    primary_address TEXT,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL DEFAULT 'Karnataka',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.business_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun, 1=Mon, ..., 6=Sat
    opens_at TIME NOT NULL,
    closes_at TIME NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(organization_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS public.business_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    designation VARCHAR(100) NOT NULL, -- e.g. "Senior Implantologist", "Sales Lead"
    specialization VARCHAR(255),
    consultation_fee NUMERIC(10, 2),
    available_days SMALLINT[] NOT NULL DEFAULT '{1,2,3,4,5,6}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.business_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    price_minimum NUMERIC(12, 2),
    price_maximum NUMERIC(12, 2),
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    description TEXT,
    is_bookable_by_ai BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 3. INDUSTRY TEMPLATES DOMAIN
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.industry_templates (
    id VARCHAR(50) PRIMARY KEY, -- 'dental_clinic', 'healthcare_clinic', 'real_estate_plots'
    display_name VARCHAR(100) NOT NULL,
    version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    default_system_prompt TEXT NOT NULL,
    allowed_tools JSONB NOT NULL DEFAULT '[]',
    qualification_schema JSONB NOT NULL DEFAULT '{}',
    safety_guardrails JSONB NOT NULL DEFAULT '{}',
    terminology_lexicon JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. AGENTS & RUNTIME PROFILES DOMAIN
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    industry_template_id VARCHAR(50) REFERENCES public.industry_templates(id),
    name VARCHAR(100) NOT NULL DEFAULT 'Sahana',
    voice_gender VARCHAR(20) NOT NULL DEFAULT 'FEMALE',
    voice_engine VARCHAR(50) NOT NULL DEFAULT 'sarvam_bulbul_v2',
    voice_speaker_id VARCHAR(50) NOT NULL DEFAULT 'meera',
    primary_dialect VARCHAR(50) NOT NULL DEFAULT 'KANGLISH_BUSINESS',
    speech_pace NUMERIC(3, 2) NOT NULL DEFAULT 1.05,
    virtual_phone_number VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    active_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agent_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    system_prompt TEXT NOT NULL,
    tools_config JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(agent_id, version_number)
);

-- ==============================================================================
-- 5. TELEPHONY SESSIONS, TRANSCRIPTS & CALL EVENTS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.agents(id),
    agent_version INTEGER NOT NULL DEFAULT 1,
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    caller_phone VARCHAR(20) NOT NULL,
    caller_name VARCHAR(100),
    city VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'QUEUED',
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    cost_inr NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
    telephony_provider VARCHAR(50) NOT NULL DEFAULT 'EXOTEL',
    telephony_call_sid VARCHAR(100),
    audio_recording_url TEXT,
    lead_rating VARCHAR(30) CHECK (lead_rating IN ('HOT', 'WARM', 'COLD', 'DISQUALIFIED')),
    summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID UNIQUE NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    turns JSONB NOT NULL DEFAULT '[]', -- Array of { speaker, text, timestampMs, latencyBreakdown }
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.call_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- STT_START, INTENT_DETECTED, LLM_START, TTS_START, USER_BARGE_IN, TOOL_DISPATCH
    payload JSONB,
    latency_ms INTEGER,
    timestamp_ms BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 6. BUSINESS ACTIONS (LEADS & APPOINTMENTS) DOMAIN
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    call_id UUID REFERENCES public.calls(id) ON DELETE SET NULL,
    contact_phone VARCHAR(20) NOT NULL,
    contact_name VARCHAR(100),
    rating VARCHAR(20) NOT NULL DEFAULT 'WARM' CHECK (rating IN ('HOT', 'WARM', 'COLD', 'DISQUALIFIED')),
    budget VARCHAR(100),
    intent VARCHAR(255) NOT NULL,
    confirmed_outcome TEXT,
    whatsapp_dispatched BOOLEAN NOT NULL DEFAULT FALSE,
    crm_synced BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    call_id UUID REFERENCES public.calls(id) ON DELETE SET NULL,
    contact_phone VARCHAR(20) NOT NULL,
    contact_name VARCHAR(100),
    service_id UUID REFERENCES public.business_services(id),
    staff_id UUID REFERENCES public.business_staff(id),
    appointment_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'CANCELLED', 'RESCHEDULED', 'COMPLETED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 7. ROW-LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Helper function to identify current authenticated user's organization memberships
CREATE OR REPLACE FUNCTION public.current_user_org_ids()
RETURNS SETOF UUID AS $$
BEGIN
    -- If running in Supabase context with auth.uid()
    RETURN QUERY
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Organization Policies
CREATE POLICY org_member_select ON public.organizations
    FOR SELECT USING (id IN (SELECT public.current_user_org_ids()));

-- Calls Policies
CREATE POLICY calls_tenant_isolation ON public.calls
    FOR ALL USING (organization_id IN (SELECT public.current_user_org_ids()));

-- Leads Policies
CREATE POLICY leads_tenant_isolation ON public.leads
    FOR ALL USING (organization_id IN (SELECT public.current_user_org_ids()));

-- Transcripts Policies
CREATE POLICY transcripts_tenant_isolation ON public.transcripts
    FOR ALL USING (organization_id IN (SELECT public.current_user_org_ids()));

-- Appointments Policies
CREATE POLICY appointments_tenant_isolation ON public.appointments
    FOR ALL USING (organization_id IN (SELECT public.current_user_org_ids()));

-- Business Brain Policies
CREATE POLICY profiles_tenant_isolation ON public.business_profiles
    FOR ALL USING (organization_id IN (SELECT public.current_user_org_ids()));

CREATE POLICY services_tenant_isolation ON public.business_services
    FOR ALL USING (organization_id IN (SELECT public.current_user_org_ids()));

CREATE POLICY staff_tenant_isolation ON public.business_staff
    FOR ALL USING (organization_id IN (SELECT public.current_user_org_ids()));


-- ------------------------------------------------------------------------------
-- MIGRATION: 002_rls_policies.sql
-- ------------------------------------------------------------------------------
-- =========================================================================
-- VANNI — 002_rls_policies.sql (Reconciled Multi-Tenant Security)
-- PostgreSQL Row-Level Security Policies for Strict Organization Data Isolation
-- =========================================================================

-- Enable RLS across all operational tables defined in 001_initial_schema
ALTER TABLE IF EXISTS public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.call_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.business_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.business_services ENABLE ROW LEVEL SECURITY;

-- Helper function to extract organization_id from JWT or active membership
CREATE OR REPLACE FUNCTION public.current_org_id() RETURNS UUID AS $$
BEGIN
  -- Service role bypasses RLS for system operations
  IF NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
    RETURN NULL;
  END IF;
  RETURN NULLIF(current_setting('request.jwt.claim.organization_id', true), '')::UUID;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Reusable predicate: is the current user an active member of target organization?
CREATE OR REPLACE FUNCTION public.is_member_of_org(target_org_id UUID) RETURNS BOOLEAN AS $$
BEGIN
  IF NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = target_org_id
      AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 1. Organizations Policy: Members can view their own organization
DROP POLICY IF EXISTS org_isolation_organizations ON public.organizations;
CREATE POLICY org_isolation_organizations ON public.organizations
  FOR ALL
  USING (
    public.is_member_of_org(id) OR
    current_setting('request.jwt.claim.role', true) = 'service_role'
  );

-- 2. Organization Members Policy
DROP POLICY IF EXISTS org_isolation_members ON public.organization_members;
CREATE POLICY org_isolation_members ON public.organization_members
  FOR ALL
  USING (
    public.is_member_of_org(organization_id) OR
    user_id = auth.uid() OR
    current_setting('request.jwt.claim.role', true) = 'service_role'
  );

-- 3. Agents Policy
DROP POLICY IF EXISTS org_isolation_agents ON public.agents;
CREATE POLICY org_isolation_agents ON public.agents
  FOR ALL
  USING (
    public.is_member_of_org(organization_id) OR
    current_setting('request.jwt.claim.role', true) = 'service_role'
  );

-- 4. Calls Policy
DROP POLICY IF EXISTS org_isolation_calls ON public.calls;
CREATE POLICY org_isolation_calls ON public.calls
  FOR ALL
  USING (
    public.is_member_of_org(organization_id) OR
    current_setting('request.jwt.claim.role', true) = 'service_role'
  );

-- 5. Transcripts Policy
DROP POLICY IF EXISTS org_isolation_transcripts ON public.transcripts;
CREATE POLICY org_isolation_transcripts ON public.transcripts
  FOR ALL
  USING (
    public.is_member_of_org(organization_id) OR
    current_setting('request.jwt.claim.role', true) = 'service_role'
  );

-- 6. Leads Policy
DROP POLICY IF EXISTS org_isolation_leads ON public.leads;
CREATE POLICY org_isolation_leads ON public.leads
  FOR ALL
  USING (
    public.is_member_of_org(organization_id) OR
    current_setting('request.jwt.claim.role', true) = 'service_role'
  );

-- 7. Appointments Policy
DROP POLICY IF EXISTS org_isolation_appointments ON public.appointments;
CREATE POLICY org_isolation_appointments ON public.appointments
  FOR ALL
  USING (
    public.is_member_of_org(organization_id) OR
    current_setting('request.jwt.claim.role', true) = 'service_role'
  );


-- ------------------------------------------------------------------------------
-- MIGRATION: 003_auth_and_multitenancy.sql
-- ------------------------------------------------------------------------------
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


-- ------------------------------------------------------------------------------
-- MIGRATION: 004_business_brain_foundation.sql
-- ------------------------------------------------------------------------------
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


-- ------------------------------------------------------------------------------
-- MIGRATION: 005_knowledge_ingestion_and_retrieval.sql
-- ------------------------------------------------------------------------------
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


-- ------------------------------------------------------------------------------
-- MIGRATION: 006_ai_employee_builder.sql
-- ------------------------------------------------------------------------------
-- ==============================================================================
-- VANNI AI Employee / Agent Builder Migration (Prompt 08)
-- Tables: ai_employees, ai_employee_versions, ai_employee_test_sessions
-- Features: Strict Tenant Isolation, RLS Policies, Version Snapshots, Auditability
-- ==============================================================================

-- 1. AI Employees Core Table
CREATE TABLE IF NOT EXISTS public.ai_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    description TEXT,
    role VARCHAR(50) NOT NULL DEFAULT 'AI_RECEPTIONIST',
    industry VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT', -- DRAFT, TESTING, ACTIVE, PAUSED, ARCHIVED
    active_version INT NOT NULL DEFAULT 1,
    active_version_id UUID,

    -- Structured Configuration JSONBs
    identity_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    objective_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    personality_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    language_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    capabilities_config JSONB NOT NULL DEFAULT '[]'::jsonb,
    knowledge_access_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    tools_config JSONB NOT NULL DEFAULT '[]'::jsonb,
    escalation_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    policy_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    conversation_rules_config JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_employees_org ON public.ai_employees(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_employees_status ON public.ai_employees(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_employees_role ON public.ai_employees(organization_id, role);

-- 2. AI Employee Versions (Immutable Snapshots & Rollback History)
CREATE TABLE IF NOT EXISTS public.ai_employee_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.ai_employees(id) ON DELETE CASCADE,
    version INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT', -- DRAFT, PUBLISHED, ACTIVE, ARCHIVED
    changelog TEXT,
    snapshot JSONB NOT NULL, -- Complete AgentRuntimeConfig snapshot
    published_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(agent_id, version)
);

CREATE INDEX IF NOT EXISTS idx_ai_emp_versions_agent ON public.ai_employee_versions(agent_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_ai_emp_versions_org ON public.ai_employee_versions(organization_id);

-- 3. AI Employee Test Sessions (Simulation & QA Logs)
CREATE TABLE IF NOT EXISTS public.ai_employee_test_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.ai_employees(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 1,
    session_title VARCHAR(255) NOT NULL DEFAULT 'Interactive Simulation',
    turns JSONB NOT NULL DEFAULT '[]'::jsonb,
    evaluation_summary JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_emp_tests_agent ON public.ai_employee_test_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_emp_tests_org ON public.ai_employee_test_sessions(organization_id);

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.ai_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_employee_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_employee_test_sessions ENABLE ROW LEVEL SECURITY;

-- 4.1 AI Employees RLS
CREATE POLICY "ai_employees_select_policy" ON public.ai_employees
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_memberships
            WHERE user_id = auth.uid() AND status = 'ACTIVE'
        )
    );

CREATE POLICY "ai_employees_insert_policy" ON public.ai_employees
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_memberships
            WHERE user_id = auth.uid() 
              AND status = 'ACTIVE' 
              AND role IN ('OWNER', 'ADMIN', 'MANAGER')
        )
    );

CREATE POLICY "ai_employees_update_policy" ON public.ai_employees
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_memberships
            WHERE user_id = auth.uid() 
              AND status = 'ACTIVE' 
              AND role IN ('OWNER', 'ADMIN', 'MANAGER')
        )
    );

CREATE POLICY "ai_employees_delete_policy" ON public.ai_employees
    FOR DELETE USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_memberships
            WHERE user_id = auth.uid() 
              AND status = 'ACTIVE' 
              AND role IN ('OWNER', 'ADMIN')
        )
    );

-- 4.2 AI Employee Versions RLS
CREATE POLICY "ai_employee_versions_select_policy" ON public.ai_employee_versions
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_memberships
            WHERE user_id = auth.uid() AND status = 'ACTIVE'
        )
    );

CREATE POLICY "ai_employee_versions_mutation_policy" ON public.ai_employee_versions
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_memberships
            WHERE user_id = auth.uid() 
              AND status = 'ACTIVE' 
              AND role IN ('OWNER', 'ADMIN', 'MANAGER')
        )
    );

-- 4.3 AI Employee Test Sessions RLS
CREATE POLICY "ai_employee_test_sessions_policy" ON public.ai_employee_test_sessions
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_memberships
            WHERE user_id = auth.uid() AND status = 'ACTIVE'
        )
    );


-- ------------------------------------------------------------------------------
-- MIGRATION: 007_conversation_orchestration_engine.sql
-- ------------------------------------------------------------------------------
-- ==============================================================================
-- Migration 007: VANNI Conversation Orchestration Engine
-- Channel-independent conversation lifecycle, state transitions, message stream,
-- server-enforced tool calls, human handoffs, and multi-tenant RLS isolation.
-- ==============================================================================

-- 1. Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
    id TEXT PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL,
    agent_version INTEGER NOT NULL DEFAULT 1,
    channel VARCHAR(30) NOT NULL DEFAULT 'WEB_CHAT',
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    current_state VARCHAR(30) NOT NULL DEFAULT 'IDLE',
    detected_language VARCHAR(20) NOT NULL DEFAULT 'en',
    customer_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    active_tool_name VARCHAR(100),
    pending_confirmation_tool JSONB,
    summary_id TEXT,
    handoff_id TEXT,
    end_reason VARCHAR(50),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_org ON public.conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_conversations_agent ON public.conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_state ON public.conversations(current_state);

-- 2. Conversation Messages Table
CREATE TABLE IF NOT EXISTS public.conversation_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    speaker VARCHAR(20) NOT NULL,
    message_type VARCHAR(30) NOT NULL DEFAULT 'TEXT',
    content TEXT NOT NULL,
    language VARCHAR(20),
    sequence_number INTEGER NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_messages_conv ON public.conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_messages_org ON public.conversation_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_conv_messages_seq ON public.conversation_messages(conversation_id, sequence_number);

-- 3. Conversation Events Table (Idempotent Event Log)
CREATE TABLE IF NOT EXISTS public.conversation_events (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    idempotency_key VARCHAR(150),
    previous_state VARCHAR(30) NOT NULL,
    new_state VARCHAR(30) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_events_conv ON public.conversation_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_events_idemp ON public.conversation_events(conversation_id, idempotency_key);

-- 4. Conversation Tool Calls Table
CREATE TABLE IF NOT EXISTS public.conversation_tool_calls (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    tool_name VARCHAR(100) NOT NULL,
    arguments JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_PERMISSION',
    requires_confirmation BOOLEAN NOT NULL DEFAULT false,
    is_confirmed BOOLEAN NOT NULL DEFAULT false,
    result JSONB,
    error_message TEXT,
    execution_duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_conv_tool_calls_conv ON public.conversation_tool_calls(conversation_id);

-- 5. Conversation Handoffs Table
CREATE TABLE IF NOT EXISTS public.conversation_handoffs (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    reason VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    destination_type VARCHAR(50) NOT NULL DEFAULT 'RECEPTION',
    destination_target TEXT NOT NULL,
    handoff_summary TEXT NOT NULL,
    customer_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_emergency_casualty BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_handoffs_conv ON public.conversation_handoffs(conversation_id);

-- 6. Conversation Summaries Table
CREATE TABLE IF NOT EXISTS public.conversation_summaries (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    customer_goal TEXT NOT NULL,
    important_details JSONB NOT NULL DEFAULT '[]'::jsonb,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    open_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    actions_completed JSONB NOT NULL DEFAULT '[]'::jsonb,
    actions_pending JSONB NOT NULL DEFAULT '[]'::jsonb,
    escalation_status VARCHAR(50) NOT NULL DEFAULT 'NONE',
    turn_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_summaries_conv ON public.conversation_summaries(conversation_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_tool_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;

-- 1. Conversations RLS
CREATE POLICY conversations_tenant_select ON public.conversations
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY conversations_tenant_all ON public.conversations
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

-- 2. Conversation Messages RLS
CREATE POLICY conv_messages_tenant_select ON public.conversation_messages
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY conv_messages_tenant_all ON public.conversation_messages
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

-- 3. Conversation Events RLS
CREATE POLICY conv_events_tenant_select ON public.conversation_events
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY conv_events_tenant_all ON public.conversation_events
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

-- 4. Conversation Tool Calls RLS
CREATE POLICY conv_tools_tenant_select ON public.conversation_tool_calls
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY conv_tools_tenant_all ON public.conversation_tool_calls
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

-- 5. Conversation Handoffs RLS
CREATE POLICY conv_handoffs_tenant_select ON public.conversation_handoffs
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY conv_handoffs_tenant_all ON public.conversation_handoffs
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

-- 6. Conversation Summaries RLS
CREATE POLICY conv_summaries_tenant_select ON public.conversation_summaries
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY conv_summaries_tenant_all ON public.conversation_summaries
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );


-- ------------------------------------------------------------------------------
-- MIGRATION: 008_kannada_language_intelligence.sql
-- ------------------------------------------------------------------------------
-- ==============================================================================
-- VANNI Migration 008: Kannada + Kanglish Conversation Intelligence Layer
-- ==============================================================================

-- 1. Business Language Profiles
CREATE TABLE IF NOT EXISTS public.business_language_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  primary_language TEXT NOT NULL DEFAULT 'kn-en', -- 'en', 'kn', 'kn-en'
  allowed_languages TEXT[] NOT NULL DEFAULT ARRAY['en', 'kn', 'kn-en'],
  auto_detect_enabled BOOLEAN NOT NULL DEFAULT true,
  code_switching_allowed BOOLEAN NOT NULL DEFAULT true,
  preferred_register TEXT NOT NULL DEFAULT 'PROFESSIONAL', -- 'FORMAL', 'PROFESSIONAL', 'NEUTRAL', 'FRIENDLY', 'CASUAL'
  honorific_preference TEXT NOT NULL DEFAULT 'NIMMA', -- 'AVARU', 'NIMMA', 'SIR_MADAM', 'NONE'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_business_language_profile UNIQUE (organization_id)
);

-- 2. Business Terminology & Aliases (Tenant-Isolated with Global Platform Fallbacks)
CREATE TABLE IF NOT EXISTS public.terminology_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE, -- NULL indicates global platform terminology
  canonical_term TEXT NOT NULL,
  entity_type TEXT NOT NULL, -- 'SERVICE', 'STAFF', 'LOCATION', 'APPOINTMENT', 'POLICY', 'PROPERTY'
  entity_id TEXT, -- Foreign reference to Business Brain entity (e.g. service UUID)
  english_aliases TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  kannada_aliases TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  kanglish_aliases TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Pronunciation & TTS Spoken Hints
CREATE TABLE IF NOT EXISTS public.pronunciation_hints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  display_text TEXT NOT NULL,
  spoken_text_kannada TEXT NOT NULL,
  spoken_text_english TEXT NOT NULL,
  phonetic_hint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_lang_prof_org ON public.business_language_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_term_alias_org ON public.terminology_aliases(organization_id);
CREATE INDEX IF NOT EXISTS idx_term_alias_term ON public.terminology_aliases(canonical_term);
CREATE INDEX IF NOT EXISTS idx_pronunc_org ON public.pronunciation_hints(organization_id);

-- Enable Row-Level Security (RLS)
ALTER TABLE public.business_language_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminology_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pronunciation_hints ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Business Language Profiles
CREATE POLICY "Language profiles viewable by organization members"
  ON public.business_language_profiles
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'ACTIVE'
    )
  );

CREATE POLICY "Language profiles manageable by organization admins"
  ON public.business_language_profiles
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'ACTIVE' AND role IN ('OWNER', 'ADMIN')
    )
  );

-- RLS Policies for Terminology Aliases (Tenant-isolated or Global NULL)
CREATE POLICY "Terminology aliases viewable by org members or global"
  ON public.terminology_aliases
  FOR SELECT
  USING (
    organization_id IS NULL OR
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'ACTIVE'
    )
  );

CREATE POLICY "Terminology aliases manageable by org admins"
  ON public.terminology_aliases
  FOR ALL
  USING (
    organization_id IS NOT NULL AND
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'ACTIVE' AND role IN ('OWNER', 'ADMIN')
    )
  );

-- RLS Policies for Pronunciation Hints
CREATE POLICY "Pronunciation hints viewable by org members or global"
  ON public.pronunciation_hints
  FOR SELECT
  USING (
    organization_id IS NULL OR
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'ACTIVE'
    )
  );

CREATE POLICY "Pronunciation hints manageable by org admins"
  ON public.pronunciation_hints
  FOR ALL
  USING (
    organization_id IS NOT NULL AND
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'ACTIVE' AND role IN ('OWNER', 'ADMIN')
    )
  );


-- ------------------------------------------------------------------------------
-- MIGRATION: 009_realtime_voice_engine.sql
-- ------------------------------------------------------------------------------
-- 009_realtime_voice_engine.sql
-- Database Migration for VANNI Real-Time Voice Engine

CREATE TABLE IF NOT EXISTS voice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voice_session_id VARCHAR(64) UNIQUE NOT NULL,
    conversation_id VARCHAR(64) NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id VARCHAR(64) NOT NULL,
    agent_version_id VARCHAR(64),
    channel VARCHAR(32) NOT NULL DEFAULT 'BROWSER', -- 'BROWSER', 'TELEPHONY', 'WEBRTC'
    direction VARCHAR(16) NOT NULL DEFAULT 'INBOUND', -- 'INBOUND', 'OUTBOUND'
    participant_phone VARCHAR(32),
    language VARCHAR(16) NOT NULL DEFAULT 'kn-IN', -- 'kn-IN', 'en-IN', 'kn-en'
    codec VARCHAR(16) NOT NULL DEFAULT 'pcm16', -- 'pcm16', 'mulaw', 'opus'
    sample_rate INTEGER NOT NULL DEFAULT 16000,
    session_state VARCHAR(32) NOT NULL DEFAULT 'CREATED', -- 'CREATED', 'CONNECTING', 'CONNECTED', 'LISTENING', 'PROCESSING', 'SPEAKING', 'INTERRUPTED', 'RECONNECTING', 'ENDING', 'ENDED', 'FAILED'
    connection_state VARCHAR(32) NOT NULL DEFAULT 'DISCONNECTED', -- 'CONNECTED', 'DISCONNECTED', 'RECONNECTING'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    connected_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    failure_reason TEXT,
    correlation_id VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_voice_sessions_org ON voice_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_conv ON voice_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_session_id ON voice_sessions(voice_session_id);

-- Operational and Diagnostic Events
CREATE TABLE IF NOT EXISTS voice_session_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voice_session_id VARCHAR(64) NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    sequence_number INTEGER NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_voice_events_session ON voice_session_events(voice_session_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_voice_events_org ON voice_session_events(organization_id);

-- Performance & Latency Metrics per Turn
CREATE TABLE IF NOT EXISTS voice_session_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voice_session_id VARCHAR(64) NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    turn_id VARCHAR(64),
    stt_latency_ms INTEGER,
    first_token_latency_ms INTEGER,
    tts_latency_ms INTEGER,
    turn_duration_ms INTEGER,
    total_audio_duration_seconds NUMERIC(10, 2) DEFAULT 0,
    was_interrupted BOOLEAN DEFAULT FALSE,
    reconnect_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_metrics_session ON voice_session_metrics(voice_session_id);
CREATE INDEX IF NOT EXISTS idx_voice_metrics_org ON voice_session_metrics(organization_id);

-- Enable RLS
ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_session_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_session_metrics ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
CREATE POLICY "Tenant isolation for voice_sessions"
    ON voice_sessions FOR ALL
    USING (organization_id = (current_setting('app.current_organization_id', true))::uuid)
    WITH CHECK (organization_id = (current_setting('app.current_organization_id', true))::uuid);

CREATE POLICY "Tenant isolation for voice_session_events"
    ON voice_session_events FOR ALL
    USING (organization_id = (current_setting('app.current_organization_id', true))::uuid)
    WITH CHECK (organization_id = (current_setting('app.current_organization_id', true))::uuid);

CREATE POLICY "Tenant isolation for voice_session_metrics"
    ON voice_session_metrics FOR ALL
    USING (organization_id = (current_setting('app.current_organization_id', true))::uuid)
    WITH CHECK (organization_id = (current_setting('app.current_organization_id', true))::uuid);


-- ------------------------------------------------------------------------------
-- MIGRATION: 010_telephony_gateway.sql
-- ------------------------------------------------------------------------------
-- 010_telephony_gateway.sql
-- Database Migration for VANNI Telephony Gateway & Inbound Call Engine

-- Business Phone Numbers managed by Organization
CREATE TABLE IF NOT EXISTS business_phone_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    phone_number VARCHAR(32) UNIQUE NOT NULL, -- e.g. '+918047192001' or '08047192001'
    country_code VARCHAR(8) NOT NULL DEFAULT '+91',
    provider VARCHAR(32) NOT NULL DEFAULT 'exotel', -- 'exotel', 'mock', 'twilio'
    provider_number_id VARCHAR(128),
    assigned_agent_id VARCHAR(64), -- ID of the assigned published AI Employee
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE', 'PROVISIONING', 'SUSPENDED'
    capabilities JSONB NOT NULL DEFAULT '["INBOUND_CALLS", "MEDIA_STREAMING"]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_numbers_org ON business_phone_numbers(organization_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_number ON business_phone_numbers(phone_number);

-- Telephony Call Sessions (Phone-level tracking linking to voice_sessions and conversations)
CREATE TABLE IF NOT EXISTS telephony_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telephony_session_id VARCHAR(64) UNIQUE NOT NULL,
    provider_call_sid VARCHAR(128) NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    phone_number_id UUID REFERENCES business_phone_numbers(id) ON DELETE SET NULL,
    assigned_agent_id VARCHAR(64) NOT NULL,
    conversation_id VARCHAR(64) NOT NULL,
    voice_session_id VARCHAR(64) NOT NULL,
    direction VARCHAR(16) NOT NULL DEFAULT 'INBOUND', -- 'INBOUND', 'OUTBOUND'
    caller_phone_number VARCHAR(32) NOT NULL,
    destination_phone_number VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'RECEIVED', -- 'RECEIVED', 'RINGING', 'ANSWERED', 'ACTIVE', 'TRANSFER_PENDING', 'TRANSFERRED', 'ENDED', 'FAILED'
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    answered_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0,
    end_reason VARCHAR(64), -- 'CALLER_HANGUP', 'AI_HANGUP', 'TRANSFERRED', 'TIMEOUT', 'FAILED'
    call_outcome VARCHAR(64) DEFAULT 'UNKNOWN', -- 'INFORMATION_PROVIDED', 'LEAD_CAPTURED', 'APPOINTMENT_CONFIRMED', 'TRANSFERRED_TO_HUMAN', 'UNKNOWN'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telephony_sessions_org ON telephony_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_telephony_sessions_provider_sid ON telephony_sessions(provider_call_sid);
CREATE INDEX IF NOT EXISTS idx_telephony_sessions_conv ON telephony_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_telephony_sessions_voice ON telephony_sessions(voice_session_id);

-- Telephony Events Log (Idempotency and Timeline)
CREATE TABLE IF NOT EXISTS telephony_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_event_id VARCHAR(128) UNIQUE NOT NULL, -- Idempotency key from provider
    telephony_session_id VARCHAR(64) NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    sequence_number INTEGER NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_telephony_events_session ON telephony_events(telephony_session_id);
CREATE INDEX IF NOT EXISTS idx_telephony_events_org ON telephony_events(organization_id);

-- Organization Telephony Settings
CREATE TABLE IF NOT EXISTS organization_telephony_settings (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    default_agent_id VARCHAR(64),
    initial_silence_timeout_seconds INTEGER NOT NULL DEFAULT 6,
    conversation_silence_timeout_seconds INTEGER NOT NULL DEFAULT 8,
    max_call_duration_seconds INTEGER NOT NULL DEFAULT 600, -- 10 mins max
    default_transfer_phone_number VARCHAR(32),
    enable_recording BOOLEAN NOT NULL DEFAULT FALSE,
    ai_disclosure_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE business_phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE telephony_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE telephony_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_telephony_settings ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
CREATE POLICY "Tenant isolation for business_phone_numbers"
    ON business_phone_numbers FOR ALL
    USING (organization_id = (current_setting('app.current_organization_id', true))::uuid)
    WITH CHECK (organization_id = (current_setting('app.current_organization_id', true))::uuid);

CREATE POLICY "Tenant isolation for telephony_sessions"
    ON telephony_sessions FOR ALL
    USING (organization_id = (current_setting('app.current_organization_id', true))::uuid)
    WITH CHECK (organization_id = (current_setting('app.current_organization_id', true))::uuid);

CREATE POLICY "Tenant isolation for telephony_events"
    ON telephony_events FOR ALL
    USING (organization_id = (current_setting('app.current_organization_id', true))::uuid)
    WITH CHECK (organization_id = (current_setting('app.current_organization_id', true))::uuid);

CREATE POLICY "Tenant isolation for organization_telephony_settings"
    ON organization_telephony_settings FOR ALL
    USING (organization_id = (current_setting('app.current_organization_id', true))::uuid)
    WITH CHECK (organization_id = (current_setting('app.current_organization_id', true))::uuid);


-- ------------------------------------------------------------------------------
-- MIGRATION: 011_action_and_tool_engine.sql
-- ------------------------------------------------------------------------------
-- 011_action_and_tool_engine.sql
-- Database Migration for VANNI Action & Tool Execution Engine
-- Strict Multi-Tenant Business Execution Layer (Customers, Leads, Appointments, Callbacks, Follow-ups, Audit Events)

-- ==============================================================================
-- 1. CUSTOMERS DOMAIN (TENANT BOUNDED)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    phone VARCHAR(32) NOT NULL, -- Normalized E.164 (e.g. +919876543210)
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    city VARCHAR(100),
    preferred_language VARCHAR(50) DEFAULT 'KANGLISH_BUSINESS',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_customer_org_phone UNIQUE(organization_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_customers_org_phone ON public.customers(organization_id, phone);
CREATE INDEX IF NOT EXISTS idx_customers_org_email ON public.customers(organization_id, email) WHERE email IS NOT NULL;

-- ==============================================================================
-- 2. LEADS DOMAIN (STRUCTURED QUALIFICATION & INDUSTRY ATTRIBUTES)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.business_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL DEFAULT 'PHONE' CHECK (source IN ('PHONE', 'WEBSITE', 'META', 'GOOGLE', 'WHATSAPP', 'MANUAL', 'OTHER')),
    campaign_id VARCHAR(100),
    conversation_id VARCHAR(64),
    status VARCHAR(50) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED', 'LOST', 'DO_NOT_CONTACT')),
    stage VARCHAR(50) NOT NULL DEFAULT 'INQUIRY',
    interest TEXT NOT NULL, -- Service or property requirement
    budget VARCHAR(100),
    location VARCHAR(150),
    preferred_timeline VARCHAR(100),
    notes TEXT,
    qualification_status VARCHAR(50) NOT NULL DEFAULT 'PARTIALLY_QUALIFIED' CHECK (qualification_status IN ('UNQUALIFIED', 'PARTIALLY_QUALIFIED', 'QUALIFIED', 'DISQUALIFIED')),
    qualification_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    assigned_to UUID,
    idempotency_key VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_lead_idempotency UNIQUE(organization_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_business_leads_org_status ON public.business_leads(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_business_leads_customer ON public.business_leads(customer_id);
CREATE INDEX IF NOT EXISTS idx_business_leads_conversation ON public.business_leads(conversation_id);

-- ==============================================================================
-- 3. APPOINTMENTS & SCHEDULING DOMAIN (ATOMIC CONFLICT PREVENTION)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.business_appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    service_id UUID REFERENCES public.business_services(id) ON DELETE SET NULL,
    staff_id UUID REFERENCES public.business_staff(id) ON DELETE SET NULL,
    location_id UUID REFERENCES public.business_profiles(id) ON DELETE SET NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    status VARCHAR(50) NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('REQUESTED', 'CONFIRMED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED', 'NO_SHOW', 'EXPIRED')),
    source VARCHAR(50) NOT NULL DEFAULT 'AI_VOICE' CHECK (source IN ('AI_VOICE', 'MANUAL', 'WEB', 'WHATSAPP')),
    conversation_id VARCHAR(64),
    cancellation_reason TEXT,
    rescheduled_from_id UUID REFERENCES public.business_appointments(id) ON DELETE SET NULL,
    idempotency_key VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_appointment_idempotency UNIQUE(organization_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_appointments_org_time ON public.business_appointments(organization_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_appointments_customer ON public.business_appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_staff ON public.business_appointments(staff_id) WHERE staff_id IS NOT NULL;

-- Partial unique index to enforce strict double-booking prevention for active staff slots
CREATE UNIQUE INDEX IF NOT EXISTS uq_appointment_staff_slot 
ON public.business_appointments(organization_id, staff_id, start_time) 
WHERE status IN ('REQUESTED', 'CONFIRMED') AND staff_id IS NOT NULL;

-- ==============================================================================
-- 4. CALLBACK REQUESTS & FOLLOW-UP TASKS DOMAIN
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.callback_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    conversation_id VARCHAR(64),
    preferred_time VARCHAR(100) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'PENDING', 'COMPLETED', 'CANCELLED')),
    assigned_team VARCHAR(100) DEFAULT 'SALES_TEAM',
    idempotency_key VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_callback_idempotency UNIQUE(organization_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_callbacks_org_status ON public.callback_requests(organization_id, status);

CREATE TABLE IF NOT EXISTS public.follow_up_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.business_leads(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES public.business_appointments(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    assigned_to UUID,
    idempotency_key VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_followup_idempotency UNIQUE(organization_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_follow_ups_org_status ON public.follow_up_tasks(organization_id, status);

-- ==============================================================================
-- 5. AUDIT LOG & OPERATIONAL TOOL TRACE DOMAIN
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.tool_execution_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    conversation_id VARCHAR(64) NOT NULL,
    agent_id VARCHAR(64) NOT NULL,
    agent_version INTEGER NOT NULL DEFAULT 1,
    tool_name VARCHAR(100) NOT NULL,
    tool_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    requested_by VARCHAR(50) NOT NULL DEFAULT 'AI_AGENT' CHECK (requested_by IN ('AI_AGENT', 'HUMAN', 'SYSTEM')),
    correlation_id VARCHAR(64) NOT NULL,
    lifecycle_state VARCHAR(50) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    status VARCHAR(50) NOT NULL, -- SUCCEEDED, FAILED, POLICY_BLOCKED, etc.
    arguments_sanitized JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_sanitized JSONB,
    error_code VARCHAR(100),
    user_safe_message TEXT,
    execution_duration_ms INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_events_org_conv ON public.tool_execution_events(organization_id, conversation_id);
CREATE INDEX IF NOT EXISTS idx_tool_events_corr ON public.tool_execution_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_tool_events_name ON public.tool_execution_events(organization_id, tool_name);

-- ==============================================================================
-- 6. ROW-LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.callback_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_execution_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY customers_tenant_isolation ON public.customers
    FOR ALL USING (organization_id IN (SELECT public.current_user_org_ids()));

CREATE POLICY business_leads_tenant_isolation ON public.business_leads
    FOR ALL USING (organization_id IN (SELECT public.current_user_org_ids()));

CREATE POLICY business_appointments_tenant_isolation ON public.business_appointments
    FOR ALL USING (organization_id IN (SELECT public.current_user_org_ids()));

CREATE POLICY callback_requests_tenant_isolation ON public.callback_requests
    FOR ALL USING (organization_id IN (SELECT public.current_user_org_ids()));

CREATE POLICY follow_up_tasks_tenant_isolation ON public.follow_up_tasks
    FOR ALL USING (organization_id IN (SELECT public.current_user_org_ids()));

CREATE POLICY tool_execution_events_tenant_isolation ON public.tool_execution_events
    FOR ALL USING (organization_id IN (SELECT public.current_user_org_ids()));


-- ------------------------------------------------------------------------------
-- MIGRATION: 012_crm_and_lead_management.sql
-- ------------------------------------------------------------------------------
-- 012_crm_and_lead_management.sql
-- Database Migration for VANNI CRM, Contacts & Lead Management Engine
-- Strict Multi-Tenant Operating Layer (Contacts, Leads, Activities, Opportunities, Suppression & Import)

-- ==============================================================================
-- 1. CONTACTS DOMAIN (REFINEMENT & SUPPRESSION)
-- ==============================================================================
-- Enhances public.customers or establishes public.contacts as the canonical contact entity
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    display_name VARCHAR(255) NOT NULL,
    phone VARCHAR(32) NOT NULL, -- Normalized E.164 (e.g. +919876543210)
    email VARCHAR(255),
    preferred_language VARCHAR(50) DEFAULT 'KANGLISH_BUSINESS',
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    city VARCHAR(100),
    location TEXT,
    source VARCHAR(50) NOT NULL DEFAULT 'PHONE' CHECK (source IN ('PHONE', 'WEBSITE', 'META', 'GOOGLE', 'WHATSAPP', 'MANUAL', 'IMPORT', 'REFERRAL', 'OTHER')),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'DO_NOT_CONTACT', 'ARCHIVED')),
    do_not_contact_reason TEXT,
    do_not_contact_set_at TIMESTAMPTZ,
    notes TEXT,
    last_contacted_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_contact_org_phone UNIQUE(organization_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_contacts_org_phone ON public.contacts(organization_id, phone);
CREATE INDEX IF NOT EXISTS idx_contacts_org_email ON public.contacts(organization_id, email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_org_status ON public.contacts(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_contacts_last_activity ON public.contacts(organization_id, last_activity_at);

-- ==============================================================================
-- 2. LEADS DOMAIN (LIFECYCLE, STAGES, ATTRIBUTION & FOLLOW-UP)
-- ==============================================================================
-- If public.business_leads was created in 011, we ensure contacts foreign key compatibility
-- and add opportunity / stage progression columns if not present
CREATE TABLE IF NOT EXISTS public.crm_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL DEFAULT 'PHONE' CHECK (source IN ('PHONE', 'WEBSITE', 'META', 'GOOGLE', 'WHATSAPP', 'MANUAL', 'IMPORT', 'REFERRAL', 'OTHER')),
    source_reference VARCHAR(255), -- e.g. Telephony Call SID, Ad campaign name
    campaign_id VARCHAR(100),
    conversation_id VARCHAR(64),
    status VARCHAR(50) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED', 'LOST', 'DO_NOT_CONTACT')),
    stage VARCHAR(50) NOT NULL DEFAULT 'NEW' CHECK (stage IN ('NEW', 'QUALIFICATION', 'FOLLOW_UP', 'APPOINTMENT', 'PROPOSAL', 'CONVERTED', 'LOST')),
    interest TEXT NOT NULL, -- Service or property requirement
    industry_context VARCHAR(50) DEFAULT 'GENERIC',
    location VARCHAR(150),
    budget VARCHAR(100),
    timeline VARCHAR(100),
    qualification_status VARCHAR(50) NOT NULL DEFAULT 'NOT_STARTED' CHECK (qualification_status IN ('NOT_STARTED', 'PARTIALLY_QUALIFIED', 'QUALIFIED', 'DISQUALIFIED')),
    qualification_score INTEGER NOT NULL DEFAULT 0,
    qualification_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    assigned_to UUID,
    assigned_team VARCHAR(100) DEFAULT 'SALES_TEAM',
    notes TEXT,
    last_contacted_at TIMESTAMPTZ,
    next_follow_up_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,
    lost_at TIMESTAMPTZ,
    lost_reason TEXT,
    idempotency_key VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_crm_lead_idempotency UNIQUE(organization_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_crm_leads_org_status ON public.crm_leads(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_org_stage ON public.crm_leads(organization_id, stage);
CREATE INDEX IF NOT EXISTS idx_crm_leads_contact ON public.crm_leads(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_conversation ON public.crm_leads(conversation_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_next_follow_up ON public.crm_leads(organization_id, next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;

-- ==============================================================================
-- 3. ACTIVITIES DOMAIN (UNIFIED OPERATIONAL TIMELINE)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.crm_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.crm_leads(id) ON DELETE SET NULL,
    conversation_id VARCHAR(64),
    type VARCHAR(50) NOT NULL CHECK (type IN ('CALL', 'MESSAGE', 'EMAIL', 'NOTE', 'LEAD_CREATED', 'LEAD_UPDATED', 'APPOINTMENT_CREATED', 'APPOINTMENT_CANCELLED', 'FOLLOW_UP_CREATED', 'HANDOFF', 'STATUS_CHANGED', 'STAGE_CHANGED')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by_type VARCHAR(50) NOT NULL DEFAULT 'AI_AGENT' CHECK (created_by_type IN ('AI_AGENT', 'HUMAN', 'SYSTEM', 'INTEGRATION')),
    created_by_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_activities_org_contact ON public.crm_activities(organization_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_org_lead ON public.crm_activities(organization_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_created_at ON public.crm_activities(created_at DESC);

-- ==============================================================================
-- 4. OPPORTUNITIES (LIGHTWEIGHT SALES VALUE FOUNDATION)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.crm_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.crm_leads(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    estimated_value NUMERIC(14, 2),
    currency VARCHAR(10) DEFAULT 'INR',
    stage VARCHAR(50) NOT NULL DEFAULT 'PROPOSAL',
    probability_percentage SMALLINT DEFAULT 50 CHECK (probability_percentage BETWEEN 0 AND 100),
    expected_close_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'WON', 'LOST', 'ABANDONED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_opportunities_org_lead ON public.crm_opportunities(organization_id, lead_id);

-- ==============================================================================
-- 5. IMPORT JOBS FOUNDATION
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.crm_import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    source_format VARCHAR(20) NOT NULL CHECK (source_format IN ('CSV', 'EXCEL')),
    file_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    total_records INTEGER DEFAULT 0,
    imported_records INTEGER DEFAULT 0,
    failed_records INTEGER DEFAULT 0,
    error_summary JSONB DEFAULT '[]'::jsonb,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ==============================================================================
-- 6. ROW-LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY contacts_tenant_isolation ON public.contacts
    FOR ALL USING (organization_id IN (SELECT public.current_user_org_ids()));

CREATE POLICY crm_leads_tenant_isolation ON public.crm_leads
    FOR ALL USING (organization_id IN (SELECT public.current_user_org_ids()));

CREATE POLICY crm_activities_tenant_isolation ON public.crm_activities
    FOR ALL USING (organization_id IN (SELECT public.current_user_org_ids()));

CREATE POLICY crm_opportunities_tenant_isolation ON public.crm_opportunities
    FOR ALL USING (organization_id IN (SELECT public.current_user_org_ids()));

CREATE POLICY crm_import_jobs_tenant_isolation ON public.crm_import_jobs
    FOR ALL USING (organization_id IN (SELECT public.current_user_org_ids()));


-- ------------------------------------------------------------------------------
-- MIGRATION: 013_outbound_calling_and_campaign_engine.sql
-- ------------------------------------------------------------------------------
-- 013_outbound_calling_and_campaign_engine.sql
-- Database Migration for VANNI Outbound Calling & Campaign Engine
-- Multi-Tenant Compliant Outbound Follow-Up Engine (Campaigns, Targets, Jobs, Attempts, Consents, Calling Windows)

-- ==============================================================================
-- 1. CAMPAIGNS DOMAIN
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'LEAD_FOLLOW_UP',
        'APPOINTMENT_CONFIRMATION',
        'APPOINTMENT_REMINDER',
        'CALLBACK',
        'SITE_VISIT_CONFIRMATION',
        'MISSED_CALL_FOLLOW_UP',
        'INQUIRY_FOLLOW_UP'
    )),
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT',
        'READY',
        'ACTIVE',
        'PAUSED',
        'COMPLETED',
        'CANCELLED',
        'ARCHIVED'
    )),
    agent_id UUID NOT NULL REFERENCES public.agents(id),
    agent_version INTEGER NOT NULL DEFAULT 1,
    caller_phone_number VARCHAR(32) NOT NULL, -- Outbound Caller ID (CLI)
    calling_purpose VARCHAR(100) NOT NULL,
    identity_disclosure TEXT NOT NULL, -- Mandatory statement identifying AI assistant
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    start_date DATE NOT NULL,
    end_date DATE,
    calling_window_start TIME NOT NULL DEFAULT '10:00:00',
    calling_window_end TIME NOT NULL DEFAULT '18:00:00',
    allowed_days_of_week SMALLINT[] NOT NULL DEFAULT '{1,2,3,4,5,6}', -- Mon-Sat
    blackout_dates DATE[] DEFAULT '{}',
    max_concurrent_calls INTEGER NOT NULL DEFAULT 2,
    max_calls_per_day INTEGER NOT NULL DEFAULT 100,
    max_attempts_per_target SMALLINT NOT NULL DEFAULT 3,
    retry_delay_minutes INTEGER NOT NULL DEFAULT 60,
    require_consent BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID,
    activated_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_org_status ON public.campaigns(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_agent ON public.campaigns(agent_id, agent_version);

-- ==============================================================================
-- 2. CONTACT CONSENTS (COMPLIANCE AUDIT DOMAIN)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.contact_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    channel VARCHAR(30) NOT NULL DEFAULT 'VOICE' CHECK (channel IN ('VOICE', 'SMS', 'WHATSAPP', 'EMAIL')),
    purpose VARCHAR(50) NOT NULL DEFAULT 'FOLLOW_UP' CHECK (purpose IN ('TRANSACTIONAL', 'SERVICE', 'FOLLOW_UP', 'MARKETING')),
    status VARCHAR(30) NOT NULL DEFAULT 'GRANTED' CHECK (status IN ('GRANTED', 'REVOKED', 'UNKNOWN')),
    source VARCHAR(100) NOT NULL DEFAULT 'INBOUND_INTERACTION', -- 'INBOUND_CALL', 'WEBSITE_FORM', 'DIRECT_REQUEST'
    evidence_reference TEXT,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consents_org_contact ON public.contact_consents(organization_id, contact_id, channel);

-- ==============================================================================
-- 3. CAMPAIGN TARGETS (CRM AUDIENCE SNAPSHOT)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.campaign_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.crm_leads(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES public.business_appointments(id) ON DELETE SET NULL,
    callback_id UUID REFERENCES public.callback_requests(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN (
        'PENDING',
        'ELIGIBLE',
        'BLOCKED',
        'SCHEDULED',
        'IN_PROGRESS',
        'COMPLETED',
        'FAILED',
        'SKIPPED',
        'OPTED_OUT'
    )),
    eligibility_status VARCHAR(50) NOT NULL DEFAULT 'NOT_EVALUATED',
    ineligibility_reason VARCHAR(100),
    attempt_count SMALLINT NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ,
    last_outcome VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_campaign_target_contact UNIQUE(campaign_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_targets_sched ON public.campaign_targets(campaign_id, status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_contact ON public.campaign_targets(contact_id);

-- ==============================================================================
-- 4. DURABLE CAMPAIGN JOBS (CONCURRENCY & WORKER LEASING)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.campaign_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES public.campaign_targets(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'QUEUED' CHECK (status IN (
        'QUEUED',
        'LOCKED',
        'STARTING',
        'IN_PROGRESS',
        'COMPLETED',
        'FAILED',
        'CANCELLED',
        'SKIPPED'
    )),
    attempt SMALLINT NOT NULL DEFAULT 1,
    locked_at TIMESTAMPTZ,
    locked_by VARCHAR(64), -- Worker ID lease
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failure_reason VARCHAR(255),
    idempotency_key VARCHAR(128) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_jobs_claim ON public.campaign_jobs(organization_id, status, scheduled_at);

-- ==============================================================================
-- 5. CALL ATTEMPTS AUDIT TRAIL
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.campaign_call_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    campaign_target_id UUID NOT NULL REFERENCES public.campaign_targets(id) ON DELETE CASCADE,
    campaign_job_id UUID REFERENCES public.campaign_jobs(id) ON DELETE SET NULL,
    telephony_session_id VARCHAR(64),
    provider_call_sid VARCHAR(128),
    conversation_id VARCHAR(64),
    attempt_number SMALLINT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'QUEUED' CHECK (status IN (
        'QUEUED',
        'DISPATCHED',
        'RINGING',
        'ANSWERED',
        'NO_ANSWER',
        'BUSY',
        'FAILED',
        'COMPLETED',
        'CANCELLED'
    )),
    telephony_outcome VARCHAR(50), -- ANSWERED, NO_ANSWER, BUSY, FAILED
    business_outcome VARCHAR(50),  -- LEAD_QUALIFIED, APPOINTMENT_CONFIRMED, CALLBACK_REQUESTED, OPTED_OUT
    failure_reason TEXT,
    duration_seconds INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    answered_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_attempts_target ON public.campaign_call_attempts(campaign_target_id);
CREATE INDEX IF NOT EXISTS idx_call_attempts_campaign ON public.campaign_call_attempts(campaign_id, status);

-- ==============================================================================
-- 6. ROW-LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_call_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY campaigns_tenant_isolation ON public.campaigns
    FOR ALL USING (organization_id IN (SELECT public.current_user_org_ids()));

CREATE POLICY contact_consents_tenant_isolation ON public.contact_consents
    FOR ALL USING (organization_id IN (SELECT public.current_user_org_ids()));

CREATE POLICY campaign_targets_tenant_isolation ON public.campaign_targets
    FOR ALL USING (organization_id IN (SELECT public.current_user_org_ids()));

CREATE POLICY campaign_jobs_tenant_isolation ON public.campaign_jobs
    FOR ALL USING (organization_id IN (SELECT public.current_user_org_ids()));

CREATE POLICY campaign_call_attempts_tenant_isolation ON public.campaign_call_attempts
    FOR ALL USING (organization_id IN (SELECT public.current_user_org_ids()));


-- ------------------------------------------------------------------------------
-- MIGRATION: 014_human_handoff_and_escalation.sql
-- ------------------------------------------------------------------------------
-- ============================================================================
-- Migration: 014_human_handoff_and_escalation.sql
-- Module 17: VANNI Human Handoff, Escalation, Team Routing, Notifications & SLA
-- ============================================================================

-- 1. Extend or Create Teams
CREATE TABLE IF NOT EXISTS public.teams (
    id TEXT PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    industry VARCHAR(50),
    contact_phone VARCHAR(30),
    email VARCHAR(150),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_team_org_slug UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_teams_org ON public.teams(organization_id);

-- 2. Team Members
CREATE TABLE IF NOT EXISTS public.team_members (
    id TEXT PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    team_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'MEMBER', -- 'LEAD', 'MEMBER'
    availability VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE', -- 'AVAILABLE', 'BUSY', 'OFFLINE', 'DO_NOT_DISTURB'
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_team_member UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_org ON public.team_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members(user_id);

-- 3. Enhance / Alter conversation_handoffs to support the full state machine and routing
ALTER TABLE public.conversation_handoffs 
    ADD COLUMN IF NOT EXISTS voice_session_id TEXT,
    ADD COLUMN IF NOT EXISTS telephony_session_id TEXT,
    ADD COLUMN IF NOT EXISTS agent_id TEXT,
    ADD COLUMN IF NOT EXISTS agent_version_id TEXT,
    ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL DEFAULT 'HUMAN_REVIEW',
    ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS assigned_team_id TEXT REFERENCES public.teams(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS destination_type VARCHAR(50) DEFAULT 'USER',
    ADD COLUMN IF NOT EXISTS destination TEXT,
    ADD COLUMN IF NOT EXISTS summary JSONB,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS callback_task_id TEXT,
    ADD COLUMN IF NOT EXISTS failure_reason TEXT,
    ADD COLUMN IF NOT EXISTS resolution VARCHAR(50),
    ADD COLUMN IF NOT EXISTS resolution_notes TEXT,
    ADD COLUMN IF NOT EXISTS resolution_next_action VARCHAR(50) DEFAULT 'NONE',
    ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sla_breached BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_handoffs_org_status ON public.conversation_handoffs(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_handoffs_assigned_user ON public.conversation_handoffs(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_handoffs_priority ON public.conversation_handoffs(priority);

-- 4. Notification Engine Model
CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    entity_type VARCHAR(30) NOT NULL, -- 'HANDOFF', 'LEAD', 'CALL', 'APPOINTMENT', 'CAMPAIGN'
    entity_id TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'UNREAD', -- 'UNREAD', 'READ', 'ARCHIVED'
    read_at TIMESTAMPTZ,
    channel VARCHAR(20) NOT NULL DEFAULT 'IN_APP', -- 'IN_APP', 'EMAIL'
    idempotency_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_notif_idempotency UNIQUE (organization_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_notif_recipient_status ON public.notifications(recipient_user_id, status);
CREATE INDEX IF NOT EXISTS idx_notif_org ON public.notifications(organization_id);

-- 5. Notification Preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id TEXT PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
    in_app_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
    urgent_only_email BOOLEAN NOT NULL DEFAULT false,
    handoff_alerts BOOLEAN NOT NULL DEFAULT true,
    campaign_alerts BOOLEAN NOT NULL DEFAULT true,
    system_alerts BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_notif_prefs_user UNIQUE (organization_id, user_id)
);

-- 6. Escalation SLAs
CREATE TABLE IF NOT EXISTS public.handoff_slas (
    id TEXT PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    priority VARCHAR(20) NOT NULL,
    target_response_minutes INTEGER NOT NULL,
    target_resolution_minutes INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_org_sla_priority UNIQUE (organization_id, priority)
);

-- 7. Organization Escalation Policies
CREATE TABLE IF NOT EXISTS public.escalation_policies (
    id TEXT PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    agent_id TEXT,
    industry VARCHAR(50),
    max_failed_answer_attempts INTEGER NOT NULL DEFAULT 2,
    unsupported_knowledge_policy VARCHAR(30) NOT NULL DEFAULT 'OFFER_CALLBACK',
    default_live_transfer_destination_phone VARCHAR(30),
    default_live_transfer_team_id TEXT REFERENCES public.teams(id) ON DELETE SET NULL,
    operating_hours_only_transfer BOOLEAN NOT NULL DEFAULT true,
    fallback_to_callback BOOLEAN NOT NULL DEFAULT true,
    high_value_lead_threshold_budget NUMERIC(12, 2),
    emergency_casualty_direct_phone VARCHAR(30) NOT NULL DEFAULT '108',
    medical_safety_mandatory_escalate BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handoff_slas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_policies ENABLE ROW LEVEL SECURITY;

-- Teams RLS
CREATE POLICY teams_tenant_all ON public.teams
    FOR ALL
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid)
    WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

-- Team Members RLS
CREATE POLICY team_members_tenant_all ON public.team_members
    FOR ALL
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid)
    WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

-- Notifications RLS: User can only access notifications within their organization and assigned to them
CREATE POLICY notif_tenant_select ON public.notifications
    FOR SELECT
    USING (
        organization_id = (auth.jwt() ->> 'organization_id')::uuid
        AND recipient_user_id = auth.uid()
    );

CREATE POLICY notif_tenant_modify ON public.notifications
    FOR UPDATE
    USING (
        organization_id = (auth.jwt() ->> 'organization_id')::uuid
        AND recipient_user_id = auth.uid()
    );

-- Notification Preferences RLS
CREATE POLICY notif_prefs_tenant_all ON public.notification_preferences
    FOR ALL
    USING (
        organization_id = (auth.jwt() ->> 'organization_id')::uuid
        AND user_id = auth.uid()
    )
    WITH CHECK (
        organization_id = (auth.jwt() ->> 'organization_id')::uuid
        AND user_id = auth.uid()
    );

-- Escalation SLAs RLS
CREATE POLICY handoff_slas_tenant_all ON public.handoff_slas
    FOR ALL
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid)
    WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

-- Escalation Policies RLS
CREATE POLICY escalation_policies_tenant_all ON public.escalation_policies
    FOR ALL
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid)
    WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id')::uuid);


-- ------------------------------------------------------------------------------
-- MIGRATION: 015_analytics_usage_metering_and_cost.sql
-- ------------------------------------------------------------------------------
-- ============================================================================
-- Migration: 015_analytics_usage_metering_and_cost.sql
-- Module 18: VANNI Analytics, Usage Metering & Cost Intelligence Engine
-- ============================================================================

-- 1. Raw Usage Events Table (Append-only immutable event store)
CREATE TABLE IF NOT EXISTS public.usage_events (
    id TEXT PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id TEXT,
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100),
    quantity NUMERIC(14, 4) NOT NULL DEFAULT 0,
    unit VARCHAR(30) NOT NULL,
    cost_type VARCHAR(20) NOT NULL DEFAULT 'ESTIMATED', -- 'ACTUAL', 'ESTIMATED', 'UNKNOWN'
    estimated_cost NUMERIC(14, 6) NOT NULL DEFAULT 0,
    actual_cost NUMERIC(14, 6),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    pricing_version_id TEXT,
    agent_id TEXT,
    agent_version_id TEXT,
    conversation_id TEXT,
    voice_session_id TEXT,
    telephony_session_id TEXT,
    campaign_id TEXT,
    knowledge_source_id TEXT,
    channel VARCHAR(30) DEFAULT 'VOICE',
    language VARCHAR(20) DEFAULT 'kn-IN',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    correlation_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_org_occurred ON public.usage_events(organization_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_agent ON public.usage_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_conv ON public.usage_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_type ON public.usage_events(event_type);

-- 2. Provider Pricing Definitions (Versioned Catalog)
CREATE TABLE IF NOT EXISTS public.provider_pricing_definitions (
    id TEXT PRIMARY KEY,
    provider VARCHAR(50) NOT NULL,
    service VARCHAR(30) NOT NULL, -- 'TELEPHONY', 'STT', 'TTS', 'LLM', 'EMBEDDING', 'STORAGE', 'MESSAGING'
    model VARCHAR(100),
    unit VARCHAR(30) NOT NULL,
    price NUMERIC(14, 6) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    effective_from TIMESTAMPTZ NOT NULL,
    effective_to TIMESTAMPTZ,
    version VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_prov_service ON public.provider_pricing_definitions(provider, service, version);

-- 3. Billable Usage Ledger (Pre-billing normalization ledger)
CREATE TABLE IF NOT EXISTS public.usage_ledger (
    id TEXT PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    usage_event_id TEXT REFERENCES public.usage_events(id) ON DELETE CASCADE,
    billing_period VARCHAR(10) NOT NULL, -- 'YYYY-MM'
    meter VARCHAR(50) NOT NULL,
    quantity NUMERIC(14, 4) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    cost_basis NUMERIC(14, 6) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status VARCHAR(20) NOT NULL DEFAULT 'UNBILLED', -- 'UNBILLED', 'BILLED', 'WAIVED', 'ADJUSTED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_org_period ON public.usage_ledger(organization_id, billing_period);
CREATE INDEX IF NOT EXISTS idx_ledger_meter ON public.usage_ledger(meter);

-- 4. Daily Usage Aggregation (Incremental rollups for fast sub-second querying)
CREATE TABLE IF NOT EXISTS public.daily_usage_aggregations (
    id TEXT PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    agent_id TEXT,
    channel VARCHAR(30) DEFAULT 'VOICE',
    industry VARCHAR(50),
    total_calls INTEGER NOT NULL DEFAULT 0,
    inbound_calls INTEGER NOT NULL DEFAULT 0,
    outbound_calls INTEGER NOT NULL DEFAULT 0,
    connected_calls INTEGER NOT NULL DEFAULT 0,
    failed_calls INTEGER NOT NULL DEFAULT 0,
    voice_minutes NUMERIC(12, 2) NOT NULL DEFAULT 0,
    stt_seconds NUMERIC(12, 2) NOT NULL DEFAULT 0,
    tts_characters INTEGER NOT NULL DEFAULT 0,
    llm_input_tokens INTEGER NOT NULL DEFAULT 0,
    llm_output_tokens INTEGER NOT NULL DEFAULT 0,
    tool_calls INTEGER NOT NULL DEFAULT 0,
    leads_created INTEGER NOT NULL DEFAULT 0,
    leads_qualified INTEGER NOT NULL DEFAULT 0,
    appointments_created INTEGER NOT NULL DEFAULT 0,
    handoffs_count INTEGER NOT NULL DEFAULT 0,
    estimated_cost_inr NUMERIC(12, 4) NOT NULL DEFAULT 0,
    actual_cost_inr NUMERIC(12, 4) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_daily_agg UNIQUE (organization_id, date, agent_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_daily_agg_org_date ON public.daily_usage_aggregations(organization_id, date);

-- 5. Usage Alert Thresholds
CREATE TABLE IF NOT EXISTS public.usage_alert_thresholds (
    id TEXT PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    meter VARCHAR(50) NOT NULL,
    monthly_limit NUMERIC(14, 2) NOT NULL,
    threshold_percentages JSONB NOT NULL DEFAULT '[75, 90, 100]'::jsonb,
    triggered_percentages JSONB NOT NULL DEFAULT '[]'::jsonb,
    recipient_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_alert_thresh UNIQUE (organization_id, meter)
);

-- 6. Cost Anomaly Alerts
CREATE TABLE IF NOT EXISTS public.cost_anomaly_alerts (
    id TEXT PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    meter VARCHAR(50) NOT NULL,
    expected_daily_average NUMERIC(14, 2) NOT NULL,
    actual_quantity NUMERIC(14, 2) NOT NULL,
    variance_percentage NUMERIC(8, 2) NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_pricing_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_usage_aggregations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_alert_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_anomaly_alerts ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation RLS
CREATE POLICY usage_events_tenant_all ON public.usage_events
    FOR ALL
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid)
    WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY provider_pricing_select ON public.provider_pricing_definitions
    FOR SELECT
    USING (true); -- Pricing definitions are platform-wide reference

CREATE POLICY usage_ledger_tenant_all ON public.usage_ledger
    FOR ALL
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid)
    WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY daily_agg_tenant_all ON public.daily_usage_aggregations
    FOR ALL
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid)
    WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY alert_thresh_tenant_all ON public.usage_alert_thresholds
    FOR ALL
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid)
    WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY anomaly_alerts_tenant_all ON public.cost_anomaly_alerts
    FOR ALL
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid)
    WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id')::uuid);


-- ------------------------------------------------------------------------------
-- MIGRATION: 016_billing_plans_subscriptions_and_entitlements.sql
-- ------------------------------------------------------------------------------
-- ============================================================================
-- Migration: 016_billing_plans_subscriptions_and_entitlements.sql
-- Module 19: VANNI Billing, Plans, Subscriptions & Usage Entitlements Engine
-- ============================================================================

-- 1. Billing Accounts (One per Organization)
CREATE TABLE IF NOT EXISTS public.billing_accounts (
    id TEXT PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    billing_email VARCHAR(255) NOT NULL,
    billing_name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    tax_identifier VARCHAR(50), -- GSTIN
    billing_address JSONB DEFAULT '{}'::jsonb,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'DELINQUENT', 'SUSPENDED'
    provider VARCHAR(50) NOT NULL DEFAULT 'RAZORPAY', -- 'RAZORPAY', 'STRIPE', 'MANUAL'
    provider_customer_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_billing_account_org UNIQUE (organization_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_accounts_org ON public.billing_accounts(organization_id);

-- 2. Plans Catalog
CREATE TABLE IF NOT EXISTS public.plans (
    id TEXT PRIMARY KEY, -- 'plan_free', 'plan_starter', 'plan_growth', 'plan_business', 'plan_enterprise'
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    monthly_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    annual_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    visibility VARCHAR(20) NOT NULL DEFAULT 'PUBLIC', -- 'PUBLIC', 'PRIVATE', 'CUSTOM'
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    entitlements JSONB NOT NULL DEFAULT '{}'::jsonb,
    overage_voice_minute_price NUMERIC(10, 4) DEFAULT 0,
    active_version VARCHAR(20) NOT NULL DEFAULT 'v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Plan Versions
CREATE TABLE IF NOT EXISTS public.plan_versions (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
    version VARCHAR(20) NOT NULL,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to TIMESTAMPTZ,
    monthly_price NUMERIC(12, 2) NOT NULL,
    annual_price NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    entitlements JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_plan_version UNIQUE (plan_id, version)
);

-- 4. Subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id TEXT PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    billing_account_id TEXT NOT NULL REFERENCES public.billing_accounts(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES public.plans(id),
    plan_version_id TEXT NOT NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'RAZORPAY',
    provider_subscription_id TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'TRIALING', -- 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED'
    billing_interval VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    cancelled_at TIMESTAMPTZ,
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sub_org UNIQUE (organization_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON public.subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

-- 5. Subscription Events (Audit History)
CREATE TABLE IF NOT EXISTS public.subscription_events (
    id TEXT PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    subscription_id TEXT NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    previous_plan_id TEXT,
    new_plan_id TEXT,
    reason TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_events_org ON public.subscription_events(organization_id);

-- 6. Payment Records
CREATE TABLE IF NOT EXISTS public.payment_records (
    id TEXT PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    billing_account_id TEXT NOT NULL REFERENCES public.billing_accounts(id) ON DELETE CASCADE,
    subscription_id TEXT REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'RAZORPAY',
    provider_payment_id TEXT NOT NULL,
    provider_order_id TEXT,
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    payment_method_type VARCHAR(30),
    paid_at TIMESTAMPTZ,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_records_org ON public.payment_records(organization_id);

-- 7. Billing Invoices / Receipts
CREATE TABLE IF NOT EXISTS public.billing_invoices (
    id TEXT PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    billing_account_id TEXT NOT NULL REFERENCES public.billing_accounts(id) ON DELETE CASCADE,
    subscription_id TEXT REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    payment_id TEXT REFERENCES public.payment_records(id) ON DELETE SET NULL,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    subtotal NUMERIC(12, 2) NOT NULL,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    tax_identifier VARCHAR(50),
    total_amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PAID',
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    pdf_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_org ON public.billing_invoices(organization_id);

-- 8. Billing Provider Events (Webhook Event Store & Idempotency)
CREATE TABLE IF NOT EXISTS public.billing_provider_events (
    id TEXT PRIMARY KEY,
    provider VARCHAR(50) NOT NULL DEFAULT 'RAZORPAY',
    provider_event_id TEXT NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload_reference TEXT,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    processing_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_billing_event_idempotency UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_events_prov_id ON public.billing_provider_events(provider, provider_event_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_provider_events ENABLE ROW LEVEL SECURITY;

-- Plans are publicly viewable by authenticated users for pricing comparison
CREATE POLICY plans_select_all ON public.plans
    FOR SELECT USING (true);

CREATE POLICY plan_versions_select_all ON public.plan_versions
    FOR SELECT USING (true);

-- Billing Accounts Tenant RLS
CREATE POLICY billing_accounts_tenant_all ON public.billing_accounts
    FOR ALL
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid)
    WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

-- Subscriptions Tenant RLS
CREATE POLICY subscriptions_tenant_all ON public.subscriptions
    FOR ALL
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid)
    WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

-- Subscription Events Tenant RLS
CREATE POLICY sub_events_tenant_all ON public.subscription_events
    FOR ALL
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid)
    WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

-- Payments Tenant RLS
CREATE POLICY payment_records_tenant_all ON public.payment_records
    FOR ALL
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid)
    WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

-- Invoices Tenant RLS
CREATE POLICY invoices_tenant_all ON public.billing_invoices
    FOR ALL
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid)
    WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

-- Billing Events System / Service Role Access Only
CREATE POLICY billing_events_tenant_select ON public.billing_provider_events
    FOR SELECT
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid OR organization_id IS NULL);


-- ------------------------------------------------------------------------------
-- MIGRATION: 017_client_workspaces_and_onboarding.sql
-- ------------------------------------------------------------------------------
-- ==============================================================================
-- VANNI — 017_client_workspaces_and_onboarding.sql (Prompt 03)
-- Multi-Tenant Client Workspaces & Industry-Aware Onboarding State
-- ==============================================================================

-- 1. Create client_workspaces table
CREATE TABLE IF NOT EXISTS public.client_workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    model_type VARCHAR(50) NOT NULL DEFAULT 'DIRECT_BUSINESS' CHECK (model_type IN ('AGENCY', 'DIRECT_BUSINESS')),
    industry_category VARCHAR(50) NOT NULL DEFAULT 'REAL_ESTATE' CHECK (industry_category IN ('DIGITAL_AGENCY', 'HEALTHCARE', 'REAL_ESTATE')),
    subcategory VARCHAR(50) NOT NULL DEFAULT 'SALES',
    operating_location VARCHAR(255) NOT NULL DEFAULT 'Karnataka, India',
    primary_phone VARCHAR(50) NOT NULL DEFAULT '+91 80 4719 2000',
    primary_email VARCHAR(255),
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    onboarding_step INTEGER NOT NULL DEFAULT 1 CHECK (onboarding_step BETWEEN 1 AND 7),
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_org_workspace_slug UNIQUE (organization_id, slug)
);

-- 2. Indexes for fast tenant and industry lookups
CREATE INDEX IF NOT EXISTS idx_client_workspaces_org ON public.client_workspaces(organization_id);
CREATE INDEX IF NOT EXISTS idx_client_workspaces_industry ON public.client_workspaces(industry_category, subcategory);

-- 3. Row-Level Security
ALTER TABLE public.client_workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation_client_workspaces ON public.client_workspaces;
CREATE POLICY org_isolation_client_workspaces ON public.client_workspaces
    FOR ALL USING (
        public.is_member_of_org(organization_id) OR
        current_setting('request.jwt.claim.role', true) = 'service_role'
    );


-- ------------------------------------------------------------------------------
-- MIGRATION: 018_healthcare_rosters_and_appointments.sql
-- ------------------------------------------------------------------------------
-- ==============================================================================
-- 018: Healthcare Clinic Operations, Doctor Rosters & Appointment Scheduling
-- Dhwani SI / Vaani-Si Multi-Tenant Voice Platform (Prompt 05)
-- ==============================================================================

-- 1. Extend client_workspaces with clinic configuration
ALTER TABLE IF EXISTS client_workspaces
  ADD COLUMN IF NOT EXISTS clinic_config JSONB DEFAULT '{}'::jsonb;

-- 2. Extend business_staff with healthcare doctor roster and shift settings
ALTER TABLE IF EXISTS business_staff
  ADD COLUMN IF NOT EXISTS shift_start VARCHAR(5) DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS shift_end VARCHAR(5) DEFAULT '17:00',
  ADD COLUMN IF NOT EXISTS break_start VARCHAR(5) DEFAULT '13:00',
  ADD COLUMN IF NOT EXISTS break_end VARCHAR(5) DEFAULT '14:00',
  ADD COLUMN IF NOT EXISTS slot_duration_minutes INT DEFAULT 15,
  ADD COLUMN IF NOT EXISTS buffer_minutes INT DEFAULT 5,
  ADD COLUMN IF NOT EXISTS leaves JSONB DEFAULT '[]'::jsonb;

-- 3. Extend appointment_slots with provider ID, notes, cancellation and audit trail
ALTER TABLE IF EXISTS appointment_slots
  ADD COLUMN IF NOT EXISTS doctor_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS audit_history JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);

-- 4. High-performance indexes for slot availability and appointment lookup
CREATE INDEX IF NOT EXISTS idx_appointment_slots_tenant_time
  ON appointment_slots(tenant_id, scheduled_time);

CREATE INDEX IF NOT EXISTS idx_appointment_slots_tenant_doctor
  ON appointment_slots(tenant_id, doctor_id);

CREATE INDEX IF NOT EXISTS idx_appointment_slots_idempotency
  ON appointment_slots(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_staff_org_active
  ON business_staff(organization_id, is_active);

-- 5. RLS Policies: strictly scope healthcare provider and appointment reads/writes to tenant
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'appointment_slots') THEN
    ALTER TABLE appointment_slots ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS appointment_slots_tenant_isolation ON appointment_slots;
    CREATE POLICY appointment_slots_tenant_isolation ON appointment_slots
      FOR ALL
      USING (
        tenant_id = current_setting('app.current_organization_id', true)
        OR
        tenant_id IN (
          SELECT id FROM client_workspaces WHERE organization_id = current_setting('app.current_organization_id', true)
        )
      );
  END IF;
END $$;


-- ------------------------------------------------------------------------------
-- MIGRATION: 019_real_estate_properties_and_site_visits.sql
-- ------------------------------------------------------------------------------
-- 019_real_estate_properties_and_site_visits.sql
-- Migration for Real Estate Vertical Configuration, Property Inventory & Site Visit Operations (Prompt 06)
-- Multi-Tenant Gated Isolation for Plots, Villas, Apartments & Site Visits

-- ==============================================================================
-- 1. EXTEND CLIENT WORKSPACES FOR REAL ESTATE SETTINGS
-- ==============================================================================
ALTER TABLE public.client_workspaces
ADD COLUMN IF NOT EXISTS real_estate_config JSONB DEFAULT '{}'::jsonb;

-- ==============================================================================
-- 2. PROPERTIES & INVENTORY CATALOGUE TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.client_workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    reference_code VARCHAR(100) NOT NULL,
    property_type VARCHAR(50) NOT NULL CHECK (property_type IN ('PLOT', 'VILLA', 'APARTMENT', 'HOUSE', 'COMMERCIAL')),
    sub_type VARCHAR(100),
    locality VARCHAR(255) NOT NULL,
    address TEXT,
    map_url TEXT,
    dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
    pricing JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'ON_HOLD', 'RESERVED', 'SOLD', 'INACTIVE')),
    amenities TEXT[] DEFAULT '{}',
    description TEXT NOT NULL DEFAULT '',
    developer_contact JSONB NOT NULL DEFAULT '{}'::jsonb,
    rera_details JSONB DEFAULT '{}'::jsonb,
    documents JSONB DEFAULT '[]'::jsonb,
    verified_by VARCHAR(255),
    last_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_properties_workspace_refcode UNIQUE (workspace_id, reference_code)
);

CREATE INDEX IF NOT EXISTS idx_properties_workspace_id ON public.properties (workspace_id);
CREATE INDEX IF NOT EXISTS idx_properties_organization_id ON public.properties (organization_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties (status);
CREATE INDEX IF NOT EXISTS idx_properties_type ON public.properties (property_type);

-- ==============================================================================
-- 3. EXTEND APPOINTMENTS FOR SITE VISITS (REUSING BOOKING ENGINE)
-- ==============================================================================
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS visitor_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS transport_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS assigned_agent VARCHAR(255),
ADD COLUMN IF NOT EXISTS appointment_type VARCHAR(50) DEFAULT 'GENERAL';

-- Concurrency-safe unique index for site visit slots
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_unique_site_visit_slot
ON public.appointments (workspace_id, property_id, scheduled_time)
WHERE status NOT IN ('CANCELLED', 'RESCHEDULED') AND property_id IS NOT NULL;

-- ==============================================================================
-- 4. EXTEND LEADS FOR REAL ESTATE QUALIFICATION
-- ==============================================================================
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS property_interest VARCHAR(255),
ADD COLUMN IF NOT EXISTS purchase_purpose VARCHAR(50),
ADD COLUMN IF NOT EXISTS budget_min NUMERIC(14, 2),
ADD COLUMN IF NOT EXISTS budget_max NUMERIC(14, 2),
ADD COLUMN IF NOT EXISTS preferred_location VARCHAR(255),
ADD COLUMN IF NOT EXISTS preferred_dimensions VARCHAR(100),
ADD COLUMN IF NOT EXISTS purchase_timeline VARCHAR(50),
ADD COLUMN IF NOT EXISTS site_visit_interest VARCHAR(50),
ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(255);

-- ==============================================================================
-- 5. ROW-LEVEL SECURITY POLICIES FOR PROPERTIES
-- ==============================================================================
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "properties_tenant_select" ON public.properties
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "properties_tenant_insert" ON public.properties
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('OWNER', 'ADMIN', 'MEMBER')
        )
    );

CREATE POLICY "properties_tenant_update" ON public.properties
    FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('OWNER', 'ADMIN', 'MEMBER')
        )
    );

CREATE POLICY "properties_tenant_delete" ON public.properties
    FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('OWNER', 'ADMIN')
        )
    );


-- ------------------------------------------------------------------------------
-- MIGRATION: 020_production_hardening_and_schema_reconciliation.sql
-- ------------------------------------------------------------------------------
-- ==============================================================================
-- 020: Production Hardening, Schema Reconciliation & Concurrency Integrity
-- Dhwani SI / Vaani-Si Multi-Tenant Voice Platform (Prompt 07)
-- ==============================================================================

-- 1. RECONCILE APPOINTMENTS TABLE
-- Reconciles discrepancies between 001, 018, and 019 for healthcare & real estate site visits
DO $$
BEGIN
    -- Ensure columns exist on public.appointments
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'appointments') THEN
        ALTER TABLE public.appointments
            ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.client_workspaces(id) ON DELETE CASCADE,
            ADD COLUMN IF NOT EXISTS scheduled_time TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS doctor_id VARCHAR(100),
            ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS visitor_count INTEGER DEFAULT 1,
            ADD COLUMN IF NOT EXISTS transport_required BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS assigned_agent VARCHAR(255),
            ADD COLUMN IF NOT EXISTS appointment_type VARCHAR(50) DEFAULT 'GENERAL',
            ADD COLUMN IF NOT EXISTS notes TEXT,
            ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
            ADD COLUMN IF NOT EXISTS audit_history JSONB DEFAULT '[]'::jsonb,
            ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100),
            ADD COLUMN IF NOT EXISTS max_capacity INTEGER DEFAULT 1;

        -- Synchronize appointment_time and scheduled_time
        UPDATE public.appointments
        SET scheduled_time = appointment_time
        WHERE scheduled_time IS NULL AND appointment_time IS NOT NULL;

        UPDATE public.appointments
        SET appointment_time = scheduled_time
        WHERE appointment_time IS NULL AND scheduled_time IS NOT NULL;
    END IF;
END $$;

-- 2. CONCURRENCY-SAFE INDEXES ON APPOINTMENTS
CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_idempotency
    ON public.appointments (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_doctor_slot
    ON public.appointments (workspace_id, doctor_id, scheduled_time)
    WHERE doctor_id IS NOT NULL AND status NOT IN ('CANCELLED', 'RESCHEDULED');

CREATE INDEX IF NOT EXISTS idx_appointments_workspace_time
    ON public.appointments (workspace_id, scheduled_time);

CREATE INDEX IF NOT EXISTS idx_appointments_org_time
    ON public.appointments (organization_id, scheduled_time);

-- 3. CAPACITY-BASED SITE VISIT CONCURRENCY TABLE
-- Enables transaction-safe capacity tracking for real estate site visits (capacity > 1)
CREATE TABLE IF NOT EXISTS public.site_visit_capacity_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.client_workspaces(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    slot_time TIMESTAMPTZ NOT NULL,
    max_capacity INTEGER NOT NULL DEFAULT 5,
    booked_count INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_site_visit_capacity_slot UNIQUE (workspace_id, property_id, slot_time),
    CONSTRAINT chk_booked_not_exceed_capacity CHECK (booked_count <= max_capacity),
    CONSTRAINT chk_booked_non_negative CHECK (booked_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_site_visit_capacity_lookup
    ON public.site_visit_capacity_slots (workspace_id, property_id, slot_time);

-- 4. RECONCILE LEADS TABLE
-- Ensures all multi-tenant vertical qualification attributes exist
ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.client_workspaces(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS property_interest VARCHAR(255),
    ADD COLUMN IF NOT EXISTS purchase_purpose VARCHAR(50),
    ADD COLUMN IF NOT EXISTS budget_min NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS budget_max NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS preferred_location VARCHAR(255),
    ADD COLUMN IF NOT EXISTS preferred_dimensions VARCHAR(100),
    ADD COLUMN IF NOT EXISTS purchase_timeline VARCHAR(50),
    ADD COLUMN IF NOT EXISTS site_visit_interest VARCHAR(50),
    ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(255),
    ADD COLUMN IF NOT EXISTS clinic_subcategory VARCHAR(100),
    ADD COLUMN IF NOT EXISTS patient_symptoms TEXT,
    ADD COLUMN IF NOT EXISTS preferred_doctor VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_leads_workspace_id ON public.leads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_leads_org_rating ON public.leads(organization_id, rating);

-- 5. RECONCILE CLIENT WORKSPACES TABLE
-- Guarantees industry config JSONB columns exist
ALTER TABLE public.client_workspaces
    ADD COLUMN IF NOT EXISTS clinic_config JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS real_estate_config JSONB DEFAULT '{}'::jsonb;

-- 6. RECONCILE BUSINESS STAFF (DOCTORS & AGENTS)
ALTER TABLE public.business_staff
    ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.client_workspaces(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS shift_start VARCHAR(5) DEFAULT '09:00',
    ADD COLUMN IF NOT EXISTS shift_end VARCHAR(5) DEFAULT '17:00',
    ADD COLUMN IF NOT EXISTS break_start VARCHAR(5) DEFAULT '13:00',
    ADD COLUMN IF NOT EXISTS break_end VARCHAR(5) DEFAULT '14:00',
    ADD COLUMN IF NOT EXISTS slot_duration_minutes INT DEFAULT 15,
    ADD COLUMN IF NOT EXISTS buffer_minutes INT DEFAULT 5,
    ADD COLUMN IF NOT EXISTS leaves JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_business_staff_workspace ON public.business_staff(workspace_id);

-- 7. RECONCILE BUSINESS FAQS
ALTER TABLE public.business_faqs
    ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.client_workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_business_faqs_workspace ON public.business_faqs(workspace_id);

-- 8. RLS HARDENING: ALL TABLES MUST ALLOW SERVICE ROLE & ENFORCE TENANT ISOLATION
ALTER TABLE public.site_visit_capacity_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_visit_capacity_isolation ON public.site_visit_capacity_slots;
CREATE POLICY site_visit_capacity_isolation ON public.site_visit_capacity_slots
    FOR ALL USING (
        current_setting('request.jwt.claim.role', true) = 'service_role' OR
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS appointments_service_role_policy ON public.appointments;
CREATE POLICY appointments_service_role_policy ON public.appointments
    FOR ALL USING (
        current_setting('request.jwt.claim.role', true) = 'service_role' OR
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS leads_service_role_policy ON public.leads;
CREATE POLICY leads_service_role_policy ON public.leads
    FOR ALL USING (
        current_setting('request.jwt.claim.role', true) = 'service_role' OR
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );


-- ------------------------------------------------------------------------------
-- MIGRATION: 021_call_lifecycle_hardening.sql
-- ------------------------------------------------------------------------------
-- ============================================================================
-- Migration 021: Call Lifecycle Hardening & Telephony Integration Columns
-- Vaani-Si — End-to-End Voice Call Reliability (Prompt 08)
-- ============================================================================

DO $$
BEGIN
    -- Ensure call lifecycle status column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'calls' AND column_name = 'status'
    ) THEN
        ALTER TABLE public.calls ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'INITIATED';
    END IF;

    -- Ensure answered_at timestamp exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'calls' AND column_name = 'answered_at'
    ) THEN
        ALTER TABLE public.calls ADD COLUMN answered_at TIMESTAMPTZ;
    END IF;

    -- Ensure started_at timestamp exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'calls' AND column_name = 'started_at'
    ) THEN
        ALTER TABLE public.calls ADD COLUMN started_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- Ensure ended_at timestamp exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'calls' AND column_name = 'ended_at'
    ) THEN
        ALTER TABLE public.calls ADD COLUMN ended_at TIMESTAMPTZ;
    END IF;

    -- Ensure failure_reason exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'calls' AND column_name = 'failure_reason'
    ) THEN
        ALTER TABLE public.calls ADD COLUMN failure_reason TEXT;
    END IF;

    -- Ensure cost_inr exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'calls' AND column_name = 'cost_inr'
    ) THEN
        ALTER TABLE public.calls ADD COLUMN cost_inr NUMERIC(10, 4) NOT NULL DEFAULT 0.0000;
    END IF;

    -- Ensure telephony_provider exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'calls' AND column_name = 'telephony_provider'
    ) THEN
        ALTER TABLE public.calls ADD COLUMN telephony_provider VARCHAR(50) NOT NULL DEFAULT 'EXOTEL';
    END IF;

    -- Ensure telephony_call_sid exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'calls' AND column_name = 'telephony_call_sid'
    ) THEN
        ALTER TABLE public.calls ADD COLUMN telephony_call_sid VARCHAR(100);
    END IF;
END $$;

-- Create indexes for call lifecycle queries and provider reconciliation
CREATE INDEX IF NOT EXISTS idx_calls_status ON public.calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_telephony_sid ON public.calls(telephony_call_sid);
CREATE INDEX IF NOT EXISTS idx_calls_org_status ON public.calls(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_calls_started_at ON public.calls(started_at DESC);


-- ------------------------------------------------------------------------------
-- MIGRATION: 022_usage_metering_and_billing.sql
-- ------------------------------------------------------------------------------
-- ============================================================================
-- Migration 022: Usage Metering, Billing Ledger & Subscription Enforcement
-- Vaani-Si — Prompt 09: SaaS Usage Metering, Billing & Subscription Enforcement
-- ============================================================================

DO $$
BEGIN
    -- 1. Ensure client_workspace_id exists on usage_events for multi-client agency attribution
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'usage_events' AND column_name = 'client_workspace_id'
    ) THEN
        ALTER TABLE public.usage_events ADD COLUMN client_workspace_id UUID REFERENCES public.client_workspaces(id) ON DELETE SET NULL;
    END IF;

    -- 2. Ensure duration_source column exists on usage_events
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'usage_events' AND column_name = 'duration_source'
    ) THEN
        ALTER TABLE public.usage_events ADD COLUMN duration_source VARCHAR(50) DEFAULT 'PROVIDER_CDR';
    END IF;

    -- 3. Ensure confirmed_duration_sec column exists on usage_events
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'usage_events' AND column_name = 'confirmed_duration_sec'
    ) THEN
        ALTER TABLE public.usage_events ADD COLUMN confirmed_duration_sec NUMERIC(10, 2);
    END IF;
END $$;

-- Enforce idempotency via unique index on organization_id, correlation_id, and event_type
CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_usage_events_org_corr_type 
ON public.usage_events(organization_id, correlation_id, event_type);

-- Fast lookup index for client workspace usage breakdowns
CREATE INDEX IF NOT EXISTS idx_usage_events_client_ws 
ON public.usage_events(client_workspace_id, occurred_at DESC);

-- Fast lookup for correlation id
CREATE INDEX IF NOT EXISTS idx_usage_events_correlation 
ON public.usage_events(correlation_id);

-- ============================================================================
-- 4. Usage Adjustments and Financial Audit Trail Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.usage_adjustments (
    id TEXT PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_workspace_id UUID REFERENCES public.client_workspaces(id) ON DELETE SET NULL,
    usage_event_id TEXT REFERENCES public.usage_events(id) ON DELETE SET NULL,
    adjustment_type VARCHAR(50) NOT NULL, -- 'CDR_RECONCILIATION', 'DISPUTE_CREDIT', 'PROVIDER_CORRECTION', 'OVERAGE_WAIVER'
    original_quantity NUMERIC(14, 4) NOT NULL,
    adjusted_quantity NUMERIC(14, 4) NOT NULL,
    delta_quantity NUMERIC(14, 4) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    reason TEXT NOT NULL,
    performed_by UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_adjustments_org ON public.usage_adjustments(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_adjustments_event ON public.usage_adjustments(usage_event_id);

-- ============================================================================
-- 5. Row-Level Security (RLS) for Usage Ledger & Billing
-- ============================================================================
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_adjustments ENABLE ROW LEVEL SECURITY;

-- Agency & Org Members can read their own organization's usage events
CREATE POLICY usage_events_tenant_select ON public.usage_events
    FOR SELECT
    USING (
        organization_id = (SELECT auth.jwt() ->> 'organization_id')::uuid
        OR EXISTS (
            SELECT 1 FROM public.memberships m
            WHERE m.organization_id = usage_events.organization_id
            AND m.user_id = auth.uid()
        )
    );

-- Agency & Org Members can view adjustments
CREATE POLICY usage_adjustments_tenant_select ON public.usage_adjustments
    FOR SELECT
    USING (
        organization_id = (SELECT auth.jwt() ->> 'organization_id')::uuid
        OR EXISTS (
            SELECT 1 FROM public.memberships m
            WHERE m.organization_id = usage_adjustments.organization_id
            AND m.user_id = auth.uid()
        )
    );


-- ------------------------------------------------------------------------------
-- MIGRATION: 023_security_and_tenant_uuid_reconciliation.sql
-- ------------------------------------------------------------------------------
-- ==============================================================================
-- VANNI — 023_security_and_tenant_uuid_reconciliation.sql (Prompt 04 / 05)
-- Multi-Tenant Hardening, Workspace Identifier Reconciliation & Safe RLS
-- ==============================================================================

-- Safety & Idempotency Guarantee:
-- This migration is idempotent and can be safely executed against an empty database,
-- a development branch, or a populated database without data loss.

-- ------------------------------------------------------------------------------
-- 1. Helper Function: Non-Recursive Membership Check (SECURITY DEFINER)
-- ------------------------------------------------------------------------------
-- Prevents RLS recursion when policies on tables query organization_members.
CREATE OR REPLACE FUNCTION public.is_active_org_member(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.organization_members
        WHERE organization_id = p_org_id
          AND user_id = auth.uid()
          AND status = 'ACTIVE'
    );
$$;

-- ------------------------------------------------------------------------------
-- 2. Tenant Identifier Type Harmonization Index
-- ------------------------------------------------------------------------------
-- Ensure client_workspaces has fast composite lookup for multi-tenant queries.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_workspaces') THEN
        CREATE INDEX IF NOT EXISTS idx_client_workspaces_tenant_lookup
        ON public.client_workspaces (id, organization_id);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. Row Level Security Hardening with Service Role Bypass
-- ------------------------------------------------------------------------------

-- Organizations: users can only access organizations they are active members of
ALTER TABLE IF EXISTS public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_member_isolation_policy ON public.organizations;
CREATE POLICY org_member_isolation_policy ON public.organizations
    FOR ALL USING (
        public.is_active_org_member(id)
        OR current_setting('request.jwt.claim.role', true) = 'service_role'
        OR auth.role() = 'service_role'
    );

-- Appointments: strictly bound to owning organization
ALTER TABLE IF EXISTS public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointments_tenant_isolation_policy ON public.appointments;
CREATE POLICY appointments_tenant_isolation_policy ON public.appointments
    FOR ALL USING (
        public.is_active_org_member(organization_id)
        OR current_setting('request.jwt.claim.role', true) = 'service_role'
        OR auth.role() = 'service_role'
    );

-- Calls & Transcripts: strict tenant isolation
ALTER TABLE IF EXISTS public.calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calls_tenant_isolation_policy ON public.calls;
CREATE POLICY calls_tenant_isolation_policy ON public.calls
    FOR ALL USING (
        public.is_active_org_member(organization_id)
        OR current_setting('request.jwt.claim.role', true) = 'service_role'
        OR auth.role() = 'service_role'
    );

-- ------------------------------------------------------------------------------
-- 4. Audit & Financial Trail Protection (Foreign Key Soft Protection)
-- ------------------------------------------------------------------------------
-- Historical financial records (billing_invoices, payment_records) and operational
-- audit logs (calls, appointments) MUST NEVER be dropped via ON DELETE CASCADE.
-- For production environments, foreign keys on these tables should be configured with
-- ON DELETE RESTRICT to guarantee audit compliance.

-- ==============================================================================
-- DOWN MIGRATION / ROLLBACK INSTRUCTIONS
-- ==============================================================================
-- To roll back this migration in an emergency, execute the following SQL:
--
-- DROP POLICY IF EXISTS calls_tenant_isolation_policy ON public.calls;
-- DROP POLICY IF EXISTS appointments_tenant_isolation_policy ON public.appointments;
-- DROP POLICY IF EXISTS org_member_isolation_policy ON public.organizations;
-- DROP INDEX IF EXISTS public.idx_client_workspaces_tenant_lookup;
-- DROP FUNCTION IF EXISTS public.is_active_org_member(UUID);
-- ==============================================================================


-- ------------------------------------------------------------------------------
-- MIGRATION: 024_real_estate_site_visit_concurrency.sql
-- ------------------------------------------------------------------------------
-- ==============================================================================
-- VANNI — 024_real_estate_site_visit_concurrency.sql (Prompt 06)
-- Real Estate Workflow Hardening, Site-Visit Concurrency & Capacity Protection
-- ==============================================================================

-- Safety & Idempotency Guarantee:
-- This migration is idempotent and can be safely executed against an empty database,
-- a development branch, or an existing production database without data loss.
-- DO NOT APPLY TO LIVE PRODUCTION WITHOUT EXPLICIT APPROVAL.

-- ------------------------------------------------------------------------------
-- 1. Index Harmonization for Multi-Capacity Site Visits
-- ------------------------------------------------------------------------------
-- Migration 019 created a unique index idx_appointments_unique_site_visit_slot
-- which enforced 1 appointment per slot for a property.
-- In a multi-visitor capacity model where capacity slots manage slot availability
-- (e.g. max_capacity = 3, 5, or custom), having a 1-per-slot unique index on
-- appointments prevents multiple clients from booking during the same slot window.
-- We drop the strict 1-per-slot unique index and replace it with a composite lookup index.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'appointments'
          AND indexname = 'idx_appointments_unique_site_visit_slot'
    ) THEN
        DROP INDEX public.idx_appointments_unique_site_visit_slot;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_appointments_property_scheduled_slot
    ON public.appointments (workspace_id, property_id, scheduled_time)
    WHERE status NOT IN ('CANCELLED', 'RESCHEDULED') AND property_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. Verify Table Definition & Constraints for site_visit_capacity_slots
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_visit_capacity_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.client_workspaces(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    slot_time TIMESTAMPTZ NOT NULL,
    max_capacity INTEGER NOT NULL DEFAULT 5,
    booked_count INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_site_visit_capacity_slot UNIQUE (workspace_id, property_id, slot_time),
    CONSTRAINT chk_booked_not_exceed_capacity CHECK (booked_count <= max_capacity),
    CONSTRAINT chk_booked_non_negative CHECK (booked_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_site_visit_capacity_lookup
    ON public.site_visit_capacity_slots (workspace_id, property_id, slot_time);

-- ------------------------------------------------------------------------------
-- 3. Stored Procedure: Atomic Slot Reservation (Row-Locked & Concurrency Safe)
-- ------------------------------------------------------------------------------
-- Guarantees that two concurrent requests competing for the last available slot
-- cannot both succeed. Employs SELECT ... FOR UPDATE on the capacity slot row.
CREATE OR REPLACE FUNCTION public.reserve_site_visit_slot(
    p_organization_id UUID,
    p_workspace_id UUID,
    p_property_id UUID,
    p_slot_time TIMESTAMPTZ,
    p_requested_slots INTEGER DEFAULT 1,
    p_default_capacity INTEGER DEFAULT 5
)
RETURNS TABLE (
    success BOOLEAN,
    booked_count INTEGER,
    max_capacity INTEGER,
    slot_id UUID,
    error_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_slot RECORD;
BEGIN
    -- Ensure slot record exists (idempotent upsert initialization)
    INSERT INTO public.site_visit_capacity_slots (
        organization_id,
        workspace_id,
        property_id,
        slot_time,
        max_capacity,
        booked_count,
        version
    )
    VALUES (
        p_organization_id,
        p_workspace_id,
        p_property_id,
        p_slot_time,
        p_default_capacity,
        0,
        1
    )
    ON CONFLICT (workspace_id, property_id, slot_time) DO NOTHING;

    -- Lock the slot row exclusively for this transaction
    SELECT * INTO v_slot
    FROM public.site_visit_capacity_slots
    WHERE workspace_id = p_workspace_id
      AND property_id = p_property_id
      AND slot_time = p_slot_time
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, 0, NULL::UUID, 'SLOT_NOT_FOUND'::TEXT;
        RETURN;
    END IF;

    -- Verify capacity threshold
    IF (v_slot.booked_count + p_requested_slots) > v_slot.max_capacity THEN
        RETURN QUERY SELECT 
            FALSE, 
            v_slot.booked_count, 
            v_slot.max_capacity, 
            v_slot.id, 
            'CAPACITY_EXHAUSTED'::TEXT;
        RETURN;
    END IF;

    -- Atomically increment booking count
    UPDATE public.site_visit_capacity_slots
    SET 
        booked_count = booked_count + p_requested_slots,
        version = version + 1,
        updated_at = NOW()
    WHERE id = v_slot.id
    RETURNING * INTO v_slot;

    RETURN QUERY SELECT 
        TRUE, 
        v_slot.booked_count, 
        v_slot.max_capacity, 
        v_slot.id, 
        NULL::TEXT;
    RETURN;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. Stored Procedure: Atomic Slot Release (Cancellation / Rescheduling)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_site_visit_slot(
    p_organization_id UUID,
    p_workspace_id UUID,
    p_property_id UUID,
    p_slot_time TIMESTAMPTZ,
    p_slots_to_release INTEGER DEFAULT 1
)
RETURNS TABLE (
    success BOOLEAN,
    booked_count INTEGER,
    max_capacity INTEGER,
    error_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_slot RECORD;
BEGIN
    SELECT * INTO v_slot
    FROM public.site_visit_capacity_slots
    WHERE workspace_id = p_workspace_id
      AND property_id = p_property_id
      AND slot_time = p_slot_time
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, 0, 'SLOT_NOT_FOUND'::TEXT;
        RETURN;
    END IF;

    UPDATE public.site_visit_capacity_slots
    SET 
        booked_count = GREATEST(0, booked_count - p_slots_to_release),
        version = version + 1,
        updated_at = NOW()
    WHERE id = v_slot.id
    RETURNING * INTO v_slot;

    RETURN QUERY SELECT 
        TRUE, 
        v_slot.booked_count, 
        v_slot.max_capacity, 
        NULL::TEXT;
    RETURN;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. Row-Level Security for site_visit_capacity_slots
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.site_visit_capacity_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_visit_capacity_isolation ON public.site_visit_capacity_slots;
CREATE POLICY site_visit_capacity_isolation ON public.site_visit_capacity_slots
    FOR ALL USING (
        public.is_active_org_member(organization_id)
        OR current_setting('request.jwt.claim.role', true) = 'service_role'
        OR auth.role() = 'service_role'
    );

-- ==============================================================================
-- DOWN MIGRATION / ROLLBACK INSTRUCTIONS
-- ==============================================================================
-- To roll back this migration in an emergency, execute the following SQL:
--
-- DROP FUNCTION IF EXISTS public.release_site_visit_slot(UUID, UUID, UUID, TIMESTAMPTZ, INTEGER);
-- DROP FUNCTION IF EXISTS public.reserve_site_visit_slot(UUID, UUID, UUID, TIMESTAMPTZ, INTEGER, INTEGER);
-- DROP POLICY IF EXISTS site_visit_capacity_isolation ON public.site_visit_capacity_slots;
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_unique_site_visit_slot
--   ON public.appointments (workspace_id, property_id, scheduled_time)
--   WHERE status NOT IN ('CANCELLED', 'RESCHEDULED') AND property_id IS NOT NULL;
-- DROP INDEX IF EXISTS public.idx_appointments_property_scheduled_slot;
-- ==============================================================================


-- ------------------------------------------------------------------------------
-- MIGRATION: 025_healthcare_appointment_concurrency.sql
-- ------------------------------------------------------------------------------
-- ==============================================================================
-- 025: Healthcare Appointment Concurrency, Doctor Roster & Tenancy Hardening
-- Dhwani SI / Vaani-Si Multi-Tenant Voice Platform (Prompt 07)
-- ==============================================================================
-- STATUS: PROPOSED FOR REVIEW ONLY — DO NOT APPLY TO LIVE DATABASE WITHOUT REVIEW
--
-- PURPOSE:
-- 1. Ensure public.appointments has atomic slot reservation constraints preventing
--    double-booking under concurrent API requests for OPD doctor schedules.
-- 2. Enforce tenant isolation indexes on (workspace_id, scheduled_time).
-- 3. Validate audit trail and cancellation tracking columns on public.appointments.
-- 4. Provide idempotent rollback definitions.
-- ==============================================================================

-- 1. APPOINTMENTS TABLE RECONCILIATION & STRICT CONSTRAINTS
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'appointments') THEN
        -- Add any missing columns with backward compatibility
        ALTER TABLE public.appointments
            ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.client_workspaces(id) ON DELETE CASCADE,
            ADD COLUMN IF NOT EXISTS doctor_id VARCHAR(100),
            ADD COLUMN IF NOT EXISTS scheduled_time TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 15,
            ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50),
            ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255),
            ADD COLUMN IF NOT EXISTS service_type VARCHAR(100) DEFAULT 'Doctor Consultation',
            ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'CONFIRMED',
            ADD COLUMN IF NOT EXISTS notes TEXT,
            ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
            ADD COLUMN IF NOT EXISTS audit_history JSONB DEFAULT '[]'::jsonb,
            ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);

        -- Synchronize scheduled_time with appointment_time if needed
        UPDATE public.appointments
        SET scheduled_time = appointment_time
        WHERE scheduled_time IS NULL AND appointment_time IS NOT NULL;
    END IF;
END $$;

-- 2. ATOMIC CONCURRENCY UNIQUE PARTIAL INDEXES
-- Prevents two active appointments from reserving the exact same doctor slot in a workspace
CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_doctor_slot
    ON public.appointments (workspace_id, doctor_id, scheduled_time)
    WHERE doctor_id IS NOT NULL AND status NOT IN ('CANCELLED', 'RESCHEDULED');

-- Prevents duplicate submissions with identical idempotency keys within tenant
CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_idempotency
    ON public.appointments (workspace_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- High-performance query index for date-range and doctor availability checks
CREATE INDEX IF NOT EXISTS idx_appointments_workspace_doctor_time
    ON public.appointments (workspace_id, doctor_id, scheduled_time)
    WHERE status NOT IN ('CANCELLED');

-- 3. HEALTHCARE DOCTOR ROSTER RECONCILIATION ON BUSINESS_STAFF
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'business_staff') THEN
        ALTER TABLE public.business_staff
            ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.client_workspaces(id) ON DELETE CASCADE,
            ADD COLUMN IF NOT EXISTS shift_start VARCHAR(5) DEFAULT '09:00',
            ADD COLUMN IF NOT EXISTS shift_end VARCHAR(5) DEFAULT '17:00',
            ADD COLUMN IF NOT EXISTS break_start VARCHAR(5) DEFAULT '13:00',
            ADD COLUMN IF NOT EXISTS break_end VARCHAR(5) DEFAULT '14:00',
            ADD COLUMN IF NOT EXISTS slot_duration_minutes INT DEFAULT 15,
            ADD COLUMN IF NOT EXISTS buffer_minutes INT DEFAULT 5,
            ADD COLUMN IF NOT EXISTS leaves JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 4. ROW LEVEL SECURITY (RLS) VERIFICATION
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointments_healthcare_tenant_isolation ON public.appointments;
CREATE POLICY appointments_healthcare_tenant_isolation ON public.appointments
    FOR ALL USING (
        current_setting('request.jwt.claim.role', true) = 'service_role' OR
        workspace_id IN (
            SELECT id FROM public.client_workspaces
            WHERE organization_id IN (
                SELECT organization_id FROM public.organization_members
                WHERE user_id = auth.uid()
            )
        ) OR
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

-- ==============================================================================
-- ROLLBACK SCRIPT (IF REQUIRED):
--
-- DROP INDEX IF EXISTS public.idx_appointments_workspace_doctor_time;
-- DROP INDEX IF EXISTS public.uq_appointments_idempotency;
-- DROP INDEX IF EXISTS public.uq_appointments_doctor_slot;
-- DROP POLICY IF EXISTS appointments_healthcare_tenant_isolation ON public.appointments;
-- ==============================================================================


-- ------------------------------------------------------------------------------
-- MIGRATION: 026_billing_payment_hardening.sql
-- ------------------------------------------------------------------------------
-- ==============================================================================
-- 026: Billing Ledger, Payment Idempotency & Webhook Hardening
-- Dhwani SI / Vaani-Si Multi-Tenant Voice Platform (Prompt 08)
-- ==============================================================================
-- STATUS: PROPOSED FOR REVIEW ONLY — DO NOT APPLY TO LIVE DATABASE WITHOUT REVIEW

DO $$
BEGIN
    -- Ensure status column on subscriptions supports INCOMPLETE
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscriptions') THEN
        ALTER TABLE public.subscriptions
            ALTER COLUMN status SET DEFAULT 'TRIALING';
    END IF;

    -- Ensure provider_payment_id unique index on payment_records for financial idempotency
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_records') THEN
        CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_records_provider_id
            ON public.payment_records (provider, provider_payment_id)
            WHERE provider_payment_id IS NOT NULL;
    END IF;

    -- Ensure provider_event_id unique index on billing_provider_events
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'billing_provider_events') THEN
        CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_provider_events_idempotency
            ON public.billing_provider_events (provider, provider_event_id);
    END IF;

    -- Ensure client_workspace_id on billing_invoices if missing
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'billing_invoices') THEN
        ALTER TABLE public.billing_invoices
            ADD COLUMN IF NOT EXISTS client_workspace_id UUID REFERENCES public.client_workspaces(id) ON DELETE SET NULL;
    END IF;
END $$;

-- RLS Hardening for billing provider events: service role only
ALTER TABLE public.billing_provider_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_provider_events_service_only ON public.billing_provider_events;
CREATE POLICY billing_provider_events_service_only ON public.billing_provider_events
    FOR ALL USING (
        current_setting('request.jwt.claim.role', true) = 'service_role'
    );

-- ROLLBACK SCRIPT (IF EVER APPLIED):
-- DROP INDEX IF EXISTS public.uq_payment_records_provider_id;
-- DROP POLICY IF EXISTS billing_provider_events_service_only ON public.billing_provider_events;

