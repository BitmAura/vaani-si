import { ISTTProvider, STTOptions, SpeechTranscript } from '@vanni/provider-sdk';
import { ensureWavHeader } from './sarvam-saaras.js';

/**
 * Azure Cognitive Speech Speech-to-Text Provider for Kannada (kn-IN)
 * Secondary / Fallback high-reliability transcription engine.
 */
export class AzureSpeechSTTProvider implements ISTTProvider {
  public readonly providerName = 'azure_speech_stt';
  private apiKey: string;
  private region: string;

  constructor(apiKey?: string, region?: string) {
    this.apiKey = apiKey || process.env.AZURE_SPEECH_KEY || '';
    this.region = region || process.env.AZURE_SPEECH_REGION || 'centralindia';
  }

  public async transcribe(audio: Buffer, options?: STTOptions): Promise<SpeechTranscript> {
    if (!this.apiKey) {
      throw new Error('[AzureSpeechSTT] Missing AZURE_SPEECH_KEY in environment');
    }

    const wavAudio = ensureWavHeader(audio, 16000, 1, 16);
    const lang = options?.languageCode || 'kn-IN';
    const url = `https://${this.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${lang}&format=detailed`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey,
          'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
          'Accept': 'application/json',
          'User-Agent': 'Vaani-Si-VoiceEngine',
        },
        body: wavAudio as any,
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`[AzureSpeechSTT] HTTP ${res.status}: ${err}`);
      }

      const data = await res.json() as any;
      if (data.RecognitionStatus === 'Success') {
        const best = data.NBest?.[0] || {};
        return {
          text: best.Display || best.Lexical || data.DisplayText || '',
          confidence: best.Confidence || 0.9,
          languageCode: lang,
          isFinal: true,
        };
      }

      return {
        text: data.DisplayText || '',
        confidence: 0.5,
        languageCode: lang,
        isFinal: true,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
