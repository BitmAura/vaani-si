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
