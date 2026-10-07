import { AudioFrame } from '../audio/audio-frame.js';

export interface VADConfig {
  energyThreshold?: number; // RMS amplitude threshold (0.0 to 1.0)
  speechStartFrames?: number; // Consecutive speech frames to trigger speech start
  speechEndFrames?: number; // Consecutive silence frames to trigger speech end
  minSpeechDurationMs?: number;
}

export interface VADEvent {
  type: 'SPEECH_START' | 'SPEECH_CONTINUE' | 'SPEECH_END' | 'SILENCE';
  timestamp: number;
  rmsEnergy: number;
}

export interface IVoiceActivityDetector {
  processFrame(frame: AudioFrame): VADEvent;
  isSpeaking(): boolean;
  reset(): void;
}

/**
 * High-performance, zero-external-dependency RMS Energy VAD for normalized PCM16 audio.
 */
export class EnergyVAD implements IVoiceActivityDetector {
  private energyThreshold: number;
  private speechStartFrames: number;
  private speechEndFrames: number;

  private consecutiveSpeech = 0;
  private consecutiveSilence = 0;
  private currentlySpeaking = false;

  constructor(config: VADConfig = {}) {
    this.energyThreshold = config.energyThreshold || 0.025; // 2.5% RMS threshold
    this.speechStartFrames = config.speechStartFrames || 2; // 2 frames * 20ms = 40ms to trigger speech start
    this.speechEndFrames = config.speechEndFrames || 15; // 15 frames * 20ms = 300ms silence to trigger speech end
  }

  processFrame(frame: AudioFrame): VADEvent {
    const rms = this.calculateRms(frame.payload);
    const isSpeechFrame = rms >= this.energyThreshold;

    if (isSpeechFrame) {
      this.consecutiveSpeech++;
      this.consecutiveSilence = 0;

      if (!this.currentlySpeaking && this.consecutiveSpeech >= this.speechStartFrames) {
        this.currentlySpeaking = true;
        return { type: 'SPEECH_START', timestamp: frame.timestamp, rmsEnergy: rms };
      }

      if (this.currentlySpeaking) {
        return { type: 'SPEECH_CONTINUE', timestamp: frame.timestamp, rmsEnergy: rms };
      }
    } else {
      this.consecutiveSilence++;
      this.consecutiveSpeech = 0;

      if (this.currentlySpeaking && this.consecutiveSilence >= this.speechEndFrames) {
        this.currentlySpeaking = false;
        return { type: 'SPEECH_END', timestamp: frame.timestamp, rmsEnergy: rms };
      }
    }

    return {
      type: this.currentlySpeaking ? 'SPEECH_CONTINUE' : 'SILENCE',
      timestamp: frame.timestamp,
      rmsEnergy: rms,
    };
  }

  /**
   * Computes normalized Root-Mean-Square (RMS) amplitude of 16-bit PCM buffer
   */
  private calculateRms(buffer: Buffer): number {
    const numSamples = Math.floor(buffer.length / 2);
    if (numSamples === 0) return 0;

    let sumSquares = 0;
    for (let i = 0; i < numSamples; i++) {
      const sample = buffer.readInt16LE(i * 2) / 32768.0; // Normalize to -1.0 .. 1.0
      sumSquares += sample * sample;
    }

    return Math.sqrt(sumSquares / numSamples);
  }

  isSpeaking(): boolean {
    return this.currentlySpeaking;
  }

  reset(): void {
    this.consecutiveSpeech = 0;
    this.consecutiveSilence = 0;
    this.currentlySpeaking = false;
  }
}
