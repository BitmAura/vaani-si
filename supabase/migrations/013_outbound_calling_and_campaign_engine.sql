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
