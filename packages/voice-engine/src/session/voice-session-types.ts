export type VoiceSessionState =
  | 'CREATED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'LISTENING'
  | 'PROCESSING'
  | 'SPEAKING'
  | 'INTERRUPTED'
  | 'RECONNECTING'
  | 'ENDING'
  | 'ENDED'
  | 'FAILED';

export type VoiceConnectionState = 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';

export type VoiceChannelType = 'BROWSER' | 'TELEPHONY' | 'WEBRTC' | 'OTHER';

export type VoiceDirection = 'INBOUND' | 'OUTBOUND';

export interface VoiceSessionDTO {
  voiceSessionId: string;
  conversationId: string;
  organizationId: string;
  agentId: string;
  agentVersionId?: string;
  channel: VoiceChannelType;
  participantPhone?: string;
  direction: VoiceDirection;
  language: string;
  codec: string;
  sampleRate: number;
  sessionState: VoiceSessionState;
  connectionState: VoiceConnectionState;
  createdAt: string;
  connectedAt?: string;
  endedAt?: string;
  lastActivityAt: string;
  failureReason?: string;
  correlationId?: string;
}

export interface VoiceSessionMetrics {
  totalTurns: number;
  interruptionCount: number;
  reconnectCount: number;
  totalAudioDurationMs: number;
  avgTurnLatencyMs: number;
  lastTurnLatencyMs: number;
  p95TurnLatencyMs: number;
}
