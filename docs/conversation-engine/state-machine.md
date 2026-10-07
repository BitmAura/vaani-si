# Conversation State Machine — Specification & Transition Matrix

## 1. Runtime States
The conversation engine implements a typed, deterministic finite state machine (`ConversationStateMachine`) with the following explicit states:

| State | Semantic Description |
| :--- | :--- |
| `IDLE` | Fresh uninitialized session awaiting caller arrival or connection. |
| `CONNECTING` | Gateway channel handshake or bridge in progress. |
| `GREETING` | Initial business introduction and AI identity disclosure delivered. |
| `LISTENING` | Channel is listening for customer utterance or silence. |
| `THINKING` | Context assembled; LLM reasoning and validation running. |
| `SPEAKING` | Agent response actively rendering / dispatching to channel. |
| `INTERRUPTED` | Customer barged-in; speech playback paused; transitioning to listening. |
| `TOOL_EXECUTION` | Executing verified read-only or confirmed action via Tool Engine. |
| `CONFIRMING` | High-impact mutation held awaiting customer verbal or textual confirmation. |
| `TRANSFER_PENDING`| Telephony/human transfer or casualty escalation dispatched. |
| `ENDED` | Terminal state; conversation concluded and audit summary generated. |
| `ERROR` | Unrecoverable error state transitioning to safe termination. |

## 2. Permitted State Transition Matrix
```ts
const ALLOWED_TRANSITIONS: Record<ConversationRuntimeState, ConversationRuntimeState[]> = {
  IDLE: ['CONNECTING', 'GREETING', 'LISTENING', 'ERROR', 'ENDED'],
  CONNECTING: ['GREETING', 'LISTENING', 'ERROR', 'ENDED'],
  GREETING: ['LISTENING', 'INTERRUPTED', 'THINKING', 'ERROR', 'ENDED'],
  LISTENING: ['THINKING', 'INTERRUPTED', 'TRANSFER_PENDING', 'ENDED', 'ERROR'],
  THINKING: ['SPEAKING', 'TOOL_EXECUTION', 'CONFIRMING', 'TRANSFER_PENDING', 'INTERRUPTED', 'ENDED', 'ERROR'],
  SPEAKING: ['LISTENING', 'INTERRUPTED', 'TOOL_EXECUTION', 'TRANSFER_PENDING', 'ENDED', 'ERROR'],
  INTERRUPTED: ['LISTENING', 'THINKING', 'ERROR', 'ENDED'],
  TOOL_EXECUTION: ['CONFIRMING', 'THINKING', 'SPEAKING', 'TRANSFER_PENDING', 'ENDED', 'ERROR'],
  CONFIRMING: ['TOOL_EXECUTION', 'THINKING', 'SPEAKING', 'TRANSFER_PENDING', 'ENDED', 'ERROR'],
  TRANSFER_PENDING: ['ENDED', 'ERROR'],
  ENDED: [], // Terminal state
  ERROR: ['ENDED'], // Terminal
};
```

Any attempt by client, channel, or model to skip states or trigger illegal transitions is rejected deterministically.
