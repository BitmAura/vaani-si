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
