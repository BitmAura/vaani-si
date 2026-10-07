# Hybrid Retrieval & Ranking Engine

## 1. Retrieval Overview

The `KnowledgeRetrievalEngine` executes before any LLM prompt construction. When a caller asks a question or a user tests knowledge in `/app/knowledge`, the engine retrieves, ranks, and validates answerability.

```
Query: "What is the price of 30x40 plots in Ballari?"
                   │
                   ▼
┌────────────────────────────────────────────────────────┐
│ Candidate Filter (Tenant Isolation & Active Version)   │
│ • organizationId === tenantId                          │
│ • document.contentStatus === 'READY'                   │
└──────────────────┬─────────────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────┐
│ Hybrid Scoring Formulation                             │
│ Score = 0.55 * Semantic + 0.30 * Lexical + Boosts      │
└──────────────────┬─────────────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────┐
│ Answerability Evaluation                               │
│ Top Score >= 0.55  --> SUPPORTED                       │
│ Top Score >= 0.35  --> PARTIALLY_SUPPORTED             │
│ Top Score <  0.35  --> UNSUPPORTED                     │
└──────────────────┬─────────────────────────────────────┘
                   │
                   ▼
    Ranked Chunks with Full Citations & Audit Trace
```

---

## 2. Hybrid Scoring Formula

For each candidate chunk:

$$\text{Final Score} = (0.55 \times \text{Semantic}) + (0.30 \times \text{Lexical}) + \text{AuthorityBoost} + \text{LanguageBoost}$$

### 2.1 Semantic Score
Cosine similarity between query embedding and chunk vector:
$$\text{Semantic} = \frac{\mathbf{u} \cdot \mathbf{v}}{||\mathbf{u}|| \cdot ||\mathbf{v}||}$$

### 2.2 Lexical / Keyword Score
Matches query tokens against chunk text with heading weighting (1.5x weight for matching tokens appearing in the section heading).

### 2.3 Gated Authority Boost
Authority boost is **gated on relevance**: it only applies if $\max(\text{Semantic}, \text{Lexical}) > 0.25$.
- `AUTHORITATIVE`: $+0.20$
- `APPROVED`: $+0.10$
- `REFERENCE`: $+0.00$
- `UNVERIFIED`: $-0.10$

This prevents an authoritative policy about office hours from being returned for unrelated medical questions.

### 2.4 Language Match Boost
If the query contains Kannada script (`\u0C80-\u0CFF`), chunks classified as `KN` or `KANGLISH` receive a $+0.05$ boost.

---

## 3. Answerability States

| Status | Threshold | Meaning for Future Voice Engine |
| :--- | :--- | :--- |
| `SUPPORTED` | $\text{TopScore} \ge 0.55$ | High-confidence factual grounding. Safe to answer directly. |
| `PARTIALLY_SUPPORTED` | $0.35 \le \text{TopScore} < 0.55$ | Contextual relevance present, but specific details may be partial. Agent should clarify or qualify. |
| `UNSUPPORTED` | $\text{TopScore} < 0.35$ | Zero or negligible evidence found. Agent must politely state uncertainty or offer human transfer. |
| `CONFLICTED` | Multiple discordant high-authority facts | Two conflicting official numbers exist. Trigger alert for administrative resolution. |

---

## 4. Retrieval Trace

Every retrieval includes an internal trace for debugging hallucinations:
```json
{
  "executionTimeMs": 8,
  "totalCandidateChunks": 24,
  "totalCandidates": 24,
  "filteredCandidates": 3,
  "filtersApplied": { "topK": 3 },
  "appliedFilters": { "organizationId": "a0000000-0000-0000-0000-000000000001" },
  "modelName": "vanni-multilingual-e5-v1-mock"
}
```
*Note: Traces are restricted to internal administrative logging and are never exposed to external callers.*
