import { ILLMProvider, LLMMessage, LLMTurnResponse, LLMOptions } from '@vanni/provider-sdk';

/**
 * Gemini 1.5 Flash Provider for Ultra-Fast Time-to-First-Token
 */
export class GeminiFlashLLMProvider implements ILLMProvider {
  public readonly providerName = 'gemini_1.5_flash';
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
  }

  public async generateTurn(
    systemPrompt: string,
    history: LLMMessage[],
    userUtterance: string,
    options?: LLMOptions
  ): Promise<LLMTurnResponse> {
    const startTime = Date.now();

    if (!this.apiKey) {
      return {
        content: 'Namaskara sir! Ballari Layouts inda mathadtha iddini. Details hella sir?',
        totalDurationMs: Date.now() - startTime,
      };
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
      console.warn(`[GeminiFlashLLM] Error calling Gemini: ${err.message}`);
      return {
        content: 'Namaskara sir, namma executive team nimge details share madthare.',
        totalDurationMs: Date.now() - startTime,
      };
    }
  }
}
