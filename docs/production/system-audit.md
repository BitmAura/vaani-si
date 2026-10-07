# VANNI Full System Production Audit

**Date**: 2026-10-05  
**Auditor**: VANNI Principal System Architect  
**Status**: Comprehensive Baseline Review Across Apps, Packages, Runtimes & Infrastructure

---

## 1. Executive Summary

VANNI has established an exceptionally comprehensive modular architecture across 19 implementation modules:
- Multi-tenancy, Auth & RBAC
- Business Brain & Industry Templates
- Knowledge Ingestion, Chunking & SSRF-Hardened Crawling
- AI Employee / Agent Builder & Versioning
- Conversation Engine with Kannada/Kanglish code-switching
- Telephony Inbound Routing (Exotel/Twilio) & Real-time WebRTC/WebSocket Voice Engine
- Action & Tool Execution Engine with Confirmation Gates & CRM Integration
- Outbound Campaigns with DND/TRAI calling window checks
- Human Handoff with SLA escalation
- Analytics, Usage Metering & Cost Tracking
- Billing, Plans, Subscriptions & Razorpay gateway adapters

However, a strict production-readiness inspection reveals several critical and high-severity security, reliability, and isolation gaps that must be systematically resolved before real customer onboarding.

---

## 2. Findings Matrix

| ID | Category | Severity | Component | Finding Description | Production Impact |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **AUD-01** | **Tenant Isolation** | **CRITICAL** | `apps/api` | REST routes in `calls.ts` and `leads.ts` accept `tenantId` from client query params instead of resolving tenant from authenticated session header. | Cross-tenant data leakage if unauthenticated caller supplies arbitrary `tenantId`. |
| **AUD-02** | **CORS & Headers** | **CRITICAL** | `apps/api`, `voice-gateway` | CORS configured with `origin: '*'` on stateful and authenticated endpoints. Missing security headers (CSP, HSTS, X-Frame-Options). | Clickjacking, CSRF vulnerability, cross-site token interception. |
| **AUD-03** | **Rate Limiting** | **HIGH** | `apps/api`, `voice-gateway` | No centralized rate limiting on public endpoints, login attempts, webhook receivers, or voice WebSocket creation. | Denial of Service (DoS), brute force attacks, runaway provider billing. |
| **AUD-04** | **Database Instance Isolation** | **HIGH** | `apps/api` | `calls.ts` and `leads.ts` instantiate local `new InMemoryDatabaseService()` instead of binding to shared global database singleton or verified DB repository. | In-memory split-brain where calls/leads saved via API are invisible to analytics or billing engine. |
| **AUD-05** | **Input Validation** | **HIGH** | `apps/api` | API routes lack rigorous Zod schema parsing before database writes, allowing arbitrary JSON payloads. | Malformed database records, type coercion errors, injection vectors. |
| **AUD-06** | **Voice Session Cleanup** | **HIGH** | `apps/voice-gateway` | WebSocket disconnect handler cleans up active session, but lacks explicit maximum idle timeout or connection timeout watchdog. | Potential zombie sessions holding memory if client drops abruptly without TCP close handshake. |
| **AUD-07** | **Log Redaction & PII** | **MEDIUM** | Logging across services | Fastify loggers log raw incoming payload objects without centralized PII redaction (phone numbers, customer names, health notes). | Logging sensitive customer identifiers in server console/log streams. |
| **AUD-08** | **Environment Secrets Check** | **HIGH** | API & Server initialization | Servers start up without asserting required environment variables or validating secret formats. | Silent fallback to mock providers in environments intended for staging or production. |
| **AUD-09** | **Error Sanitization** | **MEDIUM** | API routes | Internal error messages can leak stack traces or provider error details to client responses. | Internal system information disclosure to untrusted clients. |
| **AUD-10** | **Centralized Permission Guard** | **MEDIUM** | `packages/auth` | Role checks are manually written across handlers; missing a unified Fastify authorization preHandler hook. | Inconsistent RBAC enforcement across new or modified endpoints. |

---

## 3. Architecture Strengths

1. **Strict Runtime / Billing Separation**: The real-time voice loop and conversation orchestrator are completely independent of Razorpay or payment provider availability. Provider outages never freeze active voice streams.
2. **SSRF Hardened Knowledge Ingestion**: `packages/knowledge-engine/src/website/ssrf-validator.ts` provides robust IP blocklisting (rejecting `127.0.0.1`, RFC 1918 private IPs, AWS/GCP metadata endpoints `169.254.169.254`).
3. **Tool Safety & Confirmation Gates**: The tool engine separates low-risk queries from high-risk mutations (e.g. appointment cancellations), enforcing explicit human confirmation before executing side effects.
4. **TRAI / Regional Calling Window Compliance**: The outbound campaign engine enforces Indian telecom regulations (9 AM - 9 PM IST calling window, DND opt-out checks).
5. **Idempotent Webhooks & Transactions**: Razorpay webhooks and telephony event callbacks use deduplication keys preventing double-charging or duplicate event persistence.

---

## 4. Remediation Plan

1. **Create Unified Centralized Authorization Middleware**: Enforce authenticated tenant session resolution, preventing client-supplied `tenantId` spoofing.
2. **Implement Production Fastify Security Plugins**:
   - Explicit CORS allowlist (rejecting wildcards on credentials/session paths).
   - `@fastify/rate-limit` with tiered quotas (auth, public, voice, billing, webhooks).
   - `@fastify/helmet` or secure headers (CSP, HSTS, frameguard).
3. **Unify Database State**: Bind all API controllers to `@vanni/database` singleton (`globalDb`).
4. **Implement Zod Request Validators**: Validate all route inputs before handler execution.
5. **Implement Centralized PII Redactor & Structured Logger**: Redact phone numbers, emails, passwords, and API tokens.
6. **Voice Session Heartbeat & Watchdog Timeout**: Enforce connection, idle, and maximum call duration timeouts.
7. **Production Environment & Secrets Validator**: Build startup assertion script validating environment invariants.
