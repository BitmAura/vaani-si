import { AudioFrame, TELEPHONY_AUDIO_FORMAT, NORMALIZED_AUDIO_FORMAT } from '../audio/audio-frame.js';

export interface TelephonyMediaPacket {
  event: 'media' | 'start' | 'stop' | 'mark';
  streamSid?: string;
  sequenceNumber?: number;
  media?: {
    payload: string; // Base64 encoded audio (usually 8kHz μ-law)
    timestamp?: string;
    chunk?: string;
  };
}

/**
 * Bridges Telephony Provider Media Streaming packets (e.g. Exotel / Twilio Media Streams)
 * with the VANNI Normalized Audio Pipeline.
 */
export class TelephonyMediaBridge {
  private streamSid = '';
  private sequenceCounter = 0;

  /**
   * Converts incoming Telephony JSON media packet into normalized AudioFrame
   */
  inboundPacketToAudioFrame(packet: TelephonyMediaPacket): AudioFrame | null {
    if (packet.event !== 'media' || !packet.media?.payload) {
      return null;
    }

    this.sequenceCounter++;
    const mulawBuffer = Buffer.from(packet.media.payload, 'base64');

    return {
      sequenceNumber: packet.sequenceNumber ?? this.sequenceCounter,
      timestamp: Date.now(),
      format: TELEPHONY_AUDIO_FORMAT, // 8kHz mulaw
      payload: mulawBuffer,
    };
  }

  /**
   * Decodes an 8kHz G.711 μ-law buffer and upsamples to 16kHz PCM16 (LINEAR16)
   */
  public decodeMulaw8kToPcm16k(mulawBuffer: Buffer): Buffer {
    const numSamples8k = mulawBuffer.length;
    const pcm8k = Buffer.alloc(numSamples8k * 2);

    for (let i = 0; i < numSamples8k; i++) {
      let u = ~mulawBuffer[i] & 0xff;
      let t = ((u & 0x0f) << 3) + 0x84;
      t <<= (u & 0x70) >> 4;
      let sample = (u & 0x80) !== 0 ? 0x84 - t : t - 0x84;
      pcm8k.writeInt16LE(sample, i * 2);
    }

    // Upsample 8kHz -> 16kHz linear interpolation
    const numSamples16k = numSamples8k * 2;
    const pcm16k = Buffer.alloc(numSamples16k * 2);

    for (let i = 0; i < numSamples8k - 1; i++) {
      const s0 = pcm8k.readInt16LE(i * 2);
      const s1 = pcm8k.readInt16LE((i + 1) * 2);
      const interpolated = Math.round((s0 + s1) / 2);

      pcm16k.writeInt16LE(s0, i * 4);
      pcm16k.writeInt16LE(interpolated, i * 4 + 2);
    }

    if (numSamples8k > 0) {
      const last = pcm8k.readInt16LE((numSamples8k - 1) * 2);
      pcm16k.writeInt16LE(last, (numSamples8k - 1) * 4);
      pcm16k.writeInt16LE(last, (numSamples8k - 1) * 4 + 2);
    }

    return pcm16k;
  }

  /**
   * Decodes 8kHz base64 μ-law payload into 16kHz PCM16 (LINEAR16)
   */
  public decodePayloadToPcm16(base64Payload: string): Buffer {
    const mulawBuffer = Buffer.from(base64Payload, 'base64');
    return this.decodeMulaw8kToPcm16k(mulawBuffer);
  }

  /**
   * Encodes 16kHz PCM16 into base64 8kHz μ-law payload
   */
  public encodePcm16ToPayload(pcm16: Buffer): string {
    if (!pcm16 || pcm16.length === 0) return '';
    const mulawBuffer = this.downsampleAndEncodeMulaw(pcm16);
    return mulawBuffer.toString('base64');
  }

  /**
   * Converts synthesized PCM16 AudioFrame back to G.711 μ-law Telephony Media packet
   */
  audioFrameToOutboundPacket(pcm16Payload: Buffer, streamSid = this.streamSid): TelephonyMediaPacket {
    // Encode 16kHz PCM down to 8kHz μ-law for PSTN transmission
    const mulawBuffer = this.downsampleAndEncodeMulaw(pcm16Payload);

    return {
      event: 'media',
      streamSid,
      media: {
        payload: mulawBuffer.toString('base64'),
        timestamp: Date.now().toString(),
      },
    };
  }

  /**
   * Downsamples 16kHz PCM16 to 8kHz and encodes to G.711 μ-law
   */
  private downsampleAndEncodeMulaw(pcm16: Buffer): Buffer {
    const numSamples16k = Math.floor(pcm16.length / 2);
    const numSamples8k = Math.floor(numSamples16k / 2);
    const mulawBuf = Buffer.alloc(numSamples8k);

    for (let i = 0; i < numSamples8k; i++) {
      // Pick every 2nd sample for simple downsampling
      const sample = pcm16.readInt16LE(i * 4);
      mulawBuf[i] = this.linear16ToMulaw(sample);
    }

    return mulawBuf;
  }

  /**
   * Converts a 16-bit linear PCM sample (-32768 to 32767) to an 8-bit ITU-T G.711 μ-law byte
   */
  private linear16ToMulaw(sample: number): number {
    const BIAS = 0x84;
    const CLIP = 32635;

    let sign = (sample >> 8) & 0x80;
    if (sign !== 0) sample = -sample;
    if (sample > CLIP) sample = CLIP;
    sample += BIAS;

    let exponent = 7;
    for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; expMask >>= 1) {
      exponent--;
    }

    let mantissa = (sample >> (exponent + 3)) & 0x0f;
    let mulawByte = ~(sign | (exponent << 4) | mantissa);
    return mulawByte & 0xff;
  }
}
