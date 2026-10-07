# AI Employee Versioning & Safe Rollback

## The Reliability Problem in Conversational AI

In high-consequence telephony operations (such as healthcare appointment desks or real estate sales), modifying an active AI agent's configuration halfway through a live call can lead to non-deterministic, dangerous failures.

To eliminate this operational risk, VANNI enforces **immutable version snapshots**.

---

## State Machine & Version Progression

```
+-------------------------------------------------------------+
|                        DRAFT                                |
|  - Operator edits personality, objectives, tools            |
|  - Does not affect production calls                         |
+------------------------------+------------------------------+
                               │
                               ▼
+-------------------------------------------------------------+
|                       VALIDATE                              |
|  - Platform safety, compliance, industry guardrails check   |
|  - Verifies tool permissions and emergency triggers         |
+------------------------------+------------------------------+
                               │
                               ▼
+-------------------------------------------------------------+
|                      PUBLISHED                              |
|  - Immutable AgentRuntimeConfig snapshot stored             |
|  - Version number incremented (v1, v2, v3...)               |
|  - Changelog recorded                                       |
+------------------------------+------------------------------+
                               │
                               ▼
+-------------------------------------------------------------+
|                        ACTIVE                               |
|  - Production calls bind to this published version          |
|  - Can be PAUSED or ARCHIVED at any time                    |
+-------------------------------------------------------------+
```

---

## Rollback Architecture

If an unexpected conversational regression or issue is discovered in Version 3:
1. Operator issues `POST /api/agents/:id/rollback` with `{ targetVersion: 2 }`.
2. The `AgentLifecycleService` retrieves the immutable Version 2 snapshot.
3. The active agent configuration is atomically restored to the exact Version 2 configuration.
4. Active version pointer is updated to `2`.
5. An audit log event `agent_rollback` is written.
6. The Version 3 snapshot is preserved intact in history for post-mortem analysis.
