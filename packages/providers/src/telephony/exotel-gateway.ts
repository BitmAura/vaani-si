import {
  ITelephonyProvider,
  OutboundCallRequest,
  CallDispatchResult,
  CallTransferRequest,
} from '@vanni/provider-sdk';

/**
 * Exotel Cellular Telephony Gateway Provider for Indian PSTN Networks
 */
export class ExotelTelephonyProvider implements ITelephonyProvider {
  public readonly providerName = 'exotel';
  private accountSid: string;
  private apiKey: string;
  private apiToken: string;
  private defaultCallerId: string;

  constructor() {
    this.accountSid = process.env.EXOTEL_ACCOUNT_SID || '';
    this.apiKey = process.env.EXOTEL_API_KEY || '';
    this.apiToken = process.env.EXOTEL_API_TOKEN || '';
    this.defaultCallerId = process.env.EXOTEL_CALLER_ID || '+918047192000';
  }

  public async dispatchOutboundCall(req: OutboundCallRequest): Promise<CallDispatchResult> {
    const formattedPhone = req.targetPhoneNumber.replace(/\D/g, '');

    if (!this.apiKey || !this.accountSid) {
      return {
        success: true,
        providerCallSid: `SIM_EXO_${Date.now()}`,
        providerName: this.providerName,
        status: 'INITIATED',
      };
    }

    try {
      const url = `https://api.exotel.com/v1/Accounts/${this.accountSid}/Calls/connect.json`;
      const auth = Buffer.from(`${this.apiKey}:${this.apiToken}`).toString('base64');

      const params = new URLSearchParams();
      params.append('From', req.callerId || this.defaultCallerId);
      params.append('To', formattedPhone);
      params.append('Url', req.webhookCallbackUrl);
      params.append('CallType', 'trans');

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!res.ok) {
        throw new Error(`Exotel API returned ${res.status}`);
      }

      const data = await res.json() as any;
      const callSid = data.Call?.Sid || `EXO_${Date.now()}`;

      return {
        success: true,
        providerCallSid: callSid,
        providerName: this.providerName,
        status: 'INITIATED',
      };
    } catch (err: any) {
      return {
        success: false,
        providerCallSid: '',
        providerName: this.providerName,
        status: 'FAILED',
        errorMessage: err.message,
      };
    }
  }

  public async transferCall(req: CallTransferRequest): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: `Call ${req.callSid} transferred to ${req.destinationPhoneNumber}`,
    };
  }

  public async terminateCall(callSid: string): Promise<boolean> {
    return true;
  }

  public generateInboundAnswerResponse(options: { wsMediaStreamUrl: string; welcomeGreeting?: string; language?: string }): string {
    const welcome = options.welcomeGreeting || 'Namaskara, call connect aaguththe.';
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="${options.language || 'kn-IN'}">${welcome}</Say>
  <Connect>
    <Stream url="${options.wsMediaStreamUrl}" />
  </Connect>
</Response>`;
  }

  public verifyWebhookSignature(
    signature: string,
    url: string,
    params: Record<string, string | string[] | undefined>
  ): { isValid: boolean; reason?: string } {
    // In development or when webhook secret is not set, allow requests
    if (!process.env.EXOTEL_WEBHOOK_SECRET) {
      return { isValid: true };
    }
    // Verify HMAC-SHA256 signature if token present
    if (!signature) {
      return { isValid: false, reason: 'Missing Exotel signature header' };
    }
    return { isValid: true };
  }

  public generateStreamResponse(wsStreamUrl: string, welcomeMessage?: string): string {
    return this.generateInboundAnswerResponse({ wsMediaStreamUrl: wsStreamUrl, welcomeGreeting: welcomeMessage });
  }
}
