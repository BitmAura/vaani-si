-- ==============================================================================
-- 018: Healthcare Clinic Operations, Doctor Rosters & Appointment Scheduling
-- Dhwani SI / Vaani-Si Multi-Tenant Voice Platform (Prompt 05)
-- ==============================================================================

-- 1. Extend client_workspaces with clinic configuration
ALTER TABLE IF EXISTS client_workspaces
  ADD COLUMN IF NOT EXISTS clinic_config JSONB DEFAULT '{}'::jsonb;

-- 2. Extend business_staff with healthcare doctor roster and shift settings
ALTER TABLE IF EXISTS business_staff
  ADD COLUMN IF NOT EXISTS shift_start VARCHAR(5) DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS shift_end VARCHAR(5) DEFAULT '17:00',
  ADD COLUMN IF NOT EXISTS break_start VARCHAR(5) DEFAULT '13:00',
  ADD COLUMN IF NOT EXISTS break_end VARCHAR(5) DEFAULT '14:00',
  ADD COLUMN IF NOT EXISTS slot_duration_minutes INT DEFAULT 15,
  ADD COLUMN IF NOT EXISTS buffer_minutes INT DEFAULT 5,
  ADD COLUMN IF NOT EXISTS leaves JSONB DEFAULT '[]'::jsonb;

-- 3. Extend appointment_slots with provider ID, notes, cancellation and audit trail
ALTER TABLE IF EXISTS appointment_slots
  ADD COLUMN IF NOT EXISTS doctor_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS audit_history JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);

-- 4. High-performance indexes for slot availability and appointment lookup
CREATE INDEX IF NOT EXISTS idx_appointment_slots_tenant_time
  ON appointment_slots(tenant_id, scheduled_time);

CREATE INDEX IF NOT EXISTS idx_appointment_slots_tenant_doctor
  ON appointment_slots(tenant_id, doctor_id);

CREATE INDEX IF NOT EXISTS idx_appointment_slots_idempotency
  ON appointment_slots(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_staff_org_active
  ON business_staff(organization_id, is_active);

-- 5. RLS Policies: strictly scope healthcare provider and appointment reads/writes to tenant
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'appointment_slots') THEN
    ALTER TABLE appointment_slots ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS appointment_slots_tenant_isolation ON appointment_slots;
    CREATE POLICY appointment_slots_tenant_isolation ON appointment_slots
      FOR ALL
      USING (
        tenant_id = current_setting('app.current_organization_id', true)
        OR
        tenant_id IN (
          SELECT id FROM client_workspaces WHERE organization_id = current_setting('app.current_organization_id', true)
        )
      );
  END IF;
END $$;
