# Dhwani SI — Senior Voice-Engineering Audit

**Date**: 2026-10-16
**Auditor role**: Senior Voice Engineer / SaaS Architect
**Scope**: Every folder, end-to-end (apps/, packages/, supabase/, scripts/, docs/, web layer)
**Method**: Static read of runtime code + execution of the real verification gates + live attack against a running server.

---

## 0. Verdict (read this first)

Dhwani SI is an **impressively broad scaffold** — 22 TypeScript projects, 16 SQL migrations, ~30k LOC, a real streaming voice engine, a real knowledge engine, a real auth package. It typechecks cleanly and builds cleanly.

But it is **not a functioning multi-tenant voice product yet**, and several of the AGENTS.md "5 Immutable Invariants" are **asserted in tests that cannot fail** rather than enforced in code. Three defects are **production-critical**:

1. **The deployed server has a total authentication bypass** (`POST /api/auth/switch-org` mints an OWNER session for any tenant with no credentials — proven live).
2. **Multi-tenant air-gap isolation (Invariant 4) does not exist at runtime.** The app runs entirely on an in-memory `Map` singleton; the Supabase/RLS layer is never connected.
3. **The real-time path violates Invariant 1 by construction** — the live telephony pipeline buffers full sentences and does full-buffer STT/TTS round trips. The genuinely-streaming engine exists in a *different app* that the telephony webhook does not point to.

---

## 1. Ground-truth verification (commands actually run)

| Gate | Command | Result |
| :--- | :--- | :--- |
| Typecheck | `npm run typecheck` | ✅ **PASS** — 22/22 projects clean |
| Build | `npm run build` | ✅ **PASS** (exit 0; regenerates 14 web pages) |
| Unit tests | `npm test` (vitest) | ✅ **PASS** — 4 files, 32 tests |
| Lint | `npm run lint` | ❌ **FAIL** — `eslint` is not installed and there is no eslint config |
| Coverage | `npm run test:coverage` | ❌ **FAIL** — lines **5.47%**, statements 5.47%, functions 43.78%, branches 52.94% vs. 70% threshold |
| Invariants | `npm run test:invariants` | ⚠️ **PASS but meaningless** (see §3) |
| Live auth probe | `curl` against `apps/server` on :4055 | 🔴 see §2 |

**Consequence**: `typecheck` and `build` CI jobs are green, but the `lint` and `test` CI jobs in [.github/workflows/ci.yml](.github/workflows/ci.yml) are **red on a clean checkout**. The `docker` job builds `./apps/server` + `./apps/voice-gateway`; the `deploy-*` jobs are `echo` placeholders.

---

## 2. Critical security findings (proven against the running server)

Started `apps/server` with `PORT=4055` and probed it unauthenticated.

### SEC-1 — Unauthenticated privilege escalation / session minting 🔴 CRITICAL
`POST /api/auth/switch-org` fabricates a full session — including `activeRole: "OWNER"` — for any `organizationId` when no session exists, then sets it as a signed cookie (`apps/server/src/server.ts`, the `1.5` handler).

```
$ curl -X POST .../api/auth/switch-org -d '{"organizationId":"a0000000-...-0002"}'
{"success":true,"session":{... "activeOrganizationId":"a0000000-...-0002","activeRole":"OWNER" ...}}
```
Any anonymous caller becomes OWNER of any tenant. This directly breaks Invariant 4.

### SEC-2 — Wildcard CORS with credentials 🔴 CRITICAL
`apps/server` registers `cors({ origin: true, credentials: true })` → the server reflects **any** `Origin` and allows credentials.
```
$ curl -i .../api/organization -H 'Origin: https://evil.example'
access-control-allow-origin: https://evil.example
access-control-allow-credentials: true
```
Combined with cookie auth, any third-party page can read authenticated API responses (CSRF-with-read / account takeover).

### SEC-3 — Unauthenticated outbound calling (toll fraud) 🔴 CRITICAL
`POST /api/webhooks/meta-lead` triggers `telephony.dispatchOutboundCall()` immediately. Signature verification is **conditional**: it only runs when `META_APP_SECRET` is set **and** a signature header is present. With no secret configured (the default), verification is skipped entirely:
```
$ curl -X POST '.../api/webhooks/meta-lead?tenant=real_estate' -d '{"phone":"+919999999999","name":"Attacker"}'
{"success":true,"action":"SPEED_TO_LEAD_DISPATCHED","callId":"MOCK_EXO_..."}
```
In production with a live Exotel trunk this is free telephony abuse and a fabricated call record is written with a synthetic transcript.

### SEC-4 — Tenant spoofing via client-supplied identifiers 🟠 HIGH
Throughout `apps/server/src/server.ts`, tenant scope is resolved as
`session?.activeOrganizationId || request.headers['x-organization-id'] || <hardcoded org>` and the membership check is **guarded by `if (session)`** — so it is skipped entirely for anonymous callers. Proven:
```
$ curl .../api/organization -H 'x-organization-id: a0000000-...-0002'
{"organization":{"id":"a0000000-...-0002", ...}}   # 200, no auth
```

### SEC-5 — Stored DOM XSS in operator dashboard 🟠 HIGH
[apps/web/app-dashboard.html](apps/web/app-dashboard.html) renders backend fields into `tr.innerHTML` templates without escaping (`${callerName}`, `${item.caller}`, intent/outcome). The lead webhook stores an **attacker-controlled `name`** as `caller`. A crafted lead name injects script into every operator's authenticated dashboard.

### SEC-6 — Service-role key + client-tenant filter in plots API 🟠 HIGH
[apps/server/src/routes/plots.ts](apps/server/src/routes/plots.ts) uses `SUPABASE_SERVICE_ROLE_KEY` (which **bypasses RLS**) and filters only with `.eq('tenant_id', tenantId)` where `tenantId` comes from the query string / body. Full cross-tenant read when a DB is attached.

*Positive note*: [packages/auth/src/session.ts](packages/auth/src/session.ts) is genuinely well-built — HMAC-SHA256 signed tokens, `timingSafeEqual`, and a hard production failure on missing/weak `COOKIE_SECRET`. The problem is the handlers that bypass it.

---

## 3. The "5 Immutable Invariants" are theatre

[packages/core/src/__tests__/invariants.test.ts](packages/core/src/__tests__/invariants.test.ts) is green but does not test the product.

| Invariant | What the test actually does | Real enforcement |
| :--- | :--- | :--- |
| **1. 750ms** | Calls the pipeline with a **text override** (STT skipped → `sttMs = 0`), the LLM is mocked, and on TTS failure the code **hardcodes `ttsMs = 120`**. Asserts the manufactured sum ≤ 750. | None. No real STT/TTS/network latency is measured. With a live `SARVAM_API_KEY` in CI, the real TTS call would likely **fail** the same assertion. |
| **2. Barge-in <50ms** | `expect(bargeInDetected \|\| detectionLatency).toBeDefined()` — the number is always defined, so it can never fail. The flush test is literally `expect(true).toBe(true) // Placeholder`. | Partial, and only in the *unused* gateway path. |
| **3. Kanglish** | `expect(kanglishLoanwords).toContain('site')` — asserts a **hardcoded array contains its own element**. No code under test. | Terminology manager exists; not exercised here. |
| **4. Air-gap isolation** | Uses `InMemoryDatabaseService` (a fresh Map) — never touches RLS, SQL, or the deployed server. | ❌ Broken at runtime (§2, §4). |
| **5. Idempotent webhooks** | Constructs `lead-${callSessionId}` **inside the test** and asserts the string it just built. | Real dedup exists in the tool-engine/orchestrator, but not on the Meta/telephony webhook path (§2 SEC-3). |

An invariant suite that cannot fail is worse than no suite: it manufactures confidence and it gates CI (`test-invariants` job).

---

## 4. Architecture reality vs. the AGENTS.md 7 layers

AGENTS.md's directory topology (`apps/server`, `apps/web`, `packages/core`, `packages/voice-engine`) is a small subset of reality. Actual: **2 backends + 1 gateway + 1 frontend app + 20 packages**, with **duplicate/competing implementations** of the same layer.

| Layer (spec) | Spec claim | Reality |
| :--- | :--- | :--- |
| **L2 Persistence** | "PostgreSQL / Supabase RLS" | 🔴 **Fiction at runtime.** [`globalDb = new InMemoryDatabaseService()`](packages/database/src/index.ts) — every entity is a `Map`. No `pg`/`supabase-js` is imported by the app (only `plots.ts` + `scripts/test-production.ts`). All state is lost on restart; `data/calls.json` is an empty array. The 16 migrations + RLS live in `supabase/` and are never applied. |
| **L2 RLS** | "tenant isolation via RLS" | Migrations enable RLS on an **older schema** (`tenants`, `agents`, `knowledge_bases`…) and a `current_setting('request.jwt.claim.tenant_id')` helper — a legacy pattern — while later migrations (003–016) introduce a different schema (`organizations`, `ai_employees`, …). Schema drift + no runtime connection. |
| **L3 Engine** | "Conversation State Machine" | Two parallel engines: a solid [ConversationOrchestrator](packages/conversation-engine/src/orchestrator/conversation-orchestrator.ts) (idempotency, concurrency lock, handoff) **and** the actual live brain in [apps/server/src/llm-service.ts](apps/server/src/llm-service.ts). |
| **L4 Voice Adapters** | "Streaming STT / Streaming TTS" | 🔴 **Not streaming.** `SarvamSaarasSTTProvider.transcribe` and `SarvamBulbulTTSProvider.synthesize` are single blocking full-buffer HTTP POSTs; STT always returns `isFinal: true`. |
| **L5 Gateway** | "Fastify + WebSocket, barge-in ≤50ms" | The good streaming `VoiceRuntime` (VAD + jitter buffer + `AbortController` barge-in) lives in **`apps/voice-gateway`** on `/ws/voice-stream`. The **deployed** telephony path is `apps/server` `/ws/audio-stream` → the buffered `AudioConversationPipeline`. |
| **L6 Portal** | "Next.js 15, Linear-grade dark UX" | 🔴 **No Next.js.** Static `.html` files generated by `build-all-pages.mjs`, served via `fs.readFileSync`. There is a stray `apps/web/app/app/page.tsx` and README stubs, but no Next runtime, no `next` dependency. |
| **L7 Observability** | "Latency/QoS monitoring" | 🔴 `globalLatencyMonitor` / `recordLatency` are **never called** by any runtime path — dead code. The WS server emits a `LATENCY` frame, but nothing records it, so no invariant violation can ever be detected. |

### Duplicate / dead code inventory
- **Three server entrypoints**: `apps/server` (deployed), `apps/api` (hardened — but *not* in docker-compose/CI deploy), `scripts/test-production.ts`.
- **Dead code**: `apps/voice-gateway/src/session/realtime-session.ts`, `apps/voice-gateway/src/vad/vad-arbiter.ts` (only self-referenced); `packages/observability` latency monitor.
- **Split-brain DB**: `apps/api/src/routes/{calls,leads}.ts` used their own `new InMemoryDatabaseService()` (the repo's own `system-audit.md` AUD-04 documented this).

### The hardening went into the wrong app
[docs/production/system-audit.md](docs/production/system-audit.md) (2026-10-05) already lists AUD-01…AUD-10 — client `tenantId` trust, wildcard CORS, no rate limiting, in-memory split-brain, no secrets validation. The fix (allowlist CORS, rate limiting, security headers, PII redaction) was applied in **`apps/api`**, while **`apps/server` — the artifact docker-compose builds and names `api-server` — still has every one of those defects.** Meanwhile [docs/production/readiness-scorecard.md](docs/production/readiness-scorecard.md) declares all ten domains "READY / None", listing "no client `tenantId` trust" and "CORS allowlist" as verified controls. **That scorecard is contradicted by the live server.**

---

## 5. Layer 4/5 — voice engineering deep dive

### 5.1 The live pipeline is structurally non-streaming 🔴
[apps/server/src/audio-pipeline.ts](apps/server/src/audio-pipeline.ts) `processUserUtterance`:
1. waits for a **280ms silence timer**, then concatenates the whole audio buffer;
2. `await sarvam.transcribeSpeech(fullAudio)` — full-buffer STT round trip;
3. `await llm.generateTurn(...)` — waits for the complete response (no token streaming);
4. `await sarvam.synthesizeSpeech(normalizedSpeech)` — one full-sentence TTS blob;
5. emits one `AUDIO_CHUNK`.

AGENTS.md Invariant 1 states: *"Every layer must stream chunks. Never buffer full sentences before synthesizing audio."* The live path does exactly the forbidden thing at every layer. A realistic floor is ≥ 280ms (turn detection) + 250–500ms (STT upload/return) + TTFT+generation + 300–800ms (TTS) ≈ **1.1–2.0s**, i.e. 1.5–2.7× the 750ms ceiling — before network jitter.

### 5.2 Barge-in has a dead window; caller audio is silently dropped 🟠
In `pushAudioChunk`: `isAgentSpeaking` is set **only after TTS completes**, while `isProcessingTurn` is `true` for the whole STT→LLM→TTS window. During that window the handler hits `if (this.isProcessingTurn) return;` and **discards caller audio** — the exact moment a caller is most likely to interrupt. Because `isAgentSpeaking` is false and `isProcessingTurn` is true, no barge-in is detected and nothing is buffered.

### 5.3 Stale-audio accumulation 🟠
When the silence timer fires while a turn is already processing, `processUserUtterance` returns without clearing `this.audioBuffer` (only the `rawTextOverride`/empty branches clear it). Leftover chunks are concatenated into the *next* utterance.

### 5.4 Latency accounting is cosmetically deflated 🟡
On TTS failure the code sets `ttsMs = 120` and still reports a latency breakdown — manufacturing compliant numbers instead of surfacing the failure. `vadMs` is measured as `Date.now() - lastChunkAt` at timer fire, i.e. it silently includes the 280ms turn-detection delay.

### 5.5 The real streaming engine is unplugged 🟡
[packages/voice-engine/src/runtime/voice-runtime.ts](packages/voice-engine/src/runtime/voice-runtime.ts) is genuinely good: normalization → jitter buffer → `EnergyVAD` → `TurnDetector` → streaming STT session → segmenter → `StreamingTTSManager`, with a clean `AbortController` barge-in that cancels TTS **and** the in-flight turn. `VoiceSession` even distinguishes `TRANSCRIPT_PARTIAL` from committed text. **But** it only runs in `apps/voice-gateway`, and the telephony webhook (`callbackUrl` in the Meta handler, and `telephony-router.ts` `wss://.../ws/audio-stream`) points at the **legacy** `apps/server`. The good path is not the path calls take.

### 5.6 Provider reality
- `saaras:v3` and `bulbul:v3` are **valid current Sarvam model IDs** (verified against Sarvam docs — Bulbul v3 is the API default). ✅ No bug here, but `.env.example` and AGENTS.md say "Bulbul v2" — documentation drift.
- `SarvamSaarasSTTProvider.transcribe` is a **mock-shaped interface**: `isFinal: true` always, hardcoded `durationMs: 1500`. Any consumer that believes it is streaming is misled.
- `apps/voice-gateway` correctly **fails loudly** when `mock=false` but keys are missing — good pattern, and worth copying to `apps/server`.

---

## 6. Layer 3 — conversational intelligence

- **The default "AI brain" is a ~600-line regex script.** `LLMConversationalService` defaults to `preferredEngine = 'heuristic'` when no key/URL is set, and the Gemini/OpenAI/local paths are all **non-streaming** `generateContent`/`chat/completions` calls. `generateSimulatedKanglishResponse` hardcodes Ballari plots, Apollo doctors, ₹18L/₹35L prices, and scripted replies. It also hardcodes a **single tenant's facts**, which cannot generalize across the tenant base and creates a healthcare-claim exposure.
- The **orchestrator** is the strongest piece of engineering in the repo (idempotent `processedEventIds`, `isProcessing` concurrency lock, emergency/human-request pre-checks, handoff persistence). It is, however, bypassed by the live `apps/server` LLM path.
- `IndustryPolicyGuard` `evaluatePolicy` is substring matching on `JSON.stringify(args)` — trivially bypassable (`disguise("prescribe")`), and `'--'` will false-positive on legitimate text. Fine as a backstop, not as a compliance control.

---

## 7. Repository hygiene

- **Test surface is tiny and mis-split.** vitest only picks up `**/__tests__/**/*.test.ts` + `**/*.spec.ts`. The many `packages/*/test-*.mjs` and `scratch/*.mjs` scripts (including a ~460-line multi-tenancy script the scorecard likely counts) are **not run by CI**.
- **Committed artifacts**: `apps/api/dist/`, `apps/server/dist/`, `tsconfig.tsbuildinfo`, and top-level `data/` + `apps/server/data/calls.json` are tracked but ignored by `.gitignore` patterns — inconsistent.
- `apps/web/*.html` are generated by `generator.mjs`/`build-all-pages.mjs` and committed; hand-editing them will be overwritten by `npm run build`.
- **No eslint** despite a `lint` script and a CI lint job.
- Redis and Postgres are provisioned in `docker-compose.yml` but nothing connects to them.

---

## 8. Prioritized remediation

**P0 — before any real call is answered**
1. Delete the anonymous session fabrication in `/api/auth/switch-org`; require a real session and route through `switchActiveOrganization`.
2. Replace `cors({ origin: true, credentials: true })` on `apps/server` with the explicit allowlist already written in `apps/api`, and add security headers.
3. Make webhook signatures **mandatory** (fail closed when the secret is absent) on `/api/webhooks/meta-lead` and `/api/webhooks/telephony`.
4. Make tenant scope derive **only** from the authenticated session; remove all `if (session)`-guarded checks and `x-organization-id` fallbacks.

**P1 — make it a product, not a demo**
5. Point telephony at the **streaming** `VoiceRuntime` (retire `AudioConversationPipeline`, or port its escalation hooks into the runtime) so Invariant 1 is architecturally satisfiable.
6. Replace `globalDb` with a real Postgres repository and actually apply migrations 001–016 with RLS using the modern `auth.jwt()` pattern; delete the unused legacy RLS migration.
7. Rewrite the invariant suite to assert **observable behavior** (real streaming chunk boundaries, abort-on-barge-in effect, cross-tenant 403s, duplicate-webhook replay). Wire `globalLatencyMonitor` into the live path so the 750ms ceiling is measured, alerted, and visible.
8. Fix `npm run lint` (install + configure eslint) and fix or lower coverage so CI is honest.

**P2 — hardening**
9. Escape all dashboard interpolations (or move to a real component framework); sanitize the Meta lead `name`.
10. Deduplicate to one backend entrypoint; delete `realtime-session.ts`/`vad-arbiter.ts`/latency monitor if unused, or wire them.
11. Make the streaming STT/TTS providers actually stream (SSE/WebSocket) and stop returning `isFinal: true` unconditionally.
12. Reconcile the three "status" documents with reality; the readiness scorecard in its current form is a liability.

---

## 9. What is genuinely strong (keep it)

- `packages/auth/src/session.ts` — signed sessions, timing-safe compare, fail-closed secret handling.
- `packages/conversation-engine/src/orchestrator/conversation-orchestrator.ts` — idempotency + concurrency discipline.
- `packages/voice-engine/src/runtime/voice-runtime.ts` + `EnergyVAD`/`TurnDetector` — a correct streaming/realtime skeleton.
- `packages/knowledge-engine/src/website/ssrf-validator.ts` — real SSRF defenses.
- `apps/voice-gateway` — allowlisted CORS, token-scoped auth, fail-loud provider gating, call-duration + idle watchdogs.
- `scripts/typecheck-all.mjs` — a genuinely useful per-project typecheck harness.

The skeleton is good. The wiring, the enforcement, and the honesty of the verification are where the work is.

---

## 10. Remediation log — P0 security (implemented 2026-10-16)

All P0 findings from §2 were fixed in `apps/server/src/server.ts`, and each fix is
now covered by a **falsifiable** test in
[apps/server/src/__tests__/tenant-isolation.test.ts](../../apps/server/src/__tests__/tenant-isolation.test.ts).

| Finding | Fix | Pre-fix (live) | Post-fix (live + test) |
| :--- | :--- | :--- | :--- |
| SEC-1 anonymous session mint | `/api/auth/switch-org` now requires a session and routes through `switchActiveOrganization` (no fabricated session, no auto-granted membership) | `200` + OWNER session | `401`, no session |
| SEC-2 wildcard CORS | Explicit `ALLOWED_ORIGINS` allowlist; credentials retained only for allowlisted origins | `ACAO: https://evil.example` | disallowed origin rejected; allowlisted origin OK |
| SEC-3 unsigned webhook | Meta webhook now **fails closed** (`503`) when `META_APP_SECRET` is absent/unsigned; constant-time compare; explicit non-prod opt-in only | `SPEED_TO_LEAD_DISPATCHED` | `503 WEBHOOK_NOT_CONFIGURED` |
| SEC-4 tenant spoofing | Removed every `if (session)`-guarded check and the `x-organization-id` trust path; added unconditional `requireUser` + membership enforcement | header returned another org | `401` anonymous, `403` cross-tenant |
| SEC-5 leftover hardcoded scope | `/api/calls` benchmark bypass and the unauthenticated read path removed | unauthenticated cross-tenant read | `401` anonymous, `403` cross-tenant |
| (also) dev auth fallback | `getEffectiveOrgAndUserId` no longer returns a synthetic `usr-dev-system` session | unauthenticated in non-prod | `401` always |

Supporting changes:
- Centralized Fastify error handler maps `AuthError.statusCode` to clean JSON (no stack leakage).
- `.env.example` documents `META_APP_SECRET` (required), `META_VERIFY_TOKEN`, and the
  non-production-only `META_WEBHOOK_ALLOW_UNSIGNED` escape hatch.

**Verification** (post-fix): `npm run typecheck` 22/22 clean · `npm test` 5 files / 43 tests pass
(11 new security tests) · live re-attack on `:4055` reproduced the pre-fix results in the
"Pre-fix" column and the hardened results in the "Post-fix" column.

**Known consequence (intended):** the unauthenticated "demo" browser dashboard will now
receive `401`s for tenant-scoped APIs. The front-end must sign in (or a scoped demo
account must be used) before it can load real data. Front-end auth wiring is the next task.

**Still open from §3/§8 (not yet addressed):** the streaming rewrite (P1), the real
Postgres/RLS persistence layer (P1), the unfalsifiable 750ms/barge-in/Kanglish invariant
tests (P1), and the failing `lint` / `test:coverage` CI gates (P1).
