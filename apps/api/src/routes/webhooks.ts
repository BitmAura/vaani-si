import { FastifyInstance } from 'fastify';

export async function registerWebhookRoutes(fastify: FastifyInstance) {
  fastify.post('/api/webhooks/telephony', async (request, reply) => {
    const payload = request.body as any;
    fastify.log.info({ payload }, '[Telephony Inbound Webhook Received]');
    return reply.send({ received: true, action: 'STREAM_WS' });
  });

  fastify.post('/api/webhooks/meta-lead', async (request, reply) => {
    const payload = request.body as any;
    fastify.log.info({ payload }, '[Meta Ads Webhook Received]');
    return reply.send({ queued: true });
  });
}
