# VANNI Golden Path: Reference Customer Journey & Validation

This specification defines the canonical **Golden Path** user journey for an enterprise customer onboarding onto the **VANNI** platform, using **Sri Krishna Dental & Implant Clinic** as the reference benchmark.

---

## 1. Journey Overview: A to AJ Steps

```
[Customer Signup] 
       │
       ▼
[Organization Created: Sri Krishna Dental]
       │
       ▼
[Onboarding & Business Brain Configured]
  • Operating Hours: Mon-Sat 09:30-20:00, Sun 10:00-14:00
  • Staff: Dr. Sneha Rao (MDS Endodontics & Implantology)
  • Services: Teeth Cleaning (₹800-₹1,200), RCT (₹3,500-₹4,500)
  • Policies: Zero Prescriptions, Mandatory Clinical Examination
       │
       ▼
[AI Employee Configured: Kavya - AI Dental Receptionist]
       │
       ▼
[Knowledge Source Uploaded & Published: Services & Timings Guide]
       │
       ▼
[Agent Published: Immutable Snapshot v1.0]
       │
       ▼
[Phone Number Connected: +91 80 4719 2003]
       │
       ▼
[Inbound Voice Call Simulated]
  • Turn 1 (EN): Caller asks "What is the cost of Root Canal Treatment?"
  • AI: Retrieves authoritative pricing from Business Brain (₹3,500-₹4,500).
  • Turn 2 (KN): Caller switches: "ಹೌದಾ, ನಾಳೆ ಸಂಜೆ 5 ಗಂಟೆಗೆ Dr. Sneha Rao ಅವರ ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ಸಿಗುತ್ತಾ?"
  • AI: Code-switches naturally to Kannada. Checks slot via `check_availability`.
  • Turn 3 (KN): Slot is available. AI asks for confirmation before booking.
  • Caller: "ಹೌದು, ಕನ್ಫರ್ಮ್ ಮಾಡಿ."
  • Tool Call: `create_appointment` executes with EXPLICIT confirmation.
  • Turn 4 (EN): Caller asks: "Can you transfer me to the front desk receptionist?"
  • Tool Call: `request_human_handoff` creates escalation ticket.
       │
       ▼
[Call Concluded & Post-Call Pipeline Executed]
  • Contact Record: Matched/created (+91 98450 12345).
  • Lead Record: Created with intent "DENTAL_APPOINTMENT" & qualification score.
  • Call Outcome: APPOINTMENT_BOOKED & HUMAN_TRANSFERRED.
  • CRM Activity: Timeline entry logged with duration and appointment link.
  • Usage Metering: 2.5 voice minutes deducted from organization quota.
  • Audit Trail: End-to-end correlation ID logged.
```

---

## 2. Assertion Verification Matrix

| Step | Objective | Expected Result | Pass Criteria |
| :--- | :--- | :--- | :--- |
| **A** | Organization Setup | Active Org created with DENTAL industry template | Org ID exists, industry = `DENTAL` |
| **B** | Business Brain Snapshot | Services, staff, hours, and policies compiled | 2 services, 1 doctor, 7 day schedules present |
| **C** | Knowledge Ingestion | Document chunked and indexed | Content status = `READY`, Authority = `AUTHORITATIVE` |
| **D** | Agent Publication | Immutable version created | `activeVersion` = 1, snapshot immutable |
| **E** | Routing Map | Phone number mapped to Agent Version | Inbound called number resolves to Kavya v1 |
| **F** | Language Intelligence | Natural bilingual English/Kannada/Kanglish handling | Accurate detection, fluent response |
| **G** | Tool Guardrails | Explicit confirmation required for booking | Tool rejects commit without confirmation |
| **H** | Post-Call Processing | CRM, Lead, Appointment, Usage, Analytics sync | All records created with matching correlation ID |
