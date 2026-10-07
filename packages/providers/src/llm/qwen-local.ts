import { ILLMProvider, LLMMessage, LLMTurnResponse, LLMOptions } from '@vanni/provider-sdk';

/**
 * Local Qwen 2.5 Provider (Connecting to Ollama / vLLM from crazy-ai-stack/03-llms-rag-search/Qwen)
 */
export class QwenLocalLLMProvider implements ILLMProvider {
  public readonly providerName = 'qwen2.5_local';
  private baseUrl: string;
  private modelName: string;

  constructor(baseUrl?: string, modelName?: string) {
    this.baseUrl = baseUrl || process.env.LOCAL_LLM_URL || 'http://localhost:11434';
    this.modelName = modelName || process.env.LOCAL_LLM_MODEL || 'qwen2.5:7b-instruct';
  }

  public async generateTurn(
    systemPrompt: string,
    history: LLMMessage[],
    userUtterance: string,
    options?: LLMOptions
  ): Promise<LLMTurnResponse> {
    const startTime = Date.now();
    const timeoutMs = options?.timeoutMs || 800;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userUtterance },
      ];

      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          messages,
          stream: false,
          options: {
            temperature: options?.temperature ?? 0.3,
            num_predict: options?.maxOutputTokens ?? 50,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`[QwenLocal] HTTP status ${res.status}`);
      }

      const data = await res.json() as any;
      const text = data.message?.content?.trim() || '';

      return {
        content: text,
        totalDurationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      clearTimeout(timeout);
      return {
        content: 'Namaskara sir! Details share maadla?',
        totalDurationMs: Date.now() - startTime,
      };
    }
  }
}
