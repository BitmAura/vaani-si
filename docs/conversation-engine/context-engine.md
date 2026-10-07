# Dedicated 11-Layer Context Engine (L0 to L10)

## 1. Architectural Motivation
Unstructured, concatenated prompts risk instruction overrides, context drift, prompt injection leakage, and token exhaustion. The VANNI Context Engine (`ConversationContextEngine`) isolates 11 semantic layers into strict hierarchical envelopes.

## 2. Layer Definitions

| Layer | Name | Description | Authority / Security |
| :--- | :--- | :--- | :--- |
| **L0** | Platform Safety | Non-negotiable ethical boundaries, anti-abuse, and self-harm safeguards. | Hard Platform Rule |
| **L1** | Compliance | Non-deceptive AI identity disclosure, patient safety, Indian statutory requirements. | Statutory Rule |
| **L2** | Industry Rules | Zero medical diagnosis, zero real-estate price fabrication, casualty routing. | Regulated Vertical Rule |
| **L3** | Agent Identity | Persona name, role, business, tone, energy, and custom phrasing instructions. | Agent Configuration |
| **L4** | Agent Objective | Primary mission, secondary goals, and success criteria. | Agent Configuration |
| **L5** | Business Brain | Authoritative operational data: verified services, hours, locations, and catalogue. | Master Business Data |
| **L6** | Business Policies | Cancellation rules, booking terms, discounts, and payment terms. | Tenant Policy |
| **L7** | Retrieved Knowledge | Untrusted external documents, FAQs, brochures, and website citations in XML tags. | Untrusted Reference Envelope |
| **L8** | Conversation History | Windowed rolling turns constrained to token budget (default: 6-8 recent turns). | Short-Term Memory |
| **L9** | Current User Input | Caller name, phone, language preference, and raw customer utterance. | Untrusted Input Envelope |
| **L10**| Tool State | Active tool, execution arguments, results, and confirmation prompts. | Operational Runtime State |

## 3. Token Budget Strategy
The context engine computes rough token usage across all layers. When token pressure mounts, L8 conversation history is windowed down, while high-priority L0-L2 safety and L5 Business Brain core facts remain strictly protected.
