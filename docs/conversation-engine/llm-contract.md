# LLM Provider Abstraction & Structured Output Contract

## 1. Interface Decoupling
The conversation engine does not directly depend on any specific LLM provider (OpenAI, Gemini, Anthropic, Sarvam, or local models). All model reasoning is accessed via `ILLMProvider`:

```ts
export interface ILLMProvider {
  generateDecision(context: StructuredContextAssembly): Promise<StructuredLLMDecisionDTO>;
}
```

## 2. Structured Decision Schema
The model returns a validated typed schema (`StructuredLLMDecisionDTO`), never raw executable code or unparsed text:

```ts
export type StructuredLLMDecisionType =
  | 'RESPOND'             // Direct customer conversational reply
  | 'ASK_CLARIFICATION'   // Request more details before proceeding
  | 'CALL_TOOL'           // Request tool execution with arguments
  | 'HANDOFF'             // Escalate to human agent or department
  | 'END_CONVERSATION';   // Gracefully terminate session

export interface StructuredLLMDecisionDTO {
  type: StructuredLLMDecisionType;
  response: string;
  toolRequest?: {
    toolName: string;
    args: Record<string, any>;
  };
  handoffReason?: string;
  reason: string;
  confidence: number;
  knowledgeReferences: string[];
}
```

## 3. Post-Generation Factual Validation
Before returning or executing:
1. `FactualResponseValidator` scans output against healthcare non-diagnosis guardrails and ungrounded price claims.
2. Injections or internal prompt envelope leaks are neutralized.
3. If unverified claims are detected, the system safely falls back to `INFORMATION_UNAVAILABLE` or safe refusal.
