# Conversation Engine — Verification & Testing Architecture

## 1. Test Architecture
The test suite consists of two dedicated test runners:
1. `scratch/test-conversation-engine.mjs`: Tests core domain state machine, 11-layer context assembly, factual claims validation, tool permissions, emergency escalation, Kannada/Kanglish preservation, idempotency, and scriptable test harness.
2. `scratch/test-conversation-api.mjs`: Tests live Fastify HTTP REST endpoints (`/api/conversations/*`), tool confirmation workflows, barge-in interrupts, and multi-tenant RLS isolation.

## 2. Running Test Commands
```bash
# Run domain test harness (62 tests)
node scratch/test-conversation-engine.mjs

# Run live REST API test suite (18 tests)
node scratch/test-conversation-api.mjs

# Run full cross-package regression suite
node scratch/test-conversation-engine.mjs; node scratch/test-agent-builder.mjs; node scratch/test-agent-api.mjs; node scratch/test-knowledge-engine.mjs; node scratch/test-business-brain.mjs; node scratch/test-auth-and-multitenancy.mjs
```
