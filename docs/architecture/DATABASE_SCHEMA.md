# VANNI — Multi-Tenant Database Domain Model & Schema Specification
**Database Engine:** PostgreSQL 16+ (Supabase Architecture)  
**Security Standard:** Strict Row-Level Security (RLS) + Tenant Organization Scoping  
**Version:** 1.0.0-PROPOSAL

---

## 1. Domain ER Architecture Overview

Every customer in VANNI is an **Organization**. Every data asset (agents, contacts, leads, calls, knowledge, appointments) is strictly partitioned by `organization_id`. 
All cross-tenant access is structurally prevented at the database kernel level via PostgreSQL Row Level Security (RLS).

```
┌────────────────────────────────────────────────────────────────────────┐
│                              ORGANIZATIONS                             │
│  (id, name, slug, billing_tier, plan_status, monthly_minute_limit)     │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │ 1:N                            │ 1:N
                    ▼                                ▼
       ┌────────────────────────┐      ┌────────────────────────┐
       │  ORGANIZATION_MEMBERS  │      │   BUSINESS_PROFILES    │
       │  (user_id, role, rbac) │      │  (industry_type, info) │
       └────────────────────────┘      └────────────┬───────────┘
                                                    │ 1:N
                                                    ▼
       ┌────────────────────────────────────────────────────────┐
       │   AGENTS (AI Employees, e.g. "Sahana Dental Reception")│
       │   (id, org_id, industry_template_id, status, voice_cfg)│
       └────────────────────────┬───────────────────────────────┘
                                │ 1:N
                                ▼
       ┌────────────────────────────────────────────────────────┐
       │   CALLS (Inbound & Outbound PSTN/Web Telephony Sessions│
       │   (id, org_id, agent_id, contact_id, status, duration) │
       └──────────────┬─────────────────────────────┬───────────┘
                      │ 1:N                         │ 1:1
                      ▼                             ▼
       ┌────────────────────────┐     ┌────────────────────────┐
       │      CALL_EVENTS       │     │      TRANSCRIPTS       │
       │  (event_type, latency) │     │  (turns JSONB, summary)│
       └────────────────────────┘     └────────────────────────┘
                      │                             │
                      ▼                             ▼
       ┌────────────────────────┐     ┌────────────────────────┐
       │         LEADS          │     │      APPOINTMENTS      │
       │  (dossier, rating, val)│     │  (service, doctor, slot│
       └────────────────────────┘     └────────────────────────┘
```

---

## 2. Core Domain Tables Specification

### Domain 1: Organizations & Multi-Tenancy
```sql
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    industry_type VARCHAR(50) NOT NULL, -- DENTAL, HEALTHCARE, REAL_ESTATE, etc.
    billing_tier VARCHAR(50) DEFAULT 'GROWTH',
    monthly_minute_limit INTEGER DEFAULT 3000,
    minutes_used_current_month INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- References auth.users(id) in Supabase
    role VARCHAR(50) NOT NULL DEFAULT 'MEMBER', -- OWNER, ADMIN, OPERATOR, VIEWER
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);
```

### Domain 2: Business Profiles & Extensible Business Brain
```sql
CREATE TABLE public.business_profiles (
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
    state VARCHAR(100) DEFAULT 'Karnataka',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.business_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun, 1=Mon, etc.
    opens_at TIME NOT NULL,
    closes_at TIME NOT NULL,
    is_closed BOOLEAN DEFAULT FALSE
);

CREATE TABLE public.business_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    designation VARCHAR(100) NOT NULL, -- e.g. "Senior Implantologist", "Project Director"
    specialization VARCHAR(255),
    consultation_fee NUMERIC(10, 2),
    available_days SMALLINT[] DEFAULT '{1,2,3,4,5,6}',
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE public.business_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    price_minimum NUMERIC(12, 2),
    price_maximum NUMERIC(12, 2),
    duration_minutes INTEGER DEFAULT 30,
    description TEXT,
    is_bookable_by_ai BOOLEAN DEFAULT TRUE
);
```

### Domain 3: Industry Templates
```sql
CREATE TABLE public.industry_templates (
    id VARCHAR(50) PRIMARY KEY, -- e.g. 'dental_clinic', 'real_estate_plots'
    display_name VARCHAR(100) NOT NULL,
    version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    default_system_prompt TEXT NOT NULL,
    allowed_tools JSONB NOT NULL DEFAULT '[]',
    qualification_schema JSONB NOT NULL DEFAULT '{}',
    safety_guardrails JSONB NOT NULL DEFAULT '{}',
    terminology_lexicon JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Domain 4: AI Agents & Versioning
```sql
CREATE TABLE public.agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    industry_template_id VARCHAR(50) REFERENCES public.industry_templates(id),
    name VARCHAR(100) NOT NULL DEFAULT 'Sahana',
    voice_gender VARCHAR(20) DEFAULT 'FEMALE',
    voice_engine VARCHAR(50) DEFAULT 'sarvam_bulbul_v2',
    voice_speaker_id VARCHAR(50) DEFAULT 'meera',
    primary_dialect VARCHAR(50) DEFAULT 'KANGLISH_BUSINESS',
    speech_pace NUMERIC(3, 2) DEFAULT 1.05,
    virtual_phone_number VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    active_version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.agent_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    system_prompt TEXT NOT NULL,
    tools_config JSONB NOT NULL,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_id, version_number)
);
```

### Domain 5: Telephony Sessions, Events & Observability
```sql
CREATE TABLE public.calls (
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
    duration_seconds INTEGER DEFAULT 0,
    cost_inr NUMERIC(10, 4) DEFAULT 0.0000,
    telephony_provider VARCHAR(50) DEFAULT 'EXOTEL',
    telephony_call_sid VARCHAR(100),
    audio_recording_url TEXT,
    lead_rating VARCHAR(30) CHECK (lead_rating IN ('HOT', 'WARM', 'COLD', 'DISQUALIFIED')),
    summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.call_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- STT_START, INTENT_DETECTED, LLM_START, TTS_START, USER_BARGE_IN, TOOL_DISPATCH
    payload JSONB,
    latency_ms INTEGER,
    timestamp_ms BIGINT NOT NULL
);

CREATE TABLE public.transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID UNIQUE NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    turns JSONB NOT NULL DEFAULT '[]', -- Array of {speaker, text, timestampMs, latencyBreakdown}
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Domain 6: Leads, Appointments & Action Engine
```sql
CREATE TABLE public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    call_id UUID REFERENCES public.calls(id) ON DELETE SET NULL,
    contact_phone VARCHAR(20) NOT NULL,
    contact_name VARCHAR(100),
    rating VARCHAR(20) NOT NULL DEFAULT 'WARM',
    budget VARCHAR(100),
    intent VARCHAR(255) NOT NULL,
    confirmed_outcome TEXT,
    whatsapp_dispatched BOOLEAN DEFAULT FALSE,
    crm_synced BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    call_id UUID REFERENCES public.calls(id) ON DELETE SET NULL,
    contact_phone VARCHAR(20) NOT NULL,
    contact_name VARCHAR(100),
    service_id UUID REFERENCES public.business_services(id),
    staff_id UUID REFERENCES public.business_staff(id),
    appointment_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(30) DEFAULT 'CONFIRMED',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. Row-Level Security (RLS) Enforcement

```sql
-- Enable RLS across all customer tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Helper function: Get organizations the current authenticated user belongs to
CREATE OR REPLACE FUNCTION public.current_user_org_ids()
RETURNS SETOF UUID AS $$
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Master Tenant Isolation Policy: Organizations
CREATE POLICY tenant_isolation_orgs ON public.organizations
    FOR ALL USING (id IN (SELECT public.current_user_org_ids()));

-- Master Tenant Isolation Policy: Calls
CREATE POLICY tenant_isolation_calls ON public.calls
    FOR ALL USING (organization_id IN (SELECT public.current_user_org_ids()));

-- Master Tenant Isolation Policy: Leads
CREATE POLICY tenant_isolation_leads ON public.leads
    FOR ALL USING (organization_id IN (SELECT public.current_user_org_ids()));
```
