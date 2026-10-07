# VANNI Business Brain — Source of Truth & Authority Hierarchy

## 1. Hierarchy of Source Authority

To eliminate hallucination and resolve contradictory facts deterministically, VANNI establishes an explicit 8-level Source of Truth priority:

```
Rank 1: Explicit Business Configuration (Owner-configured settings in console)
Rank 2: Structured Operational Data (Database Services, Staff, Locations, Operating Hours)
Rank 3: Approved Business Policies (Cancellation, Escalation, Emergency, Legal)
Rank 4: Approved Multilingual FAQs (Verified Q&A pairs)
Rank 5: Retrieved Business Documents (Uploaded PDFs, brochures — Prompt 07)
Rank 6: Website Knowledge (Scraped pages, public portals)
Rank 7: Current Conversation Context (Caller statements, turns in session)
Rank 8: General LLM Pretrained Knowledge
```

---

## 2. Invariant: General Model Knowledge Never Overrides Business Data

| Scenario | General Model "Knowledge" | VANNI Authoritative Database | VANNI Autonomous Response |
| :--- | :--- | :--- | :--- |
| **Dental Consultation Fee** | "Root canals typically cost ₹3,000–₹12,000" | ₹4,500 listed in `business_services` | Quotes exactly ₹4,500. |
| **Missing Pricing** | General models estimate ₹800–₹1,500 | No price listed (`price_minimum = NULL`) | Returns `UNKNOWN_INFORMATION`: "Pricing requires a clinical consultation; I will connect you with our team." |
| **Real Estate Availability** | "Projects in Ballari usually have 30x40 plots available" | Inventory table indicates Phase 2 sold out | Accurately states Phase 2 is fully booked. Does not promise unverified plots. |
| **Doctor Prescription** | "Amoxicillin 500mg is common for tooth infections" | Healthcare Guardrail: `NEVER_PRESCRIBE` | Refuses medical diagnosis and transfers to clinic receptionist. |

---

## 3. Authority Level Classification

Each fact, service, policy, and FAQ is tagged with a `KnowledgeAuthority`:

1. **`AUTHORITATIVE`**: Entered directly by an organization `OWNER` or `ADMIN`. Treated as absolute truth.
2. **`APPROVED`**: Entered by staff or suggested by onboarding engine and formally approved by a manager.
3. **`REFERENCE`**: Scraped from external websites or imported from draft documentation.
4. **`UNVERIFIED`**: Candidate fact inferred from customer conversations or unreviewed uploads. Cannot be used for pricing or medical claims.
