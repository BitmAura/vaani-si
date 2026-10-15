/**
 * Layer 4: Regional Voice Adapters
 * Vaani SI — Sarvam AI Streaming Connector (Saaras STT & Bulbul TTS)
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

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.SARVAM_API_KEY || '';
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
   * Synthesize Kannada Speech Audio via Sarvam Bulbul v3
   * Returns audio buffer (WAV / PCM 8kHz for telephony, or 16kHz for WebRTC)
   */
  public async synthesizeSpeech(
    text: string,
    options?: {
      speaker?: 'kavya' | 'aditya' | 'ritu' | 'shreya' | 'meera' | 'pavithra';
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
      speaker: options?.speaker || 'kavya',
      speech_sample_rate: options?.sampleRate || 16000,
      enable_preprocessing: true,
      model: 'bulbul:v3',
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

    const wavBuffer = ensureWavHeader(audioBuffer, 16000, 1, 16);
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(wavBuffer)], { type: 'audio/wav' });
    formData.append('file', blob, 'audio.wav');
    formData.append('language_code', languageCode);
    formData.append('model', 'saaras:v3');

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
