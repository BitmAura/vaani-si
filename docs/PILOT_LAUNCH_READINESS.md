# Vaani-Si — Pilot Launch Readiness, Customer Onboarding & Pilot Operations Report (Prompt 11)

**Date**: 2026-10-18  
**Author**: Senior SaaS Product Engineer, Customer Onboarding Architect, Voice AI Product Manager, and DevOps Engineer  
**Target Repository**: `P:\crazy-ai-stack\vaani-si`  
**Git Branch**: `main`  
**Git Commit Hash**: `48a1f01` (baseline)  
**Verification Status**: **15 / 15 Test Files Passed (198 / 198 Tests 100% Green)**  

---

## 1. Features Actually Implemented

In this phase, we constructed the operational infrastructure, preflight safety gates, and pilot telemetry required to safely onboard real pilot customers without risking unauthorized live calls, phantom activations, or cross-tenant data leaks:

1. **Server-Backed 15-Dimension Preflight Readiness Engine** ([`apps/server/src/readiness-engine.ts`](file:///P:/crazy-ai-stack/vaani-si/apps/server/src/readiness-engine.ts)):
   - Evaluates workspaces against 15 discrete operational dimensions.
   - Categorizes each check into explicit non-binary states: `Ready`, `Action required`, `Connection failed`, `Configuration missing`, `Verification pending`, `Not applicable`.
   - Distinguishes `isMandatoryForTesting` from `isMandatoryForLive`.
   - Never outputs a false "Ready" merely because an environment variable exists.
   - Evaluates overall workspace readiness as `Ready for live activation`, `Ready for testing`, `Configuration incomplete`, `Action required`, or `Connection failed`.

2. **Certified Voice Selection Matrix & Endpoint** (`GET /api/voice-agent/supported-voices` in [`apps/server/src/routes/pilot.ts`](file:///P:/crazy-ai-stack/vaani-si/apps/server/src/routes/pilot.ts)):
   - Restricts available voice speakers strictly to provider-supported models (Sarvam Bulbul v3: `kavya`, `meera`, `pavithra`, `maitreyi`, `arvind`, `amartya`; Azure Cognitive Speech Neural: `kn-IN-SapnaNeural`, `kn-IN-GaganNeural`).
   - Automatically rejects unauthorized or fabricated voice identifiers with `400 Bad Request`.

3. **Voice Agent Configuration & Versioning Router** (`GET / PUT /api/workspaces/:id/voice-agent`):
   - Manages agent display name, verified speaker selection, primary language (`kn-IN`, `kn-en`, `en-IN`), regional dialect, greeting phrases in Kannada/English, allowed tool permissions, business hours, and after-hours routing (`TAKE_MESSAGE`, `VOICEMAIL`, `TRANSFER_URGENT`, `OFFLINE_NOTICE`).
   - Increments configuration version on every update and records an immutable audit log in `globalDb.saveAuditLog()`.

4. **Safe Activation Lifecycle & Gating Gates** (`GET / POST /api/workspaces/:id/activation`):
   - Implements the strict state machine: `DRAFT` → `CONFIGURATION_INCOMPLETE` → `READY_FOR_TESTING` → `TESTING` → `READY_FOR_LIVE_ACTIVATION` → `ACTIVE` ↔ `SUSPENDED` / `FAILED`.
   - Enforces server-side role gating: Only `OWNER` or `ADMIN` can transition activation state; `VIEWER` attempts are rejected with `403 Forbidden`.
   - Gated Activation: Transition to `ACTIVE` or `READY_FOR_LIVE_ACTIVATION` requires all mandatory readiness checks to be `Ready` or `Not applicable`. If blockers exist, returns `400 Bad Request (ACTIVATION_GATED)` with specific actionable remediation instructions.

5. **Testing Mode & Suspension Enforcement in Telephony Gateway** ([`apps/server/src/telephony-router.ts`](file:///P:/crazy-ai-stack/vaani-si/apps/server/src/telephony-router.ts)):
   - **Testing Mode**: Blocks calls to arbitrary customer numbers; allows outbound calls only to explicitly whitelisted QA numbers (`whitelistedTestNumbers`).
   - **Suspended Mode**: Inbound/outbound calls immediately fail-closed with clear error status, preventing unauthorized calls or phantom charges.
   - **Draft / Incomplete Mode**: Prevents calling until onboarding is completed.

6. **Pilot Operations Dashboard** (`GET /api/pilot/operations`):
   - Aggregates real operational telemetry across an agency's client workspaces:
     - Workspaces count and distribution across activation states.
     - Confirmed call metrics (attempted, completed, answered, unanswered, busy, failed, interrupted) and metered duration directly from durable DB records.
     - SaaS subscription allowance and remaining minutes.
     - Live database and provider health status.
     - Recent configuration changes from the audit store.
     - Specific blockers per workspace.
     - Tenant-isolated (competitors see only their own data; unmeasured metrics are represented as `null` or `UNAVAILABLE`, never fabricated).

7. **Automated Launch Readiness Test Suite** ([`apps/server/src/__tests__/launch-readiness-pilot.test.ts`](file:///P:/crazy-ai-stack/vaani-si/apps/server/src/__tests__/launch-readiness-pilot.test.ts)):
   - 22 comprehensive automated tests verifying all onboarding, readiness checking, voice configuration, activation gating, role safety, and pilot dashboard features.

---

## 2. Existing Features Reused Without Modification

- **Fastify HTTP & WebSocket Server** (`apps/server`): Real-time routing, session cookies, CORS allowlist, and streaming audio WebSocket (`/ws/audio-stream`).
- **Authentication & RBAC** (`@vanni/auth`): Signed HMAC-SHA256 session cookies, multi-tenant membership checks, role permissions.
- **Durable Database Service** (`@vanni/database`): Multi-tenant storage for workspaces, organizations, doctor rosters, appointments, properties, call records, and audit logs.
- **Entitlement & Billing Engine** (`@vanni/billing`): Monthly voice minute allowances, plan limit checks, and subscription states.
- **Telephony & Call State Machine** (`@vanni/voice-engine`): Canonical call state transitions, Exotel CDR webhook verification, deduplication, and usage events.
- **Healthcare & Real Estate Engines** (`apps/server/src/routes/doctors.ts`, `appointments.ts`, `real-estate.ts`): Doctor shift management, dynamic slot generation, double-booking prevention, RERA property inventory, and site visit scheduling.

---

## 3. Onboarding & Activation Lifecycle

### Lifecycle State Machine:
```
[ DRAFT ] 
   │
   ▼
[ CONFIGURATION_INCOMPLETE ] ──(Profile & hours filled)──► [ READY_FOR_TESTING ]
                                                                 │
                                                    (Admin starts test mode)
                                                                 │
                                                                 ▼
                                                            [ TESTING ]
                                                          (Whitelisted calls only)
                                                                 │
                                                    (All 15 preflight checks pass)
                                                                 │
                                                                 ▼
                                                  [ READY_FOR_LIVE_ACTIVATION ]
                                                                 │
                                                    (Explicit Owner approval)
                                                                 │
                                                                 ▼
                                                            [ ACTIVE ]
                                                          (Live inbound & outbound)
                                                                 │
                                                       (Manual or auto pause)
                                                                 │
                                                                 ▼
                                                           [ SUSPENDED ]
                                                      (Calls blocked immediately)
```

### State Rules & Enforcement:
| State | Outbound Calling Allowed? | Inbound Calling Allowed? | Transition Requirements | Role Required |
| :--- | :--- | :--- | :--- | :--- |
| **DRAFT** | No | No | Initial creation state | — |
| **CONFIGURATION_INCOMPLETE** | No | No | Onboarding started | OWNER / ADMIN |
| **READY_FOR_TESTING** | No | No | Business profile and hours configured | OWNER / ADMIN |
| **TESTING** | **Whitelisted QA numbers only** | Simulated / Test only | Testing-mandatory checks passed | OWNER / ADMIN |
| **READY_FOR_LIVE_ACTIVATION** | No | No | **All 15 preflight readiness checks passed** | OWNER / ADMIN |
| **ACTIVE** | **Yes (Full live)** | **Yes (Full live)** | Live readiness passed + Explicit admin activation | OWNER / ADMIN |
| **SUSPENDED** | **No (Hard blocked)** | **No (Terminated)** | Operator pause / Non-payment / Clinic maintenance | OWNER / ADMIN |
| **FAILED** | No | No | Telephony / Provider fatal error | System |

---

## 4. Readiness Checks and Their Exact Behavior

The server evaluates workspaces across **15 discrete operational dimensions**:

| # | Check Dimension | Category | Evaluation Criteria | Possible Return States | Mandatory for Testing? | Mandatory for Live? |
| :- | :--- | :--- | :--- | :--- | :-: | :-: |
| 1 | **Workspace Tenancy** | `AUTH_TENANCY` | Workspace exists and belongs to active organization. | `Ready` / `Action required` | **Yes** | **Yes** |
| 2 | **Database Health** | `DATABASE` | Database health check (`globalDb.healthCheck()`) returns ok & acceptable latency. | `Ready` / `Connection failed` | **Yes** | **Yes** |
| 3 | **Business Profile** | `BUSINESS_PROFILE` | Name (≥2 chars), operating location, valid primary E.164 phone, operating hours. | `Ready` / `Configuration missing` | **Yes** | **Yes** |
| 4 | **Voice Provider** | `VOICE_PROVIDER` | Speaker is in certified supported voice list; checks `SARVAM_API_KEY`. | `Ready` / `Verification pending` / `Action required` | No | **Yes** |
| 5 | **Telephony Provider** | `TELEPHONY_PROVIDER` | Checks `EXOTEL_ACCOUNT_SID` and `EXOTEL_API_KEY` in production. | `Ready` / `Verification pending` / `Configuration missing` | No | **Yes** |
| 6 | **Webhook Signatures** | `WEBHOOKS` | Checks `EXOTEL_WEBHOOK_SECRET` for HMAC-SHA256 signature verification. | `Ready` / `Verification pending` / `Action required` | No | **Yes** |
| 7 | **Speech Services** | `SPEECH_SERVICES` | STT & TTS streaming pipeline adapter available. | `Ready` / `Action required` | **Yes** | **Yes** |
| 8 | **Language Model** | `LANGUAGE_MODEL` | Google Gemini Flash LLM configuration (`GEMINI_API_KEY`). | `Ready` / `Verification pending` / `Configuration missing` | No | **Yes** |
| 9 | **Approved Knowledge** | `KNOWLEDGE_FAQS` | At least 1 approved active FAQ or business fact configured. | `Ready` / `Action required` | No | **Yes** |
| 10 | **Industry Actions** | `INDUSTRY_ACTIONS` | Healthcare: ≥1 active doctor with shifts/fees; Real Estate: ≥1 property in inventory. | `Ready` / `Action required` | **Yes** | **Yes** |
| 11 | **Human Handoff** | `HUMAN_HANDOFF` | Valid emergency protocol (`108`) and escalation contact phone. | `Ready` / `Action required` | **Yes** | **Yes** |
| 12 | **Subscription Quota** | `SUBSCRIPTION_ENTITLEMENT` | Active subscription tier and available monthly voice minute quota. | `Ready` / `Action required` | **Yes** | **Yes** |
| 13 | **Call Logging** | `OBSERVABILITY_LOGGING` | Call records, transcripts, and usage event stores writable. | `Ready` / `Connection failed` | **Yes** | **Yes** |
| 14 | **Security Controls** | `DEPLOYMENT_SECURITY` | Session cookie HMAC security, CORS allowlist, and fail-closed controls. | `Ready` / `Action required` | **Yes** | **Yes** |
| 15 | **Pilot Safety Whitelist**| `PILOT_TEST_SAFETY` | Whitelisted QA test numbers configured when testing mode is enabled. | `Ready` / `Action required` | **Yes** | No |

---

## 5. Pilot Workflow & Operator Checklist

### Phase A: Setup & Business Verification
1. **Organization Creation**: Create Agency or Direct Business organization via `/api/agency/clients` or `/api/workspaces`.
2. **Business Details**: Enter verified business legal name, operating location (e.g. Ballari, Hubli), and primary customer care number.
3. **Operating Hours**: Specify weekly operating hours and break windows.
4. **Industry Selection**: Select `HEALTHCARE` (with clinic specialization) or `REAL_ESTATE` (with developer/brokerage specialization).

### Phase B: Agent & Knowledge Configuration
5. **Agent Identity**: Select certified voice speaker (e.g., `kavya` for Healthcare, `meera` for General, `pavithra` for Real Estate).
6. **Language & Dialect**: Set primary language (`kn-IN`, `kn-en`) and regional dialect (`KANNADA_STANDARD_POLITE`, `KANGLISH_BUSINESS`, etc.).
7. **Approved FAQs**: Add at least 1 verified business FAQ. Never include unverified claims.
8. **Clinical / Inventory Setup**:
   - Healthcare: Add at least 1 duty doctor with shift hours and consult fee.
   - Real Estate: Add at least 1 property with Karnataka RERA registration number and pricing.
9. **Emergency Protocol**: Confirm healthcare emergency contacts point to `108` / local casualty.

### Phase C: Preflight & Test Mode
10. **Run Preflight Readiness**: Query `GET /api/workspaces/:id/readiness`. Review and resolve any `Action required` or `Configuration missing` items.
11. **Whitelist Test Phone**: Add operator/tester phone number to `whitelistedTestNumbers`.
12. **Enter Testing Mode**: Transition workspace to `TESTING` via `POST /api/workspaces/:id/activation`.
13. **Dispatch Test Call**: Place outbound test call to the whitelisted QA phone; converse in Kannada/Kanglish; verify VAD barge-in, appointment/lead tool execution, and clean call completion.

### Phase D: Live Activation & Monitoring
14. **Live Activation Approval**: Verify that `canActivateLive === true`. Organization Owner clicks Live Activation (`POST /api/workspaces/:id/activation` with `targetStatus: ACTIVE`).
15. **First-Call Monitoring**: Monitor initial calls in Pilot Operations Dashboard (`GET /api/pilot/operations`). Confirm answered status, audio latency, confirmed duration, and metered usage.
16. **Immediate Rollback Procedure**: If call quality deteriorates or provider issues arise, execute immediate suspension via `POST /api/workspaces/:id/activation` with `targetStatus: SUSPENDED`. Calls fail-closed safely with polite notification.

---

## 6. Required Environment Variables (Names Only)

The platform strictly reads credentials from the server environment. Secret values are never logged, committed, or returned via API responses:

### Core Infrastructure:
- `PORT`
- `HOST`
- `NODE_ENV`
- `APP_URL`
- `SESSION_SECRET`

### Database (Supabase PostgreSQL):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

### Telephony (Exotel):
- `EXOTEL_ACCOUNT_SID`
- `EXOTEL_API_KEY`
- `EXOTEL_API_TOKEN`
- `EXOTEL_CALLER_ID`
- `EXOTEL_WEBHOOK_SECRET`

### Speech AI & Models (Sarvam & Gemini):
- `SARVAM_API_KEY`
- `GEMINI_API_KEY`
- `AZURE_SPEECH_KEY` (Optional fallback)
- `AZURE_SPEECH_REGION` (Optional fallback)

### Billing (Razorpay):
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

### Lead Integrations (Meta):
- `META_APP_SECRET`

---

## 7. External Account & Webhook Configuration Required for Live Pilot

1. **Exotel Telephony**:
   - Provision an Exotel Virtual Number (VN) mapped to Karnataka / Bangalore trunk (+91 80 / +91 8392).
   - Configure Exotel Inbound App URL pointing to `https://<your-domain>/api/telephony/inbound-webhook`.
   - Configure Exotel CDR Callback URL pointing to `https://<your-domain>/api/telephony/cdr`.
   - Whitelist the server public IP in Exotel API whitelist settings.
2. **Sarvam AI**:
   - Create production organization on Sarvam AI dashboard and fund account balance.
   - Configure `SARVAM_API_KEY` with streaming STT and Bulbul v3 TTS entitlements.
3. **Google Cloud / Gemini**:
   - Enable Generative Language API on Google Cloud console.
   - Provision `GEMINI_API_KEY` with quota for `gemini-2.5-flash` model.
4. **Razorpay Payments**:
   - Activate live Razorpay merchant account for India INR transactions.
   - Configure Webhook endpoint pointing to `https://<your-domain>/api/billing/webhooks/razorpay` subscribed to `subscription.charged` and `payment.captured`.
   - Set `RAZORPAY_WEBHOOK_SECRET`.

---

## 8. Known Defects, Limitations & Blockers

1. **Persistent WebSocket Hosting on Vercel**:
   - **Limitation**: Vercel Serverless Functions have execution timeouts (15–60 seconds) and do not support long-lived full-duplex TCP/WebSocket streaming connections (`/ws/audio-stream`).
   - **Remediation**: The Fastify server (`apps/server`) must be hosted on a persistent container service (e.g., Azure Container Apps, AWS ECS/Fargate, Google Cloud Run with WebSockets enabled, or a VPS/VM), while the Next.js marketing/management web app (`apps/web`) can deploy to Vercel.
2. **Single Telephony Trunk in Dev Environment**:
   - Without live Exotel credentials, outbound and inbound calls run against the verified internal simulator. Real cellular calls require an active Exotel carrier contract.
3. **Live Card Charges**:
   - All billing tests run against cryptographic HMAC webhook simulation. Live credit card/UPI transactions require active bank merchant approval.

---

## 9. Deployment Preparation

| Component | Target Deployment Environment | Runtime & Protocol Requirements |
| :--- | :--- | :--- |
| **Next.js Web Frontend** (`apps/web`) | Vercel or Cloudflare Pages | Node.js 20 / Edge runtime, HTTPS, Next.js 14+ |
| **Voice Gateway & API Server** (`apps/server`) | Docker Container / Azure Container Apps / AWS ECS | **Persistent Node.js 20 container**, 1 vCPU, 2GB RAM, HTTP/2, Persistent WebSockets (`/ws/audio-stream`) |
| **Database Tier** (`packages/database`) | Managed Supabase (AWS Mumbai / `ap-south-1`) | PostgreSQL 15+ with pgvector, RLS policies enabled |
| **Telephony Ingress** | Exotel SIP Trunk / Webhook Gateway | E.164 Indian mobile format (+91), HTTPS webhook callbacks with HMAC verification |
| **Audio Processing Pipeline** | Streaming PCM (16kHz, 16-bit Mono) | Low-jitter network connection to Sarvam & Gemini endpoints (<40ms RTT) |

---

## 10. Test Commands Executed & Exact Results

| Command | Working Directory | Result | Execution Time | Details |
| :--- | :--- | :---: | :---: | :--- |
| `npx vitest run apps/server/src/__tests__/launch-readiness-pilot.test.ts` | `P:\crazy-ai-stack\vaani-si` | **PASS** | 3.06s | **22 / 22 Tests Passed** |
| `npx vitest run apps/server/src/__tests__/e2e-integration-reliability.test.ts` | `P:\crazy-ai-stack\vaani-si` | **PASS** | 3.19s | **34 / 34 Tests Passed** |
| `npm test` | `P:\crazy-ai-stack\vaani-si` | **PASS** | 28.29s | **15 Test Files Passed, 198 / 198 Tests Passed (100% Green)** |
| `node scripts/typecheck-all.mjs` | `P:\crazy-ai-stack\vaani-si` | **PASS** | 18.50s | **All 22 Monorepo Workspaces Typecheck Clean** |

---

## 11. Simulated vs Real External Service Verification Matrix

| Subsystem | Real External Service Tested | Simulated / Controlled Test Harness | Scope & Rationale |
| :--- | :---: | :---: | :--- |
| **Database Persistence** | Local durable JSON & in-memory relational mock | Strict constraint assertions & simulated connection outage | Real Supabase connection requires live cloud provisioning. Concurrency double-booking and idempotency were tested with simultaneous `Promise.all()` transactions. |
| **Exotel Telephony** | Exotel SDK adapter & E.164 phone validator | Controlled CDR HTTP webhook fixtures with HMAC signatures | No real cellular phone calls placed (rule compliance). Verified signature verification, state machine transitions, confirmed duration computation, and duplicate webhook suppression. |
| **Sarvam Bulbul TTS** | Synthesis adapter and payload generation | Simulated streaming audio buffers and mocked WebSocket framing | Real audio synthesis requires active paid Sarvam API credits. Synthetic PCM test buffers validated protocol framing. |
| **Google Gemini LLM** | Prompt engineering & structured tool schemas | Deterministic conversation engine test responder | Natural language turn responses verified against regional dialect cases without incurring live billing costs. |
| **Razorpay Billing** | Webhook verification and signature logic | HMAC-SHA256 signed Razorpay subscription webhooks | Real bank charges prevented. Validated `subscription.charged` event processing, plan upgrades, and usage entitlement. |

---

## 12. Prioritized List of Remaining Work Before First Live Pilot

1. **Cloud Container Deployment of `apps/server`**: Deploy the Fastify server image to a persistent container host with WebSocket support and configure SSL termination.
2. **Supabase Migration Execution**: Apply database migrations (001–021) to the live Supabase PostgreSQL instance and verify schema tables.
3. **Exotel Account Provisioning & Virtual Number**: Purchase 1 dedicated Indian virtual number (+91 80 / +91 8392) in Exotel console and map webhook URLs to the production domain.
4. **Production API Keys**: Inject production values for `SARVAM_API_KEY`, `GEMINI_API_KEY`, `EXOTEL_API_KEY`, and `RAZORPAY_KEY_ID`.
5. **Controlled End-to-End Test Call**: Place 1 authorized test call to the operator's personal mobile phone in `TESTING` mode to verify audio clarity, barge-in response, and transcript logging before switching workspace to `ACTIVE`.
