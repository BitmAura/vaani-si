import { ITTSProvider, AudioPayload, TTSOptions } from '@vanni/provider-sdk';

/**
 * Sarvam Bulbul v3 Kannada & Kanglish Text-to-Speech Adapter
 * Real Live Telephony Synthesis (No Mocks)
 */
export class SarvamBulbulTTSProvider implements ITTSProvider {
  public readonly providerName = 'sarvam_bulbul_v3';
  private apiKey: string;
  private baseUrl = 'https://api.sarvam.ai';

  constructor(apiKey?: string) {
    this.apiKey = apiKey !== undefined ? apiKey : (process.env.SARVAM_API_KEY || '');
  }

  public async synthesize(text: string, options?: TTSOptions): Promise<AudioPayload> {
    if (!this.apiKey) {
      throw new Error('[SarvamBulbulTTS] Missing SARVAM_API_KEY in environment');
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
          model: 'bulbul:v3',
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`[SarvamBulbul v3] HTTP ${response.status}: ${err}`);
      }

      const data = await response.json() as any;
      const base64Audio = data.audios?.[0] || '';
      if (!base64Audio) {
        throw new Error('[SarvamBulbul v3] Empty audio payload returned');
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
        throw new Error(`[SarvamBulbul v3] Request timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
