# VANNI Business Brain — Runtime Snapshot Architecture

## 1. Motivation & Latency Constraints
Real-time conversational voice streaming requires **sub-750ms total turn-around time** (Speech-to-Text -> Prompt Assembly -> LLM First Chunk -> Text-to-Speech).

If the voice server attempted to perform relational SQL joins across 8 tables (`business_locations`, `business_services`, `business_staff`, `business_operating_hours`, `business_policies`, `business_faqs`, `business_facts`, and `organizations`) on every incoming phone call, database latency and connection pool saturation would destroy voice responsiveness.

---

## 2. Compilation Pipeline

```
NORMALIZED DATABASE TABLES
         │
         ▼
[1. Validation & Schema Checks]
         │
         ▼
[2. Data Normalization]
         │ (Phone E.164, INR Currency, Day index 0-6, Kannada Unicode)
         ▼
[3. Active Filter & Expiry Check]
         │ (Drop archived records, drop effective_until < NOW())
         ▼
[4. Conflict Detection & Flagging]
         │
         ▼
[5. Deterministic Assembly]
         │
         ▼
`business_brain_snapshots` (JSONB + Version Integer + Timestamp)
         │
         ▼
RUNTIME MEMORY CACHE / VOICE GATEWAY CONTEXT ASSEMBLER
```

---

## 3. `BusinessBrainSnapshotDTO` Schema

```typescript
export interface BusinessBrainSnapshotDTO {
  id: string;
  organizationId: string;
  version: number;
  industry: IndustryType;
  primaryDialect: RegionalDialect;
  compiledAt: string;
  identity: {
    name: string;
    displayName: string;
    phone: string;
    address: string;
    city: string;
    website?: string;
  };
  locations: BusinessLocationDTO[];
  operatingHours: BusinessOperatingHoursDTO[];
  services: BusinessServiceDTO[];
  staff: BusinessStaffDTO[];
  policies: BusinessPolicyDTO[];
  faqs: BusinessFAQDTO[];
  facts: BusinessFactDTO[];
  aiConfiguration: {
    agentName: string;
    roleTitle: string;
    tone: string;
    speechPace: number;
    greetingKanglish: string;
    capabilities: string[];
    guardrails: string[];
    unknownFallbackPolicy: string;
    escalationPhone: string;
  };
  conflicts: KnowledgeConflictDTO[];
}
```

---

## 4. Invariant: Separation of Static Knowledge & Dynamic Session State
The `BusinessBrainSnapshot` contains solely verified, tenant-wide business context. It does NOT store ephemeral session data (e.g. caller phone number, current call SID, partial transcript). That caller context is layered at runtime by the `LayeredContextAssembler` into Layer 6 and Layer 7 without mutating the static snapshot.
