# VANNI End-to-End MVP Integration Flow

This document details the unified data flow, input/output schemas, security boundaries, and runtime handoffs connecting all 20 VANNI modules into one operational SaaS.

```
                           [ NEW BUSINESS CUSTOMER ]
                                       │
                                       ▼
                             AUTH & ONBOARDING
                     (Signup -> Org -> Industry: Dental)
                                       │
                                       ▼
                                BUSINESS BRAIN
                   (Locations, Hours, Doctors, Treatments, Policies)
                                       │
                                       ▼
                                KNOWLEDGE BASE
                     (Doctor bios, Root Canal FAQs, Pricing)
                                       │
                                       ▼
                                 AI EMPLOYEE
                  (Kavya - Dental Receptionist, Published v1.0)
                                       │
                                       ▼
                               TELEPHONY GATEWAY
                    (Inbound Phone Number: +91 80 4719 2003)
                                       │
                                       ▼
                       [ CALL ARRIVES: +91 98450 12345 ]
                                       │
                         PRE-FLIGHT ENTITLEMENT CHECK
                            (Active Plan & Quota)
                                       │
                                       ▼
                           REAL-TIME VOICE RUNTIME
                               (WebSocket WSS)
                                       │
          ┌────────────────────────────┼────────────────────────────┐
          ▼                            ▼                            ▼
     SARVAM STT                 KANADA INTELLIGENCE             SARVAM TTS
   (Audio -> Text)            (Code-Switching Engine)         (Text -> Audio)
          │                            │                            │
          └────────────────────────────┼────────────────────────────┘
                                       │
                                       ▼
                              CONTEXT & LLM ENGINE
                   (Business Brain Facts + Knowledge Retrieval)
                                       │
                                       ▼
                             TOOL EXECUTION ENGINE
     ┌─────────────────────────┬─────────────────────────┬─────────────────────────┐
     ▼                         ▼                         ▼                         ▼
find_customer             create_lead          check_availability       request_human_handoff
(Contact match)      (Service inquiry)       (Doctor slot check)       (Escalation / Callback)
     │                         │                         │                         │
     └─────────────────────────┼─────────────────────────┼─────────────────────────┘
                               │
                               ▼
                       CREATE APPOINTMENT
                  (Confirmed Slot with Doctor)
                               │
                               ▼
                        CALL TERMINATION
               (Audio Ended & Watchdog Cleaned Up)
                               │
                               ▼
                   POST-CALL ASYNC RECONCILIATION
     ┌─────────────────────────┼─────────────────────────┐
     ▼                         ▼                         ▼
CONVERSATION SUMMARY     CRM TIMELINE          USAGE METERING & BILLING
(Factual recap)      (Contact/Lead linked)    (Minutes debited from ledger)
```

---

## 1. Module-by-Module Connection Contracts

### A. Auth & Onboarding $\to$ Business Brain
- **Input**: User organization form (`businessName`, `industryType: 'DENTAL'`, `phone`, `operatingHours`, `staffMembers`, `services`).
- **Processing**: Automatically maps input entities into `BusinessLocationDTO`, `BusinessOperatingHoursDTO`, `BusinessStaffDTO`, and `BusinessServiceDTO`.
- **Output**: Persisted in `@vanni/database` and immediately retrievable via `globalDb.getLatestSnapshot(orgId)`. Zero duplicate manual data entry.

### B. Business Brain $\to$ AI Employee Runtime
- **Input**: Agent initialization query with `organizationId`.
- **Processing**: The `@vanni/context-engine` compiles concise business facts, location address, and active hours without overloading the LLM system prompt token budget.
- **Security Guardrail**: Precedence rule guarantees `INDUSTRY_GUARDRAILS_HEALTHCARE_ZERO_DIAGNOSIS` overrides custom instructions.

### C. Inbound Call $\to$ Telephony Gateway $\to$ Voice Gateway
- **Input**: Provider webhook POST containing caller number, called virtual number, and call SID.
- **Verification**: Signature check + called-number lookup routing to active published agent version.
- **Pre-flight Check**: `EntitlementService.preflightVoiceCall(orgId)` verifies voice minutes quota. If available or in configured overage, call proceeds.

### D. Conversational Audio Streaming $\to$ Kannada/Kanglish Intelligence
- **STT**: Inbound 16kHz PCM audio stream transcribed via Sarvam Saaras.
- **Code-Switching**: Automatic script normalization between Kannada (`ಕನ್ನಡ`) and Latin-script Kanglish (`oota aayitha?`).
- **Barge-in**: Immediate VAD event triggers audio buffer flush and playback interruption.

### E. LLM $\to$ Tool Execution Engine
- **Tool 1: `find_customer` / `create_customer`**: Deduplicates patient record using E.164 phone number.
- **Tool 2: `create_lead` & `qualify_lead`**: Captures dental procedure intent (e.g. Root Canal / Teeth Whitening).
- **Tool 3: `check_availability`**: Queries clinic timetable for requested date and doctor.
- **Tool 4: `create_appointment`**: Enforces `isConfirmed: true` confirmation gate before committing slot.
- **Tool 5: `request_human_handoff`**: Escalates to human desk if emergency or complex patient inquiry.

### F. Call End $\to$ Post-Call Analytics, Usage & Billing
- **Call Detail Record**: Duration, direction, outcome (`APPOINTMENT_BOOKED`, `HUMAN_TRANSFERRED`).
- **Conversation Summary**: Generates factual bullet-point recap without leaking LLM reasoning chains.
- **Usage Metering**: Ingests `VOICE_DURATION` event into `usage_events` and pre-billing ledger.
- **Billing Snapshot**: Updates quota meters visible on `/app/billing.html`.
