-- 019_real_estate_properties_and_site_visits.sql
-- Migration for Real Estate Vertical Configuration, Property Inventory & Site Visit Operations (Prompt 06)
-- Multi-Tenant Gated Isolation for Plots, Villas, Apartments & Site Visits

-- ==============================================================================
-- 1. EXTEND CLIENT WORKSPACES FOR REAL ESTATE SETTINGS
-- ==============================================================================
ALTER TABLE public.client_workspaces
ADD COLUMN IF NOT EXISTS real_estate_config JSONB DEFAULT '{}'::jsonb;

-- ==============================================================================
-- 2. PROPERTIES & INVENTORY CATALOGUE TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.client_workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    reference_code VARCHAR(100) NOT NULL,
    property_type VARCHAR(50) NOT NULL CHECK (property_type IN ('PLOT', 'VILLA', 'APARTMENT', 'HOUSE', 'COMMERCIAL')),
    sub_type VARCHAR(100),
    locality VARCHAR(255) NOT NULL,
    address TEXT,
    map_url TEXT,
    dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
    pricing JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'ON_HOLD', 'RESERVED', 'SOLD', 'INACTIVE')),
    amenities TEXT[] DEFAULT '{}',
    description TEXT NOT NULL DEFAULT '',
    developer_contact JSONB NOT NULL DEFAULT '{}'::jsonb,
    rera_details JSONB DEFAULT '{}'::jsonb,
    documents JSONB DEFAULT '[]'::jsonb,
    verified_by VARCHAR(255),
    last_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_properties_workspace_refcode UNIQUE (workspace_id, reference_code)
);

CREATE INDEX IF NOT EXISTS idx_properties_workspace_id ON public.properties (workspace_id);
CREATE INDEX IF NOT EXISTS idx_properties_organization_id ON public.properties (organization_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties (status);
CREATE INDEX IF NOT EXISTS idx_properties_type ON public.properties (property_type);

-- ==============================================================================
-- 3. EXTEND APPOINTMENTS FOR SITE VISITS (REUSING BOOKING ENGINE)
-- ==============================================================================
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS visitor_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS transport_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS assigned_agent VARCHAR(255),
ADD COLUMN IF NOT EXISTS appointment_type VARCHAR(50) DEFAULT 'GENERAL';

-- Concurrency-safe unique index for site visit slots
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_unique_site_visit_slot
ON public.appointments (workspace_id, property_id, scheduled_time)
WHERE status NOT IN ('CANCELLED', 'RESCHEDULED') AND property_id IS NOT NULL;

-- ==============================================================================
-- 4. EXTEND LEADS FOR REAL ESTATE QUALIFICATION
-- ==============================================================================
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS property_interest VARCHAR(255),
ADD COLUMN IF NOT EXISTS purchase_purpose VARCHAR(50),
ADD COLUMN IF NOT EXISTS budget_min NUMERIC(14, 2),
ADD COLUMN IF NOT EXISTS budget_max NUMERIC(14, 2),
ADD COLUMN IF NOT EXISTS preferred_location VARCHAR(255),
ADD COLUMN IF NOT EXISTS preferred_dimensions VARCHAR(100),
ADD COLUMN IF NOT EXISTS purchase_timeline VARCHAR(50),
ADD COLUMN IF NOT EXISTS site_visit_interest VARCHAR(50),
ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(255);

-- ==============================================================================
-- 5. ROW-LEVEL SECURITY POLICIES FOR PROPERTIES
-- ==============================================================================
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "properties_tenant_select" ON public.properties
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "properties_tenant_insert" ON public.properties
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('OWNER', 'ADMIN', 'MEMBER')
        )
    );

CREATE POLICY "properties_tenant_update" ON public.properties
    FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('OWNER', 'ADMIN', 'MEMBER')
        )
    );

CREATE POLICY "properties_tenant_delete" ON public.properties
    FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('OWNER', 'ADMIN')
        )
    );
