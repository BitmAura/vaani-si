# VANNI Billing, Plans, Subscriptions & Usage Entitlements Architecture

## 1. Architectural Philosophy & Separation of Concerns

The VANNI Billing, Plans, Subscriptions and Usage Entitlement Engine governs the commercial SaaS lifecycle across tenant organizations without ever interfering with or corrupting real-time voice, STT, TTS, or LLM conversations.

```
                    VANNI PLATFORM
                          │
                  ORGANIZATION (Tenant)
                          │
                   BILLING ACCOUNT
                          │
       ┌──────────────────┼──────────────────┐
       ▼                  ▼                  ▼
     PLAN            SUBSCRIPTION       ENTITLEMENTS
(Versioned)          (Lifecycle)        (Quotas/Flags)
       │                  │                  │
       └──────────────────┼──────────────────┘
                          │
                          ▼
                    USAGE METERS
                          │
                          ▼
                     USAGE LEDGER
                          │
                          ▼
                   BILLING PROVIDER
                          │
                          ▼
                 RAZORPAY GATEWAY
                          │
                          ▼
                   WEBHOOK ENGINE
                          │
                   BILLING EVENTS
                          │
       ┌──────────────────┼──────────────────┐
       ▼                  ▼                  ▼
  ENTITLEMENTS          AUDIT          NOTIFICATIONS

─────────────────────────────────────────────────────────────
SEPARATE REALTIME VOICE EXECUTION PATH:

VOICE CALL / ORCHESTRATION ENGINE
             │
             ▼
    PRE-FLIGHT ENTITLEMENT CHECK (Non-blocking)
             │
      ┌──────┴──────┐
      ▼             ▼
   [ALLOW]       [RESTRICT]
 (Active Call)  (Graceful Redirect / Notice)
```

### Critical Non-Negotiables:
1. **Zero Runtime Disruption**: Inbound and ongoing telephone calls or live webRTC conversations are **never interrupted mid-call** due to delayed usage reconciliation or third-party payment gateway outages.
2. **Provider Independence**: Core business logic interacts exclusively through the `IBillingProvider` abstraction. Razorpay-specific API calls and cryptographic logic are quarantined inside `@vanni/providers`.
3. **No Phantom Data Deletion**: Downgrading an organization from a higher plan to a lower plan never deletes agents, contacts, or knowledge chunks. The organization enters an explicit `ENTITLEMENT_EXCEEDED` state, halting new additions while leaving business data intact.

---

## 2. Plan & Versioning Architecture

Plans are versioned and stored in database migrations to protect existing customers from retroactive price or quota alterations.

### Plan Tiers:
- **Starter Plan** (`starter`): Ideal for single-location clinics & offices (2 AI Employees, 600 Monthly Voice Minutes, 1 Location, no outbound campaigns).
- **Growth Plan** (`growth`): For polyclinics and real estate sales teams (5 AI Employees, 2,500 Voice Minutes, Outbound Campaigns enabled, CRM webhooks enabled).
- **Enterprise Plan** (`enterprise`): High-volume SIP trunking, custom SLAs, unlimited or negotiated quotas, manual billing.

---

## 3. Subscription State Machine

A tenant subscription traverses explicit lifecycle states:

```
                  ┌──────────────┐
                  │   TRIALING   │ (14 Days Default)
                  └──────┬───────┘
                         │ (Upgrades / Pays)
                         ▼
                  ┌──────────────┐
       ┌──────────┤    ACTIVE    ├──────────┐
       │          └──────┬───────┘          │
       │                 │                  │
       │ (Payment Fails) │ (Cancel Request) │ (Downgrade)
       ▼                 ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐
│   PAST_DUE   │  │CANCEL_AT_END │  │ ENTITLEMENT_EXCEEDED │
└──────┬───────┘  └──────┬───────┘  └──────────────────────┘
       │                 │
       │ (Grace Expiry)  │ (Period Ends)
       ▼                 ▼
┌──────────────┐  ┌──────────────┐
│  RESTRICTED  │  │  CANCELLED   │
└──────────────┘  └──────────────┘
```

---

## 4. Pre-Flight Entitlement Enforcement Points

Before high-cost operations run, the `EntitlementService` conducts deterministic pre-flight checks:

| Operation | Enforcement Point | Behavior when Exceeded |
| :--- | :--- | :--- |
| **Realtime Voice Session** | `preflightVoiceCall(orgId, minutes)` | Warns at 90% (`NEAR_LIMIT`); switches to overage pricing (`OVERAGE`) if configured; never terminates active mid-call streams. |
| **Outbound Campaign** | `preflightCampaign(orgId, targets)` | Blocks execution if `campaignsEnabled === false` or target count exceeds remaining quota. |
| **AI Employee Creation** | `checkLimit(orgId, 'maxAiEmployees', 1)` | Prevents creation if current active count $\ge$ allowed limit. |
| **Knowledge Ingestion** | `checkLimit(orgId, 'maxKnowledgeStorageMb', size)` | Blocks file upload if organization exceeds storage quota. |

---

## 5. Razorpay Integration & Webhook Security

- **Cryptographic Verification**: Webhooks are validated using HMAC-SHA256 (`x-razorpay-signature`) against raw request buffers via `crypto.timingSafeEqual` to eliminate timing attacks.
- **Idempotency Guarantee**: Every incoming provider event is recorded in `public.billing_provider_events` with unique composite indexing `(provider, provider_event_id)`. Replayed webhooks are acknowledged as `IGNORED_DUPLICATE` with zero duplicate ledger charges.
- **Paise to INR Normalization**: Razorpay amounts (reported as integer paise) are automatically normalized to standard INR (divided by 100) before ledger persistence.
