# VANNI Business Brain — Architecture Overview

## 1. Executive Summary
**VANNI Business Brain** is the authoritative business context and knowledge layer for Karnataka-first enterprise voice AI employees.

A foundational principle governs the entire system:
> **The LLM is strictly a reasoning and conversational rendering engine. The LLM must NEVER serve as the database or source of truth for a business.**

If business data lacks a specific fact (e.g., pricing, inventory availability, legal terms), VANNI guarantees deterministic adherence to the configured escalation policy (`UNKNOWN_INFORMATION`) rather than fabricating responses.

```
BUSINESS DATA (Database / Supabase / PostgreSQL)
      │
      ▼
BUSINESS BRAIN (9 Conceptual Layers)
      ├──── Layer 1: Identity (Brand, Legal, Contact)
      ├──── Layer 2: Locations (Branches, Geocodes, Hours, Timezone)
      ├──── Layer 3: People (Doctors, Specialists, Agents, Staff)
      ├──── Layer 4: Offerings (Services, Plots, Rooms, Packages)
      ├──── Layer 5: Operations (Operating Hours, Scheduling Rules)
      ├──── Layer 6: Policies (Escalation, Emergency, AI Restrictions)
      ├──── Layer 7: Knowledge (Multilingual FAQs, Approved Facts)
      ├──── Layer 8: AI Configuration (Persona, Dialect, Speech Pace, Guardrails)
      └──── Layer 9: Runtime Context (Caller phone, recent conversation turns)
      │
      ▼
CONVERSATION ENGINE (Deterministic Context Assembler)
      │
      ▼
CUSTOMER VOICE / TEXT RESPONSE (Sub-750ms Latency)
```

---

## 2. Core Architectural Principles
1. **Authoritative Hierarchy**: Information is tagged with explicit authority levels (`AUTHORITATIVE` > `APPROVED` > `REFERENCE` > `UNVERIFIED`). High-authority structured database records unconditionally outrank scraped text or unstructured website references.
2. **Strict Multi-Tenancy**: Every entity possesses a non-nullable `organization_id` column. Cross-tenant access is blocked at both the PostgreSQL Row Level Security (RLS) layer and the application service layer.
3. **Conflict Detection & Preservation**: When contradictory facts are detected (e.g., website says closed Sunday, but official business profile specifies 10 AM–2 PM), VANNI surfaces a `KnowledgeConflict` rather than fabricating an artificial average or hallucinated middle ground.
4. **Deterministic Snapshot Compilation**: Runtime voice sessions do not execute dozens of un-indexed table joins on incoming phone rings. Instead, an atomic, versioned `BusinessBrainSnapshot` is pre-compiled and cached.
5. **Native Kannada & Kanglish Unicode**: Preserves authentic Kannada script alongside English and Kanglish phonetic aliases without lossy transliteration.
