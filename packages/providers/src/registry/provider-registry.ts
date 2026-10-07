import {
  ILLMProvider,
  ISTTProvider,
  ITTSProvider,
  ITelephonyProvider,
  IMessagingProvider,
  IEmbeddingProvider,
  ICalendarProvider,
  ICRMProvider,
  LLMCapabilities,
  STTCapabilities,
  TTSCapabilities,
  TelephonyCapabilities,
  MessagingCapabilities,
  EmbeddingCapabilities,
  CalendarCapabilities,
  CRMCapabilities,
  AnyProviderCapabilities,
  ProviderError,
} from '@vanni/provider-sdk';

export interface RegisteredEntry<TProvider, TCap> {
  provider: TProvider;
  capabilities: TCap;
  isDefault?: boolean;
}

export class ProviderRegistry {
  private llmProviders = new Map<string, RegisteredEntry<ILLMProvider, LLMCapabilities>>();
  private sttProviders = new Map<string, RegisteredEntry<ISTTProvider, STTCapabilities>>();
  private ttsProviders = new Map<string, RegisteredEntry<ITTSProvider, TTSCapabilities>>();
  private telephonyProviders = new Map<string, RegisteredEntry<ITelephonyProvider, TelephonyCapabilities>>();
  private messagingProviders = new Map<string, RegisteredEntry<IMessagingProvider, MessagingCapabilities>>();
  private embeddingProviders = new Map<string, RegisteredEntry<IEmbeddingProvider, EmbeddingCapabilities>>();
  private calendarProviders = new Map<string, RegisteredEntry<ICalendarProvider, CalendarCapabilities>>();
  private crmProviders = new Map<string, RegisteredEntry<ICRMProvider, CRMCapabilities>>();

  // Registration methods
  registerLLM(provider: ILLMProvider, capabilities: LLMCapabilities, isDefault = false): void {
    this.llmProviders.set(provider.providerName, { provider, capabilities, isDefault });
  }

  registerSTT(provider: ISTTProvider, capabilities: STTCapabilities, isDefault = false): void {
    this.sttProviders.set(provider.providerName, { provider, capabilities, isDefault });
  }

  registerTTS(provider: ITTSProvider, capabilities: TTSCapabilities, isDefault = false): void {
    this.ttsProviders.set(provider.providerName, { provider, capabilities, isDefault });
  }

  registerTelephony(provider: ITelephonyProvider, capabilities: TelephonyCapabilities, isDefault = false): void {
    this.telephonyProviders.set(provider.providerName, { provider, capabilities, isDefault });
  }

  registerMessaging(provider: IMessagingProvider, capabilities: MessagingCapabilities, isDefault = false): void {
    this.messagingProviders.set(provider.providerName, { provider, capabilities, isDefault });
  }

  registerEmbedding(provider: IEmbeddingProvider, capabilities: EmbeddingCapabilities, isDefault = false): void {
    this.embeddingProviders.set(provider.providerName, { provider, capabilities, isDefault });
  }

  registerCalendar(provider: ICalendarProvider, capabilities: CalendarCapabilities, isDefault = false): void {
    this.calendarProviders.set(provider.providerName, { provider, capabilities, isDefault });
  }

  registerCRM(provider: ICRMProvider, capabilities: CRMCapabilities, isDefault = false): void {
    this.crmProviders.set(provider.providerName, { provider, capabilities, isDefault });
  }

  // Retrieval by name
  getLLM(name: string): ILLMProvider | undefined {
    return this.llmProviders.get(name)?.provider;
  }

  getSTT(name: string): ISTTProvider | undefined {
    return this.sttProviders.get(name)?.provider;
  }

  getTTS(name: string): ITTSProvider | undefined {
    return this.ttsProviders.get(name)?.provider;
  }

  getTelephony(name: string): ITelephonyProvider | undefined {
    return this.telephonyProviders.get(name)?.provider;
  }

  getMessaging(name: string): IMessagingProvider | undefined {
    return this.messagingProviders.get(name)?.provider;
  }

  getEmbedding(name: string): IEmbeddingProvider | undefined {
    return this.embeddingProviders.get(name)?.provider;
  }

  getCalendar(name: string): ICalendarProvider | undefined {
    return this.calendarProviders.get(name)?.provider;
  }

  getCRM(name: string): ICRMProvider | undefined {
    return this.crmProviders.get(name)?.provider;
  }

  // Capability-based resolution
  resolveLLM(requirements?: Partial<LLMCapabilities>): ILLMProvider {
    for (const entry of this.llmProviders.values()) {
      if (!requirements) return entry.provider;

      if (requirements.supportsKannada && !entry.capabilities.supportsKannada) continue;
      if (requirements.supportsStructuredOutput && !entry.capabilities.supportsStructuredOutput) continue;
      if (requirements.supportsToolCalling && !entry.capabilities.supportsToolCalling) continue;
      if (requirements.supportsStreaming && !entry.capabilities.supportsStreaming) continue;

      return entry.provider;
    }

    const defaultEntry = Array.from(this.llmProviders.values()).find((e) => e.isDefault);
    if (defaultEntry) return defaultEntry.provider;

    const first = this.llmProviders.values().next().value;
    if (first) return first.provider;

    throw new ProviderError('PROVIDER_UNAVAILABLE', 'No matching LLM provider found in registry', {
      providerName: 'ProviderRegistry',
      isRetryable: false,
    });
  }

  resolveSTT(requirements?: Partial<STTCapabilities>): ISTTProvider {
    for (const entry of this.sttProviders.values()) {
      if (!requirements) return entry.provider;

      if (requirements.supportsKannada && !entry.capabilities.supportsKannada) continue;
      if (requirements.supportsCodeSwitching && !entry.capabilities.supportsCodeSwitching) continue;
      if (requirements.supportsStreaming && !entry.capabilities.supportsStreaming) continue;

      return entry.provider;
    }

    const defaultEntry = Array.from(this.sttProviders.values()).find((e) => e.isDefault);
    if (defaultEntry) return defaultEntry.provider;

    const first = this.sttProviders.values().next().value;
    if (first) return first.provider;

    throw new ProviderError('PROVIDER_UNAVAILABLE', 'No matching STT provider found in registry', {
      providerName: 'ProviderRegistry',
      isRetryable: false,
    });
  }

  resolveTTS(requirements?: Partial<TTSCapabilities>): ITTSProvider {
    for (const entry of this.ttsProviders.values()) {
      if (!requirements) return entry.provider;

      if (requirements.supportsKannada && !entry.capabilities.supportsKannada) continue;
      if (requirements.supportsCodeSwitching && !entry.capabilities.supportsCodeSwitching) continue;
      if (requirements.supportsStreaming && !entry.capabilities.supportsStreaming) continue;

      return entry.provider;
    }

    const defaultEntry = Array.from(this.ttsProviders.values()).find((e) => e.isDefault);
    if (defaultEntry) return defaultEntry.provider;

    const first = this.ttsProviders.values().next().value;
    if (first) return first.provider;

    throw new ProviderError('PROVIDER_UNAVAILABLE', 'No matching TTS provider found in registry', {
      providerName: 'ProviderRegistry',
      isRetryable: false,
    });
  }

  resolveEmbedding(requirements?: Partial<EmbeddingCapabilities>): IEmbeddingProvider {
    for (const entry of this.embeddingProviders.values()) {
      if (!requirements) return entry.provider;
      if (requirements.supportsKannada && !entry.capabilities.supportsKannada) continue;
      return entry.provider;
    }

    const defaultEntry = Array.from(this.embeddingProviders.values()).find((e) => e.isDefault);
    if (defaultEntry) return defaultEntry.provider;

    const first = this.embeddingProviders.values().next().value;
    if (first) return first.provider;

    throw new ProviderError('PROVIDER_UNAVAILABLE', 'No matching Embedding provider found in registry', {
      providerName: 'ProviderRegistry',
      isRetryable: false,
    });
  }

  listRegistered(): Record<string, string[]> {
    return {
      llm: Array.from(this.llmProviders.keys()),
      stt: Array.from(this.sttProviders.keys()),
      tts: Array.from(this.ttsProviders.keys()),
      telephony: Array.from(this.telephonyProviders.keys()),
      messaging: Array.from(this.messagingProviders.keys()),
      embeddings: Array.from(this.embeddingProviders.keys()),
      calendar: Array.from(this.calendarProviders.keys()),
      crm: Array.from(this.crmProviders.keys()),
    };
  }
}
