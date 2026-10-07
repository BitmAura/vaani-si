# ADR-009: VANNI Channel-Independent Conversation Orchestration Engine

## Status
Accepted & Implemented (Prompt 09)

## Context
VANNI requires an enterprise-grade conversation orchestration engine capable of powering voice conversations, inbound/outbound calls, WhatsApp, web chat, and SMS across Karnataka and pan-India enterprises. A common architectural failure in naive conversational systems is allowing the Large Language Model (LLM) to directly control execution flow, make ungrounded claims, or arbitrarily mutate databases.

## Decision
1. **Deterministic State Machine**: We established an explicit 12-state Finite State Machine (`ConversationStateMachine`) with a strictly typed transition matrix (`IDLE` -> `CONNECTING` -> `GREETING` -> `LISTENING` -> `THINKING` -> `SPEAKING` -> `CONFIRMING` -> `TOOL_EXECUTION` -> `TRANSFER_PENDING` -> `ENDED` / `ERROR`).
2. **LLM Decoupling**: The LLM acts purely as a structured reasoning engine inside a policy-enforced pipeline. It produces typed decisions (`StructuredLLMDecisionDTO`) rather than executable code.
3. **11-Layer Context Model**: Strict structural separation across 11 layers (L0 Platform Safety to L10 Tool State), enforcing prompt injection defense and token budget awareness.
4. **Factual Response Validator**: Scans structured decisions prior to execution or dispatch, strictly enforcing healthcare zero-diagnosis guardrails, real estate ungrounded price rejections, and safe unknown fallback (`INFORMATION_UNAVAILABLE`).
5. **Tool Permissions & Confirmation**: Server-side permission evaluation (`ToolPermissionEvaluator`) with mandatory caller confirmation (`CONFIRMING`) for high-impact actions like booking, rescheduling, or canceling appointments.
6. **Linguistic Preservation**: Preserves Kannada Unicode script and Kanglish phonetics without data corruption.
7. **Multi-Tenancy & Idempotency**: Strict tenant isolation across all tables via PostgreSQL RLS and high-entropy turn event ID deduping.

## Consequences
- Clean separation between channel adapters (telephony, WhatsApp, WebSockets) and the orchestration runtime.
- Guaranteed protection against medical advice liabilities and unverified commercial price claims.
- Ready for Prompt 10+ voice telephony, STT, and TTS integrations.
