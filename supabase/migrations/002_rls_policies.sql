-- =========================================================================
-- VANNI — 002_rls_policies.sql (Reconciled Multi-Tenant Security)
-- PostgreSQL Row-Level Security Policies for Strict Organization Data Isolation
-- =========================================================================

-- Enable RLS across all operational tables defined in 001_initial_schema
ALTER TABLE IF EXISTS public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.call_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.business_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.business_services ENABLE ROW LEVEL SECURITY;

-- Helper function to extract organization_id from JWT or active membership
CREATE OR REPLACE FUNCTION public.current_org_id() RETURNS UUID AS $$
BEGIN
  -- Service role bypasses RLS for system operations
  IF NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
    RETURN NULL;
  END IF;
  RETURN NULLIF(current_setting('request.jwt.claim.organization_id', true), '')::UUID;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Reusable predicate: is the current user an active member of target organization?
CREATE OR REPLACE FUNCTION public.is_member_of_org(target_org_id UUID) RETURNS BOOLEAN AS $$
BEGIN
  IF NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = target_org_id
      AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 1. Organizations Policy: Members can view their own organization
DROP POLICY IF EXISTS org_isolation_organizations ON public.organizations;
CREATE POLICY org_isolation_organizations ON public.organizations
  FOR ALL
  USING (
    public.is_member_of_org(id) OR
    current_setting('request.jwt.claim.role', true) = 'service_role'
  );

-- 2. Organization Members Policy
DROP POLICY IF EXISTS org_isolation_members ON public.organization_members;
CREATE POLICY org_isolation_members ON public.organization_members
  FOR ALL
  USING (
    public.is_member_of_org(organization_id) OR
    user_id = auth.uid() OR
    current_setting('request.jwt.claim.role', true) = 'service_role'
  );

-- 3. Agents Policy
DROP POLICY IF EXISTS org_isolation_agents ON public.agents;
CREATE POLICY org_isolation_agents ON public.agents
  FOR ALL
  USING (
    public.is_member_of_org(organization_id) OR
    current_setting('request.jwt.claim.role', true) = 'service_role'
  );

-- 4. Calls Policy
DROP POLICY IF EXISTS org_isolation_calls ON public.calls;
CREATE POLICY org_isolation_calls ON public.calls
  FOR ALL
  USING (
    public.is_member_of_org(organization_id) OR
    current_setting('request.jwt.claim.role', true) = 'service_role'
  );

-- 5. Transcripts Policy
DROP POLICY IF EXISTS org_isolation_transcripts ON public.transcripts;
CREATE POLICY org_isolation_transcripts ON public.transcripts
  FOR ALL
  USING (
    public.is_member_of_org(organization_id) OR
    current_setting('request.jwt.claim.role', true) = 'service_role'
  );

-- 6. Leads Policy
DROP POLICY IF EXISTS org_isolation_leads ON public.leads;
CREATE POLICY org_isolation_leads ON public.leads
  FOR ALL
  USING (
    public.is_member_of_org(organization_id) OR
    current_setting('request.jwt.claim.role', true) = 'service_role'
  );

-- 7. Appointments Policy
DROP POLICY IF EXISTS org_isolation_appointments ON public.appointments;
CREATE POLICY org_isolation_appointments ON public.appointments
  FOR ALL
  USING (
    public.is_member_of_org(organization_id) OR
    current_setting('request.jwt.claim.role', true) = 'service_role'
  );
