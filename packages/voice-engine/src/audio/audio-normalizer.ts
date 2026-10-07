import { AudioEncoding, AudioFormat, AudioFrame, NORMALIZED_AUDIO_FORMAT } from './audio-frame.js';

// Pre-computed ITU-T G.711 μ-law decoding lookup table (μ-law byte -> 16-bit PCM signed integer)
const ULAW_TO_PCM16_TABLE = new Int16Array(256);
for (let i = 0; i < 256; i++) {
  let u = ~i & 0xff;
  let t = ((u & 0x0f) << 3) + 0x84;
  t <<= (u & 0x70) >> 4;
  let sample = (u & 0x80) !== 0 ? 0x84 - t : t - 0x84;
  ULAW_TO_PCM16_TABLE[i] = sample;
}

export interface NormalizerMetrics {
  totalFramesReceived: number;
  droppedFrames: number;
  resampledFrames: number;
  malformedFrames: number;
}

export class AudioNormalizer {
  private lastSequenceNumber = -1;
  private metrics: NormalizerMetrics = {
    totalFramesReceived: 0,
    droppedFrames: 0,
    resampledFrames: 0,
    malformedFrames: 0,
  };

  /**
   * Normalizes an incoming audio frame from any supported external codec/rate
   * into standard 16kHz, 16-bit Mono PCM.
   */
  normalizeFrame(frame: AudioFrame): AudioFrame | null {
    this.metrics.totalFramesReceived++;

    // Validate payload
    if (!frame.payload || frame.payload.length === 0) {
      this.metrics.malformedFrames++;
      return null;
    }

    // Sequence continuity validation
    if (this.lastSequenceNumber >= 0) {
      const expected = this.lastSequenceNumber + 1;
      if (frame.sequenceNumber > expected) {
        this.metrics.droppedFrames += (frame.sequenceNumber - expected);
      }
    }
    this.lastSequenceNumber = frame.sequenceNumber;

    let pcm16Buffer: Buffer;

    // 1. Convert μ-law to PCM16 if needed
    if (frame.format.encoding === 'mulaw') {
      pcm16Buffer = this.mulawToPcm16(frame.payload);
    } else if (frame.format.encoding === 'pcm16') {
      pcm16Buffer = frame.payload;
    } else if (frame.format.encoding === 'wav') {
      // Strip 44-byte standard RIFF header if present
      pcm16Buffer = this.stripWavHeader(frame.payload);
    } else {
      // Pass-through for other codecs
      pcm16Buffer = frame.payload;
    }

    // 2. Resample if 8kHz (Telephony) -> 16kHz (Standard)
    if (frame.format.sampleRate === 8000) {
      pcm16Buffer = this.resample8kTo16k(pcm16Buffer);
      this.metrics.resampledFrames++;
    }

    return {
      sequenceNumber: frame.sequenceNumber,
      timestamp: frame.timestamp,
      format: NORMALIZED_AUDIO_FORMAT,
      payload: pcm16Buffer,
      isSilence: frame.isSilence,
    };
  }

  /**
   * Decodes G.711 μ-law bytes into 16-bit signed linear PCM bytes (Little Endian)
   */
  private mulawToPcm16(mulawBuffer: Buffer): Buffer {
    const outBuffer = Buffer.alloc(mulawBuffer.length * 2);
    for (let i = 0; i < mulawBuffer.length; i++) {
      const sample = ULAW_TO_PCM16_TABLE[mulawBuffer[i]];
      outBuffer.writeInt16LE(sample, i * 2);
    }
    return outBuffer;
  }

  /**
   * Resamples 8kHz 16-bit Mono PCM to 16kHz by linear interpolation
   */
  private resample8kTo16k(pcm8k: Buffer): Buffer {
    const numSamples8k = Math.floor(pcm8k.length / 2);
    const numSamples16k = numSamples8k * 2;
    const pcm16k = Buffer.alloc(numSamples16k * 2);

    for (let i = 0; i < numSamples8k - 1; i++) {
      const s0 = pcm8k.readInt16LE(i * 2);
      const s1 = pcm8k.readInt16LE((i + 1) * 2);
      const interpolated = Math.round((s0 + s1) / 2);

      pcm16k.writeInt16LE(s0, i * 4);
      pcm16k.writeInt16LE(interpolated, i * 4 + 2);
    }

    // Handle last sample
    if (numSamples8k > 0) {
      const last = pcm8k.readInt16LE((numSamples8k - 1) * 2);
      pcm16k.writeInt16LE(last, (numSamples8k - 1) * 4);
      pcm16k.writeInt16LE(last, (numSamples8k - 1) * 4 + 2);
    }

    return pcm16k;
  }

  private stripWavHeader(buffer: Buffer): Buffer {
    // Standard WAV RIFF header has 'RIFF' at 0 and 'data' chunk at 36 or 40
    if (buffer.length > 44 && buffer.toString('ascii', 0, 4) === 'RIFF') {
      const dataIndex = buffer.indexOf('data');
      if (dataIndex !== -1 && dataIndex + 8 <= buffer.length) {
        return buffer.subarray(dataIndex + 8);
      }
      return buffer.subarray(44);
    }
    return buffer;
  }

  getMetrics(): NormalizerMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.lastSequenceNumber = -1;
    this.metrics = {
      totalFramesReceived: 0,
      droppedFrames: 0,
      resampledFrames: 0,
      malformedFrames: 0,
    };
  }
}
