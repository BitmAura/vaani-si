# VANNI Design System & Visual Foundation

> **Product**: VANNI (Autonomous Regional AI Employee Platform)  
> **Positioning**: "AI employees that speak your customer's language."  
> **Target Audience**: B2B Enterprises across Karnataka (Healthcare, Dental, IVF, Hospitality, Real Estate, Automotive).  
> **Design Philosophy**: Trust, Intelligence, Professionalism, Speed, Reliability, Business Value.

---

## 1. Design System Philosophy & Anti-Slop Principles

VANNI is an enterprise-grade B2B SaaS operating system built for serious business owners, operations managers, and clinic administrators. It must reflect the caliber of a mature venture-backed product organization (Stripe, Linear, Vercel, Ramp) rather than an experimental AI demo.

### Prohibited Aesthetic Patterns (Strict Anti-Slop Directive)
- ❌ **No glowing neon halos or diffuse colored lasers**: AI products frequently drown in green/purple neon blurs. VANNI uses crisp, restrained borders (`1px solid var(--vanni-border)`).
- ❌ **No excessive glassmorphism**: Translucent frosted panels that impede data legibility are banned. Surfaces are solid white/slate with purposeful contrast.
- ❌ **No cartoon robot or cyberpunk illustrations**: VANNI represents enterprise employees and operational infrastructure.
- ❌ **No fake vanity statistics or invented customer logos**: Metrics like "100% human" or "99.99% accuracy" are forbidden unless backed by measured telemetry.
- ❌ **No continuously moving fake audio equalizers**: Voice waveform animations must accurately mirror real telephony activity states (`listening`, `thinking`, `speaking`, `interrupted`).

---

## 2. Color System & Semantic Tokens

VANNI employs a disciplined design-token system with restrained light-mode defaults and zero-cost dark-mode parity.

### Token Architecture (`@vanni/ui/src/tokens/colors.ts`)

| Semantic Role | Token Name | Light Value | Purpose / Usage |
| :--- | :--- | :--- | :--- |
| **Canvas** | `background` | `#F8FAFC` (Slate-50) | Base canvas background for consoles and landing pages |
| **Surface** | `surface` | `#FFFFFF` | Cards, tables, modals, input containers |
| **Subdued Surface** | `surfaceSubdued` | `#F1F5F9` (Slate-100) | Table headers, secondary toolbars, badge backdrops |
| **Hairline Border** | `border` | `#E2E8F0` (Slate-200) | 1px clean separation line between structural blocks |
| **Strong Border** | `borderStrong` | `#CBD5E1` (Slate-300) | Focus rings, active tabs, interactive card hover |
| **Primary Text** | `textPrimary` | `#0F172A` (Slate-900) | High-contrast body, data headers, applicant titles |
| **Secondary Text** | `textSecondary` | `#475569` (Slate-600) | Contextual descriptions, form labels, metadata |
| **Muted Text** | `textMuted` | `#64748B` (Slate-500) | Timestamps, transcript timecodes, footnote text |
| **Brand Primary** | `primary` | `#0F172A` (Executive Slate) | Primary CTAs, brand emblems, high-priority buttons |
| **Interactive Accent**| `accent` | `#2563EB` (Cobalt Blue) | Links, focus highlights, active conversational states |
| **Operational Live** | `success` | `#059669` (Emerald-600) | Active live calls, verified leads, confirmed bookings |
| **Pending / Warm** | `warning` | `#D97706` (Amber-600) | Warm leads, AI thinking state, callback required |
| **Escalated / Error** | `danger` | `#DC2626` (Red-600) | Interrupted call, emergency handoff, telephony fault |
| **System Info** | `info` | `#0284C7` (Sky-600) | Telephony carrier status, SIP trunk alerts |

---

## 3. Typography & Regional Font Stack

### Latin + Kannada Glyph Fallback Stack
Kannada scripts require specific line-height consideration so vowel modifiers (*kagunita*) and conjunct consonants (*ottakshara*) are never clipped:

```css
--vanni-font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Kannada', 'Kannada Sangam MN', Tunga, sans-serif;
--vanni-font-kannada: 'Noto Sans Kannada', 'Kannada Sangam MN', Tunga, sans-serif;
--vanni-font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
```

### Hierarchy & Scale

| Token | Size | Line Height | Weight | Letter Spacing | Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `display` | 40px (`2.5rem`) | 48px | 700 | `-0.025em` | Marketing Hero Headline |
| `h1` | 32px (`2.0rem`) | 40px | 700 | `-0.02em` | Main Page Titles |
| `h2` | 24px (`1.5rem`) | 32px | 600 | `-0.015em` | Section Titles, Modal Titles |
| `h3` | 20px (`1.25rem`) | 28px | 600 | `-0.01em` | Panel Headers, Drawer Titles |
| `h4` | 16px (`1.0rem`) | 24px | 600 | `-0.005em` | Card Titles, Drawer Subheads |
| `body` | 14px (`0.875rem`) | 22px | 400 | `0` | Standard B2B SaaS density |
| `bodySmall` | 13px (`0.8125rem`)| 20px | 400 | `0` | Table secondary cells, sub-captions |
| `caption` | 12px (`0.75rem`) | 16px | 500 | `0.01em` | Badges, call status tags |
| `label` | 12px (`0.75rem`) | 16px | 600 | `0.02em` | Form labels (uppercase) |
| `mono` | 12px / 13px | 18px | 500 | `tabular-nums` | Phone numbers, call duration, latency |

---

## 4. Spacing Scale & Layout Grid

### Modular 4px Scale
Margins, paddings, and component dimensions adhere to a strict modular scale:

```typescript
export const spacing = {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
  32: '128px',
};
```

### Layout Constraints
- **Console Header Height**: `56px`
- **Dashboard Sidebar Width**: `240px` (collapsed: `64px`)
- **Inspection Drawer Width**: `520px` (desktop slide-over)
- **Application Max Width**: `1280px`
- **Marketing Container Max Width**: `1120px`

---

## 5. Border Radii & Shadow Elevation

### Radii Hierarchy
- `sm` (`4px`): Small form controls, status pills, micro tags.
- `md` (`6px`): Standard text inputs, primary/secondary action buttons, dropdown items.
- `lg` (`8px`): Main data cards, table outer containers, popover menus.
- `xl` (`12px`): Modal dialogs, slide-over drawer top/bottom corners.
- `full` (`9999px`): Voice pulse dots, user avatar badges, pill status tags.

### Subtle Elevation Shadows (Stripe / Linear Caliber)
- **Hover/Default**: `0 1px 3px 0 rgba(15, 23, 42, 0.08)` (subtle ambient grounding)
- **Dropdowns / Popovers**: `0 4px 6px -1px rgba(15, 23, 42, 0.08)`
- **Drawers / Modals**: `0 20px 25px -5px rgba(15, 23, 42, 0.1)`

---

## 6. Component Architecture & Directory Organization

`packages/ui` is built as an independent, fully-typed TypeScript package (`@vanni/ui`):

```
packages/ui/
├── src/
│   ├── tokens/
│   │   ├── colors.ts
│   │   ├── typography.ts
│   │   ├── spacing.ts
│   │   ├── radius.ts
│   │   ├── shadows.ts
│   │   ├── motion.ts
│   │   └── index.ts
│   ├── styles/
│   │   └── vanni.css          // Vanilla CSS compiled distribution
│   ├── components/
│   │   ├── layout/            // AppShell, Headers, Footers, PageHeader, Section
│   │   ├── navigation/        // Tabs, Breadcrumbs, Pagination, CommandMenu
│   │   ├── forms/             // Input, Textarea, Select, Switch, Checkbox, Radio
│   │   ├── ui/                // Button, IconButton, Badge, Alert, Modal, Drawer
│   │   ├── analytics/         // Table, MetricCard, EmptyState, Timeline
│   │   └── voice/             // VoiceActivityIndicator, TranscriptLine, AudioWaveform
│   └── index.ts
```

---

## 7. Motion & Micro-Interactions

Motion in VANNI is functional, serving directly to indicate state transitions:

1. **Voice State Pulse**: A subtle 2s cubic-bezier pulse on the live voice dot indicating active microphone ingress.
2. **Drawer Slide-Over**: `transform 300ms cubic-bezier(0.0, 0.0, 0.2, 1)` to slide into view from the right edge without jank.
3. **Button Hover**: `all 150ms cubic-bezier(0.2, 0.0, 0, 1.0)` for instantaneous user feedback.
4. **No Page-Jolting Parallax**: Banned to maintain enterprise speed and accessibility.

---

## 8. Accessibility & Compliance (WCAG 2.1 AA)

- **Color Contrast**: All body text (`#0F172A`) against canvas (`#FFFFFF` / `#F8FAFC`) exceeds a `12:1` contrast ratio (far exceeding WCAG AA's `4.5:1` minimum).
- **Keyboard Trapping**: Modals and Drawers implement accessible focus trapping and `Escape` key listeners.
- **ARIA Attributes**: Every custom input and interactive element includes explicit `aria-label`, `role`, and `aria-live="polite"` indicators for voice state changes.
- **Tabular Numerals**: Numbers in financial records, call durations, and phone numbers use `font-variant-numeric: tabular-nums` to ensure exact column alignment.
