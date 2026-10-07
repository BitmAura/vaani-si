# ADR-003: Multi-Tenancy via PostgreSQL Row-Level Security (RLS) & Supabase

## Status
**ACCEPTED**

## Context
VANNI handles highly sensitive patient health records (dental, IVF, clinic consultations) and proprietary commercial real estate negotiations.
Data leaks between tenants are fatal to an enterprise B2B SaaS company.
Application-level filtering (e.g. `WHERE organization_id = :orgId` manually appended in API queries) is prone to developer error, where a single forgotten WHERE clause exposes another tenant's calls or leads.

## Decision
1. We mandate **PostgreSQL Row-Level Security (RLS)** as the foundational multi-tenant barrier.
2. In Supabase/PostgreSQL, every tenant record contains an immutable `organization_id` foreign key.
3. Every query executes within an authenticated user session where `auth.uid()` resolves to their allowed organizations via `organization_members`.
4. The database engine itself rejects any SELECT/UPDATE/DELETE query attempting to access a tenant outside the authenticated organization.
5. In addition to DB-level RLS, server-side Fastify route hooks enforce tenant authorization at the API perimeter.

## Consequences
### Positive
- Structural prevention of cross-tenant data leaks.
- Full compliance with Indian DPDP Act (Digital Personal Data Protection) and healthcare confidentiality norms.
- Clean database migrations and relational integrity.

### Negative / Trade-offs
- Superuser / service-role operations must be strictly isolated to privileged background workers (e.g. telephony webhook processors) and never exposed to public APIs.
