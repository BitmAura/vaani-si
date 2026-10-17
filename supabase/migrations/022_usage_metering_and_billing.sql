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
