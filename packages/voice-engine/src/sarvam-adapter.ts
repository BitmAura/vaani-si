/**
 * Layer 4: Regional Voice Adapters
 * Vaani SI — Sarvam AI Streaming Connector (Saaras STT & Bulbul TTS)
 */

export interface SarvamTTSRequest {
  inputs: string[];
  target_language_code: 'kn-IN' | 'te-IN' | 'hi-IN' | 'ta-IN';
  speaker: 'meera' | 'pavithra' | 'mahesh' | 'arvind';
  pitch?: number;
  pace?: number;
  loudness?: number;
  speech_sample_rate?: 8000 | 16000 | 22050;
  enable_preprocessing?: boolean;
  model?: 'bulbul:v1' | 'bulbul:v2';
}

export interface SarvamSTTResponse {
  transcript: string;
  language_code: string;
  confidence: number;
}

export class SarvamVoiceAdapter {
  private apiKey: string;
  private baseUrl: string = 'https://api.sarvam.ai';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.SARVAM_API_KEY || '';
  }

  /**
   * Synthesize Kannada Speech Audio via Sarvam Bulbul v2
   * Returns audio buffer (WAV / PCM 8kHz for telephony, or 16kHz for WebRTC)
   */
  public async synthesizeSpeech(
    text: string,
    options?: {
      speaker?: 'meera' | 'pavithra';
      sampleRate?: 8000 | 16000;
      language?: 'kn-IN';
    }
  ): Promise<{ audioBase64: string; sampleRate: number }> {
    if (!this.apiKey) {
      throw new Error('[SarvamVoiceAdapter] Missing SARVAM_API_KEY. Configure in .env');
    }

    const payload: SarvamTTSRequest = {
      inputs: [text],
      target_language_code: options?.language || 'kn-IN',
      speaker: options?.speaker || 'meera',
      speech_sample_rate: options?.sampleRate || 16000,
      enable_preprocessing: true,
      model: 'bulbul:v2',
    };

    const response = await fetch(`${this.baseUrl}/text-to-speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': this.apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`[Sarvam TTS Error] HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const audios = data.audios || [];
    if (!audios.length) {
      throw new Error('[Sarvam TTS Error] Empty audio returned from Sarvam API');
    }

    return {
      audioBase64: audios[0],
      sampleRate: payload.speech_sample_rate || 16000,
    };
  }

  /**
   * Transcribe Spoken Kannada Audio to Text via Sarvam Saaras STT
   */
  public async transcribeSpeech(
    audioBuffer: Buffer,
    languageCode: 'kn-IN' = 'kn-IN'
  ): Promise<SarvamSTTResponse> {
    if (!this.apiKey) {
      throw new Error('[SarvamVoiceAdapter] Missing SARVAM_API_KEY. Configure in .env');
    }

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/wav' });
    formData.append('file', blob, 'audio.wav');
    formData.append('language_code', languageCode);
    formData.append('model', 'saaras:v1');

    const response = await fetch(`${this.baseUrl}/speech-to-text`, {
      method: 'POST',
      headers: {
        'api-subscription-key': this.apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`[Sarvam STT Error] HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return {
      transcript: data.transcript || '',
      language_code: data.language_code || languageCode,
      confidence: data.confidence || 0.95,
    };
  }
}
