import { VADEvent } from './energy-vad.js';

export interface TurnDetectionConfig {
  minimumSilenceDurationMs?: number; // Silence duration before declaring turn end (e.g. 500ms)
  minimumSpeechDurationMs?: number;  // Minimum speech duration to qualify as a valid utterance (e.g. 250ms)
  maxTurnDurationMs?: number;        // Force commit turn after e.g. 15s to prevent runaway buffering
  bargeInEnergyThreshold?: number;   // Energy threshold for barge-in while system is speaking
}

export type TurnStatus = 'IN_PROGRESS' | 'TURN_COMPLETED' | 'TURN_DISCARDED_NOISE' | 'FORCE_COMPLETED';

export class TurnDetector {
  private config: Required<TurnDetectionConfig>;
  private speechStartTime: number | null = null;
  private lastSpeechTime: number | null = null;
  private isTurnActive = false;

  constructor(config: TurnDetectionConfig = {}) {
    this.config = {
      minimumSilenceDurationMs: config.minimumSilenceDurationMs || 500,
      minimumSpeechDurationMs: config.minimumSpeechDurationMs || 200,
      maxTurnDurationMs: config.maxTurnDurationMs || 15000,
      bargeInEnergyThreshold: config.bargeInEnergyThreshold || 0.04,
    };
  }

  processVADEvent(event: VADEvent): TurnStatus {
    const now = event.timestamp || Date.now();

    if (event.type === 'SPEECH_START') {
      if (!this.isTurnActive) {
        this.speechStartTime = now;
        this.isTurnActive = true;
      }
      this.lastSpeechTime = now;
      return 'IN_PROGRESS';
    }

    if (event.type === 'SPEECH_CONTINUE') {
      this.lastSpeechTime = now;
      if (!this.speechStartTime) this.speechStartTime = now;

      // Check max duration overflow
      if (now - this.speechStartTime >= this.config.maxTurnDurationMs) {
        this.reset();
        return 'FORCE_COMPLETED';
      }
      return 'IN_PROGRESS';
    }

    if (event.type === 'SPEECH_END' || event.type === 'SILENCE') {
      if (this.isTurnActive && this.lastSpeechTime) {
        const silenceDuration = now - this.lastSpeechTime;
        if (silenceDuration >= this.config.minimumSilenceDurationMs) {
          const totalSpeechDuration = this.lastSpeechTime - (this.speechStartTime || now);
          this.reset();

          if (totalSpeechDuration < this.config.minimumSpeechDurationMs) {
            return 'TURN_DISCARDED_NOISE';
          }
          return 'TURN_COMPLETED';
        }
      }
    }

    return 'IN_PROGRESS';
  }

  isBargeIn(event: VADEvent): boolean {
    return (
      (event.type === 'SPEECH_START' || event.type === 'SPEECH_CONTINUE') &&
      event.rmsEnergy >= this.config.bargeInEnergyThreshold
    );
  }

  reset(): void {
    this.speechStartTime = null;
    this.lastSpeechTime = null;
    this.isTurnActive = false;
  }
}
