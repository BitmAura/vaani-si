-- ==============================================================================
-- VANNI — 024_real_estate_site_visit_concurrency.sql (Prompt 06)
-- Real Estate Workflow Hardening, Site-Visit Concurrency & Capacity Protection
-- ==============================================================================

-- Safety & Idempotency Guarantee:
-- This migration is idempotent and can be safely executed against an empty database,
-- a development branch, or an existing production database without data loss.
-- DO NOT APPLY TO LIVE PRODUCTION WITHOUT EXPLICIT APPROVAL.

-- ------------------------------------------------------------------------------
-- 1. Index Harmonization for Multi-Capacity Site Visits
-- ------------------------------------------------------------------------------
-- Migration 019 created a unique index idx_appointments_unique_site_visit_slot
-- which enforced 1 appointment per slot for a property.
-- In a multi-visitor capacity model where capacity slots manage slot availability
-- (e.g. max_capacity = 3, 5, or custom), having a 1-per-slot unique index on
-- appointments prevents multiple clients from booking during the same slot window.
-- We drop the strict 1-per-slot unique index and replace it with a composite lookup index.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'appointments'
          AND indexname = 'idx_appointments_unique_site_visit_slot'
    ) THEN
        DROP INDEX public.idx_appointments_unique_site_visit_slot;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_appointments_property_scheduled_slot
    ON public.appointments (workspace_id, property_id, scheduled_time)
    WHERE status NOT IN ('CANCELLED', 'RESCHEDULED') AND property_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. Verify Table Definition & Constraints for site_visit_capacity_slots
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 3. Stored Procedure: Atomic Slot Reservation (Row-Locked & Concurrency Safe)
-- ------------------------------------------------------------------------------
-- Guarantees that two concurrent requests competing for the last available slot
-- cannot both succeed. Employs SELECT ... FOR UPDATE on the capacity slot row.
CREATE OR REPLACE FUNCTION public.reserve_site_visit_slot(
    p_organization_id UUID,
    p_workspace_id UUID,
    p_property_id UUID,
    p_slot_time TIMESTAMPTZ,
    p_requested_slots INTEGER DEFAULT 1,
    p_default_capacity INTEGER DEFAULT 5
)
RETURNS TABLE (
    success BOOLEAN,
    booked_count INTEGER,
    max_capacity INTEGER,
    slot_id UUID,
    error_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_slot RECORD;
BEGIN
    -- Ensure slot record exists (idempotent upsert initialization)
    INSERT INTO public.site_visit_capacity_slots (
        organization_id,
        workspace_id,
        property_id,
        slot_time,
        max_capacity,
        booked_count,
        version
    )
    VALUES (
        p_organization_id,
        p_workspace_id,
        p_property_id,
        p_slot_time,
        p_default_capacity,
        0,
        1
    )
    ON CONFLICT (workspace_id, property_id, slot_time) DO NOTHING;

    -- Lock the slot row exclusively for this transaction
    SELECT * INTO v_slot
    FROM public.site_visit_capacity_slots
    WHERE workspace_id = p_workspace_id
      AND property_id = p_property_id
      AND slot_time = p_slot_time
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, 0, NULL::UUID, 'SLOT_NOT_FOUND'::TEXT;
        RETURN;
    END IF;

    -- Verify capacity threshold
    IF (v_slot.booked_count + p_requested_slots) > v_slot.max_capacity THEN
        RETURN QUERY SELECT 
            FALSE, 
            v_slot.booked_count, 
            v_slot.max_capacity, 
            v_slot.id, 
            'CAPACITY_EXHAUSTED'::TEXT;
        RETURN;
    END IF;

    -- Atomically increment booking count
    UPDATE public.site_visit_capacity_slots
    SET 
        booked_count = booked_count + p_requested_slots,
        version = version + 1,
        updated_at = NOW()
    WHERE id = v_slot.id
    RETURNING * INTO v_slot;

    RETURN QUERY SELECT 
        TRUE, 
        v_slot.booked_count, 
        v_slot.max_capacity, 
        v_slot.id, 
        NULL::TEXT;
    RETURN;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. Stored Procedure: Atomic Slot Release (Cancellation / Rescheduling)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_site_visit_slot(
    p_organization_id UUID,
    p_workspace_id UUID,
    p_property_id UUID,
    p_slot_time TIMESTAMPTZ,
    p_slots_to_release INTEGER DEFAULT 1
)
RETURNS TABLE (
    success BOOLEAN,
    booked_count INTEGER,
    max_capacity INTEGER,
    error_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_slot RECORD;
BEGIN
    SELECT * INTO v_slot
    FROM public.site_visit_capacity_slots
    WHERE workspace_id = p_workspace_id
      AND property_id = p_property_id
      AND slot_time = p_slot_time
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, 0, 'SLOT_NOT_FOUND'::TEXT;
        RETURN;
    END IF;

    UPDATE public.site_visit_capacity_slots
    SET 
        booked_count = GREATEST(0, booked_count - p_slots_to_release),
        version = version + 1,
        updated_at = NOW()
    WHERE id = v_slot.id
    RETURNING * INTO v_slot;

    RETURN QUERY SELECT 
        TRUE, 
        v_slot.booked_count, 
        v_slot.max_capacity, 
        NULL::TEXT;
    RETURN;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. Row-Level Security for site_visit_capacity_slots
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.site_visit_capacity_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_visit_capacity_isolation ON public.site_visit_capacity_slots;
CREATE POLICY site_visit_capacity_isolation ON public.site_visit_capacity_slots
    FOR ALL USING (
        public.is_active_org_member(organization_id)
        OR current_setting('request.jwt.claim.role', true) = 'service_role'
        OR auth.role() = 'service_role'
    );

-- ==============================================================================
-- DOWN MIGRATION / ROLLBACK INSTRUCTIONS
-- ==============================================================================
-- To roll back this migration in an emergency, execute the following SQL:
--
-- DROP FUNCTION IF EXISTS public.release_site_visit_slot(UUID, UUID, UUID, TIMESTAMPTZ, INTEGER);
-- DROP FUNCTION IF EXISTS public.reserve_site_visit_slot(UUID, UUID, UUID, TIMESTAMPTZ, INTEGER, INTEGER);
-- DROP POLICY IF EXISTS site_visit_capacity_isolation ON public.site_visit_capacity_slots;
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_unique_site_visit_slot
--   ON public.appointments (workspace_id, property_id, scheduled_time)
--   WHERE status NOT IN ('CANCELLED', 'RESCHEDULED') AND property_id IS NOT NULL;
-- DROP INDEX IF EXISTS public.idx_appointments_property_scheduled_slot;
-- ==============================================================================
