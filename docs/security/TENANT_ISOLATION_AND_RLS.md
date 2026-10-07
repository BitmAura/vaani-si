# VANNI Security: Tenant Isolation & PostgreSQL RLS

## 1. Principles of Isolation
In VANNI, **tenant isolation is non-negotiable**.
- Every organization-owned table contains `organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE`.
- Frontend state is never trusted as a security boundary.
- Server-side data queries and mutations must verify active organization membership before accessing or updating records.

## 2. Row Level Security Policies
Row Level Security is enabled on:
- `public.profiles`
- `public.organizations`
- `public.organization_members`
- `public.audit_logs`
- `public.agents`
- `public.calls`
- `public.leads`
- `public.appointments`
- `public.knowledge_sources`

### 2.1 RLS Evaluation Helper
```sql
CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = org_id
          AND user_id = auth.uid()
          AND status = 'ACTIVE'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

### 2.2 Cross-Tenant Access Prevention Test Results
Automated tests verify that:
- User A in Organization A cannot read Organization B records.
- User A in Organization A cannot update Organization B agents or settings.
- User A in Organization A cannot invite members to Organization B.
- Parameter tampering (`?tenant=...` or body `organizationId`) is rejected with `403 Forbidden`.
