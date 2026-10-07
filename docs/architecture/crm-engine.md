# VANNI CRM, Contacts & Lead Management Engine Architecture

## 1. System Overview & Philosophy
The **VANNI CRM & Lead Management Engine** turns customer conversations into reliable business records of truth.

Unlike bloated enterprise CRMs designed around manual sales rep data entry, the VANNI CRM is built natively around **autonomous AI customer interactions**:

```
VOICE / WEB / FUTURE CHANNELS
              │
              ▼
         CONVERSATION
              │
              ▼
      CONTACT RESOLUTION (Phone / Email Deduplication)
              │
      +───────┴───────+
      │               │
      ▼               ▼
   CONTACT          LEAD
                      │
                      ▼
               QUALIFICATION (Deterministic Rules)
                      │
          +-----------+-----------+
          │           │           │
          ▼           ▼           ▼
     APPOINTMENT   CALLBACK    HANDOFF
          │
          ▼
       ACTIVITY
          │
          ▼
     OUTCOME & BUSINESS METRICS
```

---

## 2. Core Entities & Lifecycle

### A. Contact
- **Identity Resolution**: Canonical E.164 phone normalization via `ArgumentNormalizer`.
- **Deduplication**: Match hierarchy:
  1. Exact Phone Match -> Reuses existing contact.
  2. Exact Email Match -> Reuses existing contact.
  3. No Match -> Creates new verified contact.
- **Suppression (Do Not Contact)**: Server-side suppression. When marked `DO_NOT_CONTACT`, the contact is immediately blocked from automated outreach, callbacks, or campaigns.

### B. Lead
- **Lifecycle Statuses**: `NEW`, `CONTACTED`, `QUALIFIED`, `UNQUALIFIED`, `CONVERTED`, `LOST`, `DO_NOT_CONTACT`.
- **Progression Stages**: `NEW` -> `QUALIFICATION` -> `FOLLOW_UP` -> `APPOINTMENT` -> `PROPOSAL` -> `CONVERTED` / `LOST`.
- **Industry Qualification**:
  - **Dental**: Clinical service needed, preferred clinic/doctor, urgency, preferred slot.
  - **Real Estate**: Project, layout type, location, budget, purchase timeline, site visit requested.
  - **Healthcare / IVF**: Administrative consultation inquiry, location, preferred time.

### C. Deterministic Scoring Foundation
Transparent score (0–100) based on verified customer intent:
- Requirement clearly stated: **+20**
- Location known: **+15**
- Budget / Fee range known: **+15**
- Timeline known: **+15**
- Appointment / Site visit requested: **+20**
- Direct phone verified: **+10**
- Email provided: **+5**

Score $\ge 60$: `QUALIFIED`  
Score $30 - 59$: `PARTIALLY_QUALIFIED`  
Score $< 30$: `NOT_STARTED`

### D. Activity Timeline
Every operational interaction emits an activity record (`CALL`, `MESSAGE`, `LEAD_CREATED`, `LEAD_UPDATED`, `APPOINTMENT_CREATED`, `STAGE_CHANGED`, `STATUS_CHANGED`). No fake activities or speculative reasoning are ever recorded.

---

## 3. Multi-Tenancy & Row-Level Security (RLS)
Implemented in [012_crm_and_lead_management.sql](file:///p:/crazy-ai-stack/vaani-si/supabase/migrations/012_crm_and_lead_management.sql):
- Strict tenant boundary isolation on `organization_id`.
- Tenant A cannot access Tenant B contacts, leads, or activities under any circumstance.
