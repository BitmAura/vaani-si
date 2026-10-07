import { AudioFrame } from './audio-frame.js';

export interface JitterBufferConfig {
  maxQueueSize?: number; // Maximum frames stored before forced drop
  targetBufferMs?: number; // Pre-buffering latency target (e.g. 60ms)
}

export class JitterBuffer {
  private buffer: Map<number, AudioFrame> = new Map();
  private expectedSequence = 0;
  private maxQueueSize: number;

  constructor(config: JitterBufferConfig = {}) {
    this.maxQueueSize = config.maxQueueSize || 50; // 50 frames ~ 1000ms
  }

  /**
   * Push an audio frame into the jitter buffer
   */
  push(frame: AudioFrame): void {
    // Drop outdated frames
    if (frame.sequenceNumber < this.expectedSequence) {
      return;
    }

    // Backpressure guard: Drop oldest frames if buffer limit reached
    if (this.buffer.size >= this.maxQueueSize) {
      const minKey = Math.min(...Array.from(this.buffer.keys()));
      this.buffer.delete(minKey);
      this.expectedSequence = minKey + 1;
    }

    this.buffer.set(frame.sequenceNumber, frame);
  }

  /**
   * Drain continuous in-order frames
   */
  drain(): AudioFrame[] {
    const ready: AudioFrame[] = [];

    while (this.buffer.has(this.expectedSequence)) {
      const frame = this.buffer.get(this.expectedSequence)!;
      this.buffer.delete(this.expectedSequence);
      ready.push(frame);
      this.expectedSequence++;
    }

    return ready;
  }

  get size(): number {
    return this.buffer.size;
  }

  reset(): void {
    this.buffer.clear();
    this.expectedSequence = 0;
  }
}
