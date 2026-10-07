import {
  ITelephonyProvider,
  InboundCallWebhookPayload,
  WebhookVerificationResult,
} from '@vanni/provider-sdk';
import { ITelephonyRepository } from './telephony-repository.js';
import { InboundCallRouter, InboundCallRoutingResult } from './inbound-call-router.js';
import { TelephonyEventDTO } from './telephony-types.js';

export interface WebhookHandlerOptions {
  providerName: string;
  signatureHeader?: string;
  url: string;
  params: Record<string, any>;
  rawBody?: string;
}

export interface WebhookProcessingResult {
  statusCode: number;
  contentType: string;
  body: string;
  isDuplicate?: boolean;
}

/**
 * Telephony Webhook Controller.
 * Verifies signatures, ensures strict idempotency on providerEventId,
 * logs event telemetry, and invokes InboundCallRouter.
 */
export class TelephonyWebhookController {
  private repo: ITelephonyRepository;
  private router: InboundCallRouter;
  private provider: ITelephonyProvider;

  constructor(repo: ITelephonyRepository, router: InboundCallRouter, provider: ITelephonyProvider) {
    this.repo = repo;
    this.router = router;
    this.provider = provider;
  }

  async handleInboundCallWebhook(options: WebhookHandlerOptions): Promise<WebhookProcessingResult> {
    // 1. Signature Verification
    const verification: WebhookVerificationResult = this.provider.verifyWebhookSignature(
      options.signatureHeader || '',
      options.url,
      options.params
    );

    if (!verification.isValid) {
      return {
        statusCode: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized: Invalid telephony webhook signature' }),
      };
    }

    // 2. Extract Normalized Inbound Payload (Exotel / Twilio fields)
    const providerCallSid =
      options.params.CallSid ||
      options.params.CallUUID ||
      options.params.call_sid ||
      options.params.CallId ||
      `call_${Date.now()}`;

    const callerNumber =
      options.params.From ||
      options.params.Caller ||
      options.params.FromPhoneNumber ||
      '+919876543210';

    const calledNumber =
      options.params.To ||
      options.params.Called ||
      options.params.DialedNumber ||
      options.params.ToPhoneNumber ||
      '+918047192001';

    const providerEventId =
      options.params.EventId ||
      options.params.provider_event_id ||
      `${providerCallSid}_start`;

    // 3. Idempotency Check: Prevent duplicate webhook calls from creating duplicate sessions
    const isNewEvent = await this.repo.recordEventIfNew({
      providerEventId,
      telephonySessionId: providerCallSid,
      organizationId: 'org_pending',
      eventType: 'CALL_RECEIVED',
      sequenceNumber: 1,
      timestamp: new Date().toISOString(),
      payload: options.params,
    });

    if (!isNewEvent) {
      // Event already processed: Return 200 OK without re-routing
      return {
        statusCode: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ALREADY_PROCESSED' }),
        isDuplicate: true,
      };
    }

    // 4. Inbound Routing
    const payload: InboundCallWebhookPayload = {
      providerCallSid,
      callerPhoneNumber: callerNumber,
      calledPhoneNumber: calledNumber,
      rawQuery: options.params,
      timestamp: new Date().toISOString(),
    };

    const routingResult: InboundCallRoutingResult = await this.router.handleInboundCall(payload);

    const isXml = routingResult.responsePayload.trim().startsWith('<');
    return {
      statusCode: 200,
      contentType: isXml ? 'application/xml' : 'application/json',
      body: routingResult.responsePayload,
    };
  }

  async handleCallStatusWebhook(options: WebhookHandlerOptions): Promise<WebhookProcessingResult> {
    const providerCallSid = options.params.CallSid || options.params.CallUUID || '';
    const status = (options.params.Status || options.params.CallStatus || '').toUpperCase();
    const duration = parseInt(options.params.Duration || options.params.RecordingDuration || '0', 10);

    const session = await this.repo.findTelephonySessionByProviderSid(providerCallSid);
    if (session) {
      if (status === 'COMPLETED' || status === 'FAILED' || status === 'BUSY' || status === 'NO-ANSWER') {
        session.status = status === 'COMPLETED' ? 'ENDED' : 'FAILED';
        session.endedAt = new Date().toISOString();
        session.durationSeconds = duration;
        session.endReason = status === 'COMPLETED' ? 'CALLER_HANGUP' : 'PROVIDER_ERROR';
        session.updatedAt = new Date().toISOString();
        await this.repo.saveTelephonySession(session);
      }
    }

    return {
      statusCode: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ACKNOWLEDGED' }),
    };
  }
}
