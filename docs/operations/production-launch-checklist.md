# VANNI Production Launch & Operations Checklist

This checklist must be systematically completed and signed off prior to activating commercial customer traffic on the **VANNI** platform.

---

## 1. Infrastructure & Core Services

- [ ] **Node.js Runtime**: Production environments pinned to Node.js v20 LTS.
- [ ] **High Availability**: API Gateway deployed across at least 2 availability zones with auto-scaling.
- [ ] **WebSockets / Voice Gateway**: Persistent connection handling configured with sticky sessions or Redis pub/sub routing.
- [ ] **Database High Availability**: Primary PostgreSQL with automated read-replicas, point-in-time recovery (PITR), and 30-day snapshot retention.
- [ ] **DNS & SSL**: TLS 1.3 enforced across all public endpoints (`api.vanni.ai`, `voice.vanni.ai`, `app.vanni.ai`).

---

## 2. Authentication & Security Guardrails

- [ ] **JWT Key Rotation**: Production `JWT_SECRET` generated with at least 256 bits of entropy.
- [ ] **Tenant Isolation (RLS)**: Row-Level Security confirmed active across all database tables. All queries assert `organization_id`.
- [ ] **Webhook Signatures**: Exotel, Twilio, and Razorpay webhooks enforce cryptographic HMAC-SHA256 signature verification.
- [ ] **Redaction & PII**: Sensitive customer inputs (phone numbers, OTPs, medical history) masked in server logs.
- [ ] **Zero Hallucination Guardrail**: Healthcare and real estate policy filters configured in `STRICT_BLOCK` mode.

---

## 3. Telephony & Audio Providers

- [ ] **Carrier Routing**: Primary (Exotel) and secondary fallback (Twilio) telephony carriers active with pre-purchased DIDs.
- [ ] **STT Engine**: Sarvam AI Kannada/English STT API keys active with adequate concurrent stream quotas.
- [ ] **TTS Engine**: Low-latency neural voice synthesis validated with natural prosody.
- [ ] **Jitter Buffers**: Inbound/outbound audio jitter buffers calibrated to 80ms–120ms for smooth packet playback.

---

## 4. Business Brain & Tool Safety

- [ ] **Operating Hours Synchronization**: Clinic and office hours mapped with timezone awareness (`Asia/Kolkata`).
- [ ] **Appointment Tool Validation**: `create_appointment` tool enforces `confirmationMode: 'EXPLICIT'`. No booking is committed without user verbal confirmation.
- [ ] **Human Handoff Fallbacks**: If front-desk live transfer fails or times out (15s), system reliably creates a high-priority callback ticket and informs caller.

---

## 5. Billing, Metering & Entitlements

- [ ] **Pre-Flight Quota Check**: Inbound calls check monthly voice minute allowance before call acceptance.
- [ ] **Active Call Protection**: Ongoing voice calls are never disconnected mid-sentence due to delayed billing webhooks or background metering jobs.
- [ ] **Razorpay Webhooks**: Invoice generation and automated plan subscription upgrades validated.

---

## 6. Observability, Alerting & Audit Logging

- [ ] **Correlation IDs**: End-to-end `x-correlation-id` passed through telephony $\to$ voice session $\to$ conversation $\to$ tool $\to$ CRM.
- [ ] **Error Budgets & Alerts**: PagerDuty / Slack alerts configured for:
  - Error rate $> 1\%$ over 5 minutes.
  - Telephony bridge failure $> 0.5\%$.
  - End-to-end voice latency $> 800\text{ms}$.
- [ ] **Audit Trail**: All administrative config changes and AI employee publications logged with actor ID and timestamp.
