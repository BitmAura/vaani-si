# Vaani-Si — Comprehensive Codebase Audit & Technical Assessment

**Document Version:** 1.0.0  
**Audit Date:** October 18, 2026  
**Auditor Roles:** Principal Software Architect, Senior Security Engineer, SaaS Reliability Engineer, Voice AI Engineer, Technical Product Auditor  
**Repository Working Tree:** `P:\crazy-ai-stack\vaani-si`  
**Target Baseline Commit:** `e94f6ceb396d838026d87bb8d8e2cb9f50e40ccb` (Branch: `main`)  
**Pilot Status Recommendation:** **NO-GO FOR UNATTENDED LIVE PILOT** (Strict Conditional Go for Isolated Sandbox Test Mode Only)

---

## 1. Executive Summary

This audit assesses the Vaani-Si codebase following the initial 11 implementation prompts. Vaani-Si possesses an exceptionally sophisticated suite of regional AI voice components, including low-latency streaming pipeline prototypes, acoustic filler engines, Karnataka dialect prompting, Fastify-based REST/WebSocket services, and a comprehensive 198-test automated verification suite.

However, a forensic inspection of the working tree reveals critical architectural chasms, security bypasses, and silent provider fallbacks that make the platform **unsafe for an unmonitored commercial customer pilot** in its current state. 

### Key Findings Snapshot:
- **5 Critical (P0) Blockers:**
  1. **Client-side authentication fallback and Base64 password storage in browser `localStorage`** (`apps/web/login.html`, `apps/web/signup.html`).
  2. **Silent simulation of cellular outbound calls in production** when Exotel credentials are missing or unconfigured (`packages/providers/src/telephony/exotel-gateway.ts`).
  3. **Silent subscription checkout mocking in production** without Razorpay API credentials (`packages/providers/src/billing/razorpay.ts`).
  4. **Dynamic workspace voice pipeline failure**: The WebSocket voice audio pipeline silently routes all dynamic customer workspaces to a single hardcoded real-estate demo tenant (`apps/server/src/server.ts`).
  5. **Data loss upon container restart**: Subscriptions, billing accounts, usage ledgers, and user profiles are stored in-memory or in local flat files, not persisted to Supabase (`packages/database/src/index.ts`).
- **7 Blocking (P1) Operational Flaws:** Three competing backend gateways, dropped workspace activation states in Supabase, in-memory concurrency double-booking races for clinic appointments, missing Exotel Voicebot Applet response schemas, and write starvation in file persistence.
- **Go / No-Go Decision:** **NO-GO** for real live customer cellular calling until the P0/P1 remediation backlog is implemented.

---

## 2. Verified Repository Architecture

The repository is configured as an npm workspace monorepo consisting of:
- **22 Monorepo Workspaces:**
  - **4 Applications:** `apps/server`, `apps/api`, `apps/voice-gateway`, `apps/web`
  - **18 Packages:** `packages/agent-core`, `packages/auth`, `packages/billing`, `packages/campaign-engine`, `packages/context-engine`, `packages/conversation-engine`, `packages/core`, `packages/crm`, `packages/database`, `packages/handoff-engine`, `packages/industry-templates`, `packages/knowledge-engine`, `packages/observability`, `packages/provider-sdk`, `packages/providers`, `packages/shared`, `packages/tool-engine`, `packages/ui`, `packages/voice-engine`
- **Database Migrations:** 22 SQL migrations in `supabase/migrations/` (`001_initial_schema.sql` through `022_usage_metering_and_billing.sql`).
- **Static Public Site:** 14 SEO-optimized HTML marketing pages compiled by `apps/web/build-all-pages.mjs`.

---

## 3. Authoritative Implementation Map

A critical finding of this audit is that **three separate backend server applications exist in parallel**, creating operational ambiguity:

| Application | Port | Runtime Role | State & Storage Adapter | Authoritative Status |
| :--- | :--- | :--- | :--- | :--- |
| **`apps/server`** | 4000 | Primary Monolith: WebSockets (`/ws/audio-stream`), Clinic Roster, Real Estate, Agency, Pilot Routes, Static Auth APIs | Hybrid: `CallDatabaseService` (`data/calls.json`) + `globalDb` proxy | **AUTHORITATIVE BACKEND** (started by root `npm run start`) |
| **`apps/api`** | 4100 | Secondary REST API: Agents, Calls, Leads, Billing, Knowledge, CRM | Direct REST fetch to Supabase using service key | **SECONDARY / REDUNDANT** (Unconnected to `apps/server` state) |
| **`apps/voice-gateway`** | 4200 | Standalone Voice Daemon: Authenticated `/ws/voice-stream` with `VoiceRuntime` | `InMemoryTelephonyRepository` (100% ephemeral in-memory) | **EXPERIMENTAL / DETACHED** |

**Recommendation:** Consolidate runtime execution into `apps/server` or establish an explicit reverse proxy. Deprecate duplicate route controllers in `apps/api` to prevent split-brain states.

---

## 4. Database and Persistence Audit

### 4.1 Persistence Pathway Matrix

| Entity | Write Path | Read Path | Adapter | Durability | Multi-Instance Safe |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Users / Passwords** | `IdentityService.signup()` | `IdentityService.findUserByEmail()` | Local file (`data/auth_store.json`) | Survives local restart, lost on serverless deploy | ❌ NO (Local disk file) |
| **Sessions** | `serializeSession()` (HMAC Cookie) | `deserializeSession()` | Stateless HMAC-SHA256 Token | Survives if `COOKIE_SECRET` is identical | ✅ YES |
| **Organizations** | `IdentityService.createOrganization()` | `IdentityService.getOrganization()` | Local file (`data/auth_store.json`) | Survives local restart | ❌ NO |
| **Workspaces** | `globalDb.saveClientWorkspace()` | `globalDb.getClientWorkspaceById()` | Supabase / Durable JSON | Persisted to Postgres | ⚠️ PARTIAL (activationStatus dropped) |
| **Calls & Logs** | `CallDatabaseService.saveCall()` | `CallDatabaseService.getAllCalls()` | Local file (`data/calls.json`) | Local filesystem only | ❌ NO (Lost on container rebuild) |
| **Doctors / Schedules** | `globalDb.saveStaff()` | `globalDb.getStaff()` | Supabase / Durable JSON | Persisted | ✅ YES |
| **Appointments** | `globalDb.saveAppointment()` | `globalDb.getAppointments()` | Supabase / Durable JSON | Persisted | ⚠️ CONCURRENCY RISK (No row locking) |
| **Real Estate Properties**| `globalDb.saveProperty()` | `globalDb.getProperties()` | Supabase / Durable JSON | Persisted | ✅ YES |
| **Billing & Subscriptions**| `globalDb.saveSubscription()` | `globalDb.getBillingSnapshot()` | **InMemoryDatabaseService** | **LOST ON PROCESS RESTART** | ❌ NO (Pure in-memory Map) |
| **Usage Metering Ledger**| `globalDb.saveUsageEvent()` | `globalDb.getUsageSnapshot()` | **InMemoryDatabaseService** | **LOST ON PROCESS RESTART** | ❌ NO (Pure in-memory Map) |
| **Audit Logs** | `globalDb.saveAuditLog()` | `globalDb.getAuditLogs()` | **InMemoryDatabaseService** | **LOST ON PROCESS RESTART** | ❌ NO (Pure in-memory Map) |

### 4.2 Migration Consistency & Schema Analysis
- Migrations 001–022 define well-structured relational tables with Row-Level Security (RLS).
- **Schema Drift Detected:**
  - `client_workspaces` table (Migration 017 & 020) lacks an `activation_status` column. In `SupabaseDatabaseService` (`packages/database/src/index.ts:3360`), `saveClientWorkspace` ignores `workspace.activationStatus`, preventing pilot activation states from persisting across process lifecycles.
  - `appointments` table (Migration 018) lacks an exclusion or unique composite index on `(workspace_id, doctor_id, scheduled_time)` for non-cancelled appointments, allowing concurrent double bookings.

---

## 5. Security and Tenant Isolation Audit

### 5.1 Authentication Flow & Critical Vulnerabilities
1. **Critical Client-Side Auth Bypass (`apps/web/login.html:242–257`):**
   - The login form catches network failures or missing backend responses and falls back to verifying credentials against `localStorage.getItem('vanni_accounts_db')`.
   - Passwords stored in this local database are hashed using trivial browser Base64: `matchedAccount.passwordHash !== btoa(password)`.
   - An attacker or curious user can open DevTools, insert any user object into `localStorage`, and access administrative dashboards without authenticating against the server.
2. **Session Security (`packages/auth/src/session.ts`):**
   - Server-side sessions use cryptographically sound HMAC-SHA256 signatures with `httpOnly: true`, `secure: true` (in production), and `SameSite: 'lax'`.
   - In production, missing `COOKIE_SECRET` throws a hard error.
   - **Vulnerability:** `apps/web/login.html:233` copies the server session into unencrypted browser `localStorage.setItem('vanni_session', ...)`, exposing it to Cross-Site Scripting (XSS).
3. **Missing CSRF Guards:**
   - State-changing HTTP endpoints (`POST /api/appointments`, `POST /api/billing/checkout`, `POST /api/workspaces`) rely solely on cookies with `SameSite: 'lax'` without anti-CSRF tokens or custom request header verification.

### 5.2 Tenant Boundary Enforcement
- Tenant boundaries in `apps/server/src/server.ts` and `apps/server/src/routes/workspaces.ts` are strictly validated using `session.memberships`.
- Cross-tenant lookups (attempting to access workspace `B` with a session belonging only to org `A`) consistently return HTTP `403 Forbidden`.

---

## 6. Voice AI and Telephony Pipeline Audit

### 6.1 Call Lifecycle & Provider Fallback
- **Outbound Cellular Calls (`packages/providers/src/telephony/exotel-gateway.ts:111–120`):**
  - If `EXOTEL_API_KEY` or `EXOTEL_ACCOUNT_SID` are missing in production, the adapter silently synthesizes a mock call ID (`SIM_EXO_...`) and returns `status: 'INITIATED'`.
  - **Impact:** System logs show "Call Initiated", dashboards increment call counts, but no physical call was placed. This violates core pilot honesty requirements.
- **WebSocket Audio Pipeline Routing (`apps/server/src/server.ts:3368–3376`):**
  - In `/ws/audio-stream`, the tenant is resolved via `DEMO_TENANTS[tenantKey] || DEMO_TENANTS.real_estate`.
  - New customer workspaces created dynamically have generated IDs (e.g., `ws_clinic_4421`) which do not exist in `DEMO_TENANTS`.
  - Consequently, **every newly onboarded clinic or direct business customer is silently routed to the Ballari Residential Layouts real estate prompt!**
- **Speech Pipeline:**
  - Sarvam Bulbul v3 TTS and Saaras STT adapters in `packages/providers` are correctly structured for 8kHz / 16kHz audio.
  - Pre-cached natural Kannada fillers (`kannada-fillers.ts`) provide natural acoustic latency masking (280ms turn taking).

---

## 7. Healthcare and Real Estate Operational Correctness

### 7.1 Healthcare Domain
- **Appointment Concurrency Race Condition (`apps/server/src/routes/doctors.ts:551–566`):**
  - Overlapping appointment detection is performed in JavaScript memory across `globalDb.getAppointments()`.
  - Under concurrent load (e.g., two inbound callers simultaneously booking Dr. Ramesh at 10:00 AM), both read requests pass the conflict check and write to the database, creating double bookings.
- **Premature Confirmation (`apps/server/src/routes/doctors.ts:585`):**
  - All new appointments are immediately created with `status: 'CONFIRMED'` without an explicit clinic acknowledgment phase.
- **Medical Safety:** Emergency protocols (detecting chest pain, stroke, trauma) in `apps/server/src/emergency-handler.ts` intercept dangerous medical inquiries and route callers to emergency services (108).

### 7.2 Real Estate Domain
- **Plot and Site-Visit Booking (`apps/server/src/routes/real-estate.ts`):**
  - Plot inventory and site visits are tenant-isolated.
  - Missing database-level locking allows potential double-booking of plot reservations.
  - RERA verification checks require real external portal integration; currently returns verified status based solely on regex pattern matching.

---

## 8. Billing, Metering, and Commercial Correctness

### 8.1 Metering & Entitlement Guarantees
- The quantitative metering model is defined in `@vanni/billing` with plans (`STARTER`, `GROWTH`, `SCALE`).
- Voice minutes are checked via `globalEntitlementEngine.canConsumeVoiceMinutes()`.
- **Flaw:** Call durations are metered via `CallDatabaseService` into `data/calls.json`, while subscriptions and billing accounts live in transient memory (`InMemoryDatabaseService`). On process reboot, customer usage counters reset to 0 unless re-hydrated from call logs.
- **Silent Razorpay Mocking (`packages/providers/src/billing/razorpay.ts:90–99`):**
  - Unconfigured Razorpay keys in production return simulated checkout URLs (`https://rzp.io/i/sub_rzp_...`).

---

## 9. Frontend and Product Integrity

1. **Dual Storage Regimes:** `apps/web/signup.html` and `apps/web/login.html` operate primarily against browser `localStorage`, while `apps/web/app/dashboard.html` and `console.html` make calls to `/api/`. This creates desynchronized state between browser sessions.
2. **Dead Buttons & Mock Placeholders:**
   - Onboarding wizard (`app-onboarding.html`) persists progress to `localStorage.vanni_accounts_db` instead of calling `PUT /api/workspaces/:id/onboarding`.
   - Dashboard telephony diagnostics displays live badges even when operating on local mock fallback.

---

## 10. Test and Deployment Evidence

### 10.1 Test Execution Results
- Command: `npm test` (`vitest run --fileParallelism=false`)
- **Outcome:** **15 Test Files Passed (100%), 198 Tests Passed (100% Green)** in 29.87s.
- **TypeScript Typecheck:** `node scripts/typecheck-all.mjs` → **22 / 22 workspaces typecheck with 0 errors**.
- **Build Pipeline:** `npm run build` → Compiles all 18 packages, server, voice-gateway, and 14 static HTML pages with zero errors.

### 10.2 Critical Test Limitation:
All 198 passing tests execute against **in-memory mock databases and simulated provider harnesses**. **Zero tests have been executed against live Supabase, live Exotel trunks, live Sarvam STT/TTS APIs, or live Razorpay webhooks.**

---

## 11. Prioritized Findings (P0 / P1 / P2 / P3)

### P0 — Critical (Immediate Security or Commercial Failure)
- **F-P0-01 (Security):** Client-side authentication bypass and Base64 password storage in `localStorage` (`apps/web/login.html`, `apps/web/signup.html`).
- **F-P0-02 (Commercial):** Silent simulation of cellular calls in production when Exotel credentials are missing (`packages/providers/src/telephony/exotel-gateway.ts`).
- **F-P0-03 (Commercial):** Silent creation of fake Razorpay subscriptions in production (`packages/providers/src/billing/razorpay.ts`).
- **F-P0-04 (Voice AI):** WebSocket audio pipeline hardcoded fallback to real estate demo tenant for dynamic workspaces (`apps/server/src/server.ts`).
- **F-P0-05 (Data Loss):** Billing accounts, usage ledger, user profiles, and subscriptions stored in memory only; lost on process restart (`packages/database/src/index.ts`).

### P1 — Blocking (Core Workflow Cannot Safely Pilot)
- **F-P1-01 (Architecture):** Competing, divergent backend servers (`apps/server` on 4000 vs `apps/api` on 4100 vs `apps/voice-gateway` on 4200).
- **F-P1-02 (Data):** `SupabaseDatabaseService` drops `activationStatus` on workspace write and read.
- **F-P1-03 (Clinical):** Concurrent appointment booking race condition allows double-booking identical doctor slots (`apps/server/src/routes/doctors.ts`).
- **F-P1-04 (Clinical):** Auto-confirmation of OPD appointments without clinic review.
- **F-P1-05 (Data):** Silent write drops in `DurableDatabaseService` during concurrent disk flushes.
- **F-P1-06 (Telephony):** Missing Exotel Voice XML/applet response schema for bi-directional WebSocket streaming (`apps/server/src/routes/webhooks.ts`).
- **F-P1-07 (Security):** Missing CSRF tokens on session-authenticated mutating routes.

### P2 — Important (Reliability & Quality Debt)
- **F-P2-01 (Real Estate):** In-memory site visit capacity calculations prone to concurrency drift.
- **F-P2-02 (Metering):** Discrepancy between CDR duration and streaming audio session duration.
- **F-P2-03 (DevOps):** Configuration drift in `docker-compose.yml` (references non-existent Next.js web build).
- **F-P2-04 (Testing):** Zero test coverage for `apps/api` and standalone `apps/voice-gateway`.

### P3 — Improvements (Polish & Debt)
- **F-P3-01:** Monolithic source files (`apps/server/src/server.ts` > 3,500 lines; `packages/database/src/index.ts` > 4,000 lines).
- **F-P3-02:** Redundant duplicate static HTML directories in `apps/web/`.

---

## 12. Unverified External Dependencies

The following external integrations cannot be verified without live third-party credentials:
1. **Exotel Telephony:** Real SIP trunking, bidirectional E.164 caller ID delivery, and live call transfer.
2. **Sarvam AI:** Bulbul v3 streaming TTS latency and Saaras STT streaming accuracy under real cellular ambient noise.
3. **Razorpay Payments:** Live automated webhook signature delivery for subscription recurring debit events.
4. **Supabase PostgreSQL:** Connection pool exhaustion limits under sustained WebSocket audio concurrency.

---

## 13. Remediation Sequence & Phasing

```
Phase A: Security & Authentication Hardening (F-P0-01, F-P1-07)
   │
   ▼
Phase B: Fail-Closed Provider Integrity (F-P0-02, F-P0-03)
   │
   ▼
Phase C: Voice Pipeline Dynamic Workspace Resolution (F-P0-04, F-P1-06)
   │
   ▼
Phase D: Database Durability & Supabase Reconciliation (F-P0-05, F-P1-02, F-P1-05)
   │
   ▼
Phase E: Healthcare & Real Estate Concurrency Locking (F-P1-03, F-P1-04, F-P2-01)
   │
   ▼
Phase F: Server Consolidation & Deployment Harmonization (F-P1-01, F-P2-03)
```

---

## 14. Explicit Go / No-Go Criteria for First Live Pilot

### Final Assessment: **NO-GO FOR UNATTENDED LIVE PILOT**

| Gate Item | Status | Verification Criteria for Green Status |
| :--- | :--- | :--- |
| **Authentication & Credentials** | ❌ **FAILED** | Eliminate browser `localStorage` auth bypass; require valid server session cookie. |
| **Fail-Closed Outbound Calling** | ❌ **FAILED** | Throw hard HTTP 503 / 400 error when Exotel is not configured; never return `SIM_EXO_` in production. |
| **Dynamic Workspace Audio** | ❌ **FAILED** | `/ws/audio-stream` must load the dynamic agent configuration for the customer's workspace, not default to real estate. |
| **Persistent Billing & Storage** | ❌ **FAILED** | Reconcile Supabase adapter to persist billing accounts, subscriptions, and usage events. |
| **Appointment Double-Booking** | ❌ **FAILED** | Introduce database-level slot reservation constraint or Postgres transaction. |
| **Provider Credentials** | ⚠️ **PENDING** | Provide verified `EXOTEL_ACCOUNT_SID`, `SARVAM_API_KEY`, `RAZORPAY_KEY_ID`. |

*When Gates 1–5 are remediated and Gate 6 credentials are verified in staging, the platform may transition to a **CONDITIONAL PILOT GO** with human operator shadowing.*
