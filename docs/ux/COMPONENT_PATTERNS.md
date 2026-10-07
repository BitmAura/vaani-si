# VANNI Component UX Patterns & State Specifications

> **Target Platform**: VANNI B2B SaaS Enterprise Operating System  
> **Key Focus Areas**: Call Transcripts, Voice UX, Progressive Onboarding, Data Density, Resilient Error Handling.

---

## 1. Call Transcript UX & Typography Patterns

### The Principle: A Call Transcript is NOT a Chat Bubble
A call transcript is legal, financial, and operational business evidence. It must never look like an informal consumer messaging app (no rounded cartoon speech bubbles).

### Layout Pattern (`renderTranscriptLine`)
- **Metadata Column (`80px` fixed width)**:
  - Speaker Tag: `AI` (Cobalt `#1D4ED8`) vs `CUSTOMER` (`#475569`) in 11px uppercase bold.
  - Tabular Timestamp: `00:04`, `00:18` rendered in monospace (`JetBrains Mono`).
- **Narration Column (Flexible width)**:
  - High-contrast body text (`13px / 22px line-height`).
  - Native Kannada script support with proper vertical line-height (`1.7`) to prevent clipping of subscripts (*ottakshara*).
  - Kanglish syntax highlighting for critical entity values (dates, times, budgets, doctor names).

```html
<!-- Example Transcript UX Structure -->
<div class="vanni-transcript-line">
  <div class="vanni-transcript-meta">
    <span class="vanni-transcript-speaker vanni-transcript-speaker-ai">AI</span>
    <span class="vanni-transcript-time">00:02</span>
  </div>
  <div class="vanni-transcript-content vanni-kannada">
    ನಮಸ್ಕಾರ ಸರ್, ಅಪೋಲೋ ಕ್ಲಿನಿಕ್‌ಗೆ ಸ್ವಾಗತ. ಡಾಕ್ಟರ್ ರಮೇಶ್ ಪಾಟೀಲ್ ಅವರ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಬೇಕಿತ್ತಾ?
  </div>
</div>
```

---

## 2. Voice Experience & Telephony State Machine

The voice UI communicates real operational telephony states, eliminating misleading static icons or continuously dancing equalizers.

| State | Visual Indicator | Animation | User Meaning |
| :--- | :--- | :--- | :--- |
| `IDLE` | Subdued Gray Dot (`#94A3B8`) | Static | Telephony trunk ready; awaiting inbound call |
| `CONNECTING` | Blue Dot (`#2563EB`) | 500ms flash | SIP handoff in progress with carrier |
| `LISTENING` | Blue Dot with Outer Halo | 2s Pulse Ring | Customer is speaking; STT buffering audio stream |
| `THINKING` | Amber Dot (`#D97706`) | Gentle Breath | LLM generating tool parameters or regional response |
| `SPEAKING` | Emerald Dot (`#059669`) | Dynamic Waveform | TTS synthesizing Kannada audio stream to caller |
| `INTERRUPTED`| Crimson Flash (`#DC2626`)| Instant Flash | Caller interrupted AI; stream cleared instantly |
| `TRANSFERRED`| Sky Blue (`#0284C7`) | Static | Call escalated to human operator |
| `ENDED` | Muted Dot (`#64748B`) | Static | Call hung up; transcript saved to database |

---

## 3. Data & Metrics Rules: Zero Vanity Fabrications

### Real Zero-States
In B2B SaaS, when a customer opens a brand-new tenant console, showing fake metrics like "1,248 calls handled" destroys user trust.

- **Bad**: `Calls: 1,480 | Success: 99.8%` (fabricated numbers on a fresh account).
- **Good**: `Calls: 0` with an empty-state action: *"Your first call will appear here once your virtual number receives inbound traffic."*

### Empty State Pattern (`renderEmptyState`)
Every major view (Calls, Agents, Leads, Appointments, Knowledge) must provide:
1. An honest, subtle icon or glyph.
2. A clear title stating the absence of records.
3. An instructional explanation of how records are generated.
4. A direct primary action button (e.g., *"Create your first AI employee"* or *"Upload Knowledge Document"*).

---

## 4. Form UX & Progressive Disclosure

### Principles
1. **No 50-field monster forms**: Complex setups are broken into clear sequential steps:
   - Step 1: Business Identity
   - Step 2: Industry Selection (Dental, Healthcare, IVF, Real Estate, Hospitality)
   - Step 3: Operating Hours & Virtual Number Setup
   - Step 4: Knowledge Upload & FAQ Ingestion
   - Step 5: Test Call in Sandbox
2. **Inline Context & Hints**: Every form input explains *why* the data is required and shows an authentic Karnataka-specific example (e.g., `placeholder="e.g. +91 80 4719 2001 or +91 98450 XXXXX"`).
3. **Data Preservation**: Form values are never wiped on submission failures.

---

## 5. Resilient Error Handling

### Human-Readable Diagnostics
Raw technical failures (`500 Internal Server Error`, `fetch failed`) are caught and translated into actionable explanations:

- **Telephony Carrier Issue**: *"We couldn't connect to the voice provider. Your configuration is safe. Telephony fallback is active."*
- **Database Network Lag**: *"Telemetry syncing is queued. No call data has been lost."*
- **Microphone Permission**: *"Microphone access was denied. Please allow microphone permissions in your browser to test voice calls."*

---

## 6. Data-Driven Industry Architecture

Rather than hard-coding separate components for each vertical, VANNI utilizes a unified industry metadata registry:

```typescript
export interface IndustryDefinition {
  id: 'dental' | 'healthcare' | 'ivf' | 'hospitality' | 'real_estate' | 'automotive' | 'other';
  label: string;
  defaultAgentRole: string;
  primaryDialect: string;
  appointmentType: string;
  sampleCatalog: string;
}
```
All industry cards in marketing and tenant onboarding pull directly from this schema.
