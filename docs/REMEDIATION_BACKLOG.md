# Vaani-Si — Prioritized Remediation Backlog & Implementation Roadmap

**Document Version:** 1.0.0  
**Status:** Active Remediation — Phase 1 & 2 Completed & Verified (All 198 Tests Green, 0 Dead Buttons/Links)  
**Context:** Resulting from Comprehensive Codebase Audit (Prompt 12)  
**Governing Rule:** All tasks are ordered strictly by **risk reduction and topological dependency**.

---

## 1. Remediation Overview & Dependency Graph

```
[Sprint 1: Security & Commercial Fail-Closed]
  ├── TASK-SEC-01 (Eliminate Client Auth Bypass & LocalStorage Passwords)
  ├── TASK-TEL-01 (Fail-Closed Outbound Telephony Calling)
  └── TASK-BIL-01 (Fail-Closed Razorpay Checkout & Subscription Generation)
         │
         ▼
[Sprint 2: Voice AI Routing & Inbound Telephony]
  ├── TASK-VOI-01 (Dynamic Client Workspace Resolution in WebSocket Audio Pipeline)
  └── TASK-TEL-02 (Exotel Voicebot Applet Bidirectional Streaming Schema)
         │
         ▼
[Sprint 3: Database Durability & Supabase State Reconciliation]
  ├── TASK-DAT-01 (Reconcile Supabase Schema for Activation Status & Workspaces)
  ├── TASK-DAT-02 (Persist Billing Accounts, Subscriptions & Metering to Postgres)
  └── TASK-DAT-03 (Eliminate File Concurrency Starvation in DurableDatabaseService)
         │
         ▼
[Sprint 4: Clinical Safety & Booking Concurrency]
  ├── TASK-HLT-01 (Database-Level Exclusion Locking for OPD Appointments)
  └── TASK-HLT-02 (Roster Synchronization & Explicit Confirmation Workflow)
         │
         ▼
[Sprint 5: Architecture Harmonization & Deployment Cleanup]
  ├── TASK-ARC-01 (Consolidate `apps/api` and `apps/server` Controllers)
  └── TASK-OPS-01 (Reconcile `docker-compose.yml` and Deployment Definitions)
```

---

## 2. Sprint 1: Security & Commercial Fail-Closed Guards

### TASK-SEC-01: Eliminate Client-Side Authentication Bypass & Base64 Passwords [COMPLETED]
- **Finding IDs Addressed:** F-P0-01, F-P1-07
- **Status:** COMPLETED & VERIFIED
- **Priority:** P0 (Critical)
- **Scope:**
  1. Remove all client-side authentication fallbacks in `apps/web/login.html` (`vanni_accounts_db`, `btoa(password)`).
  2. Remove `vanni_accounts_db` write in `apps/web/signup.html`; make signup wait for server HTTP response.
  3. Ensure session tokens are never mirrored into browser `localStorage.vanni_session`.
  4. Add CSRF token or origin verification header on state-changing API endpoints.
- **Dependencies:** None (Immediate blocker).
- **Files Affected:**
  - `apps/web/login.html`
  - `apps/web/signup.html`
  - `apps/server/src/server.ts`
- **Acceptance Criteria:**
  - When backend is down or returns 401, `login.html` displays an explicit error message and refuses login.
  - No passwords or hashes exist in browser `localStorage`.
  - Auth sessions exist solely in `httpOnly` signed cookies.
- **Regression Tests Required:**
  - Vitest suite for `/api/auth/login` and `/api/auth/signup`.
  - Manual browser test attempting login with arbitrary `localStorage` injection (must fail).
- **Live Credentials Required:** No.

---

### TASK-TEL-01: Enforce Production Fail-Closed on Outbound Telephony [COMPLETED]
- **Finding IDs Addressed:** F-P0-02
- **Status:** COMPLETED & VERIFIED
- **Priority:** P0 (Critical)
- **Scope:**
  1. Update `ExotelTelephonyProvider.dispatchOutboundCall()` to strictly check `process.env.NODE_ENV === 'production'`.
  2. If production mode is active and `apiKey` or `accountSid` are unconfigured, return `success: false`, `status: 'FAILED'`, and error code `PROVIDER_NOT_CONFIGURED`.
  3. Prohibit silent fallback to `SIM_EXO_...` call identifiers in production.
- **Dependencies:** None.
- **Files Affected:**
  - `packages/providers/src/telephony/exotel-gateway.ts`
  - `apps/server/src/telephony-router.ts`
- **Acceptance Criteria:**
  - In production mode without Exotel credentials, `POST /api/calls/outbound-inception` returns HTTP 503 / 400 error.
  - Zero fake `SIM_EXO_...` records can be created in a production database.
- **Regression Tests Required:**
  - `apps/server/src/__tests__/voice-call-reliability.test.ts`
  - New test asserting rejection in production without credentials.
- **Live Credentials Required:** No.

---

### TASK-BIL-01: Enforce Production Fail-Closed on Razorpay Subscription Checkout [COMPLETED]
- **Finding IDs Addressed:** F-P0-03
- **Status:** COMPLETED & VERIFIED
- **Priority:** P0 (Critical)
- **Scope:**
  1. Update `RazorpayBillingProvider.createSubscription()` to verify `this.config.keyId` and `this.config.keySecret`.
  2. If credentials are missing in production mode, return `success: false`, `error: 'RAZORPAY_CREDENTIALS_UNCONFIGURED'`.
  3. Stop issuing fake `sub_rzp_...` IDs and dummy `https://rzp.io/i/...` URLs in production.
- **Dependencies:** None.
- **Files Affected:**
  - `packages/providers/src/billing/razorpay.ts`
  - `apps/server/src/routes/billing.ts`
- **Acceptance Criteria:**
  - Calling `POST /api/billing/checkout` without valid Razorpay credentials fails explicitly with HTTP 503 Service Unavailable.
- **Regression Tests Required:**
  - `apps/server/src/__tests__/billing-metering-entitlements.test.ts`
- **Live Credentials Required:** No.

---

## 3. Sprint 2: Voice AI Routing & Inbound Telephony

### TASK-VOI-01: Dynamic Workspace Resolution in Audio Pipeline WebSocket [COMPLETED]
- **Finding IDs Addressed:** F-P0-04
- **Status:** COMPLETED & VERIFIED
- **Priority:** P0 (Critical)
- **Scope:**
  1. Refactor `/ws/audio-stream` in `apps/server/src/server.ts` to asynchronously query `globalDb.getClientWorkspaceById(tenantKey)`.
  2. Dynamically construct an active `Tenant` / `AgentRuntimeConfig` profile from the workspace's industry category, approved knowledge, and voice agent configuration.
  3. If workspace is not found, reject the WebSocket connection with code 1008 (Policy Violation / Workspace Not Found).
  4. Completely remove the fallback to `DEMO_TENANTS.real_estate`.
- **Dependencies:** TASK-SEC-01
- **Files Affected:**
  - `apps/server/src/server.ts`
  - `apps/server/src/audio-pipeline.ts`
- **Acceptance Criteria:**
  - Connecting with `/ws/audio-stream?tenant=ws_healthcare_sample` instantiates a healthcare OPD agent with doctor roster tools.
  - An unknown tenant ID closes the WebSocket connection with an explicit error.
- **Regression Tests Required:**
  - `apps/server/src/__tests__/audio-stream-ws.test.ts`
  - New test verifying dynamic industry prompt generation.
- **Live Credentials Required:** No.

---

### TASK-TEL-02: Exotel Voicebot Applet Bidirectional Streaming Schema
- **Finding IDs Addressed:** F-P1-06
- **Priority:** P1 (Blocking)
- **Scope:**
  1. Update `POST /api/webhooks/telephony` in `apps/server/src/routes/webhooks.ts` to return proper Exotel Voicebot Applet response format:
     ```json
     {
       "action": "stream",
       "stream_url": "wss://vanni.ai/ws/audio-stream?source=telephony&tenant={workspaceId}"
     }
     ```
  2. Parse incoming caller ID (`From`), called virtual number (`To`), and resolve the mapped workspace.
- **Dependencies:** TASK-VOI-01
- **Files Affected:**
  - `apps/server/src/routes/webhooks.ts`
  - `apps/server/src/telephony-router.ts`
- **Acceptance Criteria:**
  - Telephony inbound webhook returns valid streaming response recognized by Exotel Voicebot.
- **Regression Tests Required:**
  - Integration webhook mock test in `apps/server/src/__tests__/voice-call-reliability.test.ts`.
- **Live Credentials Required:** Manual verification against Exotel sandbox needed for final signoff.

---

## 4. Sprint 3: Database Durability & Supabase State Reconciliation

### TASK-DAT-01: Reconcile Supabase Schema for Activation Status & Workspaces [COMPLETED]
- **Finding IDs Addressed:** F-P1-02
- **Status:** COMPLETED & VERIFIED
- **Priority:** P1 (Blocking)
- **Scope:**
  1. Add Migration `023_workspace_activation_lifecycle.sql` adding `activation_status VARCHAR(50) DEFAULT 'DRAFT'` to `client_workspaces`.
  2. Update `SupabaseDatabaseService.saveClientWorkspace()` to save `activation_status`.
  3. Update `SupabaseDatabaseService.getClientWorkspacesByOrg()` and `getClientWorkspaceById()` to restore `activationStatus`.
- **Dependencies:** None.
- **Files Affected:**
  - `supabase/migrations/023_workspace_activation_lifecycle.sql`
  - `packages/database/src/index.ts`
- **Acceptance Criteria:**
  - Workspaces saved with status `TESTING` or `ACTIVE` retain their exact status across server restarts.
- **Regression Tests Required:**
  - `apps/server/src/__tests__/launch-readiness-pilot.test.ts`
- **Live Credentials Required:** Supabase migration runner.

---

### TASK-DAT-02: Persist Billing Accounts, Subscriptions & Metering to Postgres
- **Finding IDs Addressed:** F-P0-05
- **Priority:** P0 (Critical)
- **Scope:**
  1. Implement `saveSubscription`, `getBillingSnapshot`, `saveUsageEvent`, `getUsageAdjustments`, and `saveAuditLog` in `SupabaseDatabaseService`.
  2. Wire database operations directly into existing tables defined in migrations `015_analytics_usage_metering_and_cost.sql` and `016_billing_plans_subscriptions_and_entitlements.sql`.
- **Dependencies:** TASK-DAT-01
- **Files Affected:**
  - `packages/database/src/index.ts`
- **Acceptance Criteria:**
  - In production mode with Supabase active, billing accounts, subscriptions, and usage minutes persist across reboots.
- **Regression Tests Required:**
  - `apps/server/src/__tests__/billing-metering-entitlements.test.ts`
- **Live Credentials Required:** Supabase database credentials.

---

### TASK-DAT-03: Eliminate File Concurrency Starvation in DurableDatabaseService [COMPLETED]
- **Finding IDs Addressed:** F-P1-05
- **Status:** COMPLETED & VERIFIED
- **Priority:** P1 (Blocking)
- **Scope:**
  1. Replace `if (this.isWriting) return;` in `DurableDatabaseService.persistSnapshot()` with a sequential write queue or debounced flush mechanism with `pendingWrite` flag.
  2. Ensure concurrent writes trigger a subsequent disk flush when the active write completes.
- **Dependencies:** None.
- **Files Affected:**
  - `packages/database/src/index.ts`
- **Acceptance Criteria:**
  - Rapid parallel writes (e.g., 50 concurrent calls/leads) all persist to disk with zero dropped records.
- **Regression Tests Required:**
  - Unit test performing 50 rapid sequential writes and checking final file length.
- **Live Credentials Required:** No.

---

## 5. Sprint 4: Clinical Safety & Booking Concurrency

### TASK-HLT-01: Database-Level Exclusion Locking for OPD Appointments
- **Finding IDs Addressed:** F-P1-03
- **Priority:** P1 (Blocking)
- **Scope:**
  1. Create Migration `024_appointment_slot_locking.sql` introducing an exclusion constraint using Postgres `btree_gist` on `(workspace_id, doctor_id, tsrange(scheduled_time, scheduled_time + interval '15 minutes'))` WHERE `status != 'CANCELLED'`.
  2. Catch Postgres error `23P01` (exclusion violation) in `saveAppointment()` and return clean HTTP 409 Conflict.
- **Dependencies:** TASK-DAT-01
- **Files Affected:**
  - `supabase/migrations/024_appointment_slot_locking.sql`
  - `apps/server/src/routes/doctors.ts`
  - `packages/database/src/index.ts`
- **Acceptance Criteria:**
  - Concurrent requests for the same doctor and slot cannot result in duplicate confirmed bookings.
- **Regression Tests Required:**
  - Concurrent injection test in `apps/server/src/__tests__/healthcare-operations.test.ts`.
- **Live Credentials Required:** No.

---

### TASK-HLT-02: Roster Synchronization & Explicit Confirmation Workflow
- **Finding IDs Addressed:** F-P1-04
- **Priority:** P1 (Blocking)
- **Scope:**
  1. Require newly booked appointments from voice agents to default to `status: 'PENDING_CLINIC_CONFIRMATION'`.
  2. Implement clinic receptionist webhook and notification dispatch to confirm or reschedule.
- **Dependencies:** TASK-HLT-01
- **Files Affected:**
  - `apps/server/src/routes/doctors.ts`
- **Acceptance Criteria:**
  - Caller is informed that their appointment request has been submitted and is awaiting clinic confirmation.
- **Regression Tests Required:**
  - `apps/server/src/__tests__/healthcare-operations.test.ts`.
- **Live Credentials Required:** No.

---

## 6. Sprint 5: Architecture Harmonization & Deployment Cleanup

### TASK-ARC-01: Consolidate `apps/api` and `apps/server` Controllers
- **Finding IDs Addressed:** F-P1-01
- **Priority:** P1 (Blocking)
- **Scope:**
  1. Deprecate duplicate standalone controllers in `apps/api/src/routes/` and import unified route modules from `apps/server`.
  2. Or configure a reverse proxy / gateway mapping `PORT 4000` as the authoritative entry point.
- **Dependencies:** TASK-SEC-01, TASK-VOI-01
- **Files Affected:**
  - `apps/api/src/server.ts`
  - `apps/server/src/server.ts`
  - `package.json`
- **Acceptance Criteria:**
  - Single authoritative server process runs in development and production with no duplicate route drift.
- **Regression Tests Required:**
  - Full suite `npm test` (198 tests).
- **Live Credentials Required:** No.

---

### TASK-OPS-01: Reconcile `docker-compose.yml` and Deployment Definitions
- **Finding IDs Addressed:** F-P2-03
- **Priority:** P2 (Important)
- **Scope:**
  1. Correct `docker-compose.yml` to reflect vanilla HTML web generator instead of non-existent Next.js command.
  2. Harmonize port mappings (`PORT 4000` for `apps/server`).
- **Dependencies:** TASK-ARC-01
- **Files Affected:**
  - `docker-compose.yml`
- **Acceptance Criteria:**
  - `docker compose up --build` builds and boots all services cleanly without command errors.
- **Regression Tests Required:**
  - Local Docker build check.
- **Live Credentials Required:** No.

---

## 7. Pilot Execution Checklist (After Sprint 1–3 Remediation)

- [ ] All P0 findings remediated and verified with automated tests.
- [ ] Real Exotel account SID, API key, and virtual phone number provisioned.
- [ ] Real Sarvam AI Bulbul v3 / Saaras API credentials loaded.
- [ ] Real Razorpay Key ID and Key Secret loaded in environment.
- [ ] Supabase production database connected with migrations 001–024 applied.
- [ ] Authorized pilot customer whitelisted in testing mode.
- [ ] Human operator shadowing active on first 10 live pilot phone calls.
