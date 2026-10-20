import { ISTTProvider, STTOptions, SpeechTranscript } from '@vanni/provider-sdk';

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
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);

  // 'fmt ' subchunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // 1 = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  // 'data' subchunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

/**
 * Sarvam Saaras v3 Regional Kannada & Indian STT Provider
 * Real Live Speech-to-Text Transcription (No Mocks)
 */
export class SarvamSaarasSTTProvider implements ISTTProvider {
  public readonly providerName = 'sarvam_saaras_v3';
  private apiKey: string;
  private baseUrl = 'https://api.sarvam.ai';

  constructor(apiKey?: string) {
    this.apiKey = apiKey !== undefined ? apiKey : (process.env.SARVAM_API_KEY || '');
  }

  public ensureWavHeader(
    pcmBuffer: Buffer,
    sampleRate = 16000,
    channels = 1,
    bitsPerSample = 16
  ): Buffer {
    return ensureWavHeader(pcmBuffer, sampleRate, channels, bitsPerSample);
  }

  public async transcribe(audioBuffer: Buffer, options?: STTOptions): Promise<SpeechTranscript> {
    if (!this.apiKey) {
      throw new Error('[SarvamSaarasSTT] Missing SARVAM_API_KEY in environment');
    }

    const sampleRate = options?.sampleRate || 16000;
    const wavBuffer = ensureWavHeader(audioBuffer, sampleRate, 1, 16);
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(wavBuffer)], { type: 'audio/wav' });
    formData.append('file', blob, 'audio.wav');
    formData.append('language_code', options?.languageCode || 'kn-IN');
    formData.append('model', 'saaras:v3');

    const controller = new AbortController();
    const timeoutMs = 8000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/speech-to-text`, {
        method: 'POST',
        headers: {
          'api-subscription-key': this.apiKey,
        },
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`[SarvamSaaras v3 STT Error] HTTP ${response.status}: ${err}`);
      }

      const data = await response.json() as any;
      const text = typeof data?.transcript === 'string' ? data.transcript.trim() : '';

      return {
        text,
        languageCode: data?.language_code || options?.languageCode || 'kn-IN',
        confidence: typeof data?.confidence === 'number' ? data.confidence : 0.95,
        isFinal: true,
        durationMs: 1500,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`[SarvamSaaras v3 STT Error] Request timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
