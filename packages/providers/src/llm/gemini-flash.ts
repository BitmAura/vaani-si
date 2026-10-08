import { ILLMProvider, LLMMessage, LLMTurnResponse, LLMOptions } from '@vanni/provider-sdk';
import { StructuredLLMDecisionDTO } from '@vanni/shared';

/**
 * Structural subset of the Conversation Engine's 11-layer context assembly.
 * Declared locally to avoid a providers -> conversation-engine dependency.
 */
interface StructuredDecisionContext {
  L0_PlatformSafety: string;
  L1_Compliance: string;
  L2_IndustryRules: string;
  L3_AgentIdentity: string;
  L4_AgentObjective: string;
  L5_BusinessBrain: string;
  L6_BusinessPolicies: string;
  L7_RetrievedKnowledge: string;
  L8_ConversationHistory: string;
  L9_CurrentInput: string;
  L10_ToolResults: string;
}

/**
 * Gemini 1.5 Flash Provider for Ultra-Fast Time-to-First-Token
 */
export class GeminiFlashLLMProvider {
  public readonly providerName = 'gemini_1.5_flash';
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
  }

  /**
   * Structured decision generation for the Conversation Orchestrator.
   * Asks Gemini for a strict JSON decision validated against the allowed
   * decision types; never returns tenant-specific hardcoded content.
   */
  public async generateDecision(context: StructuredDecisionContext): Promise<StructuredLLMDecisionDTO> {
    if (!this.apiKey) {
      throw new Error('[GeminiFlashLLM] Missing GEMINI_API_KEY in environment');
    }

    const systemPrompt = [
      context.L0_PlatformSafety,
      context.L1_Compliance,
      context.L2_IndustryRules,
      context.L3_AgentIdentity,
      context.L4_AgentObjective,
      context.L5_BusinessBrain,
      context.L6_BusinessPolicies,
      context.L7_RetrievedKnowledge,
      'OUTPUT FORMAT: Reply with ONLY a JSON object: {"type": "RESPOND" | "ASK_CLARIFICATION" | "CALL_TOOL" | "HANDOFF" | "END_CONVERSATION", "response": "<spoken reply in the customer\'s language>", "reason": "<short reason>", "confidence": <0-1>, "knowledgeReferences": [<titles used>]}. No markdown, no code fences.',
    ].filter(Boolean).join('\n\n');

    const historyTurns = context.L8_ConversationHistory;
    const userUtterance = [
      historyTurns ? `CONVERSATION SO FAR:\n${historyTurns}` : '',
      context.L10_ToolResults ? `TOOL RESULTS:\n${context.L10_ToolResults}` : '',
      `CUSTOMER SAYS: ${context.L9_CurrentInput}`,
    ].filter(Boolean).join('\n\n');

    const result = await this.generateTurn(systemPrompt, [], userUtterance, { maxOutputTokens: 300 });

    return this.parseDecision(result.content);
  }

  /**
   * Robust JSON decision parsing with a safe RESPOND fallback.
   */
  private parseDecision(content: string): StructuredLLMDecisionDTO {
    const fallback: StructuredLLMDecisionDTO = {
      type: 'RESPOND',
      response: content.trim(),
      reason: 'LLM returned prose; treated as a plain response',
      confidence: 0.6,
      knowledgeReferences: [],
    };

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;

    try {
      const parsed = JSON.parse(jsonMatch[0]) as Partial<StructuredLLMDecisionDTO>;
      const allowedTypes = ['RESPOND', 'ASK_CLARIFICATION', 'CALL_TOOL', 'HANDOFF', 'END_CONVERSATION'];
      if (!parsed.type || !allowedTypes.includes(parsed.type) || typeof parsed.response !== 'string') {
        return fallback;
      }
      return {
        type: parsed.type,
        response: parsed.response,
        toolRequest: parsed.toolRequest,
        handoffReason: parsed.handoffReason,
        reason: parsed.reason || '',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
        knowledgeReferences: Array.isArray(parsed.knowledgeReferences) ? parsed.knowledgeReferences : [],
      };
    } catch {
      return fallback;
    }
  }

  public async generateTurn(
    systemPrompt: string,
    history: LLMMessage[],
    userUtterance: string,
    options?: LLMOptions
  ): Promise<LLMTurnResponse> {
    const startTime = Date.now();

    if (!this.apiKey) {
      // SECURITY/CORRECTNESS: never fabricate tenant-specific content. A missing
      // API key is a configuration failure and must fail loudly.
      throw new Error('[GeminiFlashLLM] Missing GEMINI_API_KEY in environment');
    }

    try {
      const contents = [
        ...history.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        {
          role: 'user',
          parts: [{ text: userUtterance }],
        },
      ];

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemPrompt }],
          },
          contents,
          generationConfig: {
            temperature: options?.temperature ?? 0.3,
            maxOutputTokens: options?.maxOutputTokens ?? 60,
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`[GeminiFlash] HTTP status ${res.status}`);
      }

      const data = await res.json() as any;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

      return {
        content: text,
        totalDurationMs: Date.now() - startTime,
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount || 0,
          completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: data.usageMetadata?.totalTokenCount || 0,
        },
      };
    } catch (err: any) {
      // Transient provider failure: return a NEUTRAL retry prompt in the
      // customer's language (no tenant-specific content, no silent success).
      console.error(`[GeminiFlashLLM] Error calling Gemini: ${err.message}`);
      return {
        content: 'Kshamisi, nammalli technical problem ide. Dayavittu matte heli sir.',
        totalDurationMs: Date.now() - startTime,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    }
  }
}
