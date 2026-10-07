/**
 * @vanni/api — CRM & Outbound Call Inception Routes
 *
 * Provides:
 * - GET  /api/crm/status                    - CRM integration status
 * - GET  /api/crm/contacts                  - List CRM contacts
 * - POST /api/calls/outbound-inception      - Trigger outbound AI call via Exotel
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '@vanni/observability';

function getOrgId(req: FastifyRequest): string {
  return (req.headers['x-organization-id'] as string) || 'a0000000-0000-0000-0000-000000000001';
}

// CRM demo integrations per org
const CRM_INTEGRATIONS: Record<string, any> = {
  'a0000000-0000-0000-0000-000000000001': {
    provider: 'Twenty CRM (Self-hosted)',
    status: 'CONNECTED',
    syncEnabled: true,
    lastSyncAt: new Date(Date.now() - 3600000).toISOString(),
    contactsCount: 384,
    openOpportunitiesCount: 52,
    whatsappEnabled: true,
    whatsappDeliveryRate: '100%',
    meta: {
      provider: 'Meta Lead Ads',
      status: 'ACTIVE',
      campaignsCount: 4,
      leadsThisMonth: 128,
    },
  },
  'a0000000-0000-0000-0000-000000000002': {
    provider: 'Twenty CRM (Self-hosted)',
    status: 'CONNECTED',
    syncEnabled: true,
    lastSyncAt: new Date(Date.now() - 7200000).toISOString(),
    contactsCount: 621,
    openOpportunitiesCount: 38,
    whatsappEnabled: true,
    whatsappDeliveryRate: '99.8%',
  },
};

// In-memory outbound call log
const outboundCallLog: any[] = [];

export async function registerCrmAndOutboundRoutes(fastify: FastifyInstance) {
  // GET /api/crm/status
  fastify.get('/api/crm/status', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const crm = CRM_INTEGRATIONS[orgId] || {
      provider: 'Not Connected',
      status: 'DISCONNECTED',
      syncEnabled: false,
    };

    return reply.send({ success: true, crm });
  });

  // GET /api/crm/contacts (Dynamic contacts list - starts empty for real callers)
  fastify.get('/api/crm/contacts', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const contacts: any[] = [];
    return reply.send({ success: true, contacts, total: contacts.length });
  });

  // POST /api/calls/outbound-inception — Trigger outbound AI call
  fastify.post('/api/calls/outbound-inception', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any;
    const targetPhone = body?.targetPhone || body?.phone || body?.number;

    if (!targetPhone) {
      return reply.status(400).send({
        success: false,
        error: 'MISSING_PHONE',
        message: 'targetPhone is required to initiate an outbound call.',
      });
    }

    // Validate Indian phone number format
    const cleaned = targetPhone.replace(/\D/g, '');
    if (cleaned.length < 10) {
      return reply.status(400).send({
        success: false,
        error: 'INVALID_PHONE',
        message: 'Please provide a valid 10-digit Indian mobile number.',
      });
    }

    const callSid = `EX${Date.now().toString(36).toUpperCase()}`;
    const orgId = getOrgId(req);

    const callRecord = {
      callSid,
      organizationId: orgId,
      targetPhone,
      businessName: body?.businessName || 'VANNI Business',
      industry: body?.industry || 'GENERAL',
      status: 'INITIATED',
      initiatedAt: new Date().toISOString(),
      agent: body?.agentName || 'Sahana',
      provider: 'Exotel',
    };

    outboundCallLog.push(callRecord);

    logger.info('Outbound inception call initiated', {
      callSid,
      orgId,
      targetPhone: `+91 ${cleaned.slice(-10, -6)}****`,
    });

    // In production, this would call Exotel API:
    // POST https://api.exotel.com/v1/Accounts/{SID}/Calls/connect
    // For demo, simulate success
    return reply.send({
      success: true,
      callSid,
      message: `Outbound call to +91 ${cleaned.slice(-10)} initiated. ${callRecord.agent} will connect in 10-15 seconds.`,
      status: 'DIALING',
      estimatedConnectSeconds: 12,
    });
  });

  // GET /api/calls/outbound-log — View recent outbound calls
  fastify.get('/api/calls/outbound-log', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      success: true,
      calls: outboundCallLog.slice(-20).reverse(),
      total: outboundCallLog.length,
    });
  });
}
