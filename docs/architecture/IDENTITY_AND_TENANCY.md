# VANNI Architecture: SaaS Identity & Multi-Tenancy

## 1. Identity Model
VANNI decouples user credentials from business data.
- Credentials, authentication tokens, and MFA are managed via Supabase Auth (`auth.users`).
- User profile data is stored in `public.profiles`, keyed directly by the `auth.users` UUID.
- No user passwords or auth secrets are ever stored in application profile tables.

## 2. Organization Boundary
An Organization represents a single commercial entity (e.g. `Ballari Residential Layouts`, `Apollo Specialty Clinic`).
- Slugs are URL-safe, normalized, and unique (e.g. `ballari-plots`).
- Industry is stored as a flexible string to allow new verticals without database schema rewrites.
- Onboarding status tracks progressive readiness (`created` &rarr; `business_setup` &rarr; `agent_setup` &rarr; `ready`).

## 3. Organization Memberships
The relation between `profiles` and `organizations` is N:M, represented in `public.organization_members`:
- `role`: `OWNER`, `ADMIN`, `MANAGER`, `VIEWER`
- `status`: `ACTIVE`, `INVITED`, `SUSPENDED`

## 4. Session & Organization Switching
- The authenticated session (`AuthSessionDTO`) tracks the `userId`, user profile details, the `activeOrganizationId`, the user's role in that organization, and the list of all accessible organizations.
- Organization switching is strictly gated:
  1. User requests switch to `targetOrganizationId`.
  2. Server verifies that the user is an `ACTIVE` member of `targetOrganizationId`.
  3. If verified, session cookie is re-issued with the new active organization.
  4. If unverified, request is rejected with `403 Forbidden` (`OrganizationAccessDeniedError`).
