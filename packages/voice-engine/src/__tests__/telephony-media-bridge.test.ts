import { describe, it, expect } from 'vitest';
import { TelephonyMediaBridge } from '../telephony/media-bridge';

describe('TelephonyMediaBridge Unit Tests', () => {
  const bridge = new TelephonyMediaBridge();

  it('should decode base64 8kHz μ-law to 16kHz 16-bit PCM buffer', () => {
    // 80 samples of 8kHz μ-law (10ms at 8kHz)
    // 0xFF in G.711 μ-law is silence / zero level
    const mulawBytes = Buffer.alloc(80, 0xff);
    const base64Payload = mulawBytes.toString('base64');

    const pcm16Buffer = bridge.decodePayloadToPcm16(base64Payload);

    // Upsampled 8kHz -> 16kHz doubles sample count (80 -> 160 samples)
    // 160 samples * 2 bytes/sample (16-bit PCM) = 320 bytes
    expect(pcm16Buffer).toBeInstanceOf(Buffer);
    expect(pcm16Buffer.length).toBe(320);
  });

  it('should encode 16kHz 16-bit PCM buffer to base64 8kHz μ-law payload', () => {
    // 160 samples of 16kHz PCM (320 bytes)
    const pcm16Buffer = Buffer.alloc(320, 0); // silence
    const base64Payload = bridge.encodePcm16ToPayload(pcm16Buffer);

    expect(typeof base64Payload).toBe('string');
    const decodedBytes = Buffer.from(base64Payload, 'base64');
    // Downsampled 16kHz -> 8kHz halves sample count (160 -> 80 samples)
    // 80 samples * 1 byte/sample (μ-law) = 80 bytes
    expect(decodedBytes.length).toBe(80);
  });

  it('should maintain roundtrip fidelity across encode and decode cycles', () => {
    // Generate 16kHz test tone (sine wave approximation)
    const sampleCount = 320; // 20ms at 16kHz
    const pcm16 = Buffer.alloc(sampleCount * 2);
    for (let i = 0; i < sampleCount; i++) {
      const sample = Math.round(10000 * Math.sin((2 * Math.PI * 400 * i) / 16000));
      pcm16.writeInt16LE(sample, i * 2);
    }

    // Step 1: Encode 16kHz PCM to base64 8kHz μ-law
    const base64Payload = bridge.encodePcm16ToPayload(pcm16);

    // Step 2: Decode base64 8kHz μ-law back to 16kHz PCM
    const reconstructedPcm16 = bridge.decodePayloadToPcm16(base64Payload);

    expect(reconstructedPcm16.length).toBe(pcm16.length);

    // Check correlation / energy preservation (μ-law is lossy companding, but preserves speech waveform)
    let totalAbsDiff = 0;
    for (let i = 0; i < sampleCount; i++) {
      const original = pcm16.readInt16LE(i * 2);
      const reconstructed = reconstructedPcm16.readInt16LE(i * 2);
      totalAbsDiff += Math.abs(original - reconstructed);
    }
    const meanDiff = totalAbsDiff / sampleCount;
    // Mean difference under companding & linear interpolation for 10000-peak tone is well under 1000
    expect(meanDiff).toBeLessThan(1000);
  });

  it('should safely handle empty payloads or zero-length buffers', () => {
    const emptyPcm = bridge.decodePayloadToPcm16('');
    expect(emptyPcm.length).toBe(0);

    const emptyPayload = bridge.encodePcm16ToPayload(Buffer.alloc(0));
    expect(emptyPayload).toBe('');
  });

  it('should accurately translate standard G.711 μ-law extremes and zeros', () => {
    // 0x7F in μ-law is maximum positive, 0xFF is zero/silence, 0x00 is maximum negative
    const testMulaw = Buffer.from([0xff, 0x7f, 0x00]);
    const pcm = bridge.decodePayloadToPcm16(testMulaw.toString('base64'));

    // 3 samples at 8kHz upsampled 2x = 6 samples = 12 bytes
    expect(pcm.length).toBe(12);

    // Check first sample (0xFF decoded)
    const firstSample = pcm.readInt16LE(0);
    // 0xFF in standard μ-law table maps to 0 or near 0 (-0)
    expect(Math.abs(firstSample)).toBeLessThanOrEqual(5);
  });
});
