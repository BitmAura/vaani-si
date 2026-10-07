/**
 * VANNI Provider SDK — Telephony Gateway Abstraction Contract
 */
export interface OutboundCallRequest {
    targetPhoneNumber: string;
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
export interface ITelephonyProvider {
    readonly providerName: string;
    /**
     * Places an outbound call over cellular / PSTN networks
     */
    dispatchOutboundCall(req: OutboundCallRequest): Promise<CallDispatchResult>;
    /**
     * Transfers an ongoing call to a human operator or specialist clinic line
     */
    transferCall(req: CallTransferRequest): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Terminates a call session
     */
    terminateCall(callSid: string): Promise<boolean>;
    /**
     * Generates telephony streaming markup (e.g. TwiML or Exotel JSON)
     */
    generateStreamResponse(wsStreamUrl: string, welcomeMessage?: string): string;
}
