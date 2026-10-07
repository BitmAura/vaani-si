export type VoiceEventType =
  | 'SESSION_START'
  | 'SESSION_STARTED'
  | 'AUDIO_FRAME'
  | 'SPEECH_STARTED'
  | 'SPEECH_STOPPED'
  | 'TRANSCRIPT_PARTIAL'
  | 'TRANSCRIPT_FINAL'
  | 'TURN_STARTED'
  | 'TURN_COMPLETED'
  | 'AI_RESPONSE_STARTED'
  | 'AI_TEXT_DELTA'
  | 'AI_AUDIO_CHUNK'
  | 'AI_AUDIO_ENDED'
  | 'INTERRUPTION'
  | 'SESSION_END'
  | 'ERROR'
  | 'HEARTBEAT';

/**
 * Standardized, versioned Voice Event Envelope
 */
export interface VoiceEventEnvelope<T = unknown> {
  eventType: VoiceEventType;
  eventVersion: '1.0';
  sessionId: string;
  correlationId?: string;
  timestamp: number;
  sequenceNumber: number;
  payload: T;
}

export function createVoiceEvent<T>(
  eventType: VoiceEventType,
  sessionId: string,
  payload: T,
  sequenceNumber: number,
  correlationId?: string
): VoiceEventEnvelope<T> {
  return {
    eventType,
    eventVersion: '1.0',
    sessionId,
    correlationId,
    timestamp: Date.now(),
    sequenceNumber,
    payload,
  };
}
