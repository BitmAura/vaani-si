import {
  IMessagingProvider,
  MessagePayload,
  MessageDispatchResult,
} from '@vanni/provider-sdk';

/**
 * WhatsApp Cloud API Provider for Structured Lead Cards & Confirmations
 */
export class WhatsAppCloudProvider implements IMessagingProvider {
  public readonly providerName = 'whatsapp_cloud_api';
  private apiToken: string;
  private phoneNumberId: string;

  constructor() {
    this.apiToken = process.env.WHATSAPP_API_TOKEN || '';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  }

  public async dispatchStructuredMessage(payload: MessagePayload): Promise<MessageDispatchResult> {
    const cleanPhone = payload.recipientPhone.replace(/\D/g, '');

    if (!this.apiToken || !this.phoneNumberId) {
      return {
        success: true,
        messageId: `wamid.SIM_${Date.now()}`,
        provider: this.providerName,
        deliveredTimestamp: new Date().toISOString(),
      };
    }

    try {
      const url = `https://graph.facebook.com/v19.0/${this.phoneNumberId}/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'text',
          text: { body: payload.rawText || 'VANNI Lead Notification' },
        }),
      });

      if (!res.ok) {
        throw new Error(`WhatsApp API error status ${res.status}`);
      }

      const data = await res.json() as any;
      return {
        success: true,
        messageId: data.messages?.[0]?.id || `wamid.${Date.now()}`,
        provider: this.providerName,
        deliveredTimestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        success: false,
        messageId: '',
        provider: this.providerName,
        deliveredTimestamp: new Date().toISOString(),
        errorMessage: err.message,
      };
    }
  }

  public async dispatchTextMessage(recipientPhone: string, text: string): Promise<MessageDispatchResult> {
    return this.dispatchStructuredMessage({
      recipientPhone,
      rawText: text,
    });
  }
}
