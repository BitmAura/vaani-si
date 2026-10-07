/**
 * VANNI Provider SDK — Messaging & WhatsApp Gateway Abstraction Contract
 */
export interface MessagePayload {
    recipientPhone: string;
    templateName?: string;
    templateParameters?: Record<string, string>;
    rawText?: string;
    mediaUrl?: string;
}
export interface MessageDispatchResult {
    success: boolean;
    messageId: string;
    provider: string;
    deliveredTimestamp: string;
    errorMessage?: string;
}
export interface IMessagingProvider {
    readonly providerName: string;
    /**
     * Dispatches a structured WhatsApp template message (e.g. Lead Dossier or Visit Confirmation)
     */
    dispatchStructuredMessage(payload: MessagePayload): Promise<MessageDispatchResult>;
    /**
     * Dispatches freeform text within the customer 24h service window
     */
    dispatchTextMessage(recipientPhone: string, text: string): Promise<MessageDispatchResult>;
}
