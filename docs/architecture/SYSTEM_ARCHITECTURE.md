# VANNI — Master System Architecture Specification
**Author:** Founding Engineering Team & Principal Architecture  
**Status:** Approved Architectural Blueprint  
**Product:** VANNI (Universal AI Employee Runtime for Regional Businesses)  
**Version:** 1.0.0-PROPOSAL  
**Target:** Karnataka Enterprise Market (Kannada & Kanglish First, Globally Configurable)

---

## 1. Executive Summary & Product Thesis

**VANNI** is not a chatbot, not a scripted IVR, and not a generic wrapper around a single foundation model. 
VANNI is **a configurable AI Employee Runtime for businesses**.

- **The Voice is the Interface**: Sub-700ms full-duplex bi-directional conversational streaming over PSTN/SIP telephony and WebRTC.
- **The LLM is the Reasoning Layer**: Provider-independent reasoning engine executing intent recognition, conversational diplomacy, and tool dispatching.
- **The Business Database is the Source of Truth**: The AI never hallucinates arbitrary prices, appointments, or inventory. It operates strictly within verified tenant context.
- **Industry Templates provide Domain Intelligence**: Plug-and-play vertical intelligence (Dental, IVF, Clinics, Real Estate, Hospitality, Automotive) without rebuilding the core engine.
- **Tools perform Business Actions**: Guardrailed API operations (calendar slot locking, lead creation, WhatsApp dispatch, human warm transfer).
- **The Conversation Orchestrator controls Interaction**: Explicit finite state machine managing turns, barge-in interruptions, latency buffering, and escalation.
- **Analytics measure Business Outcomes**: Fixed obligation to revenue, speed-to-lead, qualification score, missed revenue recovery.

---

## 2. Universal Agent Engine Architecture

Instead of hard-coding separate applications for different industries, VANNI operates on a **Single Unified Intelligence Hierarchy**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           PLATFORM BRAIN                                │
│  • System Safety & Non-Harm Guidelines (L0)                             │
│  • Conversational Etiquette & Kannada Spoken Loanword Rules (L1)        │
│  • Sub-700ms Turn Brevity & Voice Invariants                            │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           INDUSTRY BRAIN                                │
│  • Vertical Workflows (Dental / Clinic / IVF / Real Estate / Hotel) (L3)│
│  • Qualification Criteria (Budget, Treatment Urgency, Site Visit Slot)  │
│  • Clinical / Legal / Commercial Guardrails & Human Escalation Triggers │
│  • Domain Terminology & Pronunciation Lexicon                           │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           BUSINESS BRAIN                                │
│  • Customer Tenant Facts (Clinic Name, Projects, Doctor Schedules) (L4) │
│  • Verified Catalog, Operating Hours, Doctor Fees, Plot Pricing         │
│  • Custom Business Rules (Sunday Free Cab, 24x7 Emergency Line)         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                 CONVERSATION ENGINE & RUNTIME ORCHESTRATOR               │
│  • Call State Machine (L5)                                               │
│  • Recent Sliding Window Turn History (L6)                              │
│  • Retrieved Dynamic Knowledge Chunks (L7)                              │
│  • Guardrailed Business Tool Execution (L8)                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. High-Level System Architecture Diagram

```
                     ┌───────────────────────────────────┐
                     │       Telephony / Audio PSTN      │
                     │  (Exotel / Twilio / Tata / Web)   │
                     └─────────────────┬─────────────────┘
                                       │ Raw RTP / WebSocket Audio (G.711 / PCM 8kHz)
                                       ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ VANNI REAL-TIME VOICE GATEWAY (Fastify + WebSockets)                                  │
│                                                                                        │
│  ┌─────────────────────────┐   ┌──────────────────────┐   ┌─────────────────────────┐  │
│  │ Telephony Gateway Adapt │   │ Energy / Silero VAD  │   │ Interruption Arbiter    │  │
│  │ (Exotel / Twilio / SIP) │   │ (Speech Detection)   │   │ (Barge-In Cancel Logic) │  │
│  └───────────┬─────────────┘   └──────────┬───────────┘   └────────────┬────────────┘  │
│              │                            │                            │               │
│              └────────────────────────────┼────────────────────────────┘               │
│                                           ▼                                            │
│                      ┌────────────────────────────────────────┐                        │
│                      │ STT Provider Adapter Layer             │                        │
│                      │ (Sarvam Saaras / Whisper / Deepgram)   │                        │
│                      └────────────────────┬───────────────────┘                        │
│                                           │ Text Transcript (Kannada / Kanglish)       │
│                                           ▼                                            │
│                      ┌────────────────────────────────────────┐                        │
│                      │ Conversation State Machine             │                        │
│                      │ (IDLE -> GREETING -> LISTENING -> ...) │                        │
│                      └────────────────────┬───────────────────┘                        │
│                                           │                                            │
│                                           ▼                                            │
│                      ┌────────────────────────────────────────┐                        │
│                      │ Context Assembler (L0 to L8 Layering)  │                        │
│                      │ • Platform Brain • Industry Brain      │                        │
│                      │ • Business Brain • Vector Knowledge    │                        │
│                      └────────────────────┬───────────────────┘                        │
│                                           │ Structured Prompt + Tools                  │
│                                           ▼                                            │
│                      ┌────────────────────────────────────────┐                        │
│                      │ LLM Provider Adapter Layer             │                        │
│                      │ (Gemini Flash / Qwen 2.5 / OpenAI)     │                        │
│                      └──────┬──────────────────────────┬──────┘                        │
│                             │                          │                               │
│         Tool Call Requested │                          │ Synthesizable Response Stream │
│                             ▼                          ▼                               │
│              ┌───────────────────────────┐    ┌──────────────────────────────────────┐ │
│              │ Tool Execution Engine     │    │ TTS Provider Adapter Layer           │ │
│              │ • Calendar Booking        │    │ (Sarvam Bulbul v2 / Kokoro / Eleven) │ │
│              │ • Lead Qualification      │    └──────────────────┬───────────────────┘ │
│              │ • WhatsApp Dispatch       │                       │ Audio Chunks        │
│              │ • Twenty CRM / Postgres   │                       │ (PCM / WAV)         │
│              └──────────────┬────────────┘                       ▼                     │
│                             │                  ┌───────────────────────────────────┐   │
│                             └─────────────────►│ Telephony Audio Outbound Stream   │   │
│                                                └───────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Layered Context Architecture (L0 to L8)

To guarantee sub-700ms responses and prevent hallucinations, VANNI never dumps the entire business database into the LLM prompt. Instead, context is assembled into 9 distinct layers:

| Layer | Name | Scope & Authority | Dynamic vs Static |
| :--- | :--- | :--- | :--- |
| **L0** | **System Safety** | Anti-jailbreak, strict refusal of hate/violence, medical malpractice disclaimers. | Immutable Platform Constant |
| **L1** | **Platform Rules** | Natural spoken Kanglish loanwords rule, 25-word brevity limit, warmth fillers. | Immutable Platform Constant |
| **L2** | **Agent Persona** | Name (e.g. Sahana), tone, vocal register, speaking pace, language preferences. | Configured per Agent |
| **L3** | **Industry Rules** | Healthcare triage boundaries, real estate negotiation margins, clinic booking protocols. | Industry Template |
| **L4** | **Business Facts** | Clinic address, doctor rosters, plot prices, company registration, amenities. | Tenant Profile Database |
| **L5** | **Call State** | Inbound vs Outbound, Caller Phone, Identified Name, Active Campaign Context. | Session State Memory |
| **L6** | **Recent Turns** | Sliding window of last 4-6 conversation turns (User utterance & Agent reply). | Ephemeral Session Buffer |
| **L7** | **Retrieved Knowledge**| Exact semantic matches from business FAQs or uploaded clinic/project brochures. | RAG / Exact Vector Retrieval |
| **L8** | **Tool Results** | Output of executed tools (e.g., `doctor_availability: 11:30 AM slot open`). | Dynamic Turn Output |

---

## 5. Explicit Conversation State Machine

The conversation is governed by an explicit deterministic finite-state machine (FSM). The LLM does **not** manage connection lifecycles:

```
[IDLE]
  │  (Inbound SIP Invite / Outbound Inception Dialed)
  ▼
[CONNECTING]
  │  (200 OK / Audio Stream Established)
  ▼
[GREETING] ──► Agent speaks initial greeting (e.g., "Namaskara sir!...")
  │  (Playback finished OR Barge-in detected)
  ▼
[LISTENING] ◄─────────────────────────────────────────────┐
  │                                                       │
  ├──► [INTERRUPTED] ──► (Cancel active TTS / clear ring) │
  │          │                                            │
  │          ▼                                            │
  ├──► User Silence Detected (VAD 550ms-650ms threshold)  │
  │                                                       │
  ▼                                                       │
[THINKING] ──► (STT finalized -> Context assembled)       │
  │                                                       │
  ├──► [TOOL_EXECUTION] ──► (Calendar / DB query) ────────┤
  │                                                       │
  ▼                                                       │
[SPEAKING] ──► (Streaming audio chunks to Telephony) ─────┘
  │
  ├──► [CONFIRMING] (e.g., "Sunday 11 AM confirm madla?")
  │
  ├──► [TRANSFER_PENDING] (Warm transfer to human staff SIP)
  │
  ▼  (Caller hangs up OR Agent completes goal)
[ENDED] ──► (Post-call CDR, Lead Dossier, WhatsApp Dispatch, DB sync)
```

---

## 6. Provider-Independent Architecture

All external technologies must strictly adhere to abstract TypeScript interfaces. No business domain file may directly import vendor SDKs (`twilio`, `exotel`, `google`, `openai`, `sarvam`):

1. **`ILLMProvider`**:
   - `generateTurn(messages, systemInstruction, tools): Promise<TurnResponse>`
   - `streamTurn(messages, systemInstruction, tools): AsyncIterable<TurnChunk>`
2. **`ISTTProvider`**:
   - `streamSpeechToText(audioStream): AsyncIterable<SpeechTranscript>`
   - `transcribeChunk(audioBuffer, language): Promise<SpeechTranscript>`
3. **`ITTSProvider`**:
   - `synthesizeSpeech(text, options): Promise<AudioPayload>`
   - `streamTextToSpeech(textStream, options): AsyncIterable<AudioChunk>`
4. **`ITelephonyProvider`**:
   - `dispatchOutboundCall(request): Promise<CallResult>`
   - `transferCall(callId, destinationNumber): Promise<TransferResult>`
   - `generateMediaStreamXml(streamUrl): string`
5. **`IMessagingProvider`**:
   - `dispatchStructuredTemplate(targetPhone, templateId, params): Promise<MessageResult>`
6. **`ICalendarProvider`**:
   - `getAvailableSlots(dateRange, serviceId): Promise<Slot[]>`
   - `bookSlot(slotDetails): Promise<BookingConfirmation>`

---

## 7. Healthcare & Clinical Safety Guardrails

For all healthcare, clinic, dental, and IVF tenants, VANNI enforces **Administrative Operational Boundaries**:
- **Allowed Operations**: Clinic timings, doctor OPD availability, appointment scheduling, fee structure, location directions, pre-visit fasting instructions.
- **Strictly Prohibited & Auto-Escalated**:
  - Medical diagnosis over the phone ("Do I have cancer / heart attack?").
  - Prescription medication alteration or dosage advice.
  - Guarantees of treatment or surgical success ("100% cure guarantee").
  - High-risk emergency triage ("Severe chest pain / breathing difficulty").
- **Safety Fallback**: Immediate triggering of `escalate_to_human` or instruction to dial Karnataka Emergency Services (108) or visit the nearest emergency room.
