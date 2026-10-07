# 10-Level Instruction Precedence Hierarchy

## The Precedence Problem

When building enterprise AI agents, conflicting directives often arise:
- Custom phrasing instructions might encourage the agent to be helpful.
- A caller might ask the agent for medical advice for acute abdominal pain.
- A business fact might state doctor consultation fee.

If the prompt compiler does not enforce clear ordering, custom instructions or user utterances can subvert legal compliance or safety guardrails.

---

## The 10-Level Hierarchy

VANNI defines an explicit, non-negotiable instruction precedence architecture:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. PLATFORM SAFETY                                                     │
│    Absolute prevention of harmful, illegal, abusive, or toxic outputs. │
├────────────────────────────────────────────────────────────────────────┤
│ 2. LEGAL & COMPLIANCE RULES                                            │
│    Non-deceptive AI identification; mandatory emergency handoff.       │
├────────────────────────────────────────────────────────────────────────┤
│ 3. INDUSTRY SAFETY GUARDRAILS                                          │
│    • Healthcare: Zero diagnosis, zero drug prescription.               │
│    • Real Estate: Zero price fabrication, zero unauthorized discounts. │
├────────────────────────────────────────────────────────────────────────┤
│ 4. BUSINESS POLICIES                                                   │
│    Authoritative operational rules (cancellation, refunds, intake).   │
├────────────────────────────────────────────────────────────────────────┤
│ 5. BUSINESS BRAIN AUTHORITATIVE DATA                                   │
│    Verified catalogue: doctors, operating hours, plot specs, pricing.  │
├────────────────────────────────────────────────────────────────────────┤
│ 6. AGENT CAPABILITY PERMISSIONS                                        │
│    Server-enforced tool execution flags and boundaries.                │
├────────────────────────────────────────────────────────────────────────┤
│ 7. AGENT PRIMARY OBJECTIVE                                             │
│    The core mission of the AI Employee (e.g. Schedule appointments).   │
├────────────────────────────────────────────────────────────────────────┤
│ 8. PERSONALITY & TONE                                                  │
│    Professional, Warm, Concise; Kanglish conversational preference.    │
├────────────────────────────────────────────────────────────────────────┤
│ 9. CUSTOM PHRASING INSTRUCTIONS                                        │
│    Tenant-specific colloquialisms and conversational guidelines.       │
├────────────────────────────────────────────────────────────────────────┤
│ 10. CONVERSATIONAL CONTEXT & USER INPUT                                │
│     Caller utterance, turn history, and user intent.                   │
└────────────────────────────────────────────────────────────────────────┘
```

**Golden Rule**: Lower tiers cannot violate or override higher tiers.
