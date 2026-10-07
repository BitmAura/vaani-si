# VANNI Staging Environment & Verification Guide

This guide establishes staging environment conventions and isolation rules for validating **VANNI** release candidates prior to production rollout.

---

## 1. Principles of Staging Isolation

To ensure complete production fidelity without risk of real-world side effects:

1. **Test Telephony & Virtual DIDs**: Staging uses sandbox Exotel/Twilio DIDs configured with webhook signing keys distinct from production. Outbound test calls must be routed solely to whitelisted testing phone numbers.
2. **Sandbox Payment Gateways**: Uses Razorpay Test Mode keys (`rzp_test_...`). No actual bank accounts or UPI VPA transfers are executed.
3. **Synthetic Tenant Data**: Staging databases must never import production PII or actual call transcripts from live clients. Staging uses the seeded multi-industry datasets (`REAL_ESTATE`, `HEALTHCARE`, `DENTAL`).
4. **Mock Fallback Providers**: When provider sandbox quotas are depleted, staging switches automatically to in-memory provider mocks (`MockLLMAdapter`, `MockSTTAdapter`, `MockTTSAdapter`, `MockTelephonyProvider`).

---

## 2. Staging Infrastructure Checklist

| Component | Staging Provider / Spec | Verification Criteria |
| :--- | :--- | :--- |
| **Compute / API** | Container instance / ECS / Cloud Run (Port 4000) | Health endpoint `GET /health` returns `200 OK` |
| **Voice Gateway** | WebSocket server with SSL (Port 4001) | Low-latency audio stream under 250ms |
| **Web Console** | Next.js 14 deployed on Vercel / Docker (Port 3000) | Auth, onboarding, and dashboard accessible |
| **PostgreSQL** | Supabase Staging Project / RDS PostgreSQL | RLS enabled, all migrations applied |
| **Storage** | S3 / Supabase Storage (Staging bucket) | Knowledge documents and call audio recordings stored |
| **Redis** | ElastiCache / Redis Cloud Staging | Real-time session locks and rate limits active |

---

## 3. Staging Smoke Test Verification Sequence

Before promoting any release candidate build from Staging to Production:

1. **Health Verification**:
   ```bash
   curl -s -f http://staging.vanni.ai:4000/health | jq .
   ```
2. **Deterministic Golden Path Execution**:
   ```bash
   node packages/observability/test-e2e-mvp.mjs
   ```
3. **Quota & Billing Over-Limit Check**:
   ```bash
   node packages/observability/test-billing.mjs
   ```
4. **Kannada Language Intelligence Stress Test**:
   - Verify Kanglish phoneme mapping for colloquial terms (`yelli`, `hege`, `appointment beku`).
   - Confirm language switching does not break mid-call context.
