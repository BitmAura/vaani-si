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
