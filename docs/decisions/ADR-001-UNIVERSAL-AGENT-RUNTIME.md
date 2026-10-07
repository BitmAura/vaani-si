# ADR-001: Universal Configurable Agent Runtime vs Vertical Point Applications

## Status
**ACCEPTED**

## Context
VANNI targets multiple Karnataka industries initially: Dental clinics, Healthcare clinics, IVF fertility centers, Hospitality, Real estate, and Digital marketing agencies.
A naive architectural approach would build separate bespoke applications (e.g. `dental-bot`, `realestate-bot`, `hospital-bot`).
This creates catastrophic maintenance debt: duplicate voice pipelines, fragmented bug fixes, redundant telephony connectors, and an inability to expand into retail, automotive, or education without rewriting the software.

## Decision
We mandate **One Universal Voice & Agent Runtime**:
1. The conversational engine, voice pipeline, state machine, telephony ingress, and telemetry are 100% agnostic of the business vertical.
2. Domain variations are injected through three composable layers:
   - **Platform Brain**: Spoken Kannada/Kanglish rules, brevity limits, filler words.
   - **Industry Brain (Templates)**: Workflows, allowed tools, clinical/commercial guardrails, domain terminology.
   - **Business Brain**: Tenant-specific verified facts, doctor rosters, operating hours, plot inventory, pricing.
3. Adding a new industry requires authoring an `IndustryTemplate` configuration rather than writing application code.

## Consequences
### Positive
- Sub-700ms voice pipeline enhancements immediately benefit all tenants in all industries.
- Infinite vertical scalability with zero core application code changes.
- A single unified test suite and regression matrix validates the entire company's product.

### Negative / Trade-offs
- The Prompt and Tool engine requires strict schema enforcement and validation to prevent cross-domain hallucination.
- Dynamic tool registration requires defensive execution limits.
