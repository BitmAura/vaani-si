# VANNI MVP Definition — AI Receptionist for Real-World Businesses

**Version**: 1.0.0 Release Candidate  
**Target Reference Industry**: Dental & Multi-Chair Clinics (exercising Healthcare guardrails, appointments, doctors, hours, and handoffs)  
**Primary Platform Concept**: **AI Employee** (not "bot" or "assistant")

---

## 1. Core Value Proposition & Single MVP Objective

The VANNI MVP delivers:
> **A complete, end-to-end autonomous AI Employee that answers real incoming business calls in Kannada, English, and Kanglish, understands business facts from a verified Business Brain, checks doctor/staff availability, schedules confirmed appointments, captures qualified leads, escalates to human receptionists when appropriate, and tracks full usage and billing entitlements.**

### Golden Rule:
One Business $\to$ One AI Employee $\to$ One Real Conversation $\to$ One Successful Business Action (Appointment / Lead / Handoff).

---

## 2. MVP Scope Boundaries

### IN-SCOPE (The Connected MVP Loop):
1. **Self-Service Organization Onboarding**:
   - Organization creation & industry selection (`DENTAL` reference).
   - Operating hours, location addresses, consulting dentists, treatment offerings, and business policies.
2. **Business Brain Compilation**:
   - Zero-duplicate data entry: onboarding choices immediately compile into the tenant's Business Brain snapshot.
3. **Knowledge Ingestion & Vector Retrieval**:
   - Upload clinic documents/FAQs with automated chunking and SSRF-hardened web validation.
   - Grounded RAG answering with zero hallucination of prices or treatment guarantees.
4. **AI Employee Configuration & Immutable Versioning**:
   - Pre-configured Dental AI Receptionist (`Dr. Teeth Care Receptionist`).
   - Strict publish validation and immutable version pinning.
5. **Real-Time Conversational Voice Runtime**:
   - Bi-directional audio streaming via WebSocket/WebRTC.
   - Seamless Kannada $\leftrightarrow$ English code-switching.
   - VAD interruption & barge-in support.
6. **Business Tool Execution Engine**:
   - `find_customer` & `create_customer` (Contact matching).
   - `create_lead` & `qualify_lead` (Deterministic qualification).
   - `check_availability` & `create_appointment` (Slot booking with confirmation gate).
   - `request_human_handoff` (Warm transfer / callback).
7. **CRM, Activity & Call Timeline**:
   - Linked contacts, leads, appointment slots, and post-call summaries.
8. **Observability, Usage Metering & Billing Entitlements**:
   - Pre-flight quota verification before voice session initiation.
   - Voice minutes metering, non-destructive over-entitlement, and Razorpay subscription readiness.

### OUT-OF-SCOPE FOR MVP (Deferred to v1.1+):
- Outbound multi-agent robocall dialing blasts (focus is high-quality inbound service).
- Native EHR automated database sync (FHIR/HL7).
- Multi-currency international Stripe subscriptions (INR Razorpay is primary).
- Self-hosted Kubernetes or custom SIP hardware PBX firmware.
