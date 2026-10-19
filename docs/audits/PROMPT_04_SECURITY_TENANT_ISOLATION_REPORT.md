# PROMPT 04 — SECURITY, AUTHORIZATION & TENANT ISOLATION HARDENING REPORT

**Audit Date**: October 18, 2026  
**Auditor Role**: Principal Application Security Engineer & Multi-Tenant SaaS Security Auditor  
**Target Repository**: `BitmAura/vaani-si`  
**Working Directory**: `P:\crazy-ai-stack\vaani-si`  
**Baseline Git Commit**: `08e3d46d4056a5c07892c043e95a35f5d54b14f1`  
**Branch**: `main`  

---

## 1. Executive Summary & Baseline Verification

This audit and remediation cycle focused on verifying and eliminating high-risk multi-tenant isolation breaches, authentication bypasses, webhook forgery, unauthenticated costly side-effect triggers, and cross-tenant data leakage across the Vaani-SI platform.

All changes made in Prompt 02 (Authentication & Login Loop Remediation) and Prompt 03 (Frontend Interaction & API Contract Remediation) were preserved intact. The authoritative backend service is `apps/server/src/server.ts` (Fastify), supported by the foundational database abstractions in `packages/database` and cryptographic session handlers in `packages/auth`.

### Baseline Verification Commands & Results Prior to Hardening:
- `npm run typecheck`: Clean (22/22 projects passed).
- `npm test`: 246/246 tests passing.
- `npm run test:invariants`: 18/18 invariant tests passing.

---

## 2. Route Inventory & Authorization Architecture

An exhaustive inventory of all registered HTTP routes and WebSocket entry points was conducted across the authoritative backend service (`apps/server/src/server.ts` and registered plugins in `apps/server/src/routes/*`).

| Endpoint / Route | Method | Authentication Required | Required Role / Perm | Tenant / Workspace Resolution Mechanism | Tenant Scoping Checked | Mutation / Side Effect / Cost | Regression Tests |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/auth/signup` | POST | No | Public | Server creates new Org + Member | N/A (Creates new tenant) | Saves to Identity Store & `globalDb` | `auth-session-contract.test.ts` |
| `/api/auth/login` | POST | No | Public | Verified via `IdentityService` & bcrypt | N/A (Establishes session) | Issues HMAC session cookie | `auth-session-contract.test.ts` |
| `/api/auth/session` | GET | Optional | Public/User | Reads `vaani_session` cookie | Scoped to active organization | Read-only | `auth-session-contract.test.ts` |
| `/api/organization` | GET | Yes | User | Server session `activeOrganizationId` | Verified against tenant Org ID | Read-only | `tenant-isolation.test.ts` |
| `/api/workspaces` | GET / POST | Yes | User / Admin | Server session `activeOrganizationId` | Verified against tenant Org ID | Creates/reads client workspace | `multitenant-onboarding.test.ts` |
| `/api/workspaces/:id` | GET / PUT / DEL | Yes | Admin/Owner | Scoped by `orgId` in DB query | Yes (Database query filter) | Workspace mutation | `multitenant-onboarding.test.ts` |
| `/api/telephony/outbound` | POST | Yes | Manager/Admin (Blocked for Viewer) | Verified session `activeOrganizationId` | Yes (Requires membership) | **COST / EXTERNAL CALL** | `security-tenant-isolation-hardening.test.ts` |
| `/api/calls/outbound-inception` | POST | Yes | Manager/Admin (Blocked for Viewer) | Verified session `activeOrganizationId` | Yes (Requires membership) | **COST / EXTERNAL CALL** | `security-tenant-isolation-hardening.test.ts` |
| `/api/tts/synthesize` | POST | Yes (Length capped) | User | Verified session | Scoped to caller tenant | CPU / Audio synthesis | `security-tenant-isolation-hardening.test.ts` |
| `/api/doctors` | GET / POST / PUT | Yes | Member (Admin for write) | Verified workspace membership | Yes (DB & memory filter) | Clinic roster mutations | `healthcare-operations.test.ts` |
| `/api/doctors/:id` | GET / PUT / DEL | Yes | Member (Admin for write) | Verified workspace membership | Yes (DB query filter) | Doctor record mutations | `healthcare-operations.test.ts` |
| `/api/appointments` | GET / POST / PUT | Yes | Member | Verified workspace membership | Yes (Tenant ID filter in DB) | Appointment slot updates | `healthcare-operations.test.ts` |
| `/api/real-estate/properties` | GET / POST / PUT | Yes | Member (Admin for write) | Verified workspace membership | Yes (DB query filter) | Property catalog mutations | `real-estate-operations.test.ts` |
| `/api/real-estate/leads` | GET / POST | Yes | Member | Verified workspace membership | Yes (DB query filter) | Lead capture / mutations | `real-estate-operations.test.ts` |
| `/api/campaigns` | GET / POST | Yes | Admin/Manager | Server session `activeOrganizationId` | Yes (DB query filter) | Campaign queue generation | `frontend-interaction-contracts.test.ts` |
| `/api/billing` | GET | Yes | Member | Server session `activeOrganizationId` | Yes (DB query filter) | Read-only | `billing-metering-entitlements.test.ts` |
| `/api/billing/checkout` | POST | Yes | Owner/Admin | Server session `activeOrganizationId` | Yes (DB query filter) | **PAYMENT / CHARGES** | `billing-metering-entitlements.test.ts` |
| `/api/billing/webhooks/razorpay` | POST | Signature (HMAC) | Razorpay Webhook | Validated `x-razorpay-signature` | Notes `organization_id` | Ingests payment/invoice events | `security-tenant-isolation-hardening.test.ts` |
| `/api/webhooks/telephony/exotel-cdr` | POST | Signature (HMAC) | Exotel Webhook | Validated `x-exotel-signature` | Derived from call SID | Updates call records | `security-tenant-isolation-hardening.test.ts` |
| `/api/webhooks/meta-lead` | POST | Signature (HMAC) | Meta Ads Webhook | Validated `x-hub-signature-256` | Verified tenant query parameter | **Triggers speed-to-lead call** | `security-tenant-isolation-hardening.test.ts` |
| `/ws/audio-stream` | WebSocket | Yes (In prod/scoped) | Caller / Token | Server-verified `tenantKey` & Org | Yes (Rejects cross-tenant) | **Real-time audio streaming** | `security-tenant-isolation-hardening.test.ts` |

---

## 3. Confirmed Vulnerabilities, Root Cause & Remediations

### Finding 1: WebSocket Silent Fallback to Demo Tenant (`CRITICAL`)
- **File Reference**: `apps/server/src/server.ts:3576-3625`
- **Root Cause**: The WebSocket upgrade handler had `const tenantKey = url.searchParams.get('tenant') || 'real_estate';`. When a client passed an invalid or foreign workspace string (e.g. `?workspaceId=unknown_ws`), the server failed to lookup the workspace, and fell back to `DEMO_TENANTS.real_estate` (Ballari Residential Layouts). This allowed unauthorized callers to attach to Ballari's real estate AI model and voice pipeline.
- **Remediation**:
  - Bound tenant lookup to `rawTenant = url.searchParams.get('tenant') || url.searchParams.get('workspaceId')`.
  - Removed silent fallback to `DEMO_TENANTS.real_estate`.
  - Added cross-tenant membership validation: if the resolved workspace belongs to an organization not present in the caller's verified session memberships, the socket is immediately closed with WebSocket code `1008` (`Unauthorized: Cross-tenant access forbidden`).
  - Added hard fail-closed enforcement: if `!resolvedTenant`, the socket closes with code `1008` (`Unauthorized: Unknown or unauthorized tenant workspace`).
  - Added WebSocket frame limit (max 256 KB) and per-connection message rate limit (max 200 frames/sec) to defend against audio flood denial of service.

### Finding 2: Unauthenticated Outbound Telephony & Inception Calling (`HIGH`)
- **File Reference**: `apps/server/src/server.ts:2344-2368, 2713-2721`
- **Root Cause**:
  1. `POST /api/calls/outbound-inception` had zero session check outside production, allowing unauthenticated dialer dispatches.
  2. `POST /api/telephony/outbound` allowed client-supplied `organizationId` without verifying that the caller was a member of that organization. Furthermore, `VIEWER` role users were able to trigger expensive outbound cellular calls.
- **Remediation**:
  - Unconditionally required verified authentication on `POST /api/calls/outbound-inception`, rejecting unauthenticated callers with HTTP 401.
  - Enforced RBAC check on outbound dialing: `VIEWER` role is explicitly forbidden from initiating outbound calls (HTTP 403 Forbidden).
  - Derived `organizationId` from the verified session (`session.activeOrganizationId`). If a specific organization ID is supplied in the request body, the server verifies that the authenticated user has an active membership in that organization before dispatching; otherwise rejects with HTTP 403.

### Finding 3: Unfiltered Database Query on `getAppointmentById` (`HIGH`)
- **File Reference**: `packages/database/src/index.ts:3715-3725`
- **Root Cause**: In `SupabaseDatabaseService.getAppointmentById(id: string, organizationId?: string)`, the signature accepted an optional `organizationId`, but the Supabase query did not filter by `organization_id` or `workspace_id`, returning appointment details regardless of whether the caller belonged to the owning clinic.
- **Remediation**:
  - Added explicit database-level filtering: `q.or(`organization_id.eq.${organizationId},workspace_id.eq.${organizationId}`)`.
  - Enforced post-query boundary check verifying `data.organization_id === organizationId || data.workspace_id === organizationId`, returning `null` on cross-tenant mismatch to prevent information disclosure.
  - Verified that `InMemoryDatabaseService.getAppointmentById` applies identical `tenantId === organizationId` scoping.

### Finding 4: Webhook Secret Omission Fail-Open in Production (`HIGH`)
- **File Reference**: `apps/server/src/routes/webhooks.ts:18-35`, `apps/server/src/routes/billing.ts:272-282`
- **Root Cause**:
  1. In `apps/server/src/routes/webhooks.ts`, if `EXOTEL_WEBHOOK_SECRET` or `EXOTEL_API_TOKEN` was missing from the environment, the endpoint bypassed signature verification or used fallback testing tokens.
  2. In `apps/server/src/routes/billing.ts`, missing `RAZORPAY_WEBHOOK_SECRET` fell back to an in-memory dev secret.
- **Remediation**:
  - Added strict production fail-closed guard: if `process.env.NODE_ENV === 'production'` and `EXOTEL_WEBHOOK_SECRET` is unset, `POST /api/webhooks/telephony/exotel-cdr` returns HTTP 503 (`SERVICE_UNAVAILABLE`).
  - If `process.env.NODE_ENV === 'production'` and `RAZORPAY_WEBHOOK_SECRET` is unset, `POST /api/billing/webhooks/razorpay` returns HTTP 503 (`SERVICE_UNAVAILABLE`).
  - Missing signature headers now reject with HTTP 401/400 instead of allowing execution.

### Finding 5: Context Resolvers Falling Back on Foreign Workspace Probes (`MEDIUM`)
- **File Reference**: `apps/server/src/routes/doctors.ts:40-70`, `apps/server/src/routes/real-estate.ts:35-65`
- **Root Cause**: When a client passed a foreign `x-workspace-id` or `workspaceId` query parameter that did not belong to the user's active organization, `resolveHealthcareContext` and `resolveRealEstateContext` previously fell back to the root organization ID or the first workspace in the list.
- **Remediation**:
  - Hardened both context resolvers to fail closed: if an explicit workspace ID is requested and does not exist or does not belong to an organization for which the session user is a member, the resolver immediately returns HTTP 404 (`NOT_FOUND: Workspace not found`).
  - Prevents cross-tenant information leakage and ensures competitors cannot probe or inspect other tenants' doctors, property listings, or client workspaces.

### Finding 6: In-Memory Identity Store Divergence from Authoritative Database (`MEDIUM`)
- **File Reference**: `apps/server/src/server.ts:805-825`
- **Root Cause**: During user signup (`POST /api/auth/signup`), `identityService.signup` stored the new organization and owner in internal maps, but failed to persist the new organization and owner membership to the authoritative `globalDb`. As a result, subsequent calls to `GET /api/organization` could not find the organization in `globalDb` and fell back to the hardcoded Ballari demo organization data.
- **Remediation**:
  - Synchronized created organizations and owner memberships to `globalDb.saveOrganization(organization)` and `globalDb.saveMember(...)` immediately upon signup.
  - Hardened `GET /api/organization` to return HTTP 404 if the authenticated organization cannot be found in `globalDb`, rather than silently falling back to Ballari demo organization data.

### Finding 7: Unrestricted TTS Input Length & Unauthenticated Synthesis (`MEDIUM`)
- **File Reference**: `apps/server/src/server.ts:2750-2770`
- **Root Cause**: `POST /api/tts/synthesize` accepted unbounded text payloads and had no input size constraints, exposing the backend to compute resource exhaustion and upstream audio API billing runaway.
- **Remediation**:
  - Implemented 5,000-character payload length ceiling; payloads exceeding 5,000 characters are rejected with HTTP 400 (`Text exceeds maximum length of 5000 characters`).
  - Added authentication check requiring valid user session in production.

### Finding 8: Meta Ads Lead Webhook Replay & Duplicate Call Dispatch (`MEDIUM`)
- **File Reference**: `apps/server/src/server.ts:680-695`
- **Root Cause**: Duplicate or replayed Meta lead webhooks with identical `leadgen_id` would trigger duplicate automated 5-second outbound calls to the prospective lead.
- **Remediation**:
  - Added bounded in-memory idempotency cache (`processedMetaEvents`, max 10,000 entries) tracking `leadgen_id` / `lead_id`.
  - Replayed webhooks matching an already-processed `leadgen_id` return HTTP 200 with `{ success: true, status: 'IGNORED_DUPLICATE' }` without dispatching duplicate phone calls.

### Finding 9: Production Seeding of Demo Campaigns (`LOW`)
- **File Reference**: `apps/server/src/routes/campaigns.ts:24-32`
- **Root Cause**: When a tenant had no campaigns, the campaign route automatically seeded 3 mock dental/hospital/real-estate demo campaigns, which could contaminate real production workspaces.
- **Remediation**:
  - Added `process.env.NODE_ENV !== 'production'` guard around demo campaign fixture seeding. In production environments, empty tenants remain clean.

---

## 4. Reviewed Schema Migration (`023_security_and_tenant_uuid_reconciliation.sql`)

In accordance with Phase 6 constraints, no live database migrations were applied. A reviewed migration file was prepared and committed to:
`supabase/migrations/023_security_and_tenant_uuid_reconciliation.sql`

### Key Invariants in Migration 023:
1. **Deterministic String & UUID Tenant Harmonization**: Provides `to_uuid_safe(val text)` deterministic UUID generator for string-based tenant IDs (e.g. `clinic-a-0000...`).
2. **Strict Foreign Key Constraints**: Adds foreign key constraints between client workspaces, appointments, doctors, and real-estate tables and their parent organizations with `ON DELETE CASCADE`.
3. **Comprehensive Row Level Security (RLS)**: Enforces `ENABLE ROW LEVEL SECURITY` across:
   - `organizations`
   - `organization_members`
   - `client_workspaces`
   - `appointments`
   - `doctors`
   - `properties`
   - `campaigns`
   - `call_records`
4. **Tenant Isolation Policies**: Configures RLS policies granting access strictly when `auth.uid()` matches an active member of `organization_members` for the record's `organization_id`.

---

## 5. Security Regression Test Suite

A dedicated security regression test suite was created at:
`apps/server/src/__tests__/security-tenant-isolation-hardening.test.ts`

### Test Results Summary (12/12 Passed):
1. **Unauthenticated Outbound Telephony Protection**:
   - `POST /api/telephony/outbound` unauthenticated $ightarrow$ **HTTP 401 UNAUTHORIZED** (Passed).
   - `POST /api/calls/outbound-inception` unauthenticated $ightarrow$ **HTTP 401 UNAUTHORIZED** (Passed).
   - `POST /api/telephony/outbound` with `VIEWER` role session $ightarrow$ **HTTP 403 FORBIDDEN** (Passed).
   - `POST /api/tts/synthesize` with > 5000 character payload $ightarrow$ **HTTP 400 VALIDATION ERROR** (Passed).
2. **Workspace & Cross-Tenant Boundary Enforcement**:
   - `GET /api/doctors` with foreign `x-workspace-id` $ightarrow$ **HTTP 404 NOT_FOUND** (Passed, no cross-tenant doctor leakage).
   - `GET /api/real-estate/properties` with foreign `x-workspace-id` $ightarrow$ **HTTP 404 NOT_FOUND** (Passed, no property catalog leakage).
3. **WebSocket Audio Stream Tenant Isolation**:
   - Connection with unknown or unauthorized `workspaceId` $ightarrow$ **Closed with code 1008 Policy Violation** (Passed, no fallback to demo tenant).
4. **Webhook Security & Production Fail-Closed Secrets**:
   - Exotel CDR webhook in `production` mode without secret $ightarrow$ **HTTP 503 SERVICE_UNAVAILABLE** (Passed).
   - Razorpay webhook in `production` mode without secret $ightarrow$ **HTTP 503 SERVICE_UNAVAILABLE** (Passed).
   - Razorpay webhook with invalid signature header $ightarrow$ **HTTP 401 INVALID_SIGNATURE** (Passed).
   - Meta Ads lead webhook with duplicate `leadgen_id` $ightarrow$ **HTTP 200 IGNORED_DUPLICATE** (Passed, zero duplicate calls).
5. **Database Scoping & Isolation Invariants**:
   - `InMemoryDatabaseService` and `SupabaseDatabaseService` `getAppointmentById` queries scoped strictly by `organizationId` $ightarrow$ Matching tenant returns record, foreign tenant returns `null` (Passed).

---

## 6. Full Verification Commands & Metrics

| Verification Step | Command | Result | Pass / Fail Count |
| :--- | :--- | :--- | :--- |
| **Security Regression Tests** | `npx vitest run apps/server/src/__tests__/security-tenant-isolation-hardening.test.ts` | Passed | **12 / 12 passed (100%)** |
| **All Test Suites** | `npm test` | Passed | **258 / 258 passed (18 test files)** |
| **System Invariant Tests** | `npm run test:invariants` | Passed | **18 / 18 passed (100%)** |
| **Typecheck** | `npm run typecheck` | Passed | **22 / 22 projects clean** |

---

## 7. Modified & Created Files Summary

### Modified Files:
- `packages/database/src/index.ts`: Added `organizationId` / `workspaceId` filtering in `SupabaseDatabaseService.getAppointmentById`.
- `apps/server/src/server.ts`:
  - Enforced authentication and `VIEWER` role blocking on `POST /api/telephony/outbound` and `POST /api/calls/outbound-inception`.
  - Added 5,000-character payload ceiling to `POST /api/tts/synthesize`.
  - Replaced WebSocket demo fallback with fail-closed code 1008 rejection, 256KB payload limit, and 200 frame/s rate limit.
  - Added Meta Ads webhook idempotency tracking.
  - Synchronized user signup to `globalDb.saveOrganization` and `globalDb.saveMember`.
- `apps/server/src/routes/webhooks.ts`: Added production fail-closed 503 check when `EXOTEL_WEBHOOK_SECRET` is missing.
- `apps/server/src/routes/billing.ts`: Added production fail-closed 503 check when `RAZORPAY_WEBHOOK_SECRET` is missing; strictly validated signatures.
- `apps/server/src/routes/doctors.ts`: Hardened `resolveHealthcareContext` to return 404 on foreign/unknown workspace access.
- `apps/server/src/routes/real-estate.ts`: Hardened `resolveRealEstateContext` to return 404 on foreign/unknown workspace access.
- `apps/server/src/routes/campaigns.ts`: Added non-production guard to demo campaign seeding.

### Created Files:
- `apps/server/src/__tests__/security-tenant-isolation-hardening.test.ts`: 12 automated security and tenant-isolation regression tests.
- `supabase/migrations/023_security_and_tenant_uuid_reconciliation.sql`: Reviewed PostgreSQL RLS migration.
- `docs/audits/PROMPT_04_SECURITY_TENANT_ISOLATION_REPORT.md`: This formal audit and remediation report.

---

## 8. Remaining Risks & Operational Recommendations

1. **Production Webhook Secrets Deployment**:
   - Ensure `EXOTEL_WEBHOOK_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, and `META_APP_SECRET` are configured in production Kubernetes / cloud secrets before deployment. In production, missing secrets will intentionally fail closed with HTTP 503 to prevent forgery.
2. **Database Migration Execution**:
   - When deploying to production PostgreSQL/Supabase, apply `supabase/migrations/023_security_and_tenant_uuid_reconciliation.sql` in a maintenance window with appropriate backup procedures.
3. **Session Cookie Security**:
   - In production HTTPS environments, ensure the `secure: true` cookie flag remains active (already configured in `DEFAULT_COOKIE_OPTIONS`).
4. **Duplicate Application Notice**:
   - `apps/api` exists alongside `apps/server`. The active and authoritative backend is `apps/server`. Do not deploy `apps/api` to avoid divergent authorization logic until a planned consolidation in a future prompt.

---
**Auditor Sign-off**: All confirmed security defects from Prompt 04 have been remediated, verified via automated regression testing, and validated against the entire monorepo test suite and typechecker.
