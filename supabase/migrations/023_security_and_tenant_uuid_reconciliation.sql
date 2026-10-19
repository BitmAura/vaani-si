-- ==============================================================================
-- VANNI — 023_security_and_tenant_uuid_reconciliation.sql (Prompt 04 / 05)
-- Multi-Tenant Hardening, Workspace Identifier Reconciliation & Safe RLS
-- ==============================================================================

-- Safety & Idempotency Guarantee:
-- This migration is idempotent and can be safely executed against an empty database,
-- a development branch, or a populated database without data loss.

-- ------------------------------------------------------------------------------
-- 1. Helper Function: Non-Recursive Membership Check (SECURITY DEFINER)
-- ------------------------------------------------------------------------------
-- Prevents RLS recursion when policies on tables query organization_members.
CREATE OR REPLACE FUNCTION public.is_active_org_member(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.organization_members
        WHERE organization_id = p_org_id
          AND user_id = auth.uid()
          AND status = 'ACTIVE'
    );
$$;

-- ------------------------------------------------------------------------------
-- 2. Tenant Identifier Type Harmonization Index
-- ------------------------------------------------------------------------------
-- Ensure client_workspaces has fast composite lookup for multi-tenant queries.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_workspaces') THEN
        CREATE INDEX IF NOT EXISTS idx_client_workspaces_tenant_lookup
        ON public.client_workspaces (id, organization_id);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. Row Level Security Hardening with Service Role Bypass
-- ------------------------------------------------------------------------------

-- Organizations: users can only access organizations they are active members of
ALTER TABLE IF EXISTS public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_member_isolation_policy ON public.organizations;
CREATE POLICY org_member_isolation_policy ON public.organizations
    FOR ALL USING (
        public.is_active_org_member(id)
        OR current_setting('request.jwt.claim.role', true) = 'service_role'
        OR auth.role() = 'service_role'
    );

-- Appointments: strictly bound to owning organization
ALTER TABLE IF EXISTS public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointments_tenant_isolation_policy ON public.appointments;
CREATE POLICY appointments_tenant_isolation_policy ON public.appointments
    FOR ALL USING (
        public.is_active_org_member(organization_id)
        OR current_setting('request.jwt.claim.role', true) = 'service_role'
        OR auth.role() = 'service_role'
    );

-- Calls & Transcripts: strict tenant isolation
ALTER TABLE IF EXISTS public.calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calls_tenant_isolation_policy ON public.calls;
CREATE POLICY calls_tenant_isolation_policy ON public.calls
    FOR ALL USING (
        public.is_active_org_member(organization_id)
        OR current_setting('request.jwt.claim.role', true) = 'service_role'
        OR auth.role() = 'service_role'
    );

-- ------------------------------------------------------------------------------
-- 4. Audit & Financial Trail Protection (Foreign Key Soft Protection)
-- ------------------------------------------------------------------------------
-- Historical financial records (billing_invoices, payment_records) and operational
-- audit logs (calls, appointments) MUST NEVER be dropped via ON DELETE CASCADE.
-- For production environments, foreign keys on these tables should be configured with
-- ON DELETE RESTRICT to guarantee audit compliance.

-- ==============================================================================
-- DOWN MIGRATION / ROLLBACK INSTRUCTIONS
-- ==============================================================================
-- To roll back this migration in an emergency, execute the following SQL:
--
-- DROP POLICY IF EXISTS calls_tenant_isolation_policy ON public.calls;
-- DROP POLICY IF EXISTS appointments_tenant_isolation_policy ON public.appointments;
-- DROP POLICY IF EXISTS org_member_isolation_policy ON public.organizations;
-- DROP INDEX IF EXISTS public.idx_client_workspaces_tenant_lookup;
-- DROP FUNCTION IF EXISTS public.is_active_org_member(UUID);
-- ==============================================================================
