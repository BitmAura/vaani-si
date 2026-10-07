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
