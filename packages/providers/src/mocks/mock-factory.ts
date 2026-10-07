import { MockLLMProvider } from './mock-llm.js';
import { MockSTTProvider } from './mock-stt.js';
import { MockTTSProvider } from './mock-tts.js';
import { MockTelephonyProvider } from './mock-telephony.js';
import { MockMessagingProvider } from './mock-messaging.js';
import { MockEmbeddingProvider } from './mock-embedding.js';
import { MockCalendarProvider } from './mock-calendar.js';
import { MockCRMProvider } from './mock-crm.js';
import { ProviderRegistry } from '../registry/provider-registry.js';

export interface AllMockProviders {
  llm: MockLLMProvider;
  stt: MockSTTProvider;
  tts: MockTTSProvider;
  telephony: MockTelephonyProvider;
  messaging: MockMessagingProvider;
  embeddings: MockEmbeddingProvider;
  calendar: MockCalendarProvider;
  crm: MockCRMProvider;
}

export class MockProviderFactory {
  static createAll(): AllMockProviders {
    return {
      llm: new MockLLMProvider(),
      stt: new MockSTTProvider(),
      tts: new MockTTSProvider(),
      telephony: new MockTelephonyProvider(),
      messaging: new MockMessagingProvider(),
      embeddings: new MockEmbeddingProvider(),
      calendar: new MockCalendarProvider(),
      crm: new MockCRMProvider(),
    };
  }

  static registerInto(registry: ProviderRegistry, mocks: AllMockProviders = MockProviderFactory.createAll()): void {
    registry.registerLLM(
      mocks.llm,
      {
        category: 'llm',
        providerName: mocks.llm.providerName,
        supportsStreaming: true,
        defaultTimeoutMs: 10000,
        maxRetries: 2,
        supportedLanguages: ['kn-IN', 'en-IN'],
        supportsKannada: true,
        supportsStructuredOutput: true,
        supportsToolCalling: true,
        supportsVision: false,
        contextWindowTokens: 8192,
        maxOutputTokens: 2048,
      },
      true
    );

    registry.registerSTT(
      mocks.stt,
      {
        category: 'stt',
        providerName: mocks.stt.providerName,
        supportsStreaming: false,
        defaultTimeoutMs: 10000,
        maxRetries: 2,
        supportedLanguages: ['kn-IN', 'en-IN'],
        supportsKannada: true,
        supportsEnglish: true,
        supportsCodeSwitching: true,
        supportsInterimResults: false,
        supportsWordTimestamps: true,
        supportsSpeakerDiarization: false,
        supportedEncodings: ['linear16', 'wav'],
      },
      true
    );

    registry.registerTTS(
      mocks.tts,
      {
        category: 'tts',
        providerName: mocks.tts.providerName,
        supportsStreaming: false,
        defaultTimeoutMs: 10000,
        maxRetries: 2,
        supportedLanguages: ['kn-IN', 'en-IN'],
        supportsKannada: true,
        supportsEnglish: true,
        supportsCodeSwitching: true,
        voices: [{ voiceId: 'mock-kannada-female', name: 'Roopa', gender: 'female', language: 'kn-IN' }],
        supportsPitchAdjustment: false,
        supportsSpeedAdjustment: true,
        supportedFormats: ['wav'],
      },
      true
    );

    registry.registerTelephony(
      mocks.telephony,
      {
        category: 'telephony',
        providerName: mocks.telephony.providerName,
        supportsStreaming: false,
        defaultTimeoutMs: 10000,
        maxRetries: 2,
        supportsCallRecording: true,
        supportsCallTransfer: true,
        supportsWebhooks: true,
        supportedCountries: ['IN'],
      },
      true
    );

    registry.registerMessaging(
      mocks.messaging,
      {
        category: 'messaging',
        providerName: mocks.messaging.providerName,
        supportsStreaming: false,
        defaultTimeoutMs: 10000,
        maxRetries: 2,
        channels: ['whatsapp', 'sms'],
        supportsTemplates: true,
        supportsMedia: true,
        supportsInteractiveButtons: true,
      },
      true
    );

    registry.registerEmbedding(
      mocks.embeddings,
      {
        category: 'embeddings',
        providerName: mocks.embeddings.providerName,
        supportsStreaming: false,
        defaultTimeoutMs: 10000,
        maxRetries: 2,
        dimension: 768,
        maxBatchSize: 100,
        maxInputTokens: 2048,
        supportsKannada: true,
      },
      true
    );

    registry.registerCalendar(
      mocks.calendar,
      {
        category: 'calendar',
        providerName: mocks.calendar.providerName,
        supportsStreaming: false,
        defaultTimeoutMs: 10000,
        maxRetries: 2,
        supportsTimezoneConversion: true,
        supportsConflictDetection: true,
        supportsReminders: true,
      },
      true
    );

    registry.registerCRM(
      mocks.crm,
      {
        category: 'crm',
        providerName: mocks.crm.providerName,
        supportsStreaming: false,
        defaultTimeoutMs: 10000,
        maxRetries: 2,
        supportsCustomFields: true,
        supportsWebhooks: true,
        supportsBulkSync: false,
      },
      true
    );
  }
}
