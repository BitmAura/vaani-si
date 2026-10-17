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
