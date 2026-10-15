/**
 * @vanni/server — Webhook Ingestion Routes
 * Telephony CDR & Meta Ads Speed-to-Lead Endpoints
 */

import { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';

export async function registerWebhookRoutes(fastify: FastifyInstance) {
  // 1. Inbound SIP/Twilio Voice Webhook (The actual AI Voice stream)
  fastify.post('/api/webhooks/telephony', async (request, reply) => {
    const payload = request.body as any;
    fastify.log.info({ payload }, '[Telephony Inbound Webhook Received]');
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

  // 2. Note: POST /api/webhooks/meta-lead and /webhooks/meta-lead-gen are handled with full
  // TelephonyRouter, CallDatabaseService and OpenSourceCRMService integration in server.ts.

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
// Outbound dialing is executed via TelephonyRouter in server.ts
