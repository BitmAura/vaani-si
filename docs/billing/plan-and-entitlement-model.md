# Plan and Entitlement Model

## Overview
VANNI features a normalized, versioned entitlement system where quotas and feature flags are tied to versioned plans rather than being scattered across React components or database queries.

## Entitlement Categories

### 1. Hard & Soft Quota Limits (Numeric)
- `maxAiEmployees`: Maximum active AI agents an organization can operate concurrently.
- `maxMonthlyVoiceMinutes`: Included high-definition telephony/WebRTC voice minutes per billing period.
- `maxLocations`: Physical branches or clinics supported under a single business brain.
- `maxKnowledgeStorageMb`: Total knowledge base file size in megabytes.
- `maxContacts`: CRM contacts stored.
- `maxMonthlyCalls`: Aggregate inbound and outbound call count.
- `maxCampaignTargets`: Outbound dial targets per monthly billing window.

### 2. Feature Flags (Boolean)
- `voiceEnabled`: Realtime audio conversation pipeline access.
- `outboundCallingEnabled`: Single-call outbound capabilities.
- `campaignsEnabled`: Batch outbound campaigns with automated retry logic.
- `knowledgeBaseEnabled`: Vector-indexed retrieval augmented generation (RAG).
- `analyticsEnabled`: Core dashboard analytics.
- `advancedAnalyticsEnabled`: Cohort retention, latency waterfalls, token breakdowns.
- `humanHandoffEnabled`: Live SIP transfer to clinic staff or receptionist mobile phones.
- `webhooksEnabled`: External webhook dispatches on call completion or lead qualification.
- `crmIntegrationsEnabled`: Native two-way synchronization with clinic EHRs or CRM software.

## Over-Entitlement Behavior
When a customer downgrades from Growth to Starter:
1. All preexisting AI agents, contacts, and knowledge files are retained.
2. The organization billing snapshot evaluates `isEntitlementExceeded: true`.
3. The dashboard alerts the user: `Over-Entitlement Notice: Your organization exceeds current plan limits on AI Employees (3/2)`.
4. The system safely disables the creation of *new* employees until the count complies with plan limits.
