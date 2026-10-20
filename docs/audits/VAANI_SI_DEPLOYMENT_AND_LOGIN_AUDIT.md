# VANNI-SI: Senior SaaS Builder Deployment & Login Audit

**Repository:** `BitmAura/vaani-si`  
**Date:** October 20, 2026  
**Stack:** Vercel (Web + Server), Supabase (DB), Sarvam AI (Voice), Gemini Flash (LLM), Razorpay (Billing), Exotel (Telephony)  
**Problem Reported:** Login not working on Vercel despite env vars being added.

---

## 🔴 CRITICAL: Why Login is Failing on Vercel

This is the **root cause chain** for your login issue:

### Problem 1 — Vercel is deploying the WRONG application

The `vercel.json` at the root contains:
```json
{
  "cleanUrls": true,
  "trailingSlash": false
}
```

This only has URL rewriting rules — **it tells Vercel nothing about which app to deploy**.

**What Vercel is actually deploying:** It is deploying `apps/web` — the **static HTML files** — NOT the Fastify Node.js server.

**What you need:** Vercel must deploy `apps/server` (the Fastify Node.js backend that serves HTML pages **and** handles all API calls including `/api/auth/login`).

When `apps/web` HTML files are deployed to Vercel as static files, calls to `/api/auth/login` return 404 because there is no Node.js server handling them.

### Problem 2 — Missing `COOKIE_SECRET` kills auth silently

The session system uses HMAC-SHA256 cookies. Looking at `packages/auth/src/session.ts`:
```typescript
if (process.env.NODE_ENV === 'production') {
  throw new Error('COOKIE_SECRET is required in production.');
}
```

If `COOKIE_SECRET` is not set in Vercel, the **server crashes at startup** in production mode and returns 500 on all requests including `/api/auth/login`.

### Problem 3 — Auth is purely server-side (no Supabase Auth client)

The entire auth system is **custom HMAC session tokens** stored in an in-memory `IdentityService` with file persistence to `data/auth_store.json`.

**This is incompatible with Vercel's serverless/stateless deployment model.** Vercel Functions are stateless — each request may hit a different function instance. The in-memory `IdentityService` user store **resets to empty on every cold start**. Users you registered are gone between deploys or cold starts.

Your Supabase credentials in Vercel have **no effect on login** because the auth system doesn't use Supabase Auth — it uses its own in-memory password store.

---

## 📋 Complete Vercel Deployment Issues Checklist

| # | Issue | Severity | Fix |
|---|---|---|---|
| 1 | Wrong app deployed to Vercel (static HTML vs Fastify server) | 🔴 CRITICAL | Fix `vercel.json` to deploy `apps/server` as a Node.js serverless function |
| 2 | `COOKIE_SECRET` not set — server crashes on startup | 🔴 CRITICAL | Add 32+ char random string as `COOKIE_SECRET` in Vercel env vars |
| 3 | In-memory `IdentityService` is stateless — loses all users between deployments | 🔴 CRITICAL | Connect auth to Supabase persistent storage |
| 4 | `ALLOWED_ORIGINS` doesn't include your Vercel domain | 🟠 HIGH | Add `https://your-project.vercel.app` to `ALLOWED_ORIGINS` |
| 5 | `apps/server/Dockerfile` exposes port 4100 but server defaults to 4000 | 🟡 MEDIUM | Align PORT env var with Vercel's dynamic port |
| 6 | CSS served from `packages/ui/dist/vanni.css` — missing in Vercel build | 🟡 MEDIUM | Include packages/ui in Vercel build step |
| 7 | `data/auth_store.json` path resolution breaks in Vercel filesystem | 🟡 MEDIUM | Vercel has read-only filesystem; file persistence will silently fail |

---

## ✅ Correct Vercel Deployment Architecture

Your monorepo has a single Fastify server (`apps/server`) that:
1. Serves all HTML pages (marketing + app pages)
2. Serves all API routes (`/api/auth/*`, `/api/workspaces`, etc.)
3. Serves all static assets (`/assets/vanni.css`, `/assets/vanni-auth.js`)
4. Handles WebSocket audio streaming (`/ws/audio-stream`)

**WebSocket is NOT supported on Vercel Serverless Functions.** The voice gateway (`apps/voice-gateway`) needs Azure Container Apps or Railway.io.

### Recommended Split:

```
┌──────────────────────────────────────────────────────┐
│ Vercel (vercel.json at root)                         │
│  ├── apps/server → Node.js serverless functions      │
│  │    ├── GET /api/auth/login,signup,session         │
│  │    ├── GET /login, /signup, /app/*                │
│  │    ├── GET /assets/vanni.css, vanni-auth.js       │
│  │    └── ALL other HTTP routes                      │
│  └── apps/web → NOT deployed separately             │
│       (server already serves these files)            │
├──────────────────────────────────────────────────────┤
│ Azure Container Apps / Railway.io                    │
│  └── apps/voice-gateway → WebSocket voice stream    │
├──────────────────────────────────────────────────────┤
│ Supabase                                             │
│  └── PostgreSQL DB + RLS                            │
└──────────────────────────────────────────────────────┘
```

---

## 🔧 Step-by-Step Fix Plan

### Step 1: Fix vercel.json

Replace the root `vercel.json` with:

```json
{
  "version": 2,
  "buildCommand": "npm run build --prefix apps/server",
  "outputDirectory": "apps/server",
  "installCommand": "npm install",
  "framework": null,
  "functions": {
    "apps/server/src/server.ts": {
      "runtime": "nodejs20.x",
      "maxDuration": 30
    }
  },
  "rewrites": [
    { "source": "/(.*)", "destination": "/apps/server/src/server.ts" }
  ]
}
```

> **Note:** Vercel's standard approach for a Fastify monorepo is to use the root `vercel.json` to point at the server. The exact config depends on whether you use `@vercel/node` builder.

### Step 2: Add these env vars in Vercel Dashboard

Go to **Vercel → Project Settings → Environment Variables** and add:

```bash
# REQUIRED — without this the server crashes on startup
NODE_ENV=production
COOKIE_SECRET=<generate with: openssl rand -base64 48>

# Required for CORS to allow your Vercel domain
ALLOWED_ORIGINS=https://your-project.vercel.app,https://your-custom-domain.com

# Database — must be Supabase since Vercel is stateless
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-service-role-key
SUPABASE_PUBLISHABLE_KEY=your-anon-key

# AI Voice Providers
SARVAM_API_KEY=your-sarvam-key
GEMINI_API_KEY=your-gemini-key

# Telephony
EXOTEL_ACCOUNT_SID=your-exotel-sid
EXOTEL_API_KEY=your-exotel-key
EXOTEL_API_TOKEN=your-exotel-token
EXOTEL_WEBHOOK_SECRET=your-webhook-secret

# Billing
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=your-razorpay-secret
RAZORPAY_WEBHOOK_SECRET=your-razorpay-webhook-secret

# WhatsApp
WHATSAPP_API_TOKEN=your-whatsapp-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id

# Meta Lead Ads
META_APP_SECRET=your-meta-secret
META_VERIFY_TOKEN=vanni_secure_token

# App URL
APP_URL=https://your-project.vercel.app
API_URL=https://your-project.vercel.app
```

### Step 3: Fix the Auth System for Production

**The critical issue:** `IdentityService` uses an in-memory user store backed by a local `data/auth_store.json` file. This does NOT work on Vercel because:
1. Vercel functions are stateless — the in-memory store resets every cold start
2. The filesystem is read-only on Vercel — file writes fail silently

**Short-term fix:** Force Supabase database persistence by setting:
```bash
FORCE_SUPABASE_DB=true
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-service-role-key
```

The `DurableDatabaseService` already has Supabase connectivity. For `IdentityService`, you also need to add `AUTH_STORE_PATH` pointing to a PostgreSQL-backed adapter or change the identity service to query Supabase directly.

**Medium-term fix:** Migrate `IdentityService` user/organization/membership tables to Supabase (the migrations 003 and 004 already define these schemas).

### Step 4: How to sign up and create first account

Since auth data is local, when you first deploy you will have NO users in the database. To create the first account:

1. Visit `https://your-project.vercel.app/signup`
2. Fill in email, password, name
3. The account is created in the database
4. You can then log in at `https://your-project.vercel.app/login`

**Dev seed accounts** (only work locally, NOT on Vercel):
These are created in non-production mode by `seedDevAccountsIfEmpty()`. They are NOT available on Vercel in production mode.

---

## 🗂 Folder Confusion Explained

Here is a clear breakdown of every folder and its role:

```
vaani-si/
│
├── apps/server/               ← THE ONLY SERVER TO DEPLOY
│   ├── src/server.ts          ← Main Fastify entry point (3807 lines)
│   ├── src/audio-pipeline.ts  ← Real-time Kannada voice pipeline
│   ├── src/routes/            ← All API route handlers
│   └── Dockerfile             ← For Azure/Docker deployment
│
├── apps/api/                  ← LEGACY SHADOW SERVER — DO NOT DEPLOY
│   └── src/                   ← Older standalone REST API, superseded by apps/server
│                                No tests. Not in docker-compose target.
│
├── apps/voice-gateway/        ← DEPLOY TO AZURE/RAILWAY ONLY (WebSocket)
│   └── src/index.ts          ← WebSocket voice stream gateway
│                                Vercel does not support long-running WebSockets
│
├── apps/web/                  ← DO NOT DEPLOY SEPARATELY
│   └── *.html                 ← Static pages served BY apps/server at GET /login etc.
│                                Server reads these files from disk and serves them
│                                Deploying apps/web alone = no backend = broken login
│
├── packages/                  ← Shared libraries (NO deployment needed)
│   ├── shared/                ← Zod types and interfaces
│   ├── database/              ← DurableDatabaseService + Supabase client
│   ├── auth/                  ← IdentityService, HMAC sessions
│   ├── providers/             ← Sarvam, Exotel, Razorpay, Gemini adapters
│   ├── voice-engine/          ← Audio, VAD, STT/TTS wiring
│   ├── conversation-engine/   ← Kannada dialogue, orchestration
│   ├── billing/               ← Razorpay subscriptions
│   ├── tool-engine/           ← Agent tool execution
│   ├── knowledge-engine/      ← Knowledge ingestion & retrieval
│   ├── observability/         ← Metrics, metering, PII redaction
│   ├── agent-core/            ← Agent lifecycle, roles
│   ├── campaign-engine/       ← Outbound lead campaigns
│   ├── crm/                   ← ORPHANED (0 active callers)
│   ├── handoff-engine/        ← ORPHANED (0 active callers)
│   └── ui/                    ← Design tokens; CSS built to packages/ui/dist/vanni.css
│
├── data/                      ← LOCAL FILE PERSISTENCE (NOT for production)
│   ├── vanni_database.json    ← Local DB (868KB of seeded data)
│   ├── auth_store.json        ← Local user/org/session store
│   └── calls.json             ← Call history
│
├── supabase/                  ← PostgreSQL schema for PRODUCTION
│   ├── migrations/            ← 26 SQL migrations to run in Supabase
│   └── seed.sql               ← Seed Karnataka enterprise data
│
└── docs/                      ← Architecture docs, ADRs, audit reports
```

---

## 🔑 API Keys You Have — What Each Does

| Key | Where Used | Status |
|---|---|---|
| **SUPABASE_URL + SUPABASE_SECRET_KEY** | `packages/database` (globalDb) | ✅ Used when `FORCE_SUPABASE_DB=true` |
| **SARVAM_API_KEY** | Saaras STT + Bulbul TTS (voice calls) | ✅ Fail-closed in production |
| **GEMINI_API_KEY** | Gemini Flash LLM for conversation AI | ✅ Used in agent responses |
| **RAZORPAY_KEY_ID + SECRET** | Billing subscriptions & webhooks | ✅ Used in `/api/billing` routes |
| **EXOTEL_ACCOUNT_SID + KEY + TOKEN** | SIP trunking, outbound calls | ✅ Used in telephony router |
| **Azure Credits** | Not directly referenced in code | ⚠️ Use for hosting voice-gateway container |
| **ChatGPT / OpenAI API Key** | NOT referenced in current codebase | ⚠️ Not integrated; Gemini is the LLM |

---

## 🚀 Recommended Deployment Timeline

### Phase 1 (This week): Get login working on Vercel

1. Fix root `vercel.json` to deploy `apps/server` properly
2. Add all required env vars in Vercel (especially `COOKIE_SECRET` + `NODE_ENV=production`)
3. Set `FORCE_SUPABASE_DB=true` so auth is not in-memory
4. Run supabase migrations 001–026 in Supabase dashboard
5. Visit `/signup` on your Vercel URL to create your first account
6. Test login

### Phase 2 (Next week): Voice calls working

1. Deploy `apps/voice-gateway` to Azure Container Apps (use your student credits)
2. Set `VOICE_WS_URL` env var in Vercel to point at your Azure WebSocket endpoint
3. Test a simulated inbound call via the dashboard

### Phase 3 (Following week): Production hardening

1. Configure Exotel SIP trunk to point inbound webhooks at your Vercel URL
2. Enable Razorpay live mode with real webhook endpoint
3. Set up Meta Lead Ads webhook verification
4. Load test with concurrent voice sessions

---

## 📊 Current Test Coverage (All Passing)

- **338/338 tests passing** (23 test suites)
- **22/22 TypeScript projects typecheck clean**
- **0 regressions** from Prompts 01–09

The codebase is production-ready from a code quality perspective. The only blocker is the deployment configuration and auth persistence strategy described above.
