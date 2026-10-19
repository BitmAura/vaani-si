-- ==============================================================================
-- 025: Healthcare Appointment Concurrency, Doctor Roster & Tenancy Hardening
-- Dhwani SI / Vaani-Si Multi-Tenant Voice Platform (Prompt 07)
-- ==============================================================================
-- STATUS: PROPOSED FOR REVIEW ONLY — DO NOT APPLY TO LIVE DATABASE WITHOUT REVIEW
--
-- PURPOSE:
-- 1. Ensure public.appointments has atomic slot reservation constraints preventing
--    double-booking under concurrent API requests for OPD doctor schedules.
-- 2. Enforce tenant isolation indexes on (workspace_id, scheduled_time).
-- 3. Validate audit trail and cancellation tracking columns on public.appointments.
-- 4. Provide idempotent rollback definitions.
-- ==============================================================================

-- 1. APPOINTMENTS TABLE RECONCILIATION & STRICT CONSTRAINTS
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'appointments') THEN
        -- Add any missing columns with backward compatibility
        ALTER TABLE public.appointments
            ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.client_workspaces(id) ON DELETE CASCADE,
            ADD COLUMN IF NOT EXISTS doctor_id VARCHAR(100),
            ADD COLUMN IF NOT EXISTS scheduled_time TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 15,
            ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50),
            ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255),
            ADD COLUMN IF NOT EXISTS service_type VARCHAR(100) DEFAULT 'Doctor Consultation',
            ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'CONFIRMED',
            ADD COLUMN IF NOT EXISTS notes TEXT,
            ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
            ADD COLUMN IF NOT EXISTS audit_history JSONB DEFAULT '[]'::jsonb,
            ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);

        -- Synchronize scheduled_time with appointment_time if needed
        UPDATE public.appointments
        SET scheduled_time = appointment_time
        WHERE scheduled_time IS NULL AND appointment_time IS NOT NULL;
    END IF;
END $$;

-- 2. ATOMIC CONCURRENCY UNIQUE PARTIAL INDEXES
-- Prevents two active appointments from reserving the exact same doctor slot in a workspace
CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_doctor_slot
    ON public.appointments (workspace_id, doctor_id, scheduled_time)
    WHERE doctor_id IS NOT NULL AND status NOT IN ('CANCELLED', 'RESCHEDULED');

-- Prevents duplicate submissions with identical idempotency keys within tenant
CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_idempotency
    ON public.appointments (workspace_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- High-performance query index for date-range and doctor availability checks
CREATE INDEX IF NOT EXISTS idx_appointments_workspace_doctor_time
    ON public.appointments (workspace_id, doctor_id, scheduled_time)
    WHERE status NOT IN ('CANCELLED');

-- 3. HEALTHCARE DOCTOR ROSTER RECONCILIATION ON BUSINESS_STAFF
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'business_staff') THEN
        ALTER TABLE public.business_staff
            ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.client_workspaces(id) ON DELETE CASCADE,
            ADD COLUMN IF NOT EXISTS shift_start VARCHAR(5) DEFAULT '09:00',
            ADD COLUMN IF NOT EXISTS shift_end VARCHAR(5) DEFAULT '17:00',
            ADD COLUMN IF NOT EXISTS break_start VARCHAR(5) DEFAULT '13:00',
            ADD COLUMN IF NOT EXISTS break_end VARCHAR(5) DEFAULT '14:00',
            ADD COLUMN IF NOT EXISTS slot_duration_minutes INT DEFAULT 15,
            ADD COLUMN IF NOT EXISTS buffer_minutes INT DEFAULT 5,
            ADD COLUMN IF NOT EXISTS leaves JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 4. ROW LEVEL SECURITY (RLS) VERIFICATION
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointments_healthcare_tenant_isolation ON public.appointments;
CREATE POLICY appointments_healthcare_tenant_isolation ON public.appointments
    FOR ALL USING (
        current_setting('request.jwt.claim.role', true) = 'service_role' OR
        workspace_id IN (
            SELECT id FROM public.client_workspaces
            WHERE organization_id IN (
                SELECT organization_id FROM public.organization_members
                WHERE user_id = auth.uid()
            )
        ) OR
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

-- ==============================================================================
-- ROLLBACK SCRIPT (IF REQUIRED):
--
-- DROP INDEX IF EXISTS public.idx_appointments_workspace_doctor_time;
-- DROP INDEX IF EXISTS public.uq_appointments_idempotency;
-- DROP INDEX IF EXISTS public.uq_appointments_doctor_slot;
-- DROP POLICY IF EXISTS appointments_healthcare_tenant_isolation ON public.appointments;
-- ==============================================================================
