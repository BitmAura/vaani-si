/**
 * @vanni/voice-gateway — Voice Activity Detection & Interruption Arbiter
 */

export class VadArbiter {
  private energyThreshold = 350; // RMS energy threshold

  detectBargeIn(pcmChunk: Buffer): boolean {
    if (pcmChunk.length === 0) return false;
    
    let sumSquares = 0;
    const sampleCount = Math.floor(pcmChunk.length / 2);
    
    for (let i = 0; i < pcmChunk.length - 1; i += 2) {
      const sample = pcmChunk.readInt16LE(i);
      sumSquares += sample * sample;
    }
    
    const rms = Math.sqrt(sumSquares / sampleCount);
    return rms > this.energyThreshold;
  }
}
