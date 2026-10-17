/**
 * Layer 4: Telephony Gateway Router
 * Dhwani SI — Exotel & Twilio Cellular Voice Webhook Adapter
 */

export interface InceptionCallRequest {
  targetPhoneNumber: string;
  businessName: string;
  industry: 'REAL_ESTATE' | 'HEALTHCARE_HOSPITAL' | 'AUTOMOTIVE_DEALER';
  directorName?: string;
}

export class TelephonyRouter {
  private accountSid: string;
  private apiKey: string;
  private apiToken: string;
  private callerId: string;

  constructor() {
    this.accountSid = process.env.EXOTEL_ACCOUNT_SID || '';
    this.apiKey = process.env.EXOTEL_API_KEY || '';
    this.apiToken = process.env.EXOTEL_API_TOKEN || '';
    this.callerId = process.env.EXOTEL_CALLER_ID || '+918047192000';
  }

  /**
   * Generates Twilio Media Streams TwiML or Exotel Voice App JSON to stream cellular call audio to our server
   */
  public generateTelephonyStreamResponse(serverHost: string, callSid: string): string {
    const wsUrl = `wss://${serverHost}/ws/audio-stream?callSid=${callSid}&source=telephony`;
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="kn-IN">Namaskara, call connect aaguththe, ondu second.</Say>
  <Connect>
    <Stream url="${wsUrl}" />
  </Connect>
</Response>`;
  }

  /**
   * Places an outbound cellular phone call to an Indian mobile number (+91)
   */
  public async dispatchOutboundCall(req: InceptionCallRequest, callbackUrl: string): Promise<{ success: boolean; callSid?: string; message: string }> {
    const formattedPhone = req.targetPhoneNumber.replace(/\D/g, '');

    if (!this.apiKey || !this.accountSid) {
      if (process.env.NODE_ENV === 'production') {
        return {
          success: false,
          message: 'Telephony provider is unconfigured in production. EXOTEL_ACCOUNT_SID and EXOTEL_API_KEY are required.',
        };
      }
      console.log(`[Telephony Gateway] Mock Outbound Cellular Call Dispatched to +91 ${formattedPhone}`);
      return {
        success: true,
        callSid: `MOCK_EXO_${Date.now()}`,
        message: `Simulated cellular call dispatched to +91 ${formattedPhone}. When answered, Sahana will converse in Kannada.`,
      };
    }

    try {
      const url = `https://api.exotel.com/v1/Accounts/${this.accountSid}/Calls/connect.json`;
      const auth = Buffer.from(`${this.apiKey}:${this.apiToken}`).toString('base64');

      const params = new URLSearchParams();
      params.append('From', this.callerId);
      params.append('To', formattedPhone);
      params.append('Url', callbackUrl);
      params.append('TimeLimit', '300'); // 5 minute max demo limit

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errText = await response.text();
        return { success: false, message: `Exotel error: ${errText}` };
      }

      const data = await response.json();
      return {
        success: true,
        callSid: data.Call?.Sid,
        message: `Live cellular call placed successfully via Exotel to +91 ${formattedPhone}`,
      };
    } catch (err: any) {
      return { success: false, message: `Telephony dispatch error: ${err.message}` };
    }
  }
}
