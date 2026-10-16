# Dhwani SI — Full Repository Code Audit (line-by-line sweep)

**Date**: 2026-10-16
**Scope**: every folder — `packages/*` (20), `apps/*` (4), `scripts/`, `supabase/`, root config
**Total**: **41,129 LOC TypeScript** across **343 source files**, 16 SQL migrations

## Method & honest coverage statement

This audit has two layers, and I label which findings come from which:

1. **Mechanical scan of 100% of files** — LOC inventory, export/API map per package, and pattern
   detection for TODO/FIXME, stubs, placeholder/silent-mock, `as any`/`@ts-ignore`, empty catches,
   hardcoded secrets/phones, and test coverage per package.
2. **Full file reads of ~30 substantive logic files** — all auth, the conversation
   state-machine/context/memory/orchestrator surface, the knowledge ingestion+retrieval+SSRF path,
   the tool execution engine, the voice runtime/VAD/media-bridge/providers, the billing/Razorpay
   provider, the campaign and handoff engines, and the deployed server's services + route plugins.

I did **not** read all 41k lines. Package-listed findings below that I have not read in full are
marked **[scan]**; everything else is from a full read. Where I say "verified", I ran it.

---

## 1. Inventory — what exists, and how much of it is real

| Package / App | Files | LOC | Verdict |
| :--- | --: | --: | :--- |
| `apps/server` | 19 | 7,719 | The **deployed** API. Real routes + real auth, but mock-fallback services and 3 persistence mechanisms. |
| `packages/conversation-engine` | 21 | 3,423 | Strongest engineering. Orchestrator, 11-layer context, state machine — all real. |
| `packages/voice-engine` | 38 | 3,179 | Real streaming runtime + VAD + media bridge. **Not the path live calls take.** |
| `packages/providers` | 25 | 2,749 | Real Sarvam/Gemini/Exotel adapters + a parallel mock factory. |
| `packages/database` | 1 | 2,731 | **Entirely in-memory** (`Map`). The single biggest structural gap. |
| `packages/shared` | 1 | 2,264 | Zod schemas + DTOs. Solid; the source of truth for types. |
| `packages/knowledge-engine` | 19 | 2,119 | Real pipeline + good SSRF defense, but **mock embeddings by default**. |
| `apps/api` | 12 | 2,059 | A **second, hardened API** (11 routes) that is **never deployed**. |
| `packages/tool-engine` | 7 | 2,032 | Real, well-built execution boundary. Best-defended module. |
| `packages/auth` | 7 | 1,315 | Good crypto; **critical seeded-credential backdoor**. |
| `packages/ui` | 14 | 1,304 | Token/component stubs (string-template HTML). |
| `packages/observability` | 8 | 1,244 | Monitoring exists but is **never fed**. |
| `packages/agent-core` | 6 | 1,242 | Compiler/validate/simulate — real. |
| `packages/provider-sdk` | 22 | 1,147 | Interface contracts + **7 stale committed `.js` files**. |
| `apps/web` | 5 | 1,025 | Static HTML generator (not Next.js). |
| `packages/core` | 7 | 1,006 | Domain types + prompt engine. |
| `packages/handoff-engine` | 6 | 887 | Real, well-designed — and **not wired into any app**. |
| `packages/billing` | 6 | 857 | Real Razorpay adapter with a **fail-open signature check**. |
| `packages/crm` | 5 | 740 | Real lead/contact/qualification services. |
| `packages/campaign-engine` | 5 | 685 | Real scheduler — **not wired**, and it fabricates outcomes. |
| `packages/industry-templates` | 1 | 683 | Static data. |
| `apps/voice-gateway` | 3 | 514 | Real streaming gateway (**dead session/vad files**). |
| `packages/context-engine` | 1 | 86 | Superseded duplicate of conversation-engine's context engine. |

### Dead / unwired subsystems (verified by import graph)
- **`packages/campaign-engine` — not instantiated anywhere in `apps/`.** Outbound campaigns are non-functional.
- **`packages/handoff-engine` — not instantiated anywhere in `apps/`.** Human handoff runs through `conversation-engine`'s separate `HandoffManager` instead.
- **`@vanni/billing` — not imported by any app.** Billing routes use their own logic.
- **`apps/voice-gateway/src/session/realtime-session.ts`** and **`vad/vad-arbiter.ts`** — self-referenced only.
- **`globalLatencyMonitor` / `recordLatency`** — never called by any runtime path.
- **`apps/api`** — a full hardened API that the deploy path does not run.

---

## 2. Consolidated defect list

### CRITICAL

| ID | Finding | Evidence |
| :--- | :--- | :--- |
| **C1** | **Seeded credential backdoor.** `IdentityService` unconditionally seeds 4 users — including `admin@vanni.ai` — with the hardcoded password `Password@123`, and makes that admin **OWNER of all three demo orgs**. There is no `NODE_ENV` guard. Anyone who knows the default password becomes owner of every tenant in production. | [identity-service.ts](packages/auth/src/identity-service.ts) `seedDefaultTenants()` |
| **C2** | **Payment webhook verification fails open.** `verifyWebhookSignature` returns `true` when `RAZORPAY_WEBHOOK_SECRET` is unset ("Skip verification in development"), and `verifyPaymentSignature` does the same without `RAZORPAY_KEY_SECRET`. Deployed without those secrets, any forged `payment.captured` / `subscription.charged` payload is accepted → free plan upgrades. | [razorpay-provider.ts](packages/billing/src/razorpay-provider.ts) |
| **C3** | *(fixed this session)* Unauthenticated OWNER session minting via `POST /api/auth/switch-org`. | [server.ts](apps/server/src/server.ts) |
| **C4** | *(fixed this session)* All 23 handlers had `if (session)`-guarded checks + `x-organization-id` / client `organizationId` tenant trust. | [server.ts](apps/server/src/server.ts) |
| **C5** | *(fixed this session)* Meta lead webhook accepted unsigned payloads → unauthenticated outbound call dispatch (toll fraud). | [server.ts](apps/server/src/server.ts) |
| **C6** | *(fixed this session)* Vertical route plugins `agency.ts` / `doctors.ts` / `plots.ts` **re-implemented the same insecure context** (`?tenantId` + `usr-dev-system` fallback). My first P0 pass covered only `server.ts` — this completes it. | [agency.ts](apps/server/src/routes/agency.ts), [doctors.ts](apps/server/src/routes/doctors.ts), [plots.ts](apps/server/src/routes/plots.ts), new [http-auth.ts](apps/server/src/http-auth.ts) |

### HIGH

| ID | Finding | Evidence |
| :--- | :--- | :--- |
| **H1** | **Campaign engine fabricates call outcomes.** After dispatch it hardcodes `status='ANSWERED'`, `telephonyOutcome='ANSWERED'`, `businessOutcome='LEAD_QUALIFIED'`, `durationSeconds=120` without waiting for a real call. Outbound reporting would be fiction. | [campaign-engine/engine.ts](packages/campaign-engine/src/engine.ts) `processNextJob` |
| **H2** | **Compliance guards are hardcoded open.** Eligibility is always evaluated with `isAgentActive: true, hasActiveCall: false, activeCampaignCallsCount: 0` — so the DND check, TRAI calling-window, and per-tenant concurrency limit cannot actually block. | same file, `enrollTarget` + `processNextJob` |
| **H3** | **Silent fake success on missing credentials.** `TelephonyRouter.dispatchOutboundCall` returns `success:true` with a `MOCK_EXO_*` id; `WhatsAppLeadService.dispatchLead` returns `success:true` with `SIM_WA_*`; Sarvam TTS failures are swallowed in the live pipeline. Production would report success for calls/messages that never happened. | [telephony-router.ts](apps/server/src/telephony-router.ts), [whatsapp-lead-service.ts](apps/server/src/whatsapp-lead-service.ts), [audio-pipeline.ts](apps/server/src/audio-pipeline.ts) |
| **H4** | **Four competing persistence mechanisms.** (1) in-memory `globalDb` `Map`; (2) file-backed `data/calls.json`; (3) `apps/api` routes each instantiating their own `new InMemoryDatabaseService()`; (4) an unused Supabase client. Data written by one path is invisible to the others. | [database/index.ts](packages/database/src/index.ts), [db-service.ts](apps/server/src/db-service.ts), `apps/api/src/routes/{calls,leads}.ts` |
| **H5** | **RAG runs on mock embeddings by default.** `globalEmbeddingProvider = new MockMultilingualEmbeddingProvider()` — the "384-dim dense vector similarity" in retrieval is meaningless unless a real provider is swapped in, and nothing does. | [knowledge-engine/embeddings/index.ts](packages/knowledge-engine/src/embeddings/index.ts) |
| **H6** | **Invariant 5 violated in the real dispatch path.** `WhatsAppLeadService.dispatchLead` takes no idempotency key at all, so the `call_session_id`-based dedup required by AGENTS.md is not enforced where leads actually go out. | [whatsapp-lead-service.ts](apps/server/src/whatsapp-lead-service.ts) |
| **H7** | **Verification is largely decorative.** 19 of 23 packages have **zero** tests; the "5 Immutable Invariants" suite asserts test-local literals; `lint` fails (no eslint) and `test:coverage` fails (5.47% vs 70%). | repo-wide scan |

### MEDIUM

| ID | Finding | Evidence |
| :--- | :--- | :--- |
| **M1** | File-backed call store does a **full read + full rewrite per operation** with no locking → lost updates under concurrent calls; writes to `process.cwd()`, which is ephemeral/read-only on Azure App Service. | [db-service.ts](apps/server/src/db-service.ts) |
| **M2** | `cosineSimilarity` is a bare dot product with no normalization, silently assuming unit vectors. Scores are wrong for any non-normalized embedder. | [retrieval-engine.ts](packages/knowledge-engine/src/retrieval/retrieval-engine.ts) |
| **M3** | `login()` sets `activeOrganizationId: ''` for a membership-less user; `deserializeSession` rejects empty-org sessions, so the user silently gets an unusable session instead of a clear error. | [identity-service.ts](packages/auth/src/identity-service.ts) |
| **M4** | Context layer L3 injects the raw `organizationId` **UUID** as the model's "Business" instead of the business name. | [context-engine.ts](packages/conversation-engine/src/context/context-engine.ts) |
| **M5** | `ArgumentNormalizer.normalizeCurrency` is a **no-op** (trims only) despite its doc block promising ₹/lakh/crore normalization. | [tool-engine/normalizer.ts](packages/tool-engine/src/normalizer.ts) |
| **M6** | Demo tenant mapping (`real_estate`/`hospital`/`agency` ↔ hardcoded UUIDs) is baked into production data access. | [db-service.ts](apps/server/src/db-service.ts) `getAllCalls` |
| **M7** | `PromptEngine` hardcodes real-estate claims (RERA, DC conversion, 80% SBI loan, Sunday cab) and the persona "Sahana" into **every** tenant's prompt; the "750ms rule" is a prompt instruction, not a latency mechanism. | [prompt-engine.ts](packages/core/src/conversation/prompt-engine.ts) |
| **M8** | Razorpay signature comparisons use `===` (non-constant-time). Auth/session code correctly uses `timingSafeEqual` — inconsistent. | [razorpay-provider.ts](packages/billing/src/razorpay-provider.ts) |
| **M9** | SSRF validator is genuinely good (protocol/port allowlist, RFC1918 + metadata IPs, IPv6, CGNAT), but re-validation on **redirect** and DNS-rebinding (TOCTOU) are not enforced in the fetch loop. | [ssrf-validator.ts](packages/knowledge-engine/src/website/ssrf-validator.ts) |
| **M10** | 123 `as any` casts (0 `@ts-ignore`); 7 stale committed `.js` files beside their `.ts` sources. | repo-wide scan |

---

## 3. What is missing (gaps)

1. **No real persistence layer.** Supabase/Postgres is provisioned and 16 migrations exist, but no runtime SQL path. No `pg`/`supabase-js` in the core app; `DATABASE_URL` is only read by an env validator. → No durability, no RLS, no cross-instance state.
2. **No streaming anywhere in the voice loop** (STT/LLM/TTS are all full-buffer HTTP). The 750ms invariant is unreachable by construction.
3. **No voice-token mint endpoint** — `createVoiceAccessToken` exists but is never called, so production WebSocket voice auth cannot be satisfied.
4. **Outbound campaigns and human handoff are unwired** (`campaign-engine`, `handoff-engine` not instantiated).
5. **Billing engine unwired** (`@vanni/billing` unused by apps).
6. **No notification transports** (email provider is a mock; WhatsApp/telephony fall back to console simulation).
7. **No rate limiting or security headers on the deployed `apps/server`** (present only in the undeployed `apps/api`).
8. **No front-end authentication wiring** — the dashboard is static HTML with relative `/api/*` calls and no session handling.
9. **No DB migration runner** — migrations are files with no apply mechanism.
10. **No observability wiring** — health exists; latency monitor is never fed.

---

## 4. Suggestions, in priority order

**P0 — security (do first)**
1. Remove the seeded default-password accounts, or gate them behind an explicit `SEED_DEMO_DATA=true` that is refused in production. *(C1)*
2. Make Razorpay verification **fail closed** and use `timingSafeEqual`. *(C2, M8)*
3. Make every adapter that currently fakes success **fail loudly** instead (telephony, WhatsApp, TTS, embeddings). *(H3)*

**P1 — make it a product**
4. Implement one Postgres/Supabase repository behind `IDatabaseService`; apply the 16 migrations; delete the file-backed store; keep RLS using the modern `auth.jwt()` pattern. *(H4, M1, gap 1)*
5. Wire the streaming `VoiceRuntime` as *the* telephony path and retire the buffered pipeline. *(gap 2)*
6. Add a voice-token mint endpoint and share `VOICE_TOKEN_SECRET` across services. *(gap 3)*
7. Wire `campaign-engine` + `handoff-engine` into the app, and remove the fabricated outcomes / hardcoded eligibility inputs. *(H1, H2, gap 4)*
8. Swap `MockEmbedding` for a real provider before any retrieval claim. *(H5)*
9. Replace the unfalsifiable invariant suite with behavioral tests; fix `lint`; raise coverage honestly. *(H7)*

**P2 — hygiene**
10. Delete dead code (`realtime-session.ts`, `vad-arbiter.ts`, `context-engine` duplicate, stale `.js`, unwired packages' entry points) or wire it.
11. Consolidate the **three** server entrypoints into one deployed API.
12. Fix M3–M6 (empty-org session, L3 identity, currency no-op, demo mapping in prod path).
13. Escape dashboard interpolations (stored XSS) and add the missing idempotency key to lead dispatch. *(H6)*

---

## 5. Fixed during this sweep

| Fix | Files |
| :--- | :--- |
| Centralized session→tenant resolver (no client `tenantId`, no dev fallback) | new [http-auth.ts](apps/server/src/http-auth.ts) |
| Vertical route plugins hardened (`agency`, `doctors`, `plots`) | 3 route files |
| Falsifiable assertion added for the vertical routes | [tenant-isolation.test.ts](apps/server/src/__tests__/tenant-isolation.test.ts) |

**Verified after the fix**: `npm run typecheck` → 22/22 clean; `npm test` → 5 files / **44 tests pass**.

**Not fixed** (reported only): C1, C2, H1–H7, M1–M10, and every gap in §3.
