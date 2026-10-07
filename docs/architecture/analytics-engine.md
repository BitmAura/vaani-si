# VANNI Analytics, Usage Metering & Cost Intelligence Engine

## 1. Architectural Philosophy & Core Tenet
The analytics and metering engine is strictly an **observational infrastructure layer**.
- **Non-blocking Resiliency**: Analytics and telemetry writes must never block the realtime conversational voice loop or telephony audio stream.
- **Derived from Ground Truth**: Zero hard-coded fake metrics or vanity counters. Every analytical number originates from verified append-only usage events, CRM leads, appointment slots, or call records.
- **ACTUAL vs ESTIMATED Transparency**: When telephony carriers or inference providers return verified costs in webhooks, records store `ACTUAL`. When calculated via catalog rates, records store `ESTIMATED`.

---

## 2. Event Model & Ledger Architecture

```
Telephony / Realtime Voice / LLM / Kannada STT-TTS / Tools
                          │
                          ▼
             [Raw Usage Events (Append-Only)]
             - voice_minute, stt_second, tts_char, llm_tokens
                          │
         ┌────────────────┴────────────────┐
         ▼                                 ▼
[Pre-Billing Usage Ledger]       [Incremental Daily Aggregations]
 - Status: UNBILLED (Ready        - Fast sub-second dashboard queries
   for future Module 19 billing)  - Filter by org, agent, channel
         │                                 │
         ▼                                 ▼
[Usage Alert Thresholds]          [Executive Analytics UI & REST API]
 - 75%, 90%, 100% alerts           - Funnel, Latency P95, Cost INR
 - Burst anomaly detection         - CSV Usage Export
```

---

## 3. Meters & Normalized Units
| Meter | Resource Unit | Provider Sources | Cost Modeling |
| :--- | :--- | :--- | :--- |
| `VOICE_MINUTES` | Active call minutes | Exotel, Twilio PSTN | ₹0.45/min inbound, ₹0.65/min outbound |
| `STT_SECONDS` | Audio stream seconds | Sarvam AI Saarika, Deepgram | ₹0.015/sec (₹0.90/min) |
| `TTS_CHARACTERS` | Characters synthesized | Sarvam AI Bulbul | ₹0.0008/char (₹0.80/1k chars) |
| `LLM_INPUT_TOKENS` | Prompt tokens | OpenAI gpt-4o-mini | ₹0.0125 / 1,000 tokens |
| `LLM_OUTPUT_TOKENS` | Completion tokens | OpenAI gpt-4o-mini | ₹0.05 / 1,000 tokens |
| `TOOL_EXECUTIONS` | Function invocations | Internal Tool Engine | ₹0.00 (Measured for future pricing) |

---

## 4. Pre-Billing Ledger (`public.usage_ledger`)
Provides audit-ready accounting normalization without prematurely billing customers or generating invoices:
- States: `UNBILLED`, `BILLED`, `WAIVED`, `ADJUSTED`.
- Grouped by `billing_period` (`YYYY-MM`).
- Does not block calls due to unpaid balance (handled in future billing prompt).

---

## 5. Security & Multi-Tenant RLS
Every usage event, ledger row, daily rollup, and alert is scoped with `organization_id`. Supabase RLS policies guarantee:
- Tenant A cannot query or export usage from Tenant B.
- Provider cost figures are server-side restricted to Admin and Owner roles.
