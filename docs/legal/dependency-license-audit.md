# VANNI Dependency & Open Source License Audit

**Scope**: Production SaaS Runtime & Monorepo Packages  
**Date**: 2026-10-05  
**Reviewer**: Antigravity System Architect

---

## 1. Dependency Analysis & License Inventory

| Package | Version | License | Direct/Transitive | SaaS Compliance Status | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `fastify` | ^4.28.1 | MIT | Direct | **COMPLIANT** | High-performance core HTTP framework. Permissive commercial use. |
| `@fastify/cors` | ^9.0.1 | MIT | Direct | **COMPLIANT** | CORS middleware. Permissive commercial use. |
| `@fastify/websocket` | ^10.0.1 | MIT | Direct | **COMPLIANT** | WebSocket streaming runtime for voice gateway. |
| `dotenv` | ^16.4.5 | BSD-2-Clause | Direct | **COMPLIANT** | Environment variable management. Permissive commercial use. |
| `zod` | ^3.23.8 | MIT | Direct | **COMPLIANT** | Schema validation across DTOs and tool engines. |
| `@supabase/supabase-js` | ^2.45.0 | MIT | Direct | **COMPLIANT** | Supabase database client and auth runtime. |
| `node:crypto` | Built-in | Node.js | Standard | **COMPLIANT** | Webhook HMAC verification and constant-time equality comparisons. |
| `typescript` | ^5.5.4 | Apache-2.0 | DevDependency | **COMPLIANT** | Type checking and compilation. |

---

## 2. Copyleft & Commercial SaaS Assessment

1. **No GPL / AGPL Contamination**: No GNU General Public License (GPL) or Affero General Public License (AGPL) libraries are linked or embedded in VANNI's proprietary core runtime.
2. **Proprietary IP Safe**: The core conversation engine, Kannada/Kanglish code-switching logic, Business Brain state machine, and tool execution engine remain protected under VANNI's proprietary enterprise SaaS license.
3. **Third-Party SaaS SDK Isolation**: All vendor integrations (Sarvam AI, Exotel, Twilio, Google Gemini, Razorpay) are accessed via standard REST/WebSocket protocols wrapped within `@vanni/provider-sdk`, ensuring zero proprietary vendor code locks.
