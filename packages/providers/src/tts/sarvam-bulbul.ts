import { ITTSProvider, AudioPayload, TTSOptions } from '@vanni/provider-sdk';

/** Sarvam single-response TTS. Override with SARVAM_TTS_MODEL. */
const DEFAULT_TTS_MODEL = 'bulbul:v4-flash';

/**
 * Sarvam Bulbul Kannada & Kanglish Text-to-Speech Adapter
 * Real Live Telephony Synthesis (No Mocks)
 * Same JSON POST as Bulbul v3; default model is bulbul:v4-flash.
 */
export class SarvamBulbulTTSProvider implements ITTSProvider {
  public readonly providerName = 'sarvam_bulbul';
  private apiKey: string;
  private baseUrl = 'https://api.sarvam.ai';

  constructor(apiKey?: string) {
    this.apiKey = apiKey !== undefined ? apiKey : (process.env.SARVAM_API_KEY || '');
  }

  private activeModel(): string {
    const override = process.env.SARVAM_TTS_MODEL?.trim();
    return override ? override : DEFAULT_TTS_MODEL;
  }

  public async synthesize(text: string, options?: TTSOptions): Promise<AudioPayload> {
    const model = this.activeModel();

    if (!this.apiKey) {
      throw new Error(`[SarvamBulbul ${model}] Missing SARVAM_API_KEY in environment`);
    }

    const controller = new AbortController();
    const timeoutMs = 6000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/text-to-speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': this.apiKey,
        },
        body: JSON.stringify({
          inputs: [text],
          target_language_code: options?.targetLanguageCode || 'kn-IN',
          speaker: options?.speaker || 'kavya',
          speech_sample_rate: options?.sampleRate || 16000,
          enable_preprocessing: true,
          model,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`[SarvamBulbul ${model}] HTTP ${response.status}: ${err}`);
      }

      const data = await response.json() as any;
      const base64Audio = data.audios?.[0] || '';
      if (!base64Audio) {
        throw new Error(`[SarvamBulbul ${model}] Empty audio payload returned`);
      }

      const audioBuffer = Buffer.from(base64Audio, 'base64');

      return {
        audioBuffer,
        audioBase64: base64Audio,
        sampleRate: options?.sampleRate || 16000,
        durationMs: Math.round((audioBuffer.length / (options?.sampleRate || 16000)) * 1000),
        format: 'wav',
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`[SarvamBulbul ${model}] Request timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
