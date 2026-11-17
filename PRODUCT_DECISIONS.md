# VANNI product decisions (locked)

One product. Two engines. One login. Menu follows payment.

## Plans
- FREE: Home, Billing, Settings. No fake calls, invoices, or gateway-online.
- VOICE_STARTER (4999): Home, AI employee, Calls, Leads, Appointments, industry ops, Knowledge. No AI search. No Meta campaigns.
- VOICE_GROWTH (14999): Starter + Campaigns. No AI search.
- GEO (9999): Home, Knowledge, AI search, Billing, Settings. No dialer.
- BUNDLE (19999): Voice Growth + AI search.

## Industry
- HEALTHCARE / DENTAL: Doctors roster. Persona Kavya.
- REAL_ESTATE: Plots + site visits. Persona Aditya.
- AGENCY: Clients hub. Persona Priya.
- Never show the other vertical's nav.

## Honesty rules
- No sample call rows when API returns empty.
- No invoice rows without Razorpay.
- Gateway pill = No phone line / Phone line not connected until Exotel is real.
- GEO score and Armed stay blank/off until shield is paid + live.
- Slug only after confirmed Razorpay HMAC (`/api/geo/:slug/activate`).
- WhatsApp status = PENDING when Meta API keys missing (never fake DELIVERED).
- Escalation copy = staff will call back (no live Exotel transfer claim yet).
- Medical 108 path only for healthcare industries.

## UI
- Marketing + console stay light/white. No dark navy product panels.
- Do not drop React UI kits from crazy-ai-stack into vanilla HTML; borrow clarity only.
- Human feel = voice fillers and barge-in, not landing-page animation theater.
- Marketing HTML: edit `build-all-pages.mjs` (+ `generator.mjs`), then `node apps/web/build-all-pages.mjs`.

## Launch order
1. Razorpay live + GEO onboard for first clinic.
2. One Kavya call for Punarvaas.
3. Bundle sell.

## Code-complete as of 2026-11-05 (evening)

### Security / honesty (done)
- `POST /api/voice/turn` + `GET /api/handoffs` require session + org membership.
- GEO kill-switch requires session or `x-vanni-kill-switch` / `GEO_KILL_SWITCH_SECRET`; cannot set `subscriptionStatus`.
- Unpaid GEO audit/status/extract hide embed slug.
- `POST /api/geo/:slug/checkout` creates Razorpay order when keys exist; otherwise honest lead-capture.
- Homepage claim modal opens Razorpay Checkout or “slug still locked” — never fake activate.
- Contact form posts to `POST /api/contact` (logged inquiry; optional founder WhatsApp).
- Footer Privacy / Terms / Telemetry → `/security#privacy|terms|telemetry`.
- Bundle stale ₹21,999 → ₹19,999 on campaigns/new.
- Console WhatsApp slip defaults to PENDING.

### Still needs your secrets (cannot finish in code)
1. `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` (`rzp_live_*`) on Vercel + local `.env`, then redeploy.
2. Optional: `GEO_KILL_SWITCH_SECRET` for agency kill-switch automation.
3. Local already has `SARVAM_API_KEY`. Still need `EXOTEL_*` + `GEMINI_API_KEY` for first live Kavya call.
4. Deploy voice-gateway: `railway login` then from repo root `railway up -y` (see `railway.toml`). Register Meta webhook URL after.
5. Optional: `FOUNDER_WHATSAPP` so `/api/contact` and GEO lead-capture ping you on WhatsApp.

### Founder check
```bash
curl http://127.0.0.1:4000/api/launch/readiness
```
Live snapshot 2026-11-05: Sarvam ✅ · Razorpay ❌ · Exotel ❌ · Gemini ❌ · WhatsApp ❌

### Verify commands
```bash
npx vitest run apps/server/src/__tests__/geo-engine-entitlements.test.ts
npx tsc --noEmit -p apps/server
node apps/web/build-all-pages.mjs
```
