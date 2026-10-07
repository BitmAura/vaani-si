# VANNI Telephony Gateway & Inbound Call Engine Architecture

## 1. Architectural Philosophy

The **VANNI Telephony Gateway** is an adapter layer built strictly around the **VANNI Real-Time Voice Engine** and the **Conversation Orchestration Engine**.

```
                           Incoming Cellular Phone Call
                                        │
                                        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Telephony Provider Gateway (Exotel PSTN / Twilio / Mock)                 │
└───────────────────────────────────────┬──────────────────────────────────┘
                                        │ (HTTP Webhook & Media Stream)
                                        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Telephony Adapter & Webhook Security Controller                         │
│ • Signature Validation (HMAC-SHA256)                                     │
│ • Event Idempotency (Deduplication via providerEventId)                  │
│ • Number Resolution: Called Number -> Organization -> Assigned AI Agent │
└───────────────────────────────────────┬──────────────────────────────────┘
                                        │ (Audio Bridge: G.711 μ-law <-> PCM16)
                                        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Real-Time Voice Engine (@vanni/voice-engine)                             │
│ • Jitter Buffer & Audio Normalizer                                       │
│ • Energy VAD & Turn Detector                                             │
│ • Streaming STT (Sarvam Saaras / Mock)                                   │
│ • Instant Barge-In Abort Handler                                         │
└───────────────────────────────────────┬──────────────────────────────────┘
                                        │ (Completed User Turn)
                                        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Conversation Orchestration Engine (@vanni/conversation-engine)           │
│ • State Machine (IDLE -> LISTENING -> THINKING -> SPEAKING)              │
│ • Context Engine & Business Brain (Grounding & Policies)                 │
│ • Kannada / Kanglish Intelligence Layer                                  │
│ • Tool Engine & Guardrails                                               │
│ • LLM Reasoning (Gemini Flash / Qwen Local / Mock)                       │
└───────────────────────────────────────┬──────────────────────────────────┘
                                        │ (Approved Agent Response)
                                        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Streaming TTS & Telephony Media Bridge                                   │
│ • Voice Text Preparation (Acoustic Kannada Numbers/Time/Currency)        │
│ • TTS Audio Synthesis (Sarvam Bulbul / Mock)                             │
│ • Downsampling to 8kHz μ-law packets                                     │
│ • Transmit to Cellular Caller                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Telephony as a Channel Adapter

Telephony code **NEVER** bypasses the Conversation Orchestrator. No business logic, CRM queries, or LLM prompts exist inside the telephony layer. Telephony acts purely as a transport adapter translating between cellular PSTN protocols and normalized internal event streams.

---

## 3. Webhook Endpoints & Routing

- `ALL /api/telephony/webhooks/:provider`: Inbound call signaling webhook. Validates provider signature, resolves called number to organization and published AI Employee, creates `telephony_session`, and returns streaming markup (TwiML / Exotel XML).
- `ALL /api/telephony/events/:provider`: Call status callback (ringing, answered, completed, failed). Updates duration and hangup reason.
- `GET /api/telephony/phone-numbers`: Organization phone numbers catalog.
- `POST /api/telephony/phone-numbers/:id/assign`: Assign published AI Employee to phone number.
- `GET /api/telephony/calls`: Organization call logs.
- `GET /api/telephony/calls/:id`: Detailed call timeline and metadata.

---

## 4. Idempotency & Replay Protection

Telephony providers frequently retry webhooks when network jitter occurs. Every incoming webhook is recorded in the `telephony_events` table using `providerEventId` as a unique key. If a duplicate event arrives, it returns `200 OK (ALREADY_PROCESSED)` immediately without duplicate call routing or session creation.

---

## 5. Telephony Media Bridge & Codecs

- **Inbound Audio**: Receives 8kHz G.711 μ-law base64 packets from telephony WebSockets, decodes to 16-bit linear PCM using table-driven ITU-T algorithms, and upsamples to 16kHz for STT.
- **Outbound Audio**: Downsamples synthesized 16kHz PCM16 audio to 8kHz, encodes to G.711 μ-law, and streams to caller via WebSocket packets.

---

## 6. AI Identity & Healthcare/Real-Estate Guardrails

- The AI assistant introduces itself clearly as an AI assistant (`"Namaskara, naanu VANNI AI sahayaka..."`).
- Healthcare calls enforce strict guardrails: no unauthorized medical diagnosis, prescriptive claims, or treatment guarantees; triggers `TRANSFER_PENDING` on escalation.
- Real-estate calls ground responses in approved catalog data: DC converted plots, pricing, and site visit scheduling without inventing inventory or false returns.
