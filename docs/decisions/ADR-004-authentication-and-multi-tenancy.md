# ADR-004: SaaS Identity, Multi-Tenancy & Row-Level Security (RLS)

- **Status**: Accepted
- **Date**: 2026-10-04
- **Author**: Antigravity Principal Architecture Team
- **Domain**: Identity, Access Control & Database Security

---

## 1. Context & Problem Statement
VANNI is a multi-tenant conversational AI employee platform initially deployed across Karnataka commercial verticals (Dental clinics, Hospitals, Real estate developers, Hospitality, Digital agencies).

In this domain:
1. A user does **not** directly own business records (agents, calls, recordings, leads, appointments).
2. Data belongs to an **Organization** (the customer tenant).
3. A user can belong to multiple organizations (e.g. an agency managing multiple dental clinics or a consultant with multiple practices).
4. Direct tenant parameter tampering (e.g. altering `organization_id` or `tenant_id` in request headers or query parameters) must be mathematically blocked at both the application gateway and the database engine.
5. Service role credentials must never leak into client bundles.

---

## 2. Decision

### 2.1 The Identity & Tenancy Hierarchy
We adopt the canonical Supabase / PostgreSQL three-layer tenancy architecture:

```
                  auth.users (Supabase Managed Identity)
                             │
                             ▼
                    public.profiles (1:1 with auth.users)
                             │
                             ▼
                public.organization_members (N:M Membership)
                 ├── role: OWNER | ADMIN | MANAGER | VIEWER
                 └── status: ACTIVE | INVITED | SUSPENDED
                             │
                             ▼
                  public.organizations (Tenant Boundary)
                             │
       ┌─────────────────────┼─────────────────────┐
       ▼                     ▼                     ▼
 public.agents         public.calls          public.leads
 (organization_id)    (organization_id)     (organization_id)
```

### 2.2 Role & Permission Matrix
We define four explicit hierarchical roles:
- **OWNER**: Full administrative control, billing, member removal, agent deletion, and organization lifecycle.
- **ADMIN**: Configuration of agents, campaigns, knowledge sources, integrations, and member invitations.
- **MANAGER**: Operational oversight: initiating outbound calls, updating lead dossiers, modifying appointments, and editing prompts.
- **VIEWER**: Strictly read-only access to calls, transcripts, analytics, and leads.

### 2.3 PostgreSQL Row Level Security (RLS)
Every tenant-owned table (`agents`, `calls`, `leads`, `appointments`, `knowledge_sources`, `campaigns`) enforces RLS.
- Access requires:
  $$\text{User is ACTIVE member of } \text{organization\_id}$$
- Service role bypass is permitted exclusively for internal background daemons (`request.jwt.claim.role = 'service_role'`).
- Insecure shortcuts (`auth.role() = 'authenticated'`) are strictly banned.

### 2.4 Server-Side Authorization Invariant
Authorization happens **before** data access:
- `requireUser(session)`
- `requireOrganizationMember(session, organizationId)`
- `requireOrganizationRole(session, organizationId, minimumRole)`
- `requireOrganizationAccess(session, resource)`

Organization switching validates that the requesting session possesses an active membership in the target organization before updating the session state.

---

## 3. Consequences

### Positive
- **Guaranteed Isolation**: Data leakage between competing practices (e.g. Dental Clinic A vs Dental Clinic B) is prevented at the database kernel.
- **Multi-Tenant Flexibility**: Users can manage multiple practices from a single login without account duplication.
- **Auditability**: All organization creation, member role mutations, and invitations generate immutable records in `public.audit_logs`.
- **Zero Frontend Trust**: Security does not depend on client-side state.

### Trade-offs
- Every tenant query must join against `organization_members` or filter on `organization_id`. We mitigated performance overhead by placing composite indexes on `(organization_id, user_id)` and `(organization_id, created_at DESC)`.
