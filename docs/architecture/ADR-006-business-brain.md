# ADR-006: Business Brain Architecture & Industry Template Foundation

- **Status**: Accepted
- **Date**: 2026-10-04
- **Author**: Founding CTO & Principal Architect
- **Context**: Prompt 06 — VANNI Business Brain + Industry Template Foundation

---

## 1. Context & Problem Statement
Voice AI agents in customer-facing domains (healthcare, dental, real estate, hospitality) cannot rely on LLM parameter weights for business-specific facts. General LLMs hallucinate pricing, invent fake doctor availability, fabricate real estate approvals, and make unfulfillable commitments.

Furthermore, querying dozens of normalized database tables on every phone call creates untenable latency (>1.5s), violating VANNI's sub-750ms SLA.

We required an authoritative, low-latency business context architecture that:
1. Treats the LLM solely as a conversational reasoning engine, never as the database.
2. Implements a strict Source of Truth hierarchy (`AUTHORITATIVE` > `APPROVED` > `REFERENCE` > `UNVERIFIED`).
3. Enforces a No-Hallucination Contract where missing information returns `UNKNOWN_INFORMATION` rather than invented data.
4. Detects and preserves contradictory knowledge without fabricating blended facts.
5. Provides deterministic, versioned snapshot compilation for sub-millisecond prompt assembly.
6. Encapsulates 8 core Indian enterprise industries with domain-specific guardrails, Kannada terminology, and escalation protocols.

---

## 2. Decision & Architecture

### 2.1 Hybrid Knowledge Representation
We selected a hybrid data architecture:
- **Normalized Relational Tables**: For operational entities requiring strict integrity (`business_locations`, `business_services`, `business_staff`, `business_operating_hours`, `business_policies`, `business_faqs`).
- **Flexible Business Facts Table (`business_facts`)**: For long-tail domain attributes (plot dimensions, doctor registration numbers, resort amenities).
- **Knowledge Conflicts Table (`knowledge_conflicts`)**: For persisting discrepancies discovered between competing sources.

### 2.2 Deterministic Compilation Pipeline
Instead of querying multiple tables per turn, the system compiles a `BusinessBrainSnapshotDTO`:
1. Validates and normalizes phone numbers (E.164), currency (INR), and days of week (0-6).
2. Filters out `INACTIVE`, `ARCHIVED`, or expired records.
3. Detects discrepancies between facts and generates conflict records.
4. Generates an immutable, versioned snapshot stored in PostgreSQL as JSONB.
5. The `LayeredContextAssembler` injects the pre-compiled snapshot directly into runtime prompts.

### 2.3 Industry Template Blueprints
Eight core industry templates are implemented in `@vanni/industry-templates`:
- `DENTAL`: Dental clinic procedures, root canals, scaling, emergency tooth pain rules.
- `HEALTHCARE_HOSPITAL`: Doctor OPD timings, departments, strict `NEVER_PRESCRIBE` and `NEVER_DIAGNOSE` guardrails.
- `IVF_FERTILITY`: Fertility consultations, confidentiality guardrails, strict `NEVER_PROMISE_PREGNANCY_OUTCOMES` policy.
- `HOSPITALITY_RESORT`: Room categories, check-in/out hours, dynamic inventory guardrails.
- `REAL_ESTATE`: RERA approvals, plot dimensions, strict `NEVER_INVENT_UNAPPROVED_INVENTORY` guardrail.
- `AUTOMOTIVE_DEALER`: Test drives, vehicle servicing, financing inquiries.
- `DIGITAL_AGENCY`: Retainers, marketing deliverables, lead qualification.
- `COMMERCIAL_OTHER`: Clean generic baseline for any SME.

### 2.4 Multilingual Kannada / Kanglish Support
Unicode strings for authentic Kannada script are preserved alongside English and conversational Kanglish aliases.

### 2.5 Strict Multi-Tenancy & Row-Level Security
All Business Brain tables enforce non-nullable `organization_id` foreign keys with PostgreSQL Row-Level Security (RLS) policies matching `auth.uid() -> organization_members`. Cross-tenant queries and mutations are blocked at both the database and service layers.

---

## 3. Consequences & Compliance
- **Sub-750ms Latency**: Snapshot lookup executes in <1ms, enabling voice agents to maintain instant conversational response.
- **Zero Hallucination**: Missing prices or inventory return deterministic escalation statements.
- **Auditability**: Every retrieved answer is traceable to its source and authority level.
- **Extensibility**: Prompt 07 (Document ingestion, PDF chunking, and semantic embeddings) plugs cleanly into `knowledge_sources` without altering the core Business Brain API.
