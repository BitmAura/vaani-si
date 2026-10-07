# Human Handoff & Emergency Escalation

## 1. Escalation Triggers
1. **Customer Request**: Caller explicitly asks to speak to a person, front desk, or manager.
2. **Medical Emergency**: Detection of acute chest pain, trauma, heavy bleeding, or breathing difficulty in healthcare/IVF contexts.
3. **Repeated Misunderstanding**: Model confidence consistently low or caller confused.
4. **Tool Failure**: Booking or CRM gateway unavailable.
5. **High-Value Lead**: Borrower, enterprise investor, or luxury property buyer requesting immediate senior attention.

## 2. Concise Internal Handoff Summary
When escalating, `HandoffManager` synthesizes a clean, internal summary for the human staff:
- Caller Name & Contact Number
- Trigger & Reason Code
- Priority (`LOW`, `NORMAL`, `HIGH`, `CRITICAL`)
- Destination Target (e.g. `Emergency Casualty`, `Front Desk`, `Sales Lead Desk`)
- Last Caller Utterance

**Critical Rule**: Internal prompt envelopes, model system instructions, and hallucinated claims are NEVER included in handoff summaries.
