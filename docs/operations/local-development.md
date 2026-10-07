# VANNI Local Development & Environment Guide

This guide describes how to run and test the complete **VANNI** multi-tenant conversational AI platform locally.

---

## 1. Prerequisites

- **Node.js**: v18+ or v20+ LTS
- **Package Manager**: `npm` v9+
- **TypeScript**: v5+
- **Database / Backend**: Built-in in-memory / Supabase Postgres provider
- **OS**: Windows, macOS, or Linux

---

## 2. Monorepo Structure

```
vaani-si/
├── apps/
│   ├── api/                   # Fastify multi-tenant REST API & Webhook Gateway (:4000)
│   ├── voice-gateway/         # WebSocket Real-Time Voice Engine & Call Gateway (:4001)
│   └── web/                   # Next.js 14 Web Portal & Live Voice Testing Console (:3000)
├── packages/
│   ├── database/              # Multi-tenant DB repositories, seeds & RLS enforcement
│   ├── auth/                  # JWT auth, tenant isolation & RBAC
│   ├── business-brain/        # Business facts, services, hours, policies snapshot
│   ├── ai-employee/           # Agent builder, versioning & capability permissions
│   ├── conversation/          # Orchestrator, context budget & turn management
│   ├── kannada-intelligence/  # Kannada/Kanglish code-switching, script normalization
│   ├── provider-adapters/     # LLM, STT, TTS, and Telephony multi-vendor adapters
│   ├── voice-engine/          # Audio streaming, turn detection & jitter buffers
│   ├── telephony/             # Call routing, webhook signature & session states
│   ├── tool-engine/           # Secure tool execution & booking validation
│   ├── crm/                   # Contacts, leads, activity timelines & qualification
│   ├── handoff/               # Front-desk live transfer & callback escalation
│   ├── analytics/             # Usage tracking, latency metrics & aggregations
│   ├── billing/               # Plan entitlements, meter usage & invoice engine
│   └── observability/         # Correlation IDs, audit logger & health checkers
```

---

## 3. Environment Variables Configuration

Create a `.env` file in the root directory:

```env
NODE_ENV=development
PORT=4000
VOICE_GATEWAY_PORT=4001
WEB_PORT=3000

# Authentication
JWT_SECRET=vanni_dev_super_secret_jwt_key_2026

# Supabase (Optional for local memory mode)
SUPABASE_URL=https://mock.supabase.co
SUPABASE_SERVICE_ROLE_KEY=mock-key

# Provider Credentials (Optional: System runs seamlessly on high-fidelity mocks if empty)
SARVAM_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
EXOTEL_API_KEY=
EXOTEL_API_TOKEN=
EXOTEL_SUB_ACCOUNT=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

---

## 4. Setup & Build

Install dependencies and build all packages:

```bash
# In repository root
npm install

# Build all shared packages
npm run build --prefix packages/database
npm run build --prefix packages/auth
npm run build --prefix packages/business-brain
npm run build --prefix packages/ai-employee
npm run build --prefix packages/conversation
npm run build --prefix packages/kannada-intelligence
npm run build --prefix packages/provider-adapters
npm run build --prefix packages/voice-engine
npm run build --prefix packages/telephony
npm run build --prefix packages/tool-engine
npm run build --prefix packages/crm
npm run build --prefix packages/handoff
npm run build --prefix packages/analytics
npm run build --prefix packages/billing
npm run build --prefix packages/observability
```

---

## 5. Seeded Reference Organizations

The local database seed includes three enterprise test organizations:

1. **Ballari Palm Meadows** (`a0000000-0000-0000-0000-000000000001`):
   - Industry: `REAL_ESTATE`
   - AI Employee: `Sahana` (`emp-org1-1`) — Layout Sales & Sunday Site Visit Booking.
2. **Apollo Specialty Clinic** (`a0000000-0000-0000-0000-000000000002`):
   - Industry: `HEALTHCARE`
   - AI Employee: `Ananya` (`emp-org2-1`) — OPD Doctor Appointments & Emergency Casualty Routing.
3. **Sri Krishna Dental & Implant Clinic** (`a0000000-0000-0000-0000-000000000003`):
   - Industry: `DENTAL` (Reference MVP Clinic)
   - AI Employee: `Kavya` (`emp-org3-1`) — Front Desk AI Receptionist, Teeth Scaling & RCT scheduling.

---

## 6. Running Test Suites

Run the regression and verification test suites:

```bash
# Run End-to-End MVP Golden Path Integration Test (35 steps A-to-AJ)
node packages/observability/test-e2e-mvp.mjs

# Run Hardening, Reliability & Security Verification
node packages/observability/test-hardening.mjs

# Run Billing, Plans & Quota Verification
node packages/observability/test-billing.mjs

# Run Analytics & Metering Verification
node packages/observability/test-analytics.mjs
```

---

## 7. Starting Local Servers

```bash
# Start API Gateway (Port 4000)
npm run dev --prefix apps/api

# Start Real-Time Voice Gateway (Port 4001)
npm run dev --prefix apps/voice-gateway

# Start Web Portal (Port 3000)
npm run dev --prefix apps/web
```

Navigate to `http://localhost:3000` to interact with the platform UI, browse the AI Receptionist console, and launch the in-browser WebRTC audio test harness.
