# PROMPT 06 — VAANI-SI REAL ESTATE WORKFLOW & PERSISTENCE REMEDIATION REPORT

**Author**: Senior SaaS Backend Engineer, PostgreSQL Transaction Specialist, Real-Estate Workflow Reliability Engineer  
**Date**: October 18, 2026  
**Repository**: `BitmAura/vaani-si`  
**Working Directory**: `P:\crazy-ai-stack\vaani-si`  
**Target Architecture**: Multi-Tenant Real Estate SaaS OS (Plots, Villas, Apartments, Gated Communities, Karnataka RERA, Bilingual Kannada/English Voice AI)

---

## 1. Baseline Commit & Working-Tree State

- **Active Branch**: `main`
- **Baseline HEAD Commit**: `08e3d46d4056a5c07892c043e95a35f5d54b14f1`
- **Working-Tree Status**: Preserved all prior authentication, frontend (Prompt 03), security (Prompt 04), and database persistence (Prompt 05) remediations.
- **Baseline Verification**:
  - `apps/server/src/__tests__/production-hardening.test.ts` — 12/12 passing
  - `apps/server/src/__tests__/tenant-isolation.test.ts` — 12/12 passing
  - `apps/server/src/__tests__/database-persistence-hardening.test.ts` — 12/12 passing
  - `apps/server/src/__tests__/security-tenant-isolation-hardening.test.ts` — 12/12 passing

---

## 2. Real-Estate Route and Data-Flow Inventory

### Registered Route Handlers
All real estate routes are declared in `apps/server/src/routes/real-estate.ts` and registered in Fastify via `apps/server/src/server.ts` under the `realEstateRoutes` plugin. Legacy plot routes remain mounted under `plotRoutes` for backwards compatibility.

| HTTP Method | Route Endpoint | Purpose & Business Logic | Auth & Tenant Scoping |
|---|---|---|---|
| `GET` | `/api/real-estate/config` | Retrieve layout hours, site visit capacity, buffers, and transport policy | `resolveRealEstateContext` (Session + Org + Workspace) |
| `PUT` | `/api/real-estate/config` | Configure layout timings, slot capacity, webhook secrets | Authenticated OWNER/ADMIN only (VIEWER 403) |
| `GET` | `/api/real-estate/properties` | List layout inventory (filtering by type, locality, price range, status) | Tenant scoped to `ctx.organizationId` & `ctx.workspaceId` |
| `POST` | `/api/real-estate/properties` | Add new plot/villa/apartment with dimensional & RERA validation | Authenticated OWNER/ADMIN only (VIEWER 403) |
| `GET` | `/api/real-estate/properties/:id` | Retrieve single property details by ID or reference code | Tenant scoped; cross-tenant access returns 404/403 |
| `PUT` | `/api/real-estate/properties/:id` | Update property pricing, status, amenities | Validates status & price; blocks cross-tenant tampering |
| `DELETE` | `/api/real-estate/properties/:id` | Delete/archive property | Blocks deletion if active site visits exist (409 Conflict) |
| `GET` | `/api/real-estate/site-visits/availability` | Calculate available time slots based on capacity, buffers & booked visits | Scoped to property and workspace |
| `POST` | `/api/real-estate/site-visits` | Book site visit with visitor count & idempotency key | Atomic reservation via `reserveSiteVisitSlot` |
| `GET` | `/api/real-estate/site-visits` | List upcoming & historical site visits | Scoped to `ctx.organizationId` |
| `POST` | `/api/real-estate/site-visits/:id/reschedule` | Reschedule visit time and recheck capacity | Releases old slot, atomically reserves new slot |
| `POST` | `/api/real-estate/site-visits/:id/cancel` | Cancel site visit and record audit reason | Releases capacity slot count back to available inventory |
| `GET` | `/api/real-estate/leads` | List sales enquiries & qualified leads | Strictly scoped to workspace & organization |
| `POST` | `/api/real-estate/leads/qualify` | Record buyer qualification (budget, timeline, purpose) | E.164 phone validation; scoped to workspace |
| `POST` | `/api/real-estate/webhooks/enquiry` | Ingest web/portal lead ads with deduplication | Idempotent ingestion; prevents duplicate leads |
| `POST` | `/api/real-estate/agent/inquire` | Kannada-first voice assistant property answering | Answers only verified listed properties |

---

## 3. Confirmed Defects and Root Causes

| Defect ID | Severity | Location | Root Cause | Remediation Applied |
|---|---|---|---|---|
| **DEF-RE-01** | **CRITICAL** | `apps/server/src/routes/real-estate.ts` (line 733) | **Check-Then-Act Concurrency Race Condition**: Booking endpoint queried existing appointments in application memory/DB, checked capacity, and subsequently inserted an appointment. Two concurrent requests arriving at the same millisecond for the last available slot would both observe capacity > 0 and both reserve the slot, causing double-booking. | Implemented atomic database reservation via `reserveSiteVisitSlot` with row-level locking (`SELECT ... FOR UPDATE` in PostgreSQL / atomic mutex in memory). Exactly one request succeeds with `201 Created` and the other receives `409 Conflict`. |
| **DEF-RE-02** | **CRITICAL** | `packages/database/src/index.ts` (`SupabaseDatabaseService`) | **Missing Supabase Persistence Methods**: `reserveSiteVisitSlot`, `releaseSiteVisitSlot`, and `getSiteVisitCapacitySlot` were missing from `IDatabaseService` and `SupabaseDatabaseService`, making capacity enforcement non-authoritative when Supabase is selected. | Implemented typed methods across `IDatabaseService`, `InMemoryDatabaseService`, and `SupabaseDatabaseService` utilizing table `site_visit_capacity_slots` and PostgreSQL RPC procedures. |
| **DEF-RE-03** | **HIGH** | `packages/database/src/index.ts` (`getProperties`) | **Cross-Tenant Property Leakage**: `getProperties` in `SupabaseDatabaseService` queried `.eq('workspace_id', workspaceId)` without filtering by `organization_id`. If an attacker guessed another organization's workspace ID, foreign properties were returned. | Added strict `organization_id` filtering on all property queries in `SupabaseDatabaseService` and `InMemoryDatabaseService`. |
| **DEF-RE-04** | **HIGH** | `apps/server/src/routes/real-estate.ts` (`PUT /properties/:id`) | **Missing Property Mutation Validation**: PUT accepted unvalidated property status (e.g. arbitrary strings), negative base price, and allowed changing immutable `organizationId` or `workspaceId` in the payload. | Enforced `VALID_AVAILABILITY_STATUSES`, positive price checks, and stripped immutable tenant keys (`organizationId`, `workspaceId`) from update payloads. |
| **DEF-RE-05** | **MEDIUM** | `apps/server/src/routes/real-estate.ts` (`DELETE /properties/:id`) | **Dangling Site Visits on Deleted Property**: Properties with active scheduled site visits could be deleted without warning, leaving buyers and sales coordinators with dangling orphaned appointments. | Added pre-deletion validation checking for active upcoming site visits; returns `409 Conflict` requiring cancellation/rescheduling first. |
| **DEF-RE-06** | **MEDIUM** | `apps/server/src/routes/real-estate.ts` (`POST /leads/qualify`) | **Malformed Phone Numbers Accepted**: Lead qualification accepted arbitrary text strings for `contactPhone`, breaking downstream SMS/WhatsApp and telephony dialers. | Added `isValidPhone` checking requiring valid 10-15 digit E.164 / Indian mobile format. |
| **DEF-RE-07** | **HIGH** | `apps/web/console.html` & copies | **Karnataka Local Time Interpreted as UTC**: Booking frontend appended `:00Z` to local appointment strings (`${date}T${time}:00Z`), causing Karnataka morning slots (10:00 AM IST) to be stored as 10:00 AM UTC (3:30 PM IST). | Changed to explicit offset `${date}T${time}:00+05:30` and added `timeZone: 'Asia/Kolkata'` to all display formatters. |
| **DEF-RE-08** | **HIGH** | `supabase/migrations/019` & `020` | **Unique Constraint Contradiction**: Migration 019 created a unique index `idx_appointments_unique_site_visit_slot` enforcing 1 appointment per slot for a property. This prevented multi-visitor capacity tracking (e.g. max 4 or 5 visitors per slot) configured via Migration 020's `site_visit_capacity_slots`. | Created migration 024 dropping the restrictive 1-per-slot unique index and delegating capacity threshold enforcement to `site_visit_capacity_slots`. |

---

## 4. Files Changed and Migration Files Created

### Source Code Modifications
1. `packages/shared/src/index.ts`:
   - Added DTO interfaces: `SiteVisitCapacitySlotDTO`, `ReserveSiteVisitSlotInput`, `SiteVisitReservationResult`, `ReleaseSiteVisitSlotInput`.
2. `packages/database/src/index.ts`:
   - Added `reserveSiteVisitSlot`, `releaseSiteVisitSlot`, and `getSiteVisitCapacitySlot` to `IDatabaseService`.
   - Implemented in-memory atomic capacity slot locking and tracking in `InMemoryDatabaseService`.
   - Implemented Supabase RPC and query delegations in `SupabaseDatabaseService`.
   - Updated `getProperties`, `getPropertyById`, `updateProperty`, and `deleteProperty` with strict composite tenant scoping (`workspaceId` + `organizationId`).
3. `apps/server/src/routes/real-estate.ts`:
   - Replaced check-then-act booking with atomic `reserveSiteVisitSlot`.
   - Added `releaseSiteVisitSlot` on cancellation and rescheduling.
   - Enforced status, propertyType, price, and phone number validation.
   - Guarded property deletion against active scheduled visits.
   - Enforced past-date checks and explicit `Asia/Kolkata` timezone representations.
4. `apps/web/console.html` and copies (`console/index.html`, `app-dashboard.html`, `app/dashboard.html`, `app/dashboard/index.html`):
   - Fixed timestamp generation from `:00Z` to `:00+05:30`.
   - Added explicit `timeZone: 'Asia/Kolkata'` formatting to date rendering.

### Migration Created
- **File**: `supabase/migrations/024_real_estate_site_visit_concurrency.sql`
- **Contents**:
  - Drops restrictive unique index `idx_appointments_unique_site_visit_slot` from Migration 019.
  - Replaces with composite query index `idx_appointments_property_scheduled_slot`.
  - Stored procedure `public.reserve_site_visit_slot(p_organization_id, p_workspace_id, p_property_id, p_slot_time, p_requested_slots, p_default_capacity)` with `SELECT ... FOR UPDATE` row locking and atomic capacity counter increment.
  - Stored procedure `public.release_site_visit_slot(p_organization_id, p_workspace_id, p_property_id, p_slot_time, p_slots_to_release)` with safe decrement.
  - Non-recursive RLS policy `site_visit_capacity_isolation` utilizing `public.is_active_org_member(organization_id)` and service-role bypass.
  - Emergency rollback instructions.

---

## 5. Property, Lead, and Booking Persistence Verification

| Entity | Storage Schema / Table | Persistence Adapter | Verification Status |
|---|---|---|---|
| **Real Estate Config** | `client_workspaces.real_estate_config` (JSONB) | `saveClientWorkspace` / `updateClientWorkspace` | Verified in tests (days, hours, max capacity, transport) |
| **Property Inventory** | `public.properties` (UUID PK, organization_id, workspace_id) | `saveProperty`, `updateProperty`, `deleteProperty` | Verified with dimension, pricing, and RERA attributes |
| **Site Visit Capacity** | `public.site_visit_capacity_slots` | `reserveSiteVisitSlot`, `releaseSiteVisitSlot` | Verified with atomic row locking and capacity checks |
| **Appointments / Visits** | `public.appointments` (appointment_type = 'SITE_VISIT') | `saveAppointment`, `updateAppointment` | Verified with visitor count, transport, and audit history |
| **Real Estate Leads** | `public.leads` (with vertical attributes) | `saveLead`, `getLeads` | Verified with workspace scoping and phone validation |

---

## 6. Tenant-Isolation Verification

- **Cross-Organization Property Query**: `GET /api/real-estate/properties/:id` was tested with an authenticated session from Organization B attempting to query Organization A's property. Request returned **404 Not Found** (denying knowledge of foreign tenant resources).
- **Cross-Workspace Listing**: Listing properties with `?workspaceId=...` belonging to another organization returned **404 Not Found**.
- **Cross-Workspace Property Creation**: Attempting to create a property in another organization's workspace returned **404 Not Found**.
- **Role Isolation**: User with role `VIEWER` attempting to create a property or book a site visit was rejected with **403 Forbidden**.
- **Lead Scoping**: Organization B querying `/api/real-estate/leads` cannot view leads created under Organization A's workspace.

---

## 7. Concurrency Tests and Testing Environment Reality

### Concurrency Test Scenarios Executed
In `apps/server/src/__tests__/real-estate-workflow-concurrency.test.ts`:
1. Workspace configured with `maxVisitorsPerSlot = 2`.
2. First booking successfully reserved 1 visitor spot (leaving exactly 1 spot remaining).
3. **Simultaneous Race**: Two concurrent HTTP requests (`reqA` and `reqB`) were dispatched concurrently via `Promise.all`, each requesting 1 spot for the final available capacity.
4. **Result**: Exactly one request succeeded with `201 Created` and the competing request was rejected with `409 Conflict` (`"Slot capacity exceeded"`).
5. **Capacity Consistency**: Subsequent attempt rejected with 409. Once the visit was cancelled, the slot was released and the blocked visitor succeeded with `201 Created`.

### PostgreSQL Environment Reality
> [!IMPORTANT]
> The automated concurrency tests executed against the Fastify server using the atomic locking implementation in `InMemoryDatabaseService` and verified unit delegations in `SupabaseDatabaseService`. 
> 
> **No live connection was made to production Supabase PostgreSQL**, per prompt constraints. While Migration 024's SQL procedure `reserve_site_visit_slot` employs standard PostgreSQL `SELECT ... FOR UPDATE` row locking, **we do NOT claim PostgreSQL concurrency safety in production until Migration 024 is applied and exercised against a live PostgreSQL staging database.**

---

## 8. Timezone Handling and Scheduling Strategy

- **Authoritative Timezone**: Real estate operations in this vertical operate in **India Standard Time (IST)**, standardized as `Asia/Kolkata` (UTC+05:30).
- **Timestamp Standard**: Timestamps sent to and from the API must include explicit timezone offsets (e.g. `2026-11-20T10:00:00+05:30`) or be stored as standard UTC `TIMESTAMPTZ` in PostgreSQL.
- **Frontend Display**: Formatter uses `toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })` to guarantee that agents in any browser timezone see the correct Karnataka appointment time.
- **Past Date Rejection**: Appointments scheduled in the past (< current timestamp) are rejected with `400 Bad Request`.

---

## 9. Exact Test Commands, Results, and Failures

### 1. Real Estate Operations Test Suite
```bash
npx vitest run apps/server/src/__tests__/real-estate-operations.test.ts
```
**Result**: 15 passed (15 total) — 438ms.

### 2. Real Estate Workflow Concurrency Test Suite
```bash
npx vitest run apps/server/src/__tests__/real-estate-workflow-concurrency.test.ts
```
**Result**: 15 passed (15 total) — 328ms.

### 3. Baseline & Security Test Suites (Prompts 02–05)
```bash
npx vitest run apps/server/src/__tests__/production-hardening.test.ts apps/server/src/__tests__/tenant-isolation.test.ts apps/server/src/__tests__/database-persistence-hardening.test.ts apps/server/src/__tests__/security-tenant-isolation-hardening.test.ts
```
**Result**: 4 test files passed, 48 passed (48 total) — 3.96s.

### 4. Full Repository Test Suite
```bash
npm test
```
**Result**: **20 passed (20 test files), 285 passed (285 total)** — 44.66s.

### 5. Invariant Tests
```bash
npm run test:invariants
```
**Result**: 1 passed (1 file), 18 passed (18 total) — 1.39s.

### 6. Repository-Wide TypeScript Typecheck
```bash
npm run typecheck
```
**Result**: **All 22 projects typecheck clean (0 errors)**.

---

## 10. Migrations Remaining Unapplied

In strict accordance with the prompt safety constraints, no migrations were executed against live Supabase:

1. `supabase/migrations/023_security_and_tenant_uuid_reconciliation.sql` (from Prompt 05)
2. `supabase/migrations/024_real_estate_site_visit_concurrency.sql` (created in Prompt 06)

Both migration scripts are idempotent, contain automated drop/create logic with existence checks, and include documented emergency rollback blocks.

---

## 11. Outstanding Risks and Required Manual Verification

1. **Staging Database Migration Execution**: Migration `024_real_estate_site_visit_concurrency.sql` must be executed on an isolated staging Supabase instance to verify that `reserve_site_visit_slot` stored procedure executes with zero syntax or permission errors under PostgreSQL 15+.
2. **PostgreSQL Concurrent Load Testing**: Run `pgbench` or a multi-threaded artillery script simulating 50 concurrent requests against `reserve_site_visit_slot` on the staging PostgreSQL instance to verify row locking performance under high contention.
3. **Karnataka Dialect Inquiries**: Test North Karnataka commercial phrasing ("ಯಾವಾಗ ಸೈಟ್ ನೋಡ್ಬೋದು?", "30x40 ನಿವೇಶನದ ಬೆಲೆ ಎಷ್ಟು?") with the live Sarvam voice model in a test call sandbox.
