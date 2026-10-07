# VANNI Human Handoff, Escalation & Notification Engine

## 1. Architectural Philosophy
The core principle governing VANNI's architecture is:
> **AI SHOULD NOT TRY TO HANDLE EVERYTHING.**
> A production conversational AI employee must possess a deterministic, audited, reliable escape path to human teams.

VANNI establishes a controlled boundary between the **AI Employee** and the **Human Employee**, managing transitions across:
- **Autonomous AI Execution**
- **Clarification Seeking**
- **Live Inbound Call Transfer**
- **Guaranteed Callback Generation**
- **Human Work Queue Review**
- **Urgent Emergency / Safety Escalation**

---

## 2. Precedence Hierarchy
When evaluating escalation rules and safety thresholds, the system enforces strict hierarchical precedence:

```
Platform Safety (Emergency / Casualty)
       >
Compliance & Regulatory
       >
Emergency / Medical Safety
       >
Industry Policy
       >
Business Policy
       >
Agent Configuration
       >
Conversation Context
```

*Crucial Rule*: A business cannot configure its AI agent to "Never transfer calls" and bypass emergency/casualty triggers (e.g. chest pain, severe trauma, 108 emergency alerts). Safety rules unconditionally win.

---

## 3. Escalation Lifecycle & State Machine

```
              INCOMING UTTERANCE / TOOL FAILURE / SAFETY ALERT
                                     │
                                     ▼
                        [Escalation Policy Evaluation]
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
    LIVE_TRANSFER             CALLBACK_REQUEST             HUMAN_REVIEW / TEAM
         │                           │                           │
         ▼                           ▼                           ▼
[Destination Resolver]       [ToolEngine: Callback]       [Work Queue & Notification]
         │                           │                           │
    ┌────┴────┐                      │                           │
 Available   Unavailable             │                           │
    │             │                  │                           │
    ▼             ▼                  │                           │
Telephony      Fallback              │                           │
.transferCall() to Callback          │                           │
    │             │                  │                           │
    ▼             ▼                  ▼                           ▼
TRANSFERRED  CALLBACK_SCHEDULED   CALLBACK_SCHEDULED          ASSIGNED / PENDING
                                                                 │
                                                                 ▼
                                                        [Atomic Accept / Claim]
                                                                 │
                                                                 ▼
                                                            IN_PROGRESS
                                                                 │
                                                                 ▼
                                                             RESOLVED
```

### Handoff States
- `REQUESTED`
- `VALIDATING`
- `PENDING`
- `ASSIGNED`
- `ACCEPTED`
- `IN_PROGRESS`
- `TRANSFER_PENDING`
- `TRANSFERRED`
- `CALLBACK_SCHEDULED`
- `RESOLVED`
- `DECLINED`
- `EXPIRED`
- `FAILED`
- `CANCELLED`

---

## 4. Warm Transfer Context & Summaries
When a call is transferred to a human, or an issue is escalated into the work queue, VANNI generates a structured, factual operational summary without hallucination or exposing private system prompts:

```json
{
  "customerSummary": "Vinay Kumar (+91 98450 98765)",
  "reason": "NEGOTIATION_REQUIRED",
  "request": "Caller is asking for a 15% discount on the 3-unit bridge package if confirmed today.",
  "relevantEntities": {
    "department": "Treatment Coordination",
    "verified": true
  },
  "recentActions": [
    "[AI] Hello Vinay, were you inquiring about the dental treatment?",
    "[CUSTOMER] Can you give me a 15% discount if I confirm the date today?",
    "[AI] Standard pricing is ₹35,000. Bundle discounts require manager approval."
  ],
  "pendingAction": "Human Treatment Coordinator callback to offer valid festive package.",
  "preferredLanguage": "kn-IN",
  "urgency": "HIGH",
  "generatedByAI": true
}
```

---

## 5. Atomic Claiming & Race Condition Protection
When multiple staff members view the handoff queue simultaneously, double-acceptance is blocked at the database engine level via atomic assignment validation:
```typescript
if (record.assignedUserId && record.assignedUserId !== userId && (record.status === 'ACCEPTED' || record.status === 'IN_PROGRESS')) {
  return { success: false, error: 'Already assigned to another team member.' };
}
```

---

## 6. Multi-Tenant RLS & Security
Every handoff, team, notification, and SLA record includes `organization_id`. Supabase RLS policies ensure:
1. Staff in Org A cannot view, claim, or resolve handoffs in Org B.
2. Notifications are private to the recipient user within their respective organization.
3. The AI Agent cannot self-assign or resolve human tickets.
