# VANNI Business Brain — Data Model Specification

## 1. Relational Entities (PostgreSQL / Supabase Migration 004)

The Business Brain combines normalized operational tables with a flexible, traceable key-value fact abstraction.

### 1.1 `business_locations`
Physical branches, clinics, resorts, or project sites.
- `id` (UUID PK)
- `organization_id` (UUID FK -> organizations)
- `name` (TEXT)
- `branch_code` (TEXT)
- `address_line1`, `address_line2`, `landmark`, `city`, `state`, `postal_code` (TEXT)
- `latitude`, `longitude` (DECIMAL)
- `phone`, `email` (TEXT)
- `timezone` (TEXT DEFAULT 'Asia/Kolkata')
- `is_primary` (BOOLEAN DEFAULT false)
- `status` (`ACTIVE`, `INACTIVE`, `ARCHIVED`)

### 1.2 `business_services`
Normalized catalog items (medical procedures, real estate plot types, resort rooms).
- `id` (UUID PK)
- `organization_id` (UUID FK -> organizations)
- `location_id` (UUID FK -> business_locations, nullable)
- `name` (TEXT)
- `kannada_name` (TEXT)
- `category` (TEXT)
- `description` (TEXT)
- `price_minimum`, `price_maximum` (NUMERIC)
- `currency` (TEXT DEFAULT 'INR')
- `duration_minutes` (INTEGER)
- `status` (`ACTIVE`, `INACTIVE`, `ARCHIVED`)
- `authority` (`AUTHORITATIVE`, `APPROVED`, `REFERENCE`, `UNVERIFIED`)

### 1.3 `business_staff`
Doctors, real estate agents, managers, and support staff.
- `id` (UUID PK)
- `organization_id` (UUID FK -> organizations)
- `location_id` (UUID FK -> business_locations, nullable)
- `full_name` (TEXT)
- `kannada_name` (TEXT)
- `designation` (TEXT)
- `specialization` (TEXT)
- `registration_number` (TEXT)
- `phone`, `email` (TEXT)
- `is_active` (BOOLEAN DEFAULT true)

### 1.4 `business_operating_hours`
Day-by-day weekly schedule for branches and resources.
- `id` (UUID PK)
- `organization_id` (UUID FK)
- `location_id` (UUID FK, nullable)
- `day_of_week` (INTEGER 0=Sunday, 6=Saturday)
- `open_time`, `close_time` (TIME, HH:MM)
- `is_closed` (BOOLEAN DEFAULT false)
- `special_notes` (TEXT)

### 1.5 `business_policies`
Structured rules governing operational constraints and AI behaviors.
- `id` (UUID PK)
- `organization_id` (UUID FK)
- `category` (`CANCELLATION`, `RESCHEDULING`, `REFUND`, `EMERGENCY`, `HUMAN_ESCALATION`, `AI_RESTRICTIONS`, `DATA_PRIVACY`, `PRICING_TERMS`)
- `title` (TEXT)
- `policy_statement` (TEXT)
- `enforcement_level` (`STRICT_BLOCK`, `WARNING_PROMPT`, `OPTIONAL_GUIDELINE`)
- `authority` (`AUTHORITATIVE`, `APPROVED`, `REFERENCE`, `UNVERIFIED`)
- `status` (`ACTIVE`, `INACTIVE`, `ARCHIVED`)

### 1.6 `business_faqs`
Bilingual Q&A pairs verified by business owners.
- `id` (UUID PK)
- `organization_id` (UUID FK)
- `question` (TEXT)
- `answer` (TEXT)
- `answer_kannada` (TEXT)
- `category` (TEXT)
- `language` (`EN`, `KN`, `KANGLISH`)
- `authority` (`AUTHORITATIVE`, `APPROVED`, `REFERENCE`, `UNVERIFIED`)
- `last_verified_at` (TIMESTAMPTZ)
- `status` (`ACTIVE`, `DRAFT`, `ARCHIVED`)

### 1.7 `business_facts`
Flexible key-value pairs for domain-specific unstructured knowledge.
- `id` (UUID PK)
- `organization_id` (UUID FK)
- `entity_type`, `entity_id` (TEXT)
- `category` (TEXT)
- `key` (TEXT)
- `value` (TEXT)
- `authority` (`AUTHORITATIVE`, `APPROVED`, `REFERENCE`, `UNVERIFIED`)
- `effective_from`, `effective_until` (TIMESTAMPTZ)
- `status` (`ACTIVE`, `ARCHIVED`, `EXPIRED`)

### 1.8 `knowledge_conflicts`
Detected discrepancies between competing knowledge sources.
- `id` (UUID PK)
- `organization_id` (UUID FK)
- `conflict_type` (`PRICE_DISCREPANCY`, `HOURS_MISMATCH`, `AVAILABILITY_DISPUTE`, `POLICY_CONTRADICTION`)
- `entity_type`, `entity_key` (TEXT)
- `primary_source_id`, `primary_value` (TEXT)
- `conflicting_source_id`, `conflicting_value` (TEXT)
- `status` (`UNRESOLVED`, `RESOLVED`, `IGNORED`)
- `resolution_notes`, `resolved_by`, `resolved_at` (TEXT / TIMESTAMPTZ)

### 1.9 `business_brain_snapshots`
Atomic, compiled, versioned snapshots consumed by the conversation engine.
- `id` (UUID PK)
- `organization_id` (UUID FK)
- `version` (INTEGER)
- `industry` (TEXT)
- `snapshot_data` (JSONB)
- `is_active` (BOOLEAN DEFAULT true)
- `compiled_at` (TIMESTAMPTZ)
