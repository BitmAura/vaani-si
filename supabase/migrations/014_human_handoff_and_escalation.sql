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
