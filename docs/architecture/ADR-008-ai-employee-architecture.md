# Architecture Decision Record (ADR-008)
## VANNI AI Employee / Agent Builder Architecture

- **Status**: Accepted & Implemented
- **Date**: 2026-10-04
- **Author**: Founding CTO & Senior AI Systems Architect

---

## 1. Context & Problem Statement

Enterprises in Karnataka and tier-2/3 Indian markets require voice automation that represents their business authentically. Standard conversational chatbots suffer from three critical flaws:
1. **Monolithic Prompt Bloat**: Storing instructions as massive unstructured strings in the database, leading to prompt drift and hallucinations.
2. **Runtime Mutable Drift**: Altering configurations on a live agent while telephony sessions are executing.
3. **Safety Vulnerabilities**: Lack of strict guardrails in high-consequence verticals (e.g. diagnosing patient symptoms in healthcare, or inventing plot prices in real estate).

---

## 2. Decision & Architecture

We have established the **VANNI AI Employee Builder** based on five architectural pillars:

### Pillar A: Structured Entity vs. Giant Prompts
Rather than persisting a single giant string, `ai_employees` maintains structured JSONB configurations for `identity`, `objective`, `personality`, `language`, `capabilities`, `knowledge_access`, `tools`, `escalation`, and `policies`.

### Pillar B: Immutable Snapshot Versioning (`ai_employee_versions`)
Configuration edits update a mutable draft. Active production sessions bind strictly to published version snapshots (`v1`, `v2`). Operators can atomically publish or roll back to any prior version in sub-second time.

### Pillar C: Explicit 10-Level Instruction Precedence
Platform Safety > Legal Compliance > Industry Safety Guardrails > Business Policies > Business Brain Data > Capability Permissions > Objective > Personality > Custom Instructions > Conversational Context.

### Pillar D: Server-Enforced Tool Capabilities
Capabilities and tools are strictly validated on the server. If an agent does not have permission for `CANCEL_APPOINTMENT`, the runtime rejects tool execution regardless of LLM generation.

### Pillar E: Deterministic Simulation Test Console
Before activating an agent, operators can simulate realistic customer interactions via a text simulation harness that evaluates knowledge grounding citations, capability authorization, policy enforcement, and escalation triggers.

---

## 3. Consequences & Benefits
- Zero downtime during version deployments.
- Guaranteed tenant isolation via PostgreSQL RLS.
- Complete auditability of agent lifecycle transitions (`agent_created`, `agent_published`, `agent_rollback`).
- Seamless future binding with the Conversation Orchestration Engine via the `AgentRuntimeConfig` contract.
