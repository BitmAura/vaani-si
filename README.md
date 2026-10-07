# Dhwani SI — Sovereign Voice Intelligence Architecture

**Enterprise-grade, real-time conversational voice intelligence platform for regional Indian businesses.**

## 🎯 Vision

Sub-750ms end-to-end conversation turnaround with 100% human-grade regional prosody in Kannada, Kanglish, Telugu, and Tamil.

## 🏗️ Architecture

### 7-Layer Universal Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│ Layer 7: Observability & Audio QoS (Packet Loss, Latency, Jitter)      │
├────────────────────────────────────────────────────────────────────────┤
│ Layer 6: Enterprise Client Portal (Next.js 15, Linear-grade Dark UX)   │
├────────────────────────────────────────────────────────────────────────┤
│ Layer 5: High-Concurrency WebSocket Gateway (Fastify + Real-time Audio)│
├────────────────────────────────────────────────────────────────────────┤
│ Layer 4: Regional Voice Adapters (Silero VAD + Sarvam AI + Gemini)     │
├────────────────────────────────────────────────────────────────────────┤
│ Layer 3: Conversational State Machine & Inbound/Outbound Engine        │
├────────────────────────────────────────────────────────────────────────┤
│ Layer 2: Persistence & Multi-Tenant Ledger (PostgreSQL / Supabase RLS) │
├────────────────────────────────────────────────────────────────────────┤
│ Layer 1: Domain Entities & Invariants (Tenant, Call, Intent, Lead)     │
└────────────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 20.0.0
- PostgreSQL 15+ or Supabase account
- Sarvam AI API key
- Gemini API key (or Groq)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd vaani-si

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Run database migrations
npx supabase db push

# Start development servers
npm run server:dev  # API server (port 4100)
npm run voice       # Voice gateway (port 4200)
```

### Environment Variables

See `.env.example` for required configuration:

- `DATABASE_URL` - PostgreSQL connection string
- `SARVAM_API_KEY` - Sarvam AI for STT/TTS
- `GEMINI_API_KEY` - LLM provider
- `EXOTEL_ACCOUNT_SID` - Telephony gateway
- `RAZORPAY_KEY_SECRET` - Billing (optional)

## 📦 Project Structure

```
vaani-si/
├── apps/
│   ├── server/           # Fastify WebSocket telephony voice gateway
│   ├── voice-gateway/    # Real-time audio streaming server
│   └── web/              # Next.js enterprise dashboard
├── packages/
│   ├── core/             # Domain types, invariants, Zod schemas
│   ├── voice-engine/     # VAD, STT, LLM, TTS streaming pipelines
│   ├── conversation-engine/  # State machine & orchestration
│   ├── knowledge-engine/ # Business brain & knowledge retrieval
│   ├── auth/             # Multi-tenancy identity service
│   ├── database/         # Supabase client & repositories
│   ├── agent-core/       # AI employee lifecycle management
│   ├── tool-engine/      # Guardrailed business tools
│   └── [11 more packages...]
└── supabase/
    └── migrations/       # 16 comprehensive migrations
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific package tests
npm test --workspace=packages/voice-engine

# Run with coverage
npm run test:coverage
```

## 🔐 The 5 Immutable Invariants

1. **750ms Latency Ceiling** - Total VAD + STT + LLM + TTS ≤ 750ms
2. **Barge-In Immunity** - Audio truncation ≤ 50ms
3. **Kanglish Phonetic Preservation** - No translation of loanwords
4. **Multi-Tenant Air-Gap Isolation** - Strict tenant_id enforcement
5. **Idempotent Webhooks** - Duplicate prevention via idempotency_key

## 🏢 Target Industries

- Real Estate Layout Developers
- Multi-Specialty Hospitals
- Automobile Dealerships
- PU/NEET Educational Institutes
- Co-operative Banks
- D2C Brands

## 📊 Tech Stack

- **Runtime**: Node.js 20+ (TypeScript strict ESM)
- **Transport**: Fastify + @fastify/websocket
- **Voice**: Silero VAD v5 + Sarvam AI
- **LLM**: Gemini 1.5 Flash / Groq Llama 3.1 70B
- **Database**: PostgreSQL / Supabase
- **Frontend**: Next.js 15, Tailwind CSS
- **Telephony**: Exotel / Tata SIP / Twilio

## 📈 Monitoring & Observability

- Real-time latency tracking
- Audio QoS metrics (packet loss, jitter)
- Multi-tenant usage metering
- Cost anomaly detection
- Conversation analytics

## 🚢 Deployment

```bash
# Build all packages
npm run build

# Docker deployment
docker-compose up -d

# Production start
npm run server
npm run voice
```

## 📖 Documentation

- [Architecture Decision Records](./docs/architecture/)
- [API Documentation](./docs/api/)
- [Agent Development Guide](./docs/agents/)

## 🤝 Contributing

This is a proprietary codebase. Contact the founding team for contribution guidelines.

## 📄 License

**UNLICENSED** — Proprietary software. All rights reserved.

---

**Built with ❤️ by Antigravity Sovereign Architecture**
