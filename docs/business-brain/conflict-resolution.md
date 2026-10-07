# VANNI Business Brain — Conflict Detection & Resolution

## 1. The Conflict Problem
In unstructured business setups, contradictory statements frequently occur across disparate sources:
- **Scenario A**: The Google Maps listing states "Sunday: 10:00 AM – 2:00 PM". The clinic brochure states "Closed on Sundays".
- **Scenario B**: The service pricing card states "Scaling: ₹800". An uploaded FAQ document states "Teeth cleaning is ₹1,200".

A generic AI model will either hallucinate an average ("It costs ₹800–₹1,200 and we might be open Sunday") or silently favor an arbitrary document.

---

## 2. VANNI Invariant: No Fabricated Blended Facts

VANNI strictly forbids blending contradictory values:
1. **Detection**: During compilation or record ingestion, candidate facts are evaluated against existing normalized records using fuzzy key matching (`entity_key`).
2. **Discrepancy Identification**: If values differ by more than 5% (numerical) or contradict truth tables (hours/open days), a `KnowledgeConflict` entity is generated.
3. **Runtime Fallback**:
   - The higher authority record (`AUTHORITATIVE` > `REFERENCE`) is conditionally used.
   - If both records share the same authority level, the conflict is flagged as `CONFLICT_DETECTED` and the agent gracefully follows the configured unknown/escalation policy rather than guessing.
4. **Resolution Panel**: The conflict appears in the `/app/knowledge` Conflict Resolution Panel. An administrator resolves it by explicitly selecting the canonical value or typing an override.
