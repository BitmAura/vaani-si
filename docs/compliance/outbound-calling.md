# VANNI Outbound Calling Compliance & Regulatory Playbook

## 1. Compliance Disclaimer
*This document outlines the operational and technical guardrails implemented in the VANNI Outbound Campaign Engine. It does not constitute formal legal advice. Deploying businesses must independently verify their telemarketing and calling operations against local statutory regulations (e.g. TRAI Telecom Commercial Communications Customer Preference Regulations - TCCCPR 2018 in India).*

---

## 2. Mandatory Guardrails Enforced Server-Side

### A. Mandatory AI Identity Disclosure
Under consumer protection and transparency principles, VANNI AI Employees must **never impersonate human beings** or obscure their artificial nature.
- **Enforcement**: Campaign activation requires an explicit `identity_disclosure` prompt.
- **Standard Format**: *"Namaskara, nanu VANNI, an AI assistant calling on behalf of [Business Name] regarding your recent inquiry."*

### B. Calling Time Windows
- Outbound customer calls are strictly restricted to business daylight hours (default: 10:00 AM to 6:00 PM IST).
- No automated calls can be initiated outside these hours, on national/state public holidays, or during business blackout periods.

### C. Do-Not-Contact (DNC) / Suppression Priority
- If a customer requests suppression or states *"Please do not call me"*, the contact is immediately transitioned to `DO_NOT_CONTACT`.
- All ongoing campaign targets for that contact are cancelled immediately.
- The `OutboundEligibilityEngine` rejects any future automated calls server-side.

### D. Conservative Attempt & Concurrency Capping
- Default retry ceiling: **Maximum 3 attempts** per lead/appointment.
- Non-retryable outcomes: `OPTED_OUT`, `CUSTOMER_NOT_INTERESTED`, `ALREADY_COMPLETED`.
- Bounded concurrency limits prevent high-frequency dialing bursts.
