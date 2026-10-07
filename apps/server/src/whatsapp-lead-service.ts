/**
 * Layer 5: Institutional Lead Dispatch
 * Dhwani SI — WhatsApp Instant Notification Service
 */

export interface LeadPayload {
  tenantName: string;
  customerName: string;
  customerPhone: string;
  leadRating: 'HOT' | 'WARM' | 'COLD' | 'DISQUALIFIED' | 'ENTERPRISE_UPSELL';
  requirementSummary: string;
  budgetOrFee?: string;
  nextAction: string;
  callDurationSeconds: number;
}

export class WhatsAppLeadService {
  private apiToken: string;
  private phoneNumberId: string;

  constructor() {
    this.apiToken = process.env.WHATSAPP_API_TOKEN || '';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  }

  /**
   * Generates the institutional WhatsApp alert text
   */
  public formatLeadMessage(lead: LeadPayload): string {
    const ratingEmoji =
      lead.leadRating === 'HOT'
        ? '🔥 *HOT QUALIFIED LEAD*'
        : lead.leadRating === 'ENTERPRISE_UPSELL'
        ? '💎 *ENTERPRISE INCEPTION LEAD*'
        : '⚡ *CONFIRMED APPOINTMENT*';

    return `🚨 *[DHWANI SI — NEW VOICE LEAD DETECTED]*

${ratingEmoji}
🏢 *Client:* ${lead.tenantName}
👤 *Customer:* ${lead.customerName}
📞 *Mobile:* ${lead.customerPhone}

📋 *Key Requirement:*
${lead.requirementSummary}

💰 *Budget / Value:* ${lead.budgetOrFee || 'Standard Pricing'}
📅 *Confirmed Next Step:*
${lead.nextAction}

⏱️ *Call Handled By:* Sahana (Kannada Voice OS)
📊 *Call Duration:* ${lead.callDurationSeconds}s (0 Human Staff Needed)
───────────────────────
_Generated instantly by Dhwani SI Voice Telephony Gateway_`;
  }

  /**
   * Dispatch via WhatsApp Cloud API or simulate locally
   */
  public async dispatchLead(ownerPhone: string, lead: LeadPayload): Promise<{ success: boolean; messageId?: string }> {
    const bodyText = this.formatLeadMessage(lead);

    if (!this.apiToken || !this.phoneNumberId) {
      console.log(`\n======================================================`);
      console.log(`[WHATSAPP DISPATCH SIMULATION -> ${ownerPhone}]`);
      console.log(bodyText);
      console.log(`======================================================\n`);
      return { success: true, messageId: `SIM_WA_${Date.now()}` };
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
          to: ownerPhone.replace(/\D/g, ''),
          type: 'text',
          text: { body: bodyText },
        }),
      });

      if (!res.ok) {
        console.error('[WhatsApp Service] Dispatch failed HTTP', res.status, await res.text());
        return { success: false };
      }

      const data = await res.json();
      return { success: true, messageId: data.messages?.[0]?.id };
    } catch (err) {
      console.error('[WhatsApp Service] Dispatch error:', err);
      return { success: false };
    }
  }
}
