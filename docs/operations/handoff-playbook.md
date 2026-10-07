# VANNI Human Handoff & Escalation Playbook

This operational playbook outlines the standard procedures for handling escalations across key regional business verticals.

---

## 1. Scenario: Explicit Human Request
- **Caller Input**: *"Can I speak to someone from the clinic?"* or *"Put me through to a real person."*
- **Action**:
  1. Detect explicit human request via conversational regex/intent parser.
  2. Do NOT repeatedly interrogate the caller or attempt to prolong autonomous AI dialogue.
  3. Resolve destination (e.g. Front Desk / Reception team).
  4. If member is live & available, execute `ITelephonyProvider.transferCall()`.
  5. If team is busy/offline, explain immediately: *"Our reception team isn't free right now, but I have scheduled a guaranteed callback for you."* and call `create_callback_request` through ToolEngine.

---

## 2. Scenario: Knowledge Gap
- **Caller Input**: *"Do you offer cashless mediclaim for Star Health on root canal treatments?"*
- **State**: Knowledge Engine returns `UNSUPPORTED`.
- **Action**:
  1. The AI does not guess or hallucinate policy terms.
  2. Acknowledge the limit: *"I don't have confirmed details about Star Health cashless terms for root canals. Let me connect you with our accounts coordinator."*
  3. Escalates as `KNOWLEDGE_GAP` with `NORMAL` priority.

---

## 3. Scenario: Tool Execution Failure
- **Caller Input**: Booking an appointment, but the calendar provider throws repeated conflict or timeout errors.
- **Action**:
  1. After the configured threshold, cease retry loops.
  2. State: *"I am having trouble confirming that slot automatically. I'm transferring your request to our appointment desk so you don't lose the slot."*
  3. Create handoff with reason `TOOL_FAILURE`.

---

## 4. Scenario: Healthcare / Emergency Safety
- **Caller Input**: *"I have severe chest pain and breathlessness"* or *"Patient is bleeding profusely."*
- **Action**:
  1. Precedence overrides all business rules.
  2. Mark priority `URGENT`.
  3. AI advises dialing 108 / casualty immediately while initiating emergency line transfer.
  4. Never provide autonomous diagnostic or clinical reassurance.

---

## 5. Scenario: Real Estate Negotiation
- **Caller Input**: *"Can you give me 10% off the 3BHK flat if I pay the booking advance today?"*
- **Action**:
  1. AI does not invent discounts without explicit business authority.
  2. Flag reason `NEGOTIATION_REQUIRED`.
  3. Create `HIGH` priority escalation to Sales Team.
  4. Human Sales Lead claims the ticket from the `/app/handoffs` queue.

---

## 6. Scenario: Customer Opt-Out
- **Caller Input**: *"Please don't call me again."*
- **Action**:
  1. Record opt-out in CRM suppression system (`suppressed: true`).
  2. Do not treat opt-out as an invitation for human handoff or marketing callback.
