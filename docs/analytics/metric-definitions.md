# VANNI Metric Definitions & Analytical Standards

This document establishes the official definitions and calculation methodologies for all metrics surfaced across the VANNI executive dashboard and analytical APIs.

---

## 1. Call & Telephony Metrics
- **Total Calls**: Count of all telephony sessions initiated (inbound rings received + outbound dials dispatched).
- **Connected Calls**: Calls where active bidirectional media was established and `durationSeconds > 0`.
- **Call Connection Rate (%)**:
  $$\text{Connection Rate} = \frac{\text{Connected Calls}}{\text{Total Calls}} \times 100$$
- **Voice Minutes**: Total sum of connected call seconds divided by 60, rounded to 2 decimal places.

---

## 2. Conversation & Kannada Intelligence Metrics
- **Meaningful Conversation**: A conversational session with $\ge 3$ dialog turns between caller and AI Employee.
- **Kannada Language Mode Share (%)**:
  $$\frac{\text{Conversations with detected language 'kn' or 'kn-en'}}{\text{Total Conversations}} \times 100$$
- **Latency P95 (STT / LLM / TTS)**: 95th percentile latency measured in milliseconds from voice pipeline timestamps. Displays `INSUFFICIENT DATA` if fewer than 20 turn samples exist.

---

## 3. Business Outcome & Conversion Funnel
- **Qualified Lead Rate (%)**:
  $$\frac{\text{Qualified CRM Leads Captured}}{\text{Connected Calls}} \times 100$$
- **Appointment Conversion Rate (%)**:
  $$\frac{\text{Confirmed Appointments Booked}}{\text{Connected Calls}} \times 100$$
- **Escalation / Handoff Rate (%)**:
  $$\frac{\text{Human Handoffs Requested}}{\text{Total Conversations}} \times 100$$

---

## 4. Cost Intelligence & Metering
- **Estimated Provider Cost (INR)**: Sum of estimated provider charges derived deterministically from the versioned `PricingCatalog` (Telephony PSTN minutes + Sarvam Kannada STT/TTS + LLM token volume).
- **Actual Cost (INR)**: Real vendor invoiced amount populated from asynchronous carrier / provider delivery webhooks.
