# Conversation Security, Anti-Injection & Tenancy

## 1. Multi-Tenant Isolation
All conversation entities (`conversations`, `conversation_messages`, `conversation_events`, `conversation_tool_calls`, `conversation_handoffs`, `conversation_summaries`) include `organization_id`.
- **Database Level**: Protected with strict PostgreSQL Row-Level Security (`RLS`) policies referencing `organization_members`.
- **API Level**: Endpoints enforce `requireOrganizationMember` checking session tokens against request path/body parameters.

## 2. Prompt Injection Defense
- Caller utterances and external retrieved documents are placed inside untrusted data envelopes (`[L9_CURRENT_INPUT]` and `<citation>` tags).
- System instructions explicitly forbid user utterances or knowledge citations from modifying platform instructions, disclosing prompts, or executing unpermitted actions.
- Post-processing checks (`FactualResponseValidator`) detect and block any leakage of internal prompt envelopes.

## 3. Idempotency & Concurrency Guards
- Every turn handles an optional or generated `idempotencyKey` / `eventId`. Duplicate arrivals do not re-execute tool calls or disburse duplicate messages.
- Runtime session includes `isProcessing` concurrency locking, preventing simultaneous speech or asynchronous events from corrupting finite state machine state.
