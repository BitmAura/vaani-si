/**
 * Layer 4: Regional Voice Adapters
 * Vaani SI — Sarvam AI Streaming Connector (Saaras STT & Bulbul TTS) with Azure Speech Fallback
 */

export interface SarvamTTSRequest {
  inputs: string[];
  target_language_code: 'kn-IN' | 'te-IN' | 'hi-IN' | 'ta-IN';
  speaker: 'kavya' | 'aditya' | 'ritu' | 'shreya' | 'meera' | 'pavithra';
  pitch?: number;
  pace?: number;
  loudness?: number;
  speech_sample_rate?: 8000 | 16000 | 22050;
  enable_preprocessing?: boolean;
  model?: 'bulbul:v1' | 'bulbul:v2' | 'bulbul:v3';
}

export interface SarvamSTTResponse {
  transcript: string;
  language_code: string;
  confidence: number;
}

/**
 * Ensures audio buffer has a standard 44-byte RIFF WAV header.
 * If raw PCM16 is supplied, prepends valid RIFF WAVE header for 16-bit PCM.
 */
export function ensureWavHeader(
  pcmBuffer: Buffer,
  sampleRate = 16000,
  channels = 1,
  bitsPerSample = 16
): Buffer {
  if (pcmBuffer.length >= 4 && pcmBuffer.toString('ascii', 0, 4) === 'RIFF') {
    return pcmBuffer;
  }

  const header = Buffer.alloc(44);
  const dataSize = pcmBuffer.length;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);

  // RIFF chunk descriptor
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4); // ChunkSize
  header.write('WAVE', 8);

  // 'fmt ' subchunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size for PCM (16)
  header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  header.writeUInt16LE(channels, 22); // NumChannels
  header.writeUInt32LE(sampleRate, 24); // SampleRate
  header.writeUInt32LE(byteRate, 28); // ByteRate
  header.writeUInt16LE(blockAlign, 32); // BlockAlign
  header.writeUInt16LE(bitsPerSample, 34); // BitsPerSample

  // 'data' subchunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40); // Subchunk2Size

  return Buffer.concat([header, pcmBuffer]);
}

export class SarvamVoiceAdapter {
  private apiKey: string;
  private baseUrl: string = 'https://api.sarvam.ai';
  private azureKey: string;
  private azureRegion: string;

  constructor(apiKey?: string, azureKey?: string, azureRegion?: string) {
    this.apiKey = apiKey || process.env.SARVAM_API_KEY || '';
    this.azureKey = azureKey || process.env.AZURE_SPEECH_KEY || '';
    this.azureRegion = azureRegion || process.env.AZURE_SPEECH_REGION || 'centralindia';
  }

  public ensureWavHeader(
    pcmBuffer: Buffer,
    sampleRate = 16000,
    channels = 1,
    bitsPerSample = 16
  ): Buffer {
    return ensureWavHeader(pcmBuffer, sampleRate, channels, bitsPerSample);
  }

  /**
   * Synthesize Kannada Speech Audio via Sarvam Bulbul v3 with Azure Speech Fallback
   */
  public async synthesizeSpeech(
    text: string,
    options?: {
      speaker?: 'kavya' | 'aditya' | 'ritu' | 'shreya' | 'meera' | 'pavithra';
      sampleRate?: 8000 | 16000;
      language?: 'kn-IN';
    }
  ): Promise<{ audioBase64: string; sampleRate: number }> {
    // 1. Try Sarvam Bulbul v3 first if API key configured
    if (this.apiKey) {
      try {
        const payload: SarvamTTSRequest = {
          inputs: [text],
          target_language_code: options?.language || 'kn-IN',
          speaker: options?.speaker || 'kavya',
          speech_sample_rate: options?.sampleRate || 16000,
          enable_preprocessing: true,
          model: 'bulbul:v3',
        };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch(`${this.baseUrl}/text-to-speech`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-subscription-key': this.apiKey,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json();
          const audios = data.audios || [];
          if (audios.length > 0) {
            return {
              audioBase64: audios[0],
              sampleRate: payload.speech_sample_rate || 16000,
            };
          }
        }
      } catch (err: any) {
        console.warn('[SarvamVoiceAdapter] Sarvam TTS attempt failed, falling back:', err.message);
      }
    }

    // 2. Try Azure Cognitive Speech Fallback if configured
    if (this.azureKey) {
      try {
        const voiceName = options?.speaker === 'aditya' ? 'kn-IN-GaganNeural' : 'kn-IN-SapnaNeural';
        const cleanText = text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

        const ssml = `<speak version='1.0' xml:lang='kn-IN'>
  <voice xml:lang='kn-IN' name='${voiceName}'>${cleanText}</voice>
</speak>`;

        const azureUrl = `https://${this.azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(azureUrl, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': this.azureKey,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': options?.sampleRate === 8000
              ? 'raw-8khz-8bit-mono-mulaw'
              : 'riff-16khz-16bit-mono-pcm',
            'User-Agent': 'Vaani-Si-VoiceEngine',
          },
          body: ssml,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const audioBase64 = Buffer.from(arrayBuffer).toString('base64');
          return {
            audioBase64,
            sampleRate: options?.sampleRate || 16000,
          };
        }
      } catch (azureErr: any) {
        console.warn('[SarvamVoiceAdapter] Azure Speech TTS fallback failed:', azureErr.message);
      }
    }

    // 3. In production mode, missing credentials must fail closed
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[SarvamVoiceAdapter] Missing SARVAM_API_KEY or AZURE_SPEECH_KEY in production mode. Refusing unconfigured TTS fallback.');
    }

    // In dev/test when neither key is configured, return deterministic silent audio frame (400ms PCM16)
    const sampleRate = options?.sampleRate || 16000;
    const numSamples = Math.round(sampleRate * 0.4); // 400ms
    const dummyBuffer = ensureWavHeader(Buffer.alloc(numSamples * 2), sampleRate, 1, 16);
    return {
      audioBase64: dummyBuffer.toString('base64'),
      sampleRate,
    };
  }

  /**
   * Transcribe Spoken Kannada Audio to Text via Sarvam Saaras STT with Azure Fallback
   */
  public async transcribeSpeech(
    audioBuffer: Buffer,
    languageCode: 'kn-IN' = 'kn-IN'
  ): Promise<SarvamSTTResponse> {
    // 1. Try Sarvam Saaras first
    if (this.apiKey) {
      try {
        const wavBuffer = ensureWavHeader(audioBuffer, 16000, 1, 16);
        const formData = new FormData();
        const blob = new Blob([new Uint8Array(wavBuffer)], { type: 'audio/wav' });
        formData.append('file', blob, 'audio.wav');
        formData.append('language_code', languageCode);
        formData.append('model', 'saaras:v3');

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        const response = await fetch(`${this.baseUrl}/speech-to-text`, {
          method: 'POST',
          headers: {
            'api-subscription-key': this.apiKey,
          },
          body: formData,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json();
          return {
            transcript: data.transcript || '',
            language_code: data.language_code || languageCode,
            confidence: data.confidence || 0.95,
          };
        }
      } catch (sttErr: any) {
        console.warn('[SarvamVoiceAdapter] Sarvam STT failed, falling back:', sttErr.message);
      }
    }

    // 2. Try Azure Speech STT Fallback
    if (this.azureKey) {
      try {
        const wavBuffer = ensureWavHeader(audioBuffer, 16000, 1, 16);
        const url = `https://${this.azureRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${languageCode}&format=detailed`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': this.azureKey,
            'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
            'Accept': 'application/json',
          },
          body: wavBuffer as any,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json() as any;
          const transcript = data.DisplayText || data.NBest?.[0]?.Display || '';
          return {
            transcript,
            language_code: languageCode,
            confidence: data.NBest?.[0]?.Confidence || 0.9,
          };
        }
      } catch (azureErr: any) {
        console.warn('[SarvamVoiceAdapter] Azure STT fallback failed:', azureErr.message);
      }
    }

    // 3. In production mode, missing credentials must fail closed
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[SarvamVoiceAdapter] Missing SARVAM_API_KEY or AZURE_SPEECH_KEY in production mode. Refusing unconfigured STT fallback.');
    }

    // In dev/test when keys not configured, return empty transcript for truthful recovery
    return {
      transcript: '',
      language_code: languageCode,
      confidence: 0,
    };
  }
}
