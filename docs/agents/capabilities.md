# Capabilities & Server-Enforced Tool Permissions

## Security Principle: Prompt vs. Backend Enforcement

**Crucial Architecture Directive**: In VANNI, capability permissions are **never enforced solely by LLM prompt guidance**. 

If an AI Employee has `BOOK_APPOINTMENT` enabled, but `CANCEL_APPOINTMENT` disabled, the Tool Engine will strictly reject any cancellation tool invocation on the server side, even if the model attempts to invoke it.

---

## Capabilities Catalogue

| Capability Enum | Description | Requires Operator Permission |
|---|---|---|
| `ANSWER_QUESTIONS` | Standard business grounding from Business Brain & Knowledge Base | No |
| `QUALIFY_LEAD` | Collect and score lead requirements (budget, timeline) | No |
| `COLLECT_CONTACT_DETAILS` | Collect caller phone, name, email | No |
| `BOOK_APPOINTMENT` | Schedule new calendar slot for doctor or site visit | Yes |
| `RESCHEDULE_APPOINTMENT`| Modify existing appointment booking | Yes |
| `CANCEL_APPOINTMENT` | Cancel scheduled booking (Strictly protected by default) | Yes |
| `CONFIRM_APPOINTMENT` | Dispatch appointment confirmation | No |
| `FOLLOW_UP` | Trigger automated outbound follow-up task | Yes |
| `TRANSFER_TO_HUMAN` | Route live telephony session to human destination | No |
| `SEND_MESSAGE` | Send SMS or WhatsApp message via authorized gateway | No |
| `CREATE_LEAD` | Persist lead dossier into CRM | No |
| `UPDATE_LEAD` | Update existing customer record | No |
| `CHECK_AVAILABILITY` | Query doctor / resource calendar for open slots | No |
| `CREATE_TASK` | File task for front desk staff in queue | No |

---

## Tool Execution Configuration

Every agent tool is explicitly marked with its implementation status and execution permissions:
```typescript
export interface AgentToolConfig {
  toolName: string;
  displayName: string;
  enabled: boolean;
  category: 'CALENDAR' | 'CRM' | 'COMMUNICATION' | 'KNOWLEDGE' | 'TELEPHONY';
  isImplemented: boolean;
  permissions: {
    canExecute: boolean;
    requiresConfirmation: boolean;
  };
}
```

If a tool is not yet implemented (e.g. `sms_whatsapp_dispatch`), `isImplemented` is `false`, and the compiler will strictly disallow `canExecute: true`.
