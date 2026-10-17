-- ==============================================================================
-- 020: Production Hardening, Schema Reconciliation & Concurrency Integrity
-- Dhwani SI / Vaani-Si Multi-Tenant Voice Platform (Prompt 07)
-- ==============================================================================

-- 1. RECONCILE APPOINTMENTS TABLE
-- Reconciles discrepancies between 001, 018, and 019 for healthcare & real estate site visits
DO $$
BEGIN
    -- Ensure columns exist on public.appointments
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'appointments') THEN
        ALTER TABLE public.appointments
            ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.client_workspaces(id) ON DELETE CASCADE,
            ADD COLUMN IF NOT EXISTS scheduled_time TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS doctor_id VARCHAR(100),
            ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS visitor_count INTEGER DEFAULT 1,
            ADD COLUMN IF NOT EXISTS transport_required BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS assigned_agent VARCHAR(255),
            ADD COLUMN IF NOT EXISTS appointment_type VARCHAR(50) DEFAULT 'GENERAL',
            ADD COLUMN IF NOT EXISTS notes TEXT,
            ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
            ADD COLUMN IF NOT EXISTS audit_history JSONB DEFAULT '[]'::jsonb,
            ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100),
            ADD COLUMN IF NOT EXISTS max_capacity INTEGER DEFAULT 1;

        -- Synchronize appointment_time and scheduled_time
        UPDATE public.appointments
        SET scheduled_time = appointment_time
        WHERE scheduled_time IS NULL AND appointment_time IS NOT NULL;

        UPDATE public.appointments
        SET appointment_time = scheduled_time
        WHERE appointment_time IS NULL AND scheduled_time IS NOT NULL;
    END IF;
END $$;

-- 2. CONCURRENCY-SAFE INDEXES ON APPOINTMENTS
CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_idempotency
    ON public.appointments (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_doctor_slot
    ON public.appointments (workspace_id, doctor_id, scheduled_time)
    WHERE doctor_id IS NOT NULL AND status NOT IN ('CANCELLED', 'RESCHEDULED');

CREATE INDEX IF NOT EXISTS idx_appointments_workspace_time
    ON public.appointments (workspace_id, scheduled_time);

CREATE INDEX IF NOT EXISTS idx_appointments_org_time
    ON public.appointments (organization_id, scheduled_time);

-- 3. CAPACITY-BASED SITE VISIT CONCURRENCY TABLE
-- Enables transaction-safe capacity tracking for real estate site visits (capacity > 1)
CREATE TABLE IF NOT EXISTS public.site_visit_capacity_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.client_workspaces(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    slot_time TIMESTAMPTZ NOT NULL,
    max_capacity INTEGER NOT NULL DEFAULT 5,
    booked_count INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_site_visit_capacity_slot UNIQUE (workspace_id, property_id, slot_time),
    CONSTRAINT chk_booked_not_exceed_capacity CHECK (booked_count <= max_capacity),
    CONSTRAINT chk_booked_non_negative CHECK (booked_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_site_visit_capacity_lookup
    ON public.site_visit_capacity_slots (workspace_id, property_id, slot_time);

-- 4. RECONCILE LEADS TABLE
-- Ensures all multi-tenant vertical qualification attributes exist
ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.client_workspaces(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS property_interest VARCHAR(255),
    ADD COLUMN IF NOT EXISTS purchase_purpose VARCHAR(50),
    ADD COLUMN IF NOT EXISTS budget_min NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS budget_max NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS preferred_location VARCHAR(255),
    ADD COLUMN IF NOT EXISTS preferred_dimensions VARCHAR(100),
    ADD COLUMN IF NOT EXISTS purchase_timeline VARCHAR(50),
    ADD COLUMN IF NOT EXISTS site_visit_interest VARCHAR(50),
    ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(255),
    ADD COLUMN IF NOT EXISTS clinic_subcategory VARCHAR(100),
    ADD COLUMN IF NOT EXISTS patient_symptoms TEXT,
    ADD COLUMN IF NOT EXISTS preferred_doctor VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_leads_workspace_id ON public.leads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_leads_org_rating ON public.leads(organization_id, rating);

-- 5. RECONCILE CLIENT WORKSPACES TABLE
-- Guarantees industry config JSONB columns exist
ALTER TABLE public.client_workspaces
    ADD COLUMN IF NOT EXISTS clinic_config JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS real_estate_config JSONB DEFAULT '{}'::jsonb;

-- 6. RECONCILE BUSINESS STAFF (DOCTORS & AGENTS)
ALTER TABLE public.business_staff
    ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.client_workspaces(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS shift_start VARCHAR(5) DEFAULT '09:00',
    ADD COLUMN IF NOT EXISTS shift_end VARCHAR(5) DEFAULT '17:00',
    ADD COLUMN IF NOT EXISTS break_start VARCHAR(5) DEFAULT '13:00',
    ADD COLUMN IF NOT EXISTS break_end VARCHAR(5) DEFAULT '14:00',
    ADD COLUMN IF NOT EXISTS slot_duration_minutes INT DEFAULT 15,
    ADD COLUMN IF NOT EXISTS buffer_minutes INT DEFAULT 5,
    ADD COLUMN IF NOT EXISTS leaves JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_business_staff_workspace ON public.business_staff(workspace_id);

-- 7. RECONCILE BUSINESS FAQS
ALTER TABLE public.business_faqs
    ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.client_workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_business_faqs_workspace ON public.business_faqs(workspace_id);

-- 8. RLS HARDENING: ALL TABLES MUST ALLOW SERVICE ROLE & ENFORCE TENANT ISOLATION
ALTER TABLE public.site_visit_capacity_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_visit_capacity_isolation ON public.site_visit_capacity_slots;
CREATE POLICY site_visit_capacity_isolation ON public.site_visit_capacity_slots
    FOR ALL USING (
        current_setting('request.jwt.claim.role', true) = 'service_role' OR
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS appointments_service_role_policy ON public.appointments;
CREATE POLICY appointments_service_role_policy ON public.appointments
    FOR ALL USING (
        current_setting('request.jwt.claim.role', true) = 'service_role' OR
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS leads_service_role_policy ON public.leads;
CREATE POLICY leads_service_role_policy ON public.leads
    FOR ALL USING (
        current_setting('request.jwt.claim.role', true) = 'service_role' OR
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );
