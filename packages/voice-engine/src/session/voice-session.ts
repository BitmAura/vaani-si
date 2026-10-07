import {
  VoiceSessionDTO,
  VoiceSessionState,
  VoiceConnectionState,
  VoiceChannelType,
  VoiceDirection,
  VoiceSessionMetrics,
} from './voice-session-types.js';
import { VoiceSessionStateMachine } from './voice-session-state-machine.js';

export interface VoiceSessionConfig {
  voiceSessionId: string;
  conversationId: string;
  organizationId: string;
  agentId: string;
  agentVersionId?: string;
  channel?: VoiceChannelType;
  direction?: VoiceDirection;
  language?: string;
  codec?: string;
  sampleRate?: number;
  correlationId?: string;
}

export class VoiceSession {
  public readonly voiceSessionId: string;
  public readonly conversationId: string;
  public readonly organizationId: string;
  public readonly agentId: string;
  public readonly agentVersionId?: string;
  public readonly channel: VoiceChannelType;
  public readonly direction: VoiceDirection;
  public language: string;
  public codec: string;
  public sampleRate: number;
  public readonly correlationId?: string;

  public readonly stateMachine: VoiceSessionStateMachine;
  public connectionState: VoiceConnectionState = 'DISCONNECTED';
  public readonly createdAt: string;
  public connectedAt?: string;
  public endedAt?: string;
  public lastActivityAt: string;
  public failureReason?: string;

  public metrics: VoiceSessionMetrics = {
    totalTurns: 0,
    interruptionCount: 0,
    reconnectCount: 0,
    totalAudioDurationMs: 0,
    avgTurnLatencyMs: 0,
    lastTurnLatencyMs: 0,
    p95TurnLatencyMs: 0,
  };

  private latencies: number[] = [];

  constructor(config: VoiceSessionConfig) {
    this.voiceSessionId = config.voiceSessionId;
    this.conversationId = config.conversationId;
    this.organizationId = config.organizationId;
    this.agentId = config.agentId;
    this.agentVersionId = config.agentVersionId;
    this.channel = config.channel || 'BROWSER';
    this.direction = config.direction || 'INBOUND';
    this.language = config.language || 'kn-IN';
    this.codec = config.codec || 'pcm16';
    this.sampleRate = config.sampleRate || 16000;
    this.correlationId = config.correlationId;

    this.stateMachine = new VoiceSessionStateMachine('CREATED');
    const now = new Date().toISOString();
    this.createdAt = now;
    this.lastActivityAt = now;
  }

  touch(): void {
    this.lastActivityAt = new Date().toISOString();
  }

  connect(): void {
    this.connectionState = 'CONNECTED';
    this.connectedAt = new Date().toISOString();
    this.stateMachine.transition('CONNECTED');
    this.touch();
  }

  recordTurn(latencyMs: number, audioDurationMs: number): void {
    this.metrics.totalTurns++;
    this.metrics.lastTurnLatencyMs = latencyMs;
    this.metrics.totalAudioDurationMs += audioDurationMs;
    this.latencies.push(latencyMs);

    const sum = this.latencies.reduce((a, b) => a + b, 0);
    this.metrics.avgTurnLatencyMs = Math.round(sum / this.latencies.length);

    const sorted = [...this.latencies].sort((a, b) => a - b);
    const p95Idx = Math.floor(sorted.length * 0.95);
    this.metrics.p95TurnLatencyMs = sorted[p95Idx] ?? sorted[sorted.length - 1];
    this.touch();
  }

  recordInterruption(): void {
    this.metrics.interruptionCount++;
    this.stateMachine.transition('INTERRUPTED');
    this.touch();
  }

  recordReconnect(): void {
    this.metrics.reconnectCount++;
    this.connectionState = 'RECONNECTING';
    this.stateMachine.transition('RECONNECTING');
    this.touch();
  }

  fail(reason: string): void {
    this.failureReason = reason;
    this.stateMachine.forceState('FAILED');
    this.touch();
  }

  close(): void {
    this.connectionState = 'DISCONNECTED';
    this.endedAt = new Date().toISOString();
    this.stateMachine.transition('ENDED');
    this.touch();
  }

  toDTO(): VoiceSessionDTO {
    return {
      voiceSessionId: this.voiceSessionId,
      conversationId: this.conversationId,
      organizationId: this.organizationId,
      agentId: this.agentId,
      agentVersionId: this.agentVersionId,
      channel: this.channel,
      direction: this.direction,
      language: this.language,
      codec: this.codec,
      sampleRate: this.sampleRate,
      sessionState: this.stateMachine.getState(),
      connectionState: this.connectionState,
      createdAt: this.createdAt,
      connectedAt: this.connectedAt,
      endedAt: this.endedAt,
      lastActivityAt: this.lastActivityAt,
      failureReason: this.failureReason,
      correlationId: this.correlationId,
    };
  }
}
