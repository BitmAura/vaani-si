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
