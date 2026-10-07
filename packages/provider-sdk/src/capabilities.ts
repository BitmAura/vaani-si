export interface BaseProviderCapabilities {
  providerName: string;
  version?: string;
  supportsStreaming: boolean;
  defaultTimeoutMs: number;
  maxRetries: number;
}

export interface STTCapabilities extends BaseProviderCapabilities {
  category: 'stt';
  supportedLanguages: string[]; // e.g. ['kn-IN', 'en-IN', 'hi-IN']
  supportsKannada: boolean;
  supportsEnglish: boolean;
  supportsCodeSwitching: boolean; // Kannada + English Kanglish mixing
  supportsInterimResults: boolean;
  supportsWordTimestamps: boolean;
  supportsSpeakerDiarization: boolean;
  supportedEncodings: ('linear16' | 'opus' | 'mulaw' | 'alaw' | 'mp3' | 'wav')[];
}

export interface TTSVoiceMetadata {
  voiceId: string;
  name: string;
  gender: 'female' | 'male' | 'neutral';
  language: string;
  accent?: string;
  isCustomTrained?: boolean;
}

export interface TTSCapabilities extends BaseProviderCapabilities {
  category: 'tts';
  supportedLanguages: string[];
  supportsKannada: boolean;
  supportsEnglish: boolean;
  supportsCodeSwitching: boolean;
  voices: TTSVoiceMetadata[];
  supportsPitchAdjustment: boolean;
  supportsSpeedAdjustment: boolean;
  supportedFormats: ('wav' | 'mp3' | 'opus' | 'pcm16')[];
}

export interface LLMCapabilities extends BaseProviderCapabilities {
  category: 'llm';
  supportedLanguages: string[];
  supportsKannada: boolean;
  supportsStructuredOutput: boolean;
  supportsToolCalling: boolean;
  supportsVision: boolean;
  contextWindowTokens: number;
  maxOutputTokens: number;
  costPer1kInputTokensUsd?: number;
  costPer1kOutputTokensUsd?: number;
}

export interface TelephonyCapabilities extends BaseProviderCapabilities {
  category: 'telephony';
  supportsCallRecording: boolean;
  supportsCallTransfer: boolean;
  supportsWebhooks: boolean;
  supportedCountries: string[];
}

export interface MessagingCapabilities extends BaseProviderCapabilities {
  category: 'messaging';
  channels: ('whatsapp' | 'sms' | 'rcs')[];
  supportsTemplates: boolean;
  supportsMedia: boolean;
  supportsInteractiveButtons: boolean;
}

export interface EmbeddingCapabilities extends BaseProviderCapabilities {
  category: 'embeddings';
  dimension: number;
  maxBatchSize: number;
  maxInputTokens: number;
  supportsKannada: boolean;
}

export interface CalendarCapabilities extends BaseProviderCapabilities {
  category: 'calendar';
  supportsTimezoneConversion: boolean;
  supportsConflictDetection: boolean;
  supportsReminders: boolean;
}

export interface CRMCapabilities extends BaseProviderCapabilities {
  category: 'crm';
  supportsCustomFields: boolean;
  supportsWebhooks: boolean;
  supportsBulkSync: boolean;
}

export type AnyProviderCapabilities =
  | STTCapabilities
  | TTSCapabilities
  | LLMCapabilities
  | TelephonyCapabilities
  | MessagingCapabilities
  | EmbeddingCapabilities
  | CalendarCapabilities
  | CRMCapabilities;
