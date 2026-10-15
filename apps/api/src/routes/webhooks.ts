import { FastifyInstance } from 'fastify';
import crypto from 'crypto';

export async function registerWebhookRoutes(fastify: FastifyInstance) {
  // 1. Inbound SIP/Twilio Voice Webhook (The actual AI Voice stream)
  fastify.post('/api/webhooks/telephony', async (request, reply) => {
    const payload = request.body as any;
    fastify.log.info({ payload }, '[Telephony Inbound Webhook Received]');
    // Here we will stream the WebSockets to voice-gateway
    return reply.send({ received: true, action: 'STREAM_WS' });
  });

  // 1b. Exotel CDR (Call Detail Record) Webhook with HMAC-SHA256 signature verification
  fastify.post('/api/webhooks/telephony/exotel-cdr', async (request, reply) => {
    const secret = process.env.EXOTEL_WEBHOOK_SECRET || process.env.EXOTEL_API_TOKEN;
    const signature = request.headers['x-exotel-signature'] as string;

    if (secret && process.env.NODE_ENV === 'production') {
      if (!signature) {
        fastify.log.warn('[Exotel CDR] Missing x-exotel-signature header');
        return reply.status(401).send({ error: 'UNAUTHORIZED: Missing Exotel signature' });
      }

      try {
        const fullUrl = `${request.protocol}://${request.hostname}${request.url}`;
        const rawBody = typeof request.body === 'string' ? request.body : JSON.stringify(request.body || {});
        const expectedHex = crypto.createHmac('sha256', secret).update(`${fullUrl}${rawBody}`).digest('hex');
        const expectedBase64 = crypto.createHmac('sha256', secret).update(`${fullUrl}${rawBody}`).digest('base64');
        const sigClean = signature.replace(/^sha256=/i, '').trim();

        const matchHex = sigClean.length === expectedHex.length &&
          crypto.timingSafeEqual(Buffer.from(sigClean), Buffer.from(expectedHex));
        const matchBase64 = sigClean.length === expectedBase64.length &&
          crypto.timingSafeEqual(Buffer.from(sigClean), Buffer.from(expectedBase64));

        if (!matchHex && !matchBase64) {
          fastify.log.warn('[Exotel CDR] Signature verification mismatch');
          return reply.status(401).send({ error: 'UNAUTHORIZED: Invalid Exotel signature' });
        }
      } catch (err: any) {
        return reply.status(401).send({ error: `Signature verification failed: ${err.message}` });
      }
    }

    const payload = request.body as any;
    fastify.log.info({ callSid: payload?.CallSid, status: payload?.Status, duration: payload?.Duration }, '[Exotel CDR Received]');
    return reply.send({ success: true, received: true, callSid: payload?.CallSid });
  });

  // 2. Meta/Facebook Ads Webhook (Speed-to-Lead Engine)
  fastify.post('/api/webhooks/meta-lead', async (request, reply) => {
    try {
      const payload = request.body as any;
      fastify.log.info({ payload }, '[Meta Ads Webhook Received]');

      // Step 1: Verify Meta App Secret (Domain Security)
      const signature = request.headers['x-hub-signature-256'] as string;
      if (process.env.META_APP_SECRET && signature) {
        const hmac = crypto.createHmac('sha256', process.env.META_APP_SECRET);
        hmac.update(JSON.stringify(payload));
        const expectedSignature = `sha256=${hmac.digest('hex')}`;
        if (signature !== expectedSignature) {
          fastify.log.error('Meta Webhook Signature mismatch - Potential Hijack');
          return reply.status(401).send({ error: 'UNAUTHORIZED_WEBHOOK' });
        }
      }

      // Step 2: Extract Lead Details (Handling Meta's deeply nested JSON)
      let phone = '';
      let name = 'Facebook Lead';
      let formId = '';
      
      if (payload.entry && payload.entry[0] && payload.entry[0].changes) {
        const changes = payload.entry[0].changes[0];
        formId = changes.value.form_id;
        
        // In a real production setup, we would make a Graph API call here using the leadgen_id
        // to fetch the actual unhashed phone and name. For the architecture proof, we mock the extraction:
        phone = changes.value.lead_phone || '+918047192001';
      }

      // Step 3: Identify the Organization (Tenant) based on the Form ID
      // Real-world: We query the DB to see which org owns this Meta Form ID.
      // E.g. Form ID 12345 belongs to "Ballari Residential Layouts"
      const tenantId = 'a0000000-0000-0000-0000-000000000001'; // Defaulting to Real Estate for this flow

      fastify.log.info({ phone, formId, tenantId }, 'Lead parsed successfully. Triggering Outbound Engine.');

      // Step 4: Fire Outbound AI Voice Agent (Speed-to-Lead: < 5 seconds)
      // We asynchronously trigger the AI agent so the webhook responds to Meta in <200ms
      triggerOutboundAICall(phone, tenantId).catch(err => {
        fastify.log.error({ err }, 'Failed to trigger outbound AI call');
      });

      return reply.send({ success: true, queued: true, action: 'AI_DISPATCHED' });
    } catch (error) {
      fastify.log.error({ error }, 'Webhook processing failed');
      return reply.status(500).send({ error: 'WEBHOOK_FAILURE' });
    }
  });

  // 3. Meta Webhook Verification (GET) - Required by Facebook to register the webhook
  fastify.get('/api/webhooks/meta-lead', async (request, reply) => {
    const query = request.query as any;
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === (process.env.META_VERIFY_TOKEN || 'vanni_secure_token')) {
      fastify.log.info('Meta Webhook Verified Successfully');
      return reply.status(200).send(challenge);
    } else {
      return reply.status(403).send('Forbidden');
    }
  });
}

/**
 * Background Service to immediately dial the lead
 */
async function triggerOutboundAICall(phone: string, tenantId: string) {
  // Simulate the SIP/Twilio dialer trigger
  console.log(`[SPEED-TO-LEAD] Dialing ${phone} via AI Agent for tenant ${tenantId}`);
  
  // In real life, this would hit our internal SIP gateway:
  // await fetch('http://voice-gateway:8080/outbound', { ... })
  return true;
}
