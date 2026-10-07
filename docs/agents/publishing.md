# Publishing & Activation Workflow

## Pre-Publishing Validation Gates

An AI Employee cannot be published or activated if any of the following validation checks fail:

1. **Mandatory Identity**: Name and display name must be non-empty.
2. **Non-Deceptive AI Identification**: `identifyAsAI` must be `true`. Configurations that instruct the agent to pretend to be human are automatically rejected.
3. **Primary Objective**: Must be defined (minimum 5 characters).
4. **Primary Language**: Must be configured.
5. **Healthcare Safety Guardrails**: If industry is Healthcare, Clinic, Dental, or IVF:
   - `enforceHealthcareGuardrails` must be `true`.
   - An active `EMERGENCY` escalation trigger must be defined with destination target.
6. **Real Estate Price Guardrails**: If industry is Real Estate or Builders:
   - `enforceRealEstateGuardrails` must be `true` to block price and inventory fabrication.
7. **Tool Permissions Consistency**: Any tool marked with `isImplemented: false` cannot have `canExecute: true`.
8. **Default Escalation Target**: Must specify a human front desk, phone number, or team destination.

---

## The Compilation Contract

When `publishAgentVersion` succeeds, the compiler freezes the agent state into an `AgentRuntimeConfig` JSON snapshot stored in `ai_employee_versions.snapshot`.

Future telephony voice sessions call:
```typescript
const runtimeConfig = await agentLifecycleService.getPublishedAgentRuntimeConfig(agentId, orgId);
```
This guarantees that running calls execute against a static, verified configuration without runtime database jitter or dirty reads.
