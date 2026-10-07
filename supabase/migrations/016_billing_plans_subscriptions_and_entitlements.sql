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
