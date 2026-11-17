-- ==============================================================================
-- 027: Close organization_members self-join RLS hole
-- ==============================================================================
-- 002_rls_policies.sql created org_isolation_members FOR ALL with
-- USING (is_member_of_org(organization_id) OR user_id = auth.uid() OR service_role)
-- and no separate WITH CHECK. Postgres uses USING as the check, so an
-- authenticated user can INSERT a membership for any organization_id as long
-- as user_id is themselves, then read that tenant. Later policies are OR'd
-- with this one, so they do not close it.
--
-- SELECT of the caller's own membership rows stays allowed. Inserts, updates,
-- and deletes stay on the admin/service policies from 003.

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation_members ON public.organization_members;

CREATE POLICY org_isolation_members_select ON public.organization_members
    FOR SELECT USING (
        public.is_active_org_member(organization_id)
        OR user_id = auth.uid()
        OR current_setting('request.jwt.claim.role', true) = 'service_role'
        OR auth.role() = 'service_role'
    );
