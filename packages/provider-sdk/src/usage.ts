export interface BaseUsageEvent {
  orgId: string;
  conversationId?: string;
  providerName: string;
  category: 'llm' | 'stt' | 'tts' | 'telephony' | 'messaging' | 'embeddings';
  timestamp: string; // ISO string
  latencyMs: number;
}

export interface LLMUsageEvent extends BaseUsageEvent {
  category: 'llm';
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd?: number;
}

export interface STTUsageEvent extends BaseUsageEvent {
  category: 'stt';
  model?: string;
  audioDurationSeconds: number;
  language?: string;
  estimatedCostUsd?: number;
}

export interface TTSUsageEvent extends BaseUsageEvent {
  category: 'tts';
  voiceId?: string;
  characterCount: number;
  audioDurationSeconds?: number;
  language?: string;
  estimatedCostUsd?: number;
}

export interface TelephonyUsageEvent extends BaseUsageEvent {
  category: 'telephony';
  callId: string;
  callDurationSeconds: number;
  callType: 'inbound' | 'outbound';
  status: string;
  estimatedCostInr?: number;
}

export interface MessagingUsageEvent extends BaseUsageEvent {
  category: 'messaging';
  channel: 'whatsapp' | 'sms' | 'rcs';
  messageId: string;
  status: 'sent' | 'delivered' | 'failed';
  estimatedCostInr?: number;
}

export interface EmbeddingUsageEvent extends BaseUsageEvent {
  category: 'embeddings';
  model: string;
  tokenCount: number;
  vectorDimensions: number;
  batchSize: number;
  estimatedCostUsd?: number;
}

export type ProviderUsageEvent =
  | LLMUsageEvent
  | STTUsageEvent
  | TTSUsageEvent
  | TelephonyUsageEvent
  | MessagingUsageEvent
  | EmbeddingUsageEvent;
