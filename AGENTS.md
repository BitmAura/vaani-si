# VANNI-SI — Master Agent Context File
## Authoritative Product, Architecture & Domain Knowledge for ALL AI Coding Agents

> **CRITICAL FOR CURSOR / CLAUDE / GEMINI / ALL AI AGENTS:**
> Read this entire file before writing a single line of code.
> This is NOT optional background reading. This is the law.
> If you violate anything here, you are costing this business real money.

---

## 1. WHAT WE ARE BUILDING — THE SINGLE DEFINITIVE ANSWER

**VANNI** is a **two-engine revenue platform** for Indian SMEs:

```
  VANNI PLATFORM
  ═══════════════════════════════════════════════════════════════

  ENGINE 1: AEO & GEO SEARCH SHIELD          ENGINE 2: AI VOICE EMPLOYEE (Telecaller OS)
  ──────────────────────────────────────     ──────────────────────────────────────────
  Makes businesses rank #1 on ChatGPT,      Replaces human tele-callers. Dials every
  Claude, Perplexity & Google AI Overviews   Meta/Facebook lead within 15 seconds.
  by injecting verified Schema.org graphs    Converses in Kannada + Kanglish. Books
  and /llms.txt feeds via a 1-line script.   appointments, qualifies leads, dispatches
                                             WhatsApp dossiers. Zero human cost.
  Price: ₹9,999/month per client             Price: ₹14,999/month per client workspace

  ══════════════════════════════════════════════════════════════
  COMBINED BUNDLE: ₹19,999/month = GEO Shield + Voice AI Employee
  (Save ₹5,000/month vs buying separately)
```

**These two engines are NOT separate products. They are two modules of ONE product.**
**Cursor's claim that "you can't combine them" is wrong. They share the same dashboard, same billing, same tenant system.**

---

## 2. THE 4 TARGET INDUSTRIES — MEMORIZE THESE

### Industry 1: Digital Marketing Agencies (Reseller Channel)
**Who they are:**
- Agencies in Bengaluru, Delhi, Mumbai, Hyderabad that run Facebook/Instagram/Google ads for SME clients
- They charge clients ₹15,000–50,000/month for ad management
- Their biggest problem: "We generated 200 leads but the client says they didn't convert"

**How VANNI makes them money:**
- They become VANNI resellers (white-label the platform)
- They add ₹9,999–14,999/month AI automation on top of their ad retainer
- VANNI charges agency ₹5,000/month base + ₹2/min voice usage
- Agency marks up to ₹15,000–20,000/month → 80%+ margin
- They now OWN the client's lead conversion. Client can never fire them.

**What they get:**
- Multi-client agency dashboard (switch between all their clients)
- Per-client call logs, lead ratings, appointment reports
- White-label option (calls come from "Radiant Dental's AI receptionist" not VANNI)
- Proof of ROI: Play the audio recording of a lead agreeing to a site visit

**Key backend routes:** `routes/agency.ts`, `routes/campaigns.ts`

---

### Industry 2: Healthcare / Medical (Primary Revenue Target)
**Sub-verticals:**
- Hospitals (especially neuro, orthopedic, oncology, multi-specialty)
- IVF & fertility clinics
- Dental chains (single clinics AND multi-branch)
- Physiotherapy / rehabilitation centers (e.g., Punarvaas)
- Dermatology / cosmetic clinics
- Eye hospitals (LASIK, cataract)

**Their problems VANNI solves:**
1. **AI Discovery:** When patients ask ChatGPT "Best IVF clinic in Indiranagar," Practo shows up — not the clinic directly. VANNI's GEO Shield puts the clinic first.
2. **Missed calls after hours:** Hospitals get calls at 9 PM when reception is closed. VANNI's AI answers instantly.
3. **WhatsApp lead response time:** Patients fill Google forms and get called back the next day. VANNI calls back in 15 seconds.

**AI Voice Employee behavior for Healthcare:**
- Voice persona: **Kavya** (empathetic female, warm Bengaluru Kannada)
- Asks: preferred appointment time (morning/evening), type of issue, doctor preference
- NEVER prescribes medicine or gives medical advice
- Offers: "I can book a consultation for you with Dr. [Name] on [Date]. Should I confirm?"
- On high-value cases: seamlessly transfers to human doctor coordinator
- Language: Pure Kannada, Kanglish (mix of Kannada + English), or English depending on caller

**Data models:** `routes/doctors.ts`, `supabase/migrations/018_healthcare_rosters_and_appointments.sql`

**GEO Schema type:** `MedicalBusiness`, `Hospital`, `Dentist` with `Physician` entities

---

### Industry 3: Real Estate Developers & Brokers
**Sub-verticals:**
- Residential plot developers (Ballari, Mysuru, Belagavi — UNDERSERVED markets)
- Villa/apartment builders in Bengaluru outskirts (Whitefield, Yelahanka, Sarjapur)
- Commercial property brokers
- RERA-registered builders

**Their problems VANNI solves:**
1. **Speed-to-lead is everything:** A buyer inquires on a plot at 7 PM. If they're not called within 5 minutes, they've moved to a competitor. VANNI calls in 15 seconds.
2. **Site visit is the money moment:** The entire real estate sales funnel depends on getting the prospect to physically visit the site. VANNI qualifies and books site visits with free cab arrangements.
3. **AI Discovery:** When someone asks Perplexity "2 BHK ready-to-move apartment in Ballari," property portals (99acres, MagicBricks) show up. VANNI puts the developer directly.

**AI Voice Employee behavior for Real Estate:**
- Voice persona: **Aditya** (authoritative male, confident North Karnataka Kannada)
- Speaks: Kannada, Kanglish, Ballari/Hubli dialect when needed
- Qualifies: investment or self-construction? Budget range? Loan needed (SBI/HDFC)?
- Goal: Book a Sunday site visit with free cab pickup
- NEVER negotiates below the listed price ("Sir, ₹18 lakhs starting price is our government valuation rate")
- On HOT lead: books cab, sends WhatsApp confirmation with map and plot brochure PDF

**Data models:** `routes/real-estate.ts`, `routes/plots.ts`, `supabase/migrations/019_real_estate_properties_and_site_visits.sql`

**GEO Schema type:** `RealEstateAgent`, with RERA number in schema for trust signals

---

### Industry 4: Luxury Car Dealerships (NEW — Add This Now)
**Sub-verticals:**
- Mercedes-Benz, BMW, Audi, Lexus dealers in Tier-1 and Tier-2 cities
- Maruti Nexa, Hyundai Premium dealers
- Pre-owned luxury car platforms

**Their problems VANNI solves:**
1. **Test drive booking:** The #1 conversion event is a test drive. VANNI calls Meta leads in 15 seconds and books test drives.
2. **AI Discovery:** When a buyer asks ChatGPT "Best Mercedes dealer in Hyderabad for GLE?" they get a generic answer. VANNI puts the dealership first with specific inventory, finance options, EMI calculators.
3. **After-hours service inquiries:** "When is the next service slot for my C-Class?" VANNI answers instantly and books the service bay.
4. **Finance qualification:** VANNI pre-qualifies buyers (salaried/business, monthly income, loan preference) before the human sales manager calls back.

**AI Voice Employee behavior for Automotive:**
- Voice persona: **Rohan** (premium English + Hinglish, professional showroom tone)
- Speaks: English, Hinglish (Hindi + English), or regional language based on caller
- Goal: Book a test drive or service appointment
- Knows: On-road price, EMI at different tenures, color/variant availability, exchange value estimate
- NEVER reveals competitor pricing; deflects to "our certified finance team will match the best rate"

**GEO Schema type:** `AutoDealer` with specific vehicle inventory schema

---

## 3. THE FULL PRODUCT ARCHITECTURE

### 3.1 AEO & GEO Search Shield Engine
```
Client adds 1 line to their website:
<script src="https://vanni.ai/geo/[slug]/loader.js"></script>

What that 1 line does:
1. Injects verified Schema.org JSON-LD into the page DOM (<50ms, async, non-blocking)
2. Schema includes: doctor names, qualifications, services, prices, FAQs, phone numbers
3. GPTBot, ClaudeBot, PerplexityBot read this and cite the business directly
4. /llms.txt file at vanni.ai/geo/[slug]/llms.txt provides clean Markdown for AI engines
5. Client ranks #1 when AI engines are asked about their category + city

Kill-Switch (Agency Retention):
- Agency owns the Vercel deployment
- If client misses a payment → agency calls POST /api/geo/[slug]/toggle → shield turns off instantly
- Client's AI search ranking disappears
- This creates 100% payment compliance
```

**Live endpoints (already working on Vercel):**
- `GET /api/geo/:slug/loader.js` — Dynamic Schema.org injector
- `GET /api/geo/:slug/llms.txt` — LLM-readable Markdown feed
- `GET /api/geo/:slug/schema.json` — Raw JSON-LD
- `GET /api/geo/:slug/status` — Entitlement + readiness score
- `POST /api/geo/:slug/toggle` — Kill-switch
- `POST /api/geo/audit` — Free public audit (returns 24/100 for unshielded, 98/100 for active clients)
- `POST /api/geo/extract` — Scrapes and extracts entity data from any URL

**Paywall rule (NEVER VIOLATE):**
The embed slug is ONLY revealed after confirmed Razorpay payment of ₹9,999.
No payment → no slug → no script → no protection.
This is enforced in `routes/geo.ts` `subscriptionStatus` check.

---

### 3.2 AI Voice Employee Engine (Telecaller OS)
```
The Full Call Lifecycle:

T+0s:    Facebook/Instagram lead submits form (Meta Lead Ads)
T+3s:    Meta webhook fires → POST /api/webhooks/meta-lead
T+5s:    Exotel/Twilio SIP gateway dials the lead's phone number
T+10s:   Lead picks up. VANNI's AI greets in Kannada/English
T+10–120s: Full conversation. AI qualifies, books appointment, answers objections
T+120s:  Call ends. Audio → Sarvam STT → transcript
T+125s:  LLM extracts: name, rating (HOT/WARM/COLD), requirement, budget, next action
T+126s:  WhatsApp dossier sent to business owner's phone instantly
T+127s:  CRM updated with lead record, audio recording, transcript
T+128s:  If HOT lead → optionally escalate to human via live call bridge
```

**Voice Stack:**
- **STT (Speech-to-Text):** Sarvam AI Saaras v2 (primary) → Deepgram Nova-2 (fallback)
- **LLM (Thinking):** Gemini 1.5 Flash (cloud) or Qwen 2.5 7B via Ollama (local/cost-saving)
- **TTS (Text-to-Speech):** Sarvam Bulbul v2 (primary, Kannada-native) → ElevenLabs (fallback)
- **Telephony:** Exotel (India SIP) → Twilio (international fallback)
- **Fillers:** KannadaFillerEngine — plays "Haudu sir, ondu nimisha..." while LLM is thinking

**Key source files:**
- `apps/server/src/audio-pipeline.ts` — Core real-time audio processing pipeline
- `apps/server/src/llm-service.ts` — LLM conversation + lead extraction
- `apps/server/src/kannada-fillers.ts` — Sub-100ms filler audio engine
- `apps/server/src/whatsapp-lead-service.ts` — WhatsApp dispatch
- `apps/voice-gateway/src/session/realtime-session.ts` — WebSocket session manager
- `apps/server/src/routes/webhooks.ts` — Meta Lead Ads + Exotel webhook handlers
- `apps/server/src/routes/campaigns.ts` — Outbound campaign scheduler

---

### 3.3 Agency Multi-Client Dashboard
```
Agency Owner logs in → sees ALL their client businesses in one dropdown
├── Apollo Dental Clinic (Indiranagar)
│   ├── Calls today: 23 | HOT leads: 4 | Appointments booked: 3
│   ├── GEO Shield: ACTIVE (98/100)
│   └── Voice AI: ACTIVE (Kavya, Kannada)
├── Ballari Residential Layouts (Real Estate)
│   ├── Calls today: 12 | HOT leads: 2 | Site visits booked: 2
│   ├── GEO Shield: ACTIVE (96/100)
│   └── Voice AI: ACTIVE (Aditya, Kannada)
└── + Add New Client
```

**Key source files:**
- `apps/server/src/routes/agency.ts` — All multi-client CRUD and metrics
- `apps/web/components/dashboard/agency-widgets.tsx` — Agency dashboard UI

---

### 3.4 The Technology Stack
| Layer | Technology | File |
| :--- | :--- | :--- |
| Marketing Frontend | Pure HTML, Vanilla JS, CSS | `apps/web/index.html`, `build-all-pages.mjs` |
| App Dashboard | HTML + Vanilla JS (no React, fast load) | `apps/web/app/*.html` |
| API Server | Node.js + Fastify + TypeScript | `apps/server/src/server.ts` |
| Voice Gateway | Node.js + WebSocket + TypeScript | `apps/voice-gateway/src/index.ts` |
| Database | Supabase (PostgreSQL) with Row Level Security | `supabase/migrations/` |
| Hosting (Web + GEO API) | Vercel Edge Functions | `vercel.json`, `api/index.ts` |
| Hosting (Voice Gateway) | Railway.app (persistent WebSocket) | `apps/voice-gateway/Dockerfile` |
| STT | Sarvam AI (Saaras v2) | `SARVAM_API_KEY` in `.env` |
| TTS | Sarvam AI (Bulbul v2) | `SARVAM_API_KEY` in `.env` |
| LLM | Gemini Flash / Qwen 2.5 | `GEMINI_API_KEY` in `.env` |
| Telephony | Exotel (India) | `EXOTEL_*` in `.env` |
| Payments | Razorpay (subscriptions + mandates) | `RAZORPAY_*` in `.env` |
| WhatsApp | WhatsApp Cloud API | `WHATSAPP_*` in `.env` |
| Auth | Cookie-based sessions (httpOnly, signed) | `apps/server/src/http-auth.ts` |

---

## 4. PRICING TIERS — THESE ARE FIXED, NEVER CHANGE WITHOUT ASKING

| Tier | Monthly Price | What's Included |
| :--- | :--- | :--- |
| **Voice Starter** | **₹4,999/mo** | 1 AI Employee, 600 minutes, Kannada + Kanglish + English, call recordings, ₹2.50/extra min |
| **AEO & GEO Shield** | **₹9,999/mo** | #1 AI ranking on ChatGPT/Perplexity, 1-line script, Schema.org + `/llms.txt`, kill-switch, 30-day MBG |
| **Voice AI Growth** | **₹14,999/mo** | 3 AI Employees, 2,500 minutes, sub-15s Meta autodialer, calendar booking, WhatsApp sync, ₹2.20/extra min |
| **Complete Bundle** | **₹19,999/mo** | Voice Growth + GEO Shield (saves ₹5,000/mo) |

**Agency reseller economics:**
- VANNI charges agency: ₹5,000/mo base + ₹2/min
- Agency charges their client: ₹15,000–20,000/mo
- Agency margin: 80%+

---

## 5. THE MULTI-TENANT DATA MODEL

Every piece of data in VANNI is scoped to a tenant (organization):

```
Organization (Tenant)
├── id: UUID (used for all RLS enforcement)
├── name: "Creative Digital Agency" OR "Apollo Dental Clinic"
├── type: AGENCY | DIRECT
│
├── ClientWorkspaces[] (if AGENCY type)
│   ├── workspace_id: UUID
│   ├── business_name: "Radiant Dental" / "Ballari Layouts"
│   ├── industry: HEALTHCARE | DENTAL | REAL_ESTATE | AUTOMOTIVE | HOSPITALITY | AGENCY
│   ├── voice_config: { persona, language, systemPrompt }
│   ├── geo_profile: GeoEntityProfile
│   └── subscription: { status, plan, razorpay_subscription_id }
│
├── Calls[] (scoped to org or workspace)
├── Leads[] (scoped to org or workspace)
├── Appointments[] (scoped to org or workspace)
└── KnowledgeBase[] (RAG documents per workspace)
```

**CRITICAL: NEVER allow cross-tenant data access.**
Every database query MUST filter by `organization_id` or `workspace_id`.
RLS policies in Supabase enforce this at the DB layer.
The `getSessionFromRequest()` function in `http-auth.ts` is the auth guard — always use it.

---

## 6. VOICE AGENT PERSONAS — THE 4 STANDARD VOICES

| Persona | Language | Industry | Tone | Sarvam Speaker |
| :--- | :--- | :--- | :--- | :--- |
| **Kavya** | Kannada + Kanglish | Healthcare, Dental, IVF | Warm, empathetic, patient | `meera` or `pavithra` |
| **Aditya** | Kannada + North Karnataka dialect | Real Estate, Plots | Authoritative, confident, senior sales | `anup` |
| **Rohan** | English + Hinglish | Luxury Automotive | Premium, professional showroom | `arvind` |
| **Priya** | Kannada + English | Digital Marketing Agency | Friendly, business-like | `meera` |

**Configurable per workspace.** Agency can rename personas (white-label).

---

## 7. THE GEO ENGINE ENTITY PROFILES

Each shielded client has a `GeoEntityProfile` with:
- `slug`: URL-safe ID (e.g., `punarvaas`, `apollo-dental-indiranagar`)
- `industry`: HEALTHCARE | DENTAL | REAL_ESTATE | AUTOMOTIVE | HOSPITALITY | LEGAL | EDUCATION | WELLNESS | AGENCY | GENERAL
- `doctorsOrTeam[]`: Named professionals with qualifications (critical for AI grounding)
- `services[]`: Named services with price ranges (critical for AI citation)
- `faqs[]`: Q&A pairs (directly cited by AI search engines)
- `geoEnabled`: boolean (kill-switch)
- `subscriptionStatus`: ACTIVE | PAST_DUE | CANCELLED (drives access control)

The Schema.org graph generated varies by industry:
- Healthcare → `MedicalBusiness` + `Hospital` + `Physician` entities
- Dental → `MedicalBusiness` + `Dentist`
- Real Estate → `RealEstateAgent` with RERA number
- Automotive → `AutoDealer` with `CarModel` inventory
- Hotel → `Hotel` + `LodgingBusiness`
- Legal → `LegalService`

---

## 8. THE BUSINESS BRAIN (RAG KNOWLEDGE BASE)

Each client workspace has a knowledge base. The AI voice employee reads this before every call.

Documents uploaded per client:
1. **Pricing Sheet** — Exact treatment costs, plot prices, car variants + EMIs
2. **Objection Handling** — "Is your plot BDA approved?" → "Sir, this is DC converted with A-Khata. RERA registered."
3. **Doctor/Team Roster** — Names, qualifications, availability
4. **FAQ Document** — Common patient/buyer questions + answers
5. **Business Timings** — When is the clinic/office open?
6. **Competitor Differentiators** — Why us vs. Practo/99acres/competitor

**RAG implementation:** `apps/server/src/knowledge-base-service.ts`

---

## 9. WHAT HAS BEEN BUILT (DO NOT REBUILD)

✅ Complete GEO engine with multi-industry Schema.org generation
✅ `/api/geo/*` endpoints (loader.js, llms.txt, schema.json, status, toggle, audit, extract)
✅ Free AI audit scanner on homepage (24/100 unshielded → 98/100 shielded)
✅ ₹9,999 Razorpay paywall (slug NOT revealed before payment)
✅ Marketing website with 14 pages on Vercel
✅ Agency multi-client dashboard
✅ Audio conversation pipeline (STT → LLM → TTS with Kannada fillers)
✅ WhatsApp lead dispatch service
✅ Meta Lead Ads webhook handler
✅ Campaign scheduler (outbound calling campaigns)
✅ Real estate plot inventory + site visit booking
✅ Healthcare appointment booking + doctor roster
✅ Multi-tenant Supabase schema with RLS
✅ Razorpay subscription + webhook lifecycle
✅ Session auth with httpOnly cookies

## 10. WHAT NEEDS TO BE CONNECTED (PRIORITY ORDER)

🔴 P0 (This week — makes immediate revenue):
- Switch Razorpay from test mode to live mode (update `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` on Vercel)
- Verify end-to-end GEO onboarding flow: audit → payment → slug revealed → script live

🟡 P1 (Week 2–3 — unlocks voice revenue):
- Add real `SARVAM_API_KEY` and `EXOTEL_*` credentials to `.env` on Railway
- Deploy `apps/voice-gateway` to Railway (it has a Dockerfile ready)
- Register Meta Webhook URL in Meta Business Manager for first agency client
- Test one live Kannada call end-to-end

🟢 P2 (Month 2 — luxury automotive vertical):
- Add `AUTOMOTIVE` industry profile template to GEO profiles
- Add Rohan (English/Hinglish) voice persona to LLM system prompts
- Add car inventory schema (`AutoDealer`, `CarModel`, `Offer`)
- Create automotive-specific appointment type: TEST_DRIVE, SERVICE_BOOKING

---

## 11. NON-NEGOTIABLE ENGINEERING RULES

1. **NEVER expose the GEO embed slug before a confirmed ₹9,999 payment** — this is the paywall. Violating this is business loss.
2. **NEVER cross tenant data boundaries** — every DB query must filter by `organization_id`.
3. **NEVER replace the marketing HTML directly** — always edit `build-all-pages.mjs` and run `node apps/web/build-all-pages.mjs` to regenerate.
4. **NEVER add Python dependencies** — the stack is 100% TypeScript/Node.js.
5. **NEVER hardcode pricing** — pricing is a business decision. Always read from constants.
6. **NEVER invent fake statistics** on the marketing website.
7. **ALWAYS run `npx tsc --noEmit` before committing** — TypeScript must compile clean.
8. **ALWAYS run the GEO test suite after any geo.ts change:** `npx vitest run tests/engine/geo-engine-entitlements.test.ts`
9. **The kill-switch (toggle endpoint) must always work** — this is the agency's leverage over clients.
10. **Audio pipeline latency target: <800ms total** (VAD → STT → LLM → TTS → playback). Never add blocking calls in the hot path.

---

## 12. THE SALES REALITY CURSOR MUST UNDERSTAND

The biggest engineering mistake that kills startups is building features nobody has paid for yet.

**The current priority is NOT building new features.** It is:
1. Making Razorpay live so the first ₹9,999 can be collected
2. Making the GEO onboarding flow seamless end-to-end
3. Connecting voice API keys so the first demo call can be made

When a founder says "build X," always ask:
- "Does this help get the first paying client this week?"
- "Is this the feature that closes the current deal or the next one?"

If the answer to both is no, deprioritize it.

---

## 13. DIRECTORY STRUCTURE (QUICK REFERENCE)

```
vaani-si/
├── api/
│   └── index.ts                    → Vercel Edge entrypoint (routes to apps/server)
├── apps/
│   ├── server/
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── geo.ts          → AEO/GEO engine (THE money endpoint)
│   │   │   │   ├── agency.ts       → Multi-client agency dashboard
│   │   │   │   ├── billing.ts      → Razorpay subscription management
│   │   │   │   ├── campaigns.ts    → Outbound calling campaigns
│   │   │   │   ├── doctors.ts      → Healthcare doctor roster
│   │   │   │   ├── real-estate.ts  → Property + site visit management
│   │   │   │   ├── plots.ts        → Plot inventory
│   │   │   │   └── webhooks.ts     → Meta Lead Ads + Exotel callbacks
│   │   │   ├── audio-pipeline.ts   → Core voice call pipeline
│   │   │   ├── llm-service.ts      → Conversation + lead extraction
│   │   │   ├── kannada-fillers.ts  → Sub-100ms Kannada filler engine
│   │   │   ├── whatsapp-lead-service.ts → WhatsApp dossier dispatch
│   │   │   └── server.ts           → Fastify server registration
│   │   └── src/__tests__/          → All test suites (DO NOT DELETE)
│   ├── voice-gateway/
│   │   └── src/                    → WebSocket voice session handler
│   └── web/
│       ├── build-all-pages.mjs     → MASTER page generator (edit this, NOT index.html directly)
│       ├── index.html              → Homepage (generated by build-all-pages.mjs)
│       ├── pricing.html            → Pricing page (generated)
│       ├── features.html           → Features page (generated)
│       └── app/                    → Client-side dashboard HTML pages
├── packages/                       → Shared TypeScript packages
├── supabase/migrations/            → 26 Supabase migration files
├── vercel.json                     → Vercel deployment config
└── .env.example                    → All required environment variables
```

---

## 14. ENVIRONMENT VARIABLES (WHAT EACH ONE DOES)

```bash
# Database
SUPABASE_URL              # Your Supabase project URL
SUPABASE_ANON_KEY         # Public key (safe in frontend)
SUPABASE_SERVICE_ROLE_KEY # Server-only secret (NEVER expose to client)

# Voice AI
SARVAM_API_KEY            # Sarvam AI — STT (Saaras v2) + TTS (Bulbul v2)
GEMINI_API_KEY            # Google Gemini Flash — conversation LLM

# Telephony
EXOTEL_ACCOUNT_SID        # Exotel India SIP trunking
EXOTEL_API_KEY
EXOTEL_API_TOKEN
EXOTEL_CALLER_ID          # The phone number that shows on caller ID

# Payments
RAZORPAY_KEY_ID           # Public key (SWITCH TO LIVE: rzp_live_*)
RAZORPAY_KEY_SECRET       # Server-only secret
RAZORPAY_WEBHOOK_SECRET   # For webhook signature verification

# WhatsApp
WHATSAPP_API_TOKEN        # Meta WhatsApp Cloud API token
WHATSAPP_PHONE_NUMBER_ID  # Your WhatsApp Business phone number ID

# Meta Lead Ads
META_APP_SECRET           # REQUIRED — verifies webhook signatures
META_VERIFY_TOKEN         # Challenge token for webhook setup

# Session
COOKIE_SECRET             # Min 32 random chars — signs auth cookies
```

---

## 15. TEST COMMANDS

```bash
# Run GEO engine tests (run after ANY change to routes/geo.ts)
npx vitest run tests/engine/geo-engine-entitlements.test.ts

# Run all tests
npm test

# Type-check everything
npx tsc --noEmit

# Rebuild all 14 marketing pages (run after ANY change to build-all-pages.mjs)
node apps/web/build-all-pages.mjs

# Check what's deployed
curl https://vaani-si-web.vercel.app/api/geo/punarvaas/llms.txt
```

---

*This file is the single source of truth. When in doubt, re-read section 2 (target industries) and section 11 (non-negotiable rules).*
