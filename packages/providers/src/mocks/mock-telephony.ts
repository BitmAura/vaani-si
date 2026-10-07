import {
  ITelephonyProvider,
  OutboundCallRequest,
  CallDispatchResult,
  CallTransferRequest,
  ProviderError,
  ProviderErrorCode,
} from '@vanni/provider-sdk';

export interface MockTelephonyConfig {
  simulatedLatencyMs?: number;
  failureErrorCode?: ProviderErrorCode;
}

export class MockTelephonyProvider implements ITelephonyProvider {
  public readonly providerName = 'mock-telephony';
  private latencyMs: number;
  private failureCode?: ProviderErrorCode;
  private calls = new Map<string, OutboundCallRequest>();

  constructor(config: MockTelephonyConfig = {}) {
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_MOCK_PROVIDERS) {
      throw new Error('MockTelephonyProvider must NOT be instantiated in production environments');
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

  async dispatchOutboundCall(req: OutboundCallRequest): Promise<CallDispatchResult> {
    await this.delay();

    if (this.failureCode) {
      throw new ProviderError(this.failureCode, `Simulated Telephony failure: ${this.failureCode}`, {
        providerName: this.providerName,
        isRetryable: this.failureCode === 'PROVIDER_TIMEOUT',
      });
    }

    const providerCallSid = `call_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.calls.set(providerCallSid, req);

    return {
      success: true,
      providerCallSid,
      providerName: this.providerName,
      status: 'INITIATED',
    };
  }

  async transferCall(req: CallTransferRequest): Promise<{ success: boolean; message: string }> {
    await this.delay();
    return { success: true, message: `Transferred to ${req.destinationPhoneNumber}` };
  }

  async terminateCall(callSid: string): Promise<boolean> {
    await this.delay();
    return this.calls.delete(callSid);
  }

  generateInboundAnswerResponse(options: { wsMediaStreamUrl: string; welcomeGreeting?: string; language?: string }): string {
    return JSON.stringify({
      action: 'connect_stream',
      streamUrl: options.wsMediaStreamUrl,
      greeting: options.welcomeGreeting || 'Namaskara! Ballari Layouts kadeyinda mathadtha iddini.',
      language: options.language || 'kn-IN',
    });
  }

  verifyWebhookSignature(
    signature: string,
    url: string,
    params: Record<string, string | string[] | undefined>
  ): { isValid: boolean; reason?: string } {
    if (signature === 'invalid_signature') {
      return { isValid: false, reason: 'Invalid signature for test' };
    }
    return { isValid: true };
  }

  generateStreamResponse(wsStreamUrl: string, welcomeMessage?: string): string {
    return this.generateInboundAnswerResponse({ wsMediaStreamUrl: wsStreamUrl, welcomeGreeting: welcomeMessage });
  }
}
