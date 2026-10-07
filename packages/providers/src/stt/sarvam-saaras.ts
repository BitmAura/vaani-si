import { ISTTProvider, STTOptions, SpeechTranscript } from '@vanni/provider-sdk';

/**
 * Sarvam Saaras v3 Regional Kannada & Indian STT Provider
 * Real Live Speech-to-Text Transcription (No Mocks)
 */
export class SarvamSaarasSTTProvider implements ISTTProvider {
  public readonly providerName = 'sarvam_saaras_v3';
  private apiKey: string;
  private baseUrl = 'https://api.sarvam.ai';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.SARVAM_API_KEY || '';
  }

  public async transcribe(audioBuffer: Buffer, options?: STTOptions): Promise<SpeechTranscript> {
    if (!this.apiKey) {
      throw new Error('[SarvamSaarasSTT] Missing SARVAM_API_KEY in environment');
    }

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/wav' });
    formData.append('file', blob, 'audio.wav');
    formData.append('language_code', options?.languageCode || 'kn-IN');
    formData.append('model', 'saaras:v3');

    const response = await fetch(`${this.baseUrl}/speech-to-text`, {
      method: 'POST',
      headers: {
        'api-subscription-key': this.apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`[SarvamSaaras v3 STT Error] HTTP ${response.status}: ${err}`);
    }

    const data = await response.json() as any;
    const text = data.transcript || '';

    return {
      text,
      languageCode: data.language_code || 'kn-IN',
      confidence: data.confidence || 0.95,
      isFinal: true,
      durationMs: 1500,
    };
  }
}
