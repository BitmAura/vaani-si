# VANNI Conversation Orchestration Engine — Overview

## 1. System Vision & Architecture
The **VANNI Conversation Orchestration Engine** (`@vanni/conversation-engine`) is the central channel-independent runtime that powers all autonomous voice, text, WhatsApp, web chat, and future messaging conversations for Indian enterprise verticals.

### Core Architectural Principle
**The LLM does NOT control the application.**
The LLM is a reasoning and natural-language synthesis component inside a deterministic state machine and policy orchestration system.

```
EVENT
  │
  ▼
CONVERSATION STATE MACHINE (IDLE -> CONNECTING -> GREETING -> LISTENING -> THINKING)
  │
  ▼
11-LAYER CONTEXT ASSEMBLY (L0 Platform Safety to L10 Tool State)
  │
  ▼
POLICY & RETRIEVAL CHECK (Business Brain + Knowledge Chunks)
  │
  ▼
LLM STRUCTURED REASONING
  │
  ▼
STRUCTURED OUTPUT VALIDATION (Zod + Factual Claim Validator)
  │
  ├──► RESPOND / ASK_CLARIFICATION (SPEAKING -> LISTENING)
  ├──► CALL_TOOL (TOOL_EXECUTION / CONFIRMING)
  ├──► HANDOFF (TRANSFER_PENDING)
  └──► END_CONVERSATION (ENDED)
```

## 2. Decoupling & Modularity
- **Channel Decoupling**: Interacts through `IConversationChannel`, ensuring zero dependency on telephony, STT, TTS, or WebSockets inside the core logic.
- **Provider Decoupling**: Interacts through `ILLMProvider`, returning strictly typed `StructuredLLMDecisionDTO`.
- **Database Decoupling**: Operates via `IDatabaseService` interfaces, guaranteeing multi-tenant isolation and portability.
- **Tool Decoupling**: Enforces server-side permissions (`ToolPermissionEvaluator`) and human confirmation flows before execution.
