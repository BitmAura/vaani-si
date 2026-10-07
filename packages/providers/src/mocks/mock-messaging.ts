import {
  IMessagingProvider,
  MessagePayload,
  MessageDispatchResult,
  ProviderError,
  ProviderErrorCode,
} from '@vanni/provider-sdk';

export interface MockMessagingConfig {
  simulatedLatencyMs?: number;
  failureErrorCode?: ProviderErrorCode;
}

export class MockMessagingProvider implements IMessagingProvider {
  public readonly providerName = 'mock-messaging';
  private latencyMs: number;
  private failureCode?: ProviderErrorCode;
  public sentMessages: MessagePayload[] = [];

  constructor(config: MockMessagingConfig = {}) {
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_MOCK_PROVIDERS) {
      throw new Error('MockMessagingProvider must NOT be instantiated in production environments');
    }
    this.latencyMs = config.simulatedLatencyMs || 10;
    this.failureCode = config.failureErrorCode;
  }

  simulateFailure(code?: ProviderErrorCode): void {
    this.failureCode = code;
  }

  private async delay(): Promise<void> {
    if (this.latencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.latencyMs));
    }
  }

  async dispatchStructuredMessage(payload: MessagePayload): Promise<MessageDispatchResult> {
    await this.delay();

    if (this.failureCode) {
      throw new ProviderError(this.failureCode, `Simulated Messaging failure: ${this.failureCode}`, {
        providerName: this.providerName,
        isRetryable: this.failureCode === 'PROVIDER_TIMEOUT',
      });
    }

    this.sentMessages.push(payload);
    const messageId = `msg_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    return {
      success: true,
      messageId,
      provider: this.providerName,
      deliveredTimestamp: new Date().toISOString(),
    };
  }

  async dispatchTextMessage(recipientPhone: string, text: string): Promise<MessageDispatchResult> {
    return this.dispatchStructuredMessage({
      recipientPhone,
      rawText: text,
    });
  }
}
