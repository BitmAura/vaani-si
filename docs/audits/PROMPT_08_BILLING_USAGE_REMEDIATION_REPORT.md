# PROMPT 08: Billing, Subscription, Usage Metering & Payment Reliability Audit and Remediation Report

**Repository:** `BitmAura/vaani-si`  
**Target Monorepo:** `P:\crazy-ai-stack\vaani-si`  
**Authoritative Branch:** `main`  
**Baseline HEAD Commit:** `5c7095d` (*"fix(healthcare): appointment concurrency hardening, timezone safety, and strictly administrative safeguards (Prompt 07)"*)  
**Execution Date:** October 20, 2026  
**Auditor / Engineering Agent:** Antigravity (Google DeepMind Advanced Agentic Coding)

---

## 1. Initial Repository State and Git Baseline

Prior to implementing any Prompt 08 modifications, git status and working tree were verified:
- **Baseline Git Commit:** `5c7095d105beadbb6e17441dc31ceb83ea36c8be`
- **Working Tree Cleanliness:** Clean working tree with Prompts 01–07 fully green across healthcare, real estate, auth, agency, voice engine, and database persistence.
- **Initial Test Suite:** 298 tests passed across 21 test files.
- **Typecheck Baseline:** 22/22 projects passed cleanly with zero type errors.

---

## 2. Verified Architecture & End-to-End API Flow

The complete billing lifecycle was audited across all layers:

```
[Frontend Client] (apps/web/app/billing.html)
      │
      │ 1. POST /api/billing/checkout { planId, billingInterval }
      ▼
[API Gateway / Fastify Route] (apps/server/src/routes/billing.ts & apps/api/src/routes/billing.ts)
      │
      ├─► Authenticates session via vanni_session cookie / Bearer token (rejects unauthenticated: 401)
      ├─► Derives tenant scope (orgId) strictly from trusted session (rejects spoofed body/header orgId)
      ├─► Enforces role permissions (requires OWNER or ADMIN; VIEWER returns 403 FORBIDDEN)
      ├─► Validates plan against server-side plan catalog (rejects browser-supplied prices/amounts)
      │
      ▼
[Billing Provider Adapter] (packages/providers/src/billing/resolve-provider.ts)
      │
      ├─► Production with Keys   -> RazorpayBillingProvider (live credentials & HMAC)
      ├─► Production w/o Keys    -> UnconfiguredBillingProvider (FAILS CLOSED, rejects webhooks: 503)
      └─► Dev / Test Mode        -> MockBillingProvider (synthetic sandbox)
      │
      ▼
[Local / Durable Database Ledger] (packages/database/src/index.ts)
      │
      ├─► Creates/updates SubscriptionDTO with status: 'INCOMPLETE' (NEVER activates before payment!)
      ├─► Emits SubscriptionEventDTO ('SUBSCRIPTION_CREATED')
      ├─► Persists snapshot to disk (vanni_database.json) across server restarts
      │
      ▼
[Client Return / Verification]
      │
      ├─► POST /api/billing/checkout/verify { razorpay_order_id, razorpay_payment_id, razorpay_signature }
      │     └─► Cryptographically verifies HMAC signature against secret before upgrading subscription status to 'ACTIVE'
      │
      └─► POST /api/billing/webhooks/razorpay (Raw payload & x-razorpay-signature)
            ├─► Fail-closed if production secret is missing (503)
            ├─► Computes raw-body HMAC-SHA256 signature (rejects invalid: 401)
            ├─► Idempotency deduplication check via getBillingProviderEvent (ignores duplicate events: 200 IGNORED_DUPLICATE)
            ├─► Out-of-order event guard: prevents late payment event from resurrecting 'CANCELLED' subscription
            ├─► Records payment in PaymentRecordDTO and generates verified GST Tax Invoice
            └─► Durable audit persistence via saveBillingProviderEvent
```

---

## 3. Confirmed Defects & Forensic Evidence

During the audit, five critical architectural and security vulnerabilities were identified in the existing codebase:

### Defect 1: Premature Subscription Activation Vulnerability (Critical Financial Flaw)
- **Location:** `apps/server/src/routes/billing.ts` (old line 170)
- **Defect:** `POST /api/billing/checkout` immediately marked new subscriptions as `ACTIVE` upon checkout initiation—*before* the customer completed payment on the gateway and before any webhook was received.
- **Exploitation:** Any authenticated user could click "Upgrade Plan", initiate checkout, close the Razorpay window without paying, and immediately gain full enterprise voice and AI quota entitlements for free.
- **Evidence:** Test revealed subscription status transitioned directly to `ACTIVE` before signature verification or webhook confirmation.

### Defect 2: Insecure Header-Based Authorization Defaults in API Routes
- **Location:** `apps/api/src/routes/billing.ts` (old lines 36–37)
- **Defect:** Duplicate billing route accepted client-supplied `x-organization-id` and `x-user-role: ADMIN` directly from request headers with zero session authentication.
- **Exploitation:** An unauthenticated attacker could send `curl -H "x-organization-id: victim_org" -H "x-user-role: ADMIN" /api/billing/checkout` and forge checkout sessions or inspect other tenants' billing snapshots.

### Defect 3: Non-Durable Webhook Deduplication and Audit Loss
- **Location:** `packages/database/src/index.ts` (`DurableDatabaseService`)
- **Defect:** While `DurableDatabaseService` persisted organizations and calls, it omitted snapshot hydration and persistence for `billing_provider_events`, `subscription_events`, `payment_records`, and `billing_invoices`.
- **Exploitation:** Upon any server restart or pod recycling, the in-memory deduplication set was wiped, allowing duplicate Razorpay webhook deliveries to be reprocessed, generating duplicate invoices and re-triggering lifecycle events.

### Defect 4: Unverified Checkout Return and Missing Verification Endpoint
- **Location:** `apps/server/src/routes/billing.ts`
- **Defect:** There was no cryptographic verification route for frontend redirect returns. The frontend was displaying success banners simply based on client-side redirect query parameters.
- **Exploitation:** A user could navigate directly to `/app/billing.html?status=success` without completing checkout and observe misleading entitlement messages.

### Defect 5: Unbounded Out-of-Order Lifecycle State Corruption
- **Location:** `apps/server/src/routes/billing.ts` (webhook handler)
- **Defect:** When a delayed `payment.captured` or `subscription.charged` webhook arrived after a user had explicitly cancelled their subscription, the webhook blindly reset `sub.status = 'ACTIVE'`, resurrecting a terminated subscription without authorization.

---

## 4. Fixes Implemented

1. **Strict Lifecycle State Machine & Incomplete Initiation**:
   - `POST /api/billing/checkout` now initializes new subscriptions in `'INCOMPLETE'` status (or retains existing active plan for pending upgrades). Entitlements are strictly withheld until payment signature confirmation.
2. **Cryptographic Checkout Verification Endpoint**:
   - Added `POST /api/billing/checkout/verify` in `apps/server/src/routes/billing.ts` validating Razorpay HMAC-SHA256 signatures (`order_id|payment_id`), recording durable payment records, and invoking `globalInvoiceGenerator` before granting active entitlements.
3. **Fail-Closed Webhook Ingestion & Idempotency**:
   - Enforced fail-closed behavior in production: if `RAZORPAY_WEBHOOK_SECRET` is missing, the endpoint rejects incoming calls with `503 Service Unavailable`.
   - Raw-body signature verification validates Razorpay HMAC-SHA256.
   - Durable idempotency checks `globalDb.getBillingProviderEvent('RAZORPAY', providerEventId)`. Duplicates return `200 OK` with `status: 'IGNORED_DUPLICATE'`.
   - Added out-of-order state guards: payment webhooks cannot resurrect `CANCELLED` subscriptions to `ACTIVE`.
4. **Durable Database Persistence Hardening**:
   - Added collection persistence and initial hydration in `DurableDatabaseService` for `subscriptionEvents`, `paymentRecords`, `billingInvoices`, and `billingProviderEvents`.
   - Overrode mutation methods to immediately call `this.persistSnapshot()`, persisting financial audit trails across server restarts.
5. **Contract Consistency Across Server, API & Frontend**:
   - Standardized responses across `apps/server` and `apps/api` to return `{ success, checkoutUrl, shortUrl, amount, currency, billingInterval, providerSubscriptionId, data: { ... } }`.
   - Added alias routing for `/api/billing` and `/api/billing/snapshot`, as well as `GET /api/billing/subscription`.
   - In `apps/web/app/billing.html`, removed forged `x-user-role: ADMIN` headers and bound receipt generation to actual loaded financial records.

---

## 5. Files Changed

| File Path | Type of Modification | Purpose |
| :--- | :--- | :--- |
| `packages/providers/src/mocks/mock-billing.ts` | Enhanced | Supported real HMAC verification with fallback, nested payload normalization, and event ID resolution |
| `packages/database/src/index.ts` | Hardened | Protected billing collections, added snapshot hydration and persistence for billing events, invoices, and payment records in `DurableDatabaseService` |
| `apps/server/src/routes/billing.ts` | Hardened | Enforced fail-closed webhooks, incomplete checkout state, verification endpoint, durable idempotency, plan alias resolution, and out-of-order lifecycle guards |
| `apps/api/src/routes/billing.ts` | Security Fix | Removed unauthenticated header overrides; bound strictly to `PermissionService.resolveAuthContext(req.headers)` |
| `apps/web/app/billing.html` | Frontend Fix | Removed hardcoded `x-user-role` headers; inspected loaded snapshot for receipts |
| `supabase/migrations/026_billing_payment_hardening.sql` | New (Proposed) | Proposed, review-only schema migration for durable idempotency and payment uniqueness constraints |
| `apps/server/src/__tests__/billing-payment-lifecycle-hardening.test.ts` | New Test Suite | Comprehensive 18-scenario automated test suite verifying all Prompt 08 requirements |

---

## 6. Exact Automated Test Results

### Targeted Billing Test Suites

```powershell
npx vitest run apps/server/src/__tests__/billing-metering-entitlements.test.ts apps/server/src/__tests__/billing-payment-lifecycle-hardening.test.ts
```

**Result:**
```text
 ✓ apps/server/src/__tests__/billing-metering-entitlements.test.ts (14 tests) 1204ms
 ✓ apps/server/src/__tests__/billing-payment-lifecycle-hardening.test.ts (18 tests) 1340ms

 Test Files  2 passed (2)
      Tests  32 passed (32)
   Duration  3.84s
```

#### Verification of All 18 Required Scenarios:
1. **Checkout requires authentication:** Verified (401 without authenticated session).
2. **Server-side plan and amount validation:** Verified (invalid plan rejected with 404, valid plan sets catalog amount).
3. **Browser-supplied amounts cannot override configured prices:** Verified (tampered amount ignored; server catalog enforced).
4. **Provider failure does not create falsely paid subscription:** Verified (provider exception returns 502; sub remains null).
5. **Unverified checkout return cannot grant entitlements:** Verified (unverified signature leaves sub in INCOMPLETE status).
6. **Invalid webhook signatures are rejected:** Verified (401 Unauthorized on invalid signature).
7. **Missing production webhook secrets fail closed:** Verified (503 Service Unavailable when production secret absent).
8. **Duplicate webhook events are processed idempotently:** Verified (returns 200 with IGNORED_DUPLICATE without duplicating records).
9. **Out-of-order webhook events do not corrupt subscription state:** Verified (late payment event cannot resurrect CANCELLED subscription).
10. **Cross-tenant subscription, invoice, and usage access is denied:** Verified (tenant scope strictly derived from session; foreign cancel attempts rejected).
11. **Role restrictions for billing operations:** Verified (VIEWER role rejected with 403 FORBIDDEN on checkout and cancellation).
12. **Usage counting is idempotent for retried events:** Verified (duplicate Exotel CDR webhooks deduplicated without inflating voice minutes).
13. **Usage limits behave correctly under concurrent requests:** Verified (403 ENTITLEMENT_LIMIT_EXCEEDED when quota is exhausted).
14. **Failed or incomplete calls follow configured usage policy:** Verified (unanswered/failed calls with 0 duration do not consume billable minutes).
15. **Subscription expiry and cancellation update entitlements correctly:** Verified (immediate cancellation transitions status to CANCELLED).
16. **Database failures return truthful errors:** Verified (500 INTERNAL_ERROR with truthful error message on DB failure).
17. **Supabase / Durable adapter persistence tests snapshotting:** Verified (DurableDatabaseService persists subscriptions, payments, and billing provider events to disk).
18. **Frontend checkout and billing API response contracts agree:** Verified (returns checkoutUrl, shortUrl, amount, currency, billingInterval, providerSubscriptionId).

---

### Full Repository Regression Test Suite

```powershell
npm test
```

**Result:**
```text
 Test Files  22 passed (22)
      Tests  316 passed (316)
   Duration  38.55s
```
**Baseline vs. Final Test Count:**
- Baseline (Prompt 07): 298 tests passing across 21 test files.
- Final (Prompt 08): **316 tests passing across 22 test files** (+18 new tests, 0 failures, 0 regressions).

---

### Monorepo TypeScript Compilation

```powershell
npm run typecheck
```

**Result:**
```text
[typecheck-all] Checking 22 projects...
✓ apps\api
✓ apps\server
✓ apps\voice-gateway
✓ packages\agent-core
✓ packages\auth
✓ packages\billing
✓ packages\campaign-engine
✓ packages\context-engine
✓ packages\conversation-engine
✓ packages\core
✓ packages\crm
✓ packages\database
✓ packages\handoff-engine
✓ packages\industry-templates
✓ packages\knowledge-engine
✓ packages\observability
✓ packages\provider-sdk
✓ packages\providers
✓ packages\shared
✓ packages\tool-engine
✓ packages\ui
✓ packages\voice-engine

[typecheck-all] All 22 projects typecheck clean.
```

---

## 7. Subscription, Webhook, and Usage Behavior

1. **Subscription States Supported:**
   - `'TRIALING'`: Automatically created for newly registered organizations (14 days allowance).
   - `'INCOMPLETE'`: Set when subscription checkout is initiated but payment is pending.
   - `'ACTIVE'`: Set only after valid payment signature verification or provider webhook confirmation.
   - `'PAST_DUE'`: Set when renewal charge fails. Outbound calling is strictly paused.
   - `'CANCELLED'`: Set upon immediate cancellation or period-end termination.
2. **Webhook Idempotency:**
   - Webhook deliveries are keyed by provider event identifier (`x-razorpay-event-id` or payload `id`).
   - Events are written to `billingProviderEvents` audit table. Duplicate deliveries are discarded with `200 OK` and `status: 'IGNORED_DUPLICATE'`.
3. **Usage Metering Policy:**
   - Voice minutes are counted strictly upon receipt of confirmed CDR completion (`CallStatus: 'completed'`).
   - Failed, busy, or unanswered calls with 0 duration are recorded as calls but do not consume billable voice minutes.
   - Quotas are checked via `globalEntitlementEngine.canInitiateOutboundCall()` prior to placing outbound calls, preventing concurrency overrun.

---

## 8. Persistence Findings

- **Supabase Production Adapter:** Full SQL schema supports billing accounts, subscriptions, subscription events, payment records, and billing invoices under RLS.
- **Durable Local Storage (`DurableDatabaseService`):** Updated to persist all billing collections into `vanni_database.json`. Webhook idempotency and payment records survive server restarts.
- **In-Memory Fallback (`InMemoryDatabaseService`):** Collections are maintained in memory for lightweight unit tests.

---

## 9. Proposed Database Migrations

**File:** `supabase/migrations/026_billing_payment_hardening.sql` *(Unapplied, proposed for review only)*.

**Summary of Schema Hardening:**
1. Adds unique constraint `uq_payment_records_provider_id` on `payment_records(provider, provider_payment_id)` to prevent duplicate ledger transactions at the database level.
2. Adds unique constraint `uq_billing_provider_events_idempotency` on `billing_provider_events(provider, provider_event_id)` for durable webhook deduplication across clustered database replicas.
3. Adds `client_workspace_id` foreign key on `billing_invoices` for multi-tenant agency sub-billing.
4. Adds RLS policies strictly isolating billing snapshots and payment receipts to authenticated organization members.
5. Includes a complete rollback script in the migration header.

---

## 10. Remaining Risks & Manual Staging Verification

1. **Live Gateway Webhook Verification:**
   - Provider calls in automated tests used `MockBillingProvider` and simulated Razorpay payloads.
   - When promoting to staging, configure live test credentials (`rzp_test_...`) and trigger an actual ₹1 test transaction in the Razorpay sandbox to verify webhook delivery over public HTTPS via ngrok.
2. **GST Invoice Compliance:**
   - Automated invoices use standard 18% GST calculation. Live enterprise deployments should verify state-specific CGST/SGST vs. IGST tax split based on customer billing address state code.
3. **Razorpay Plan Synchronization:**
   - In live mode, local plan IDs (`plan_growth`, `plan_scale`) must be pre-mapped to corresponding Razorpay Plan IDs (`plan_...`) in the Razorpay dashboard.

---

## 11. Completion Status

All requirements for Prompt 08 have been met. Zero live transactions were executed, zero migrations were applied to live databases, all 22 projects typecheck clean, and all 316 automated tests pass.
