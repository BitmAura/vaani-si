# VANNI Outbound Calling & Campaign Engine Architecture

## 1. System Vision & Non-Negotiable Core Principle
The **VANNI Outbound Calling & Campaign Engine** enables local Indian businesses to perform legitimate, permissioned, compliance-aware follow-up calls (lead qualification, appointment reminders, callback fulfillment, and site-visit confirmations).

The system is strictly designed **NOT** to be an unrestricted robocalling or spam-dialing engine.

Every call must traverse a multi-layered server-side boundary:

```
CRM AUDIENCE (Leads / Appointments / Callbacks)
                  │
                  ▼
        ELIGIBILITY EVALUATION
  (16-Point Legal, Commercial & Operational Checks)
                  │
        +---------┴---------+
        │                   │
   [ELIGIBLE]           [BLOCKED]
        │                   │
        ▼                   ▼
  DURABLE JOB QUEUE     AUDIT REASON RECORDED
        │              (DO_NOT_CONTACT / OUTSIDE_WINDOW)
        ▼
  WORKER LEASE CLAIM
  (Atomic Concurrency Guard)
        │
        ▼
  TELEPHONY DISPATCH (Exotel / Mock Provider)
        │
        ▼
  VOICE RUNTIME & CONVERSATION ENGINE
  (Pinned Published Agent Version)
        │
        ▼
  MANDATORY AI IDENTITY DISCLOSURE
  ("Namaskara, nanu VANNI, an AI assistant...")
        │
        ▼
  CONTROLLED ACTION EXECUTION (Tool Engine)
        │
        ▼
  BUSINESS & TELEPHONY OUTCOME RECORDING (CRM)
```

---

## 2. The 16-Point Outbound Eligibility Engine
Implemented in [packages/campaign-engine/src/eligibility.ts](file:///p:/crazy-ai-stack/vaani-si/packages/campaign-engine/src/eligibility.ts):
1. **Contact Record Exists**: Non-empty contact record.
2. **Valid Phone Number**: Canonical E.164 phone string $\ge 10$ digits.
3. **Suppression (Not DNC)**: Customer has not opted out (`status !== 'DO_NOT_CONTACT'`).
4. **Not Archived**: Contact is active.
5. **Campaign Active**: Campaign in `ACTIVE` or `READY` status.
6. **Agent Published & Active**: Referenced AI Employee version is published and active.
7. **Calling Window Valid**: Local business time falls between configured start and end hours (e.g. 10:00–18:00 IST).
8. **Allowed Day of Week**: Calling occurs only on configured days (e.g., Monday through Saturday).
9. **Blackout / Holiday Check**: Call is blocked on Karnataka government holidays or business blackout dates.
10. **Under Retry Limit**: Attempts count does not exceed `maxAttemptsPerTarget` (default: 3).
11. **Target Incomplete**: Target has not already completed or converted.
12. **No Active Call on Target**: Concurrency collision check prevents parallel calls to the same recipient.
13. **Campaign Concurrency Capacity**: Active calls do not exceed campaign concurrency limits.
14. **Organization-Level Limits**: Respects overall tenant subscription caps.
15. **Consent Policy Satisfied**: Validated where required.
16. **Channel Capable**: Pinned telephony carrier is healthy.

---

## 3. Durable Job Engine & Concurrency Control
- **Durable Scheduling**: All scheduled attempts are stored in `campaign_jobs` with unique idempotency keys (`job_{campaignId}_{targetId}_{attemptNumber}`).
- **Atomic Job Leasing**: Workers claim jobs via atomic leasing (`LOCKED`, `locked_by = workerId`, `locked_at = now()`), ensuring multiple concurrent workers or application restarts never double-call a recipient.
- **Provider-Independent Telephony**: Dispatches via `ITelephonyProvider.dispatchOutboundCall()`, creating identical `TelephonySession` and `VoiceSession` objects as inbound calls.

---

## 4. Immediate Opt-Out & Suppression Flow
When a recipient indicates *"Don't call me again"*, the system immediately:
1. Transitions target status to `OPTED_OUT`.
2. Updates contact status in CRM to `DO_NOT_CONTACT` with suppression reason.
3. Automatically cancels any queued future jobs.
4. Emits a compliance audit activity in `crm_activities`.
