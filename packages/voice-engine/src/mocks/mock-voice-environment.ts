import {
  MockSTTProvider,
  MockTTSProvider,
  MockLLMProvider,
  MockProviderFactory,
  ProviderRegistry,
} from '@vanni/providers';

export interface MockVoiceEnvironmentConfig {
  sttLatencyMs?: number;
  ttsLatencyMs?: number;
  llmLatencyMs?: number;
  simulatedTranscript?: string;
  simulatedLLMResponse?: string;
}

export class MockVoiceEnvironment {
  public readonly stt: MockSTTProvider;
  public readonly tts: MockTTSProvider;
  public readonly llm: MockLLMProvider;
  public readonly registry: ProviderRegistry;

  constructor(config: MockVoiceEnvironmentConfig = {}) {
    this.stt = new MockSTTProvider({
      simulatedLatencyMs: config.sttLatencyMs ?? 20,
      defaultTranscript: config.simulatedTranscript ?? 'ನಾಳೆ 10 ಗಂಟೆಗೆ ಡಾಕ್ಟರ್ ರವಿ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಸಿಗುತ್ತಾ?',
    });

    this.tts = new MockTTSProvider({
      simulatedLatencyMs: config.ttsLatencyMs ?? 20,
    });

    this.llm = new MockLLMProvider({
      simulatedLatencyMs: config.llmLatencyMs ?? 20,
      defaultResponse: config.simulatedLLMResponse ?? 'ಹೌದು, ನಾಳೆ ಬೆಳಿಗ್ಗೆ 10:00 ಗಂಟೆಗೆ ಡಾಕ್ಟರ್ ರವಿ ಅವರ ಸ್ಲಾಟ್ ಲಭ್ಯವಿದೆ. ಬುಕ್ ಮಾಡಲೇ?',
    });

    this.registry = new ProviderRegistry();
    const mocks = MockProviderFactory.createAll();
    mocks.stt = this.stt;
    mocks.tts = this.tts;
    mocks.llm = this.llm;
    MockProviderFactory.registerInto(this.registry, mocks);
  }
}
