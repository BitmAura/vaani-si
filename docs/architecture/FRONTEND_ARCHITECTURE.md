# VANNI Frontend & UI/UX Architecture

> **Architecture Stage**: Design System & Frontend Foundation  
> **Package**: `@vanni/ui` (Private Workspace Monorepo Package)  
> **Server Integration**: Fastify static distribution via `/assets/vanni.css` and route controllers

---

## 1. Monorepo Organization

The frontend foundation for VANNI is organized as a zero-dependency, pure TypeScript UI system within the monorepo:

```
vaani-si/
├── packages/
│   ├── core/              # Domain entities, tenant schema, CRM interfaces
│   ├── provider-sdk/      # Provider contracts (STT, TTS, LLM, Telephony, CRM)
│   ├── providers/         # Concrete integrations (Sarvam, Qwen, Exotel, WhatsApp)
│   └── ui/                # @vanni/ui: Master Design System & Component Library
│       ├── src/
│       │   ├── tokens/    # Semantic design tokens (Colors, Typography, Spacing, Radius, Shadows, Motion)
│       │   ├── styles/    # Pure Vanilla CSS design system (vanni.css)
│       │   ├── components/
│       │   │   ├── layout/      # AppShell, MarketingHeader, Footer, Sidebar, PageHeader
│       │   │   ├── navigation/  # Tabs, Breadcrumbs, Pagination, CommandMenu
│       │   │   ├── forms/       # Input, Textarea, Select, Switch, Checkbox, Radio, FileUpload
│       │   │   ├── ui/          # Button, IconButton, Badge, Alert, Modal, Drawer, Skeleton
│       │   │   ├── analytics/   # Table, MetricCard, EmptyState, Timeline
│       │   │   └── voice/       # VoiceActivityIndicator, TranscriptLine, AudioWaveform
│       │   └── index.ts
│       ├── dist/          # Compiled ESM/CJS and styles/vanni.css
│       └── package.json
├── apps/
│   ├── server/            # Fastify Real-Time Server + WebSocket audio stream
│   └── web/               # Web client applications (index.html, console.html, login.html)
└── docs/
    ├── design/            # DESIGN_SYSTEM.md
    ├── ux/                # COMPONENT_PATTERNS.md
    └── architecture/      # FRONTEND_ARCHITECTURE.md
```

---

## 2. Zero-Runtime Bloat Philosophy

1. **Lightweight Compilation**:
   `@vanni/ui` compiles via `tsc` without requiring complex bundlers or heavy third-party CSS compilers.
2. **Vanilla CSS Standard**:
   All tokens are exposed as standard CSS custom properties (`--vanni-bg`, `--vanni-primary`, `--vanni-font-sans`), ensuring maximum browser performance, fast load times, and instantaneous rendering.
3. **Server-Rendered & Static Delivery**:
   Fastify serves the compiled CSS distribution from `/assets/vanni.css` directly to all client consoles and marketing pages.

---

## 3. Design Verification & Quality Gates

The frontend architecture enforces three strict automated quality gates:
1. `npm run build --prefix packages/ui`: Strict TypeScript verification with declaration map emission and CSS asset synchronization.
2. `npm run build`: Monorepo-wide compilation check ensuring zero type regressions across `@vanni/core`, `@vanni/provider-sdk`, `@vanni/providers`, and `@vanni/ui`.
3. `e2e-api-test.mjs`: Fastify server route integrity and static asset delivery verification.
