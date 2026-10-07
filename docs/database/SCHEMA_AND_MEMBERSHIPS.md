# VANNI Database: Schema & Memberships Foundation

## 1. Foundational Tables

### `public.profiles`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PK, REFERENCES auth.users(id)` | Maps 1:1 to Supabase Auth |
| `full_name` | `VARCHAR(255)` | `NOT NULL` | Display name of the user |
| `avatar_url` | `TEXT` | `NULLABLE` | S3/Supabase Storage link |
| `phone` | `VARCHAR(50)` | `NULLABLE` | Direct contact number |
| `timezone` | `VARCHAR(100)` | `DEFAULT 'Asia/Kolkata'` | Operating timezone |
| `locale` | `VARCHAR(50)` | `DEFAULT 'en-IN'` | Locale preference |

### `public.organizations`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PK, DEFAULT gen_random_uuid()` | Unique tenant identifier |
| `name` | `VARCHAR(255)` | `NOT NULL` | Customer commercial name |
| `slug` | `VARCHAR(100)` | `UNIQUE, NOT NULL` | URL-safe alphanumeric slug |
| `industry` | `VARCHAR(100)` | `DEFAULT 'REAL_ESTATE'` | Vertical categorization |
| `status` | `VARCHAR(50)` | `CHECK IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED')` | Tenant lifecycle |
| `onboarding_status` | `VARCHAR(50)` | `CHECK IN ('created', 'business_setup', 'agent_setup', 'ready')` | Setup state |
| `billing_tier` | `VARCHAR(50)` | `DEFAULT 'STARTER'` | Subscription tier |

### `public.organization_members`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PK, DEFAULT gen_random_uuid()` | Membership record |
| `organization_id` | `UUID` | `REFERENCES public.organizations(id)` | Tenant reference |
| `user_id` | `UUID` | `REFERENCES auth.users(id)` | User reference |
| `role` | `VARCHAR(50)` | `CHECK IN ('OWNER', 'ADMIN', 'MANAGER', 'VIEWER')` | Role assignment |
| `status` | `VARCHAR(50)` | `CHECK IN ('ACTIVE', 'INVITED', 'SUSPENDED')` | Member status |

### `public.audit_logs`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PK, DEFAULT gen_random_uuid()` | Audit log identifier |
| `organization_id` | `UUID` | `REFERENCES public.organizations(id)` | Tenant boundary |
| `actor_user_id` | `UUID` | `REFERENCES auth.users(id)` | Action performer |
| `action` | `VARCHAR(100)` | `NOT NULL` | Event tag (e.g. `organization.created`) |
| `resource_type` | `VARCHAR(100)` | `NOT NULL` | Target entity |
| `metadata` | `JSONB` | `DEFAULT '{}'::jsonb` | Contextual event payload |
