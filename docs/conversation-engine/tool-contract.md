# Tool Permission & Execution Contract

## 1. Principles of Tool Execution
1. **Never LLM-Direct**: The LLM cannot mutate database records or execute APIs directly.
2. **Permission Check**: The tool must be explicitly enabled in `AgentRuntimeConfig.tools` for that published agent version.
3. **High-Impact Confirmation**: Actions that mutate external state (`book_appointment`, `cancel_appointment`, `send_sms`) require caller confirmation before execution.
4. **Reversible & Safe Fallback**: If a tool fails, the system transitions to alternative routing, human escalation, or a polite error reply without falsely claiming success.

## 2. Tool Lifecycle
```
LLM Decision (CALL_TOOL)
  │
  ▼
ToolPermissionEvaluator.evaluateToolRequest()
  │
  ├──► Not Permitted ──► Generate safe refusal ──► Return to LISTENING
  │
  ├──► High Impact Action ──► State: CONFIRMING (Held until customer confirms)
  │
  └──► Read-Only Lookup ──► State: TOOL_EXECUTION ──► Execute Tool ──► Synthesize response
```

## 3. High-Impact Tools
The following operations require explicit confirmation by default:
- `book_appointment`
- `cancel_appointment`
- `reschedule_appointment`
- `submit_lead_application`
- `transfer_to_human`
- `send_sms_confirmation`
