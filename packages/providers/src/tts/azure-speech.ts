import { ITTSProvider, AudioPayload, TTSOptions } from '@vanni/provider-sdk';

/**
 * Azure Cognitive Speech Text-to-Speech Provider for Kannada (kn-IN)
 * Secondary / Fallback high-reliability synthesis engine.
 * Voices: kn-IN-SapnaNeural (Female), kn-IN-GaganNeural (Male)
 */
export class AzureSpeechTTSProvider implements ITTSProvider {
  public readonly providerName = 'azure_speech_tts';
  private apiKey: string;
  private region: string;

  constructor(apiKey?: string, region?: string) {
    this.apiKey = apiKey || process.env.AZURE_SPEECH_KEY || '';
    this.region = region || process.env.AZURE_SPEECH_REGION || 'centralindia';
  }

  public async synthesize(text: string, options?: TTSOptions): Promise<AudioPayload> {
    if (!this.apiKey) {
      throw new Error('[AzureSpeechTTS] Missing AZURE_SPEECH_KEY in environment');
    }

    const voiceName = options?.speaker === 'aditya' || options?.speaker === 'male'
      ? 'kn-IN-GaganNeural'
      : 'kn-IN-SapnaNeural';

    const cleanText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    const ssml = `<speak version='1.0' xml:lang='kn-IN'>
  <voice xml:lang='kn-IN' xml:gender='${voiceName.includes('Gagan') ? 'Male' : 'Female'}' name='${voiceName}'>
    ${cleanText}
  </voice>
</speak>`;

    const url = `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'riff-16khz-16bit-mono-pcm',
          'User-Agent': 'Vaani-Si-VoiceEngine',
        },
        body: ssml,
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`[AzureSpeechTTS] HTTP ${res.status}: ${errText}`);
      }

      const arrayBuffer = await res.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);
      const audioBase64 = audioBuffer.toString('base64');
      const sampleRate = options?.sampleRate || 16000;
      const durationMs = Math.round((audioBuffer.length / (sampleRate * 2)) * 1000);

      return {
        audioBuffer,
        audioBase64,
        sampleRate,
        durationMs,
        format: 'wav',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
