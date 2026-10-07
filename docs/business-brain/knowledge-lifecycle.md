# VANNI Business Brain — Knowledge Lifecycle & Freshness

## 1. Lifecycle States

Knowledge records adhere to an explicit finite state machine:

```
[DRAFT] ──────> [PENDING_REVIEW] ──────> [ACTIVE] ──────> [ARCHIVED]
                                            │
                                            └──────────> [EXPIRED]
```

- **`DRAFT`**: Created during onboarding or batch import. Not accessible to voice agents.
- **`PENDING_REVIEW`**: Candidate knowledge flagged for administrator verification.
- **`ACTIVE`**: Authoritative, production-ready knowledge actively compiled into snapshots.
- **`ARCHIVED`**: Deprecated services, ex-employees, or superseded rules. Retained for historical audit; strictly excluded from runtime compilation.
- **`EXPIRED`**: Time-bounded facts (e.g. "Festival discount valid until Oct 15") whose `effective_until` timestamp has elapsed.

---

## 2. Temporal Freshness & Verification

To prevent stale information from propagating into phone conversations, records maintain temporal metadata:
- `last_verified_at`: Timestamp when an administrator confirmed accuracy.
- `effective_from`: Start date for seasonal pricing or schedules.
- `effective_until`: Auto-expiration boundary.
- `updated_at`: Revision timestamp.

### Freshness Invariants:
1. Records with `effective_until < NOW()` are automatically dropped during snapshot compilation.
2. The UI `/app/knowledge` highlights items with `last_verified_at > 90 days` in amber to prompt administrative review.
3. Pricing updates invalidate existing compiled snapshots, triggering automatic snapshot recompilation.
