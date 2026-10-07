# AI Employee Domain & Data Model

## Structured Configuration vs. Monolithic Prompts

A core architectural tenet of VANNI is **preventing prompt bloat**. The AI Employee configuration is never stored as a single, unmaintainable prompt string. Important concepts are modeled in typed, queryable relational structures, with runtime compilation performed deterministically.

---

## Entity Schema (`ai_employees`)

| Field | Type | Description |
|---|---|---|
| `id` | `UUID / TEXT` | Primary key (`emp-...`) |
| `organization_id` | `UUID` | Foreign key referencing tenant organization (RLS gated) |
| `name` | `VARCHAR(100)` | Colloquial name (e.g., "Sahana", "Ananya") |
| `display_name` | `VARCHAR(120)` | Full designation (e.g., "Sahana — AI Sales Executive") |
| `description` | `TEXT` | Internal operational description |
| `role` | `VARCHAR(50)` | Institutional role enum (`AI_RECEPTIONIST`, `AI_SALES_ASSISTANT`, etc.) |
| `industry` | `VARCHAR(50)` | Vertical (`HEALTHCARE`, `REAL_ESTATE`, etc.) |
| `status` | `VARCHAR(20)` | Lifecycle state (`DRAFT`, `TESTING`, `ACTIVE`, `PAUSED`, `ARCHIVED`) |
| `active_version` | `INTEGER` | Active published snapshot version number |
| `active_version_id` | `VARCHAR(100)` | Foreign key referencing the active `ai_employee_versions` record |
| `identity` | `JSONB` | Name, greeting, introduction, mandatory `identifyAsAI: true` |
| `objective` | `JSONB` | Primary objective, secondary objectives, success criteria |
| `personality` | `JSONB` | Preset, tone, conversation style, energy, custom instructions |
| `language` | `JSONB` | Primary language, secondary languages, conversational mode (Kanglish) |
| `capabilities` | `JSONB` | Array of capability permissions with explicit execution flags |
| `knowledge_access` | `JSONB` | Access level, allowed source IDs, restricted categories |
| `tools` | `JSONB` | Enabled tools, implementation status, execution permissions |
| `escalation` | `JSONB` | Default target, triggers (emergency, human request, sensitive) |
| `policies` | `JSONB` | Healthcare guardrails, real estate price protection, hallucination locks |
| `conversation_rules` | `JSONB` | Greeting style, question pacing, uncertainty behavior |
| `created_by` / `updated_by` | `UUID` | Audit actor tracking |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | Timestamp records |

---

## Version Entity Schema (`ai_employee_versions`)

| Field | Type | Description |
|---|---|---|
| `id` | `TEXT` | Primary key (`ver-{agentId}-v{number}`) |
| `organization_id` | `UUID` | Foreign key referencing tenant organization |
| `agent_id` | `TEXT` | Foreign key referencing `ai_employees.id` |
| `version` | `INTEGER` | Monotonically increasing version number (1, 2, 3...) |
| `status` | `VARCHAR(20)` | Snapshot state (`DRAFT`, `PUBLISHED`, `ACTIVE`, `ARCHIVED`) |
| `changelog` | `TEXT` | Operator change summary |
| `snapshot` | `JSONB` | Complete, immutable compiled `AgentRuntimeConfig` |
| `published_at` | `TIMESTAMPTZ` | Timestamp when snapshot was published |
| `created_at` | `TIMESTAMPTZ` | Creation timestamp |
