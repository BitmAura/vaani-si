# AGENTS.md — Dhwani SI (Sovereign Voice Intelligence Architecture)

> **AUTHORITATIVE DIRECTIVE FOR DHWANI SI**:
> This document defines the permanent, non-negotiable architectural standards, domain rules, mathematical invariants, and multi-tenant telephony specifications for **Dhwani SI** (High-Performance Regional Conversational Voice OS - ಧ್ವನಿ).
> Governed by [UNIVERSAL_SYSTEM_ARCHITECT_FRAMEWORK.md](file:///p:/crazy-ai-stack/UNIVERSAL_SYSTEM_ARCHITECT_FRAMEWORK.md) and [THE_SOVEREIGN_ARCHITECT_PLAYBOOK.md](file:///p:/crazy-ai-stack/THE_SOVEREIGN_ARCHITECT_PLAYBOOK.md).

---

## 1. System Vision & Value Proposition
**Dhwani SI** is an enterprise-grade, real-time conversational voice intelligence platform purpose-built for regional Indian business operations (starting with Kannada & Kanglish in Karnataka, expanding to Telugu & Tamil).

- **Who Uses It**: Real Estate Layout Developers, Multi-Specialty Hospitals, Automobile Dealerships, PU/NEET Educational Institutes, Co-operative Banks, and D2C Brands.
- **The Core Metric**: **Sub-750ms end-to-end conversation turnaround** with 100% human-grade regional prosody, zero robotic latency, and native code-mixed Kanglish vocabulary preservation.

---

## 2. The 7-Layer Universal Architecture Specification

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

---

## 3. The 5 Immutable Invariants (Never Broken Under Any Circumstance)

1. **The 750ms Latency Ceiling**:
   $$\text{Latency}_{\text{total}} = \text{VAD}_{\text{silence}} + \text{STT}_{\text{stream}} + \text{LLM}_{\text{TTFT}} + \text{TTS}_{\text{first\_byte}} \le 750\text{ms}$$
   Every layer must stream chunks. Never buffer full sentences before synthesizing audio.

2. **Barge-In Immunity (<50ms Audio Truncation)**:
   The instant user speech is detected while the voice agent is speaking, the outgoing audio buffer is flushed and cleared in $\le 50\text{ms}$. The agent must never talk over the user.

3. **Kanglish Phonetic Preservation**:
   Common English commercial loanwords (*site, plot, layout, doctor, appointment, booking, advance, token, hospital, Creta, Swift*) must NEVER be translated into archaic textbook Kannada. They are preserved phonetically in the transcript.

4. **Multi-Tenant Air-Gap Isolation**:
   Every database query and cache hit must enforce tenant tenancy (`tenant_id`). Client A (Hospital) can never access, query, or leak prompts/leads from Client B (Real Estate).

5. **Idempotent Webhooks & Lead Delivery**:
   Lead dispatch to WhatsApp/CRM must carry an `idempotency_key` based on `call_session_id`. Duplicate alerts are prohibited.

---

## 4. Technical Stack

- **Runtime**: Node.js >= 20.0.0 (TypeScript strict ESM)
- **Transport**: Fastify + `@fastify/websocket` for streaming audio frames (PCM 16kHz / 8kHz μ-law)
- **Voice Detection**: Silero VAD (v5)
- **Speech-to-Text**: Sarvam AI Saaras (Streaming Kannada/Kanglish)
- **Dialogue Engine**: Gemini 1.5 Flash / Groq Llama 3.1 70B (Streaming tokens, TTFT < 150ms)
- **Text-to-Speech**: Sarvam AI Bulbul v2 (Streaming audio chunks)
- **Telephony Adapter**: Exotel / Tata SIP Trunking / Twilio Media Streams
- **Frontend & Dashboard**: Next.js 15, Tailwind CSS, Lucide icons, bespoke Linear-style dark aesthetic.

---

## 5. Directory Topology

```
p:\crazy-ai-stack\vaani-si\
├── AGENTS.md                  (This master file)
├── package.json               (Workspace root)
├── tsconfig.json              (Strict TypeScript base)
├── apps/
│   ├── server/                (Fastify WebSocket telephony voice gateway)
│   └── web/                   (Next.js enterprise dashboard & WebRTC testbed)
└── packages/
    ├── core/                  (Layer 1 & Layer 3: Domain types, state machine, Zod schemas)
    └── voice-engine/          (Layer 4: VAD, STT, LLM, TTS streaming pipelines)
```
