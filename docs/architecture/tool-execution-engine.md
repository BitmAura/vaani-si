# VANNI Action & Tool Execution Engine Architecture

## 1. Executive Summary & Core Principle

The **VANNI Action & Tool Execution Engine** transitions the platform from *"AI that can talk"* to *"AI that can safely perform business actions"* (lead capture, appointment booking, rescheduling, human handoffs, callbacks, and verified information retrieval).

### The Inviolable Security Boundary
The Large Language Model (LLM) **NEVER** directly executes arbitrary business actions, nor does it write to databases, invoke arbitrary HTTP endpoints, or run shell scripts.

The LLM may only **propose / request** an action. The server-side Tool Engine decides whether that action is:
1. **Registered & Enabled**
2. **Authorized for the Tenant and Agent**
3. **Compliant with Industry Safety Guardrails (Healthcare, IVF, RERA)**
4. **Valid against strict Zod runtime schemas**
5. **Confirmed by the Customer** (for HIGH-risk mutations)
6. **Free of concurrency slot conflicts** (atomic booking)
7. **Idempotent against duplicate requests**

```
                USER (Caller / Web)
                         │
                         ▼
             CONVERSATION ORCHESTRATOR
                         │
                         ▼
                    LLM DECISION
                         │
                         ▼
                    TOOL REQUEST
                         │
                         ▼
              +----------------------+
              |  TOOL REGISTRY CHECK |
              +----------------------+
                         │
                         ▼
              AUTHORIZATION & RLS (OrgId)
                         │
                         ▼
              INDUSTRY SAFETY POLICY
                         │
                         ▼
              ZOD ARGUMENT VALIDATION
                         │
                         ▼
              CONFIRMATION POLICY CHECK
                         │
                         ▼
              ATOMIC HANDLER EXECUTION
                         │
                         ▼
              RESULT & AUDIT EVENT EMISSION
                         │
                         ▼
             CONVERSATION ORCHESTRATOR
                         │
                         ▼
                USER (Natural Fact)
```

---

## 2. Foundational 16 Tool Catalog

| Category | Tool Name | Risk Level | Confirmation Mode | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **CUSTOMER** | `find_customer` | LOW | NONE | Look up existing customer by normalized phone number. |
| **CUSTOMER** | `create_customer` | MEDIUM | NONE | Create new verified customer profile. |
| **CUSTOMER** | `update_customer` | MEDIUM | NONE | Update contact details or language preference. |
| **LEAD** | `create_lead` | MEDIUM | IMPLICIT | Capture lead requirement, budget, timeline, and score. |
| **LEAD** | `update_lead` | MEDIUM | NONE | Enrich lead notes, location, or stage. |
| **LEAD** | `qualify_lead` | MEDIUM | NONE | Deterministic rule-based lead qualification. |
| **APPOINTMENT** | `check_availability` | LOW | NONE | Query verified appointment slots on a given date. |
| **APPOINTMENT** | `create_appointment` | HIGH | EXPLICIT | Book slot atomically with conflict prevention. |
| **APPOINTMENT** | `reschedule_appointment`| HIGH | EXPLICIT | Change appointment time atomically. |
| **APPOINTMENT** | `cancel_appointment` | HIGH | EXPLICIT | Cancel previously scheduled appointment. |
| **CALLBACK** | `create_callback_request`| MEDIUM | IMPLICIT | Schedule business callback during operating hours. |
| **TRANSFER** | `request_human_handoff`| HIGH | NONE | Escalate caller to receptionist or doctor. |
| **FOLLOW_UP** | `create_follow_up` | MEDIUM | NONE | Create internal CRM task for sales/support team. |
| **BUSINESS INFO** | `get_business_hours` | LOW | NONE | Retrieve official verified opening hours. |
| **BUSINESS INFO** | `get_business_services`| LOW | NONE | Retrieve verified services and starting pricing. |
| **BUSINESS INFO** | `get_business_location`| LOW | NONE | Retrieve official clinic/office address and landmarks. |

---

## 3. Concurrency & Slot Conflict Prevention
Double bookings are prevented using two layers:
1. **Database Constraint**: Migration `011_action_and_tool_engine.sql` establishes a partial unique index:
   ```sql
   CREATE UNIQUE INDEX uq_appointment_staff_slot 
   ON public.business_appointments(organization_id, staff_id, start_time) 
   WHERE status IN ('REQUESTED', 'CONFIRMED') AND staff_id IS NOT NULL;
   ```
2. **Repository Pre-Check**: `checkSlotConflict()` checks overlap condition `(ReqStart < ExistEnd && ReqEnd > ExistStart)` across all active appointments for the tenant.

If a conflict occurs, the system emits `SLOT_CONFLICT` and prompts the conversational AI to offer alternate slots, never claiming a false booking.

---

## 4. Multi-Tenant Row Level Security (RLS)
The tenant context (`organizationId`) is **never trusted** from the LLM arguments. It is strictly injected from the authenticated session context (`ToolSecurityContext`). In queries and updates, tenant boundary checks are enforced:
- Cross-tenant lookups return `NOT_FOUND` or throw `TENANT_MISMATCH_ATTEMPT`.
- All database tables in `011_action_and_tool_engine.sql` enforce `current_user_org_ids()` RLS policies.

---

## 5. Audit Logging & Observability
Every execution emits a structured `tool_execution_events` record with:
- `organization_id`, `conversation_id`, `agent_id`, `agent_version`
- `tool_name`, `tool_version`, `lifecycle_state`
- Sanitized arguments (passwords and secrets redacted)
- Safe execution status and duration in milliseconds
