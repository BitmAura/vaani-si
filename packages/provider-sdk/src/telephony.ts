/**
 * VANNI Provider SDK — Telephony Gateway Abstraction Contract
 */

export type TelephonyCallDirection = 'INBOUND' | 'OUTBOUND';

export type TelephonyCallStatus =
  | 'RECEIVED'
  | 'ROUTING'
  | 'RINGING'
  | 'ANSWERED'
  | 'CONNECTING_MEDIA'
  | 'ACTIVE'
  | 'ON_HOLD'
  | 'TRANSFER_PENDING'
  | 'TRANSFERRED'
  | 'ENDING'
  | 'ENDED'
  | 'FAILED';

export interface InboundCallWebhookPayload {
  providerCallSid: string;
  callerPhoneNumber: string;
  calledPhoneNumber: string;
  rawQuery?: Record<string, string>;
  rawHeaders?: Record<string, string>;
  timestamp?: string;
}

export interface InboundCallAnswerOptions {
  wsMediaStreamUrl: string;
  welcomeGreeting?: string;
  language?: 'kn-IN' | 'en-IN' | 'hi-IN';
}

export interface OutboundCallRequest {
  targetPhoneNumber: string; // 10-digit Indian number or E.164
  callerId?: string;
  organizationId: string;
  agentId: string;
  webhookCallbackUrl: string;
  customParameters?: Record<string, string>;
}

export interface CallDispatchResult {
  success: boolean;
  providerCallSid: string;
  providerName: string;
  status: 'INITIATED' | 'RINGING' | 'FAILED';
  errorMessage?: string;
}

export interface CallTransferRequest {
  callSid: string;
  destinationPhoneNumber: string;
  transferType: 'COLD' | 'WARM';
}

export interface WebhookVerificationResult {
  isValid: boolean;
  reason?: string;
}

export interface ITelephonyProvider {
  readonly providerName: string;

  /**
   * Places an outbound call over cellular / PSTN networks (Future module)
   */
  dispatchOutboundCall(req: OutboundCallRequest): Promise<CallDispatchResult>;

  /**
   * Generates telephony streaming markup / response to answer inbound call and bridge audio stream
   */
  generateInboundAnswerResponse(options: InboundCallAnswerOptions): string;

  /**
   * Verifies authenticity and signature of an incoming webhook from the telephony provider
   */
  verifyWebhookSignature(
    signature: string,
    url: string,
    params: Record<string, string | string[] | undefined>
  ): WebhookVerificationResult;

  /**
   * Transfers an ongoing call to a human operator or specialist clinic line
   */
  transferCall(req: CallTransferRequest): Promise<{ success: boolean; message: string }>;

  /**
   * Terminates a call session
   */
  terminateCall(callSid: string): Promise<boolean>;

  /**
   * Generates telephony streaming markup (e.g. TwiML or Exotel JSON)
   */
  generateStreamResponse(wsStreamUrl: string, welcomeMessage?: string): string;
}
