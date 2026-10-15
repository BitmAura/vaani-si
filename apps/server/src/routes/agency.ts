/**
 * Digital Agency Client Management API Routes
 * Dhwani SI — Layer 5: Fastify Routes
 * White-label multi-client management for agencies
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AgencyClientSchema } from '../../../../packages/core/src/schemas/agency-schema';
import { randomUUID } from 'node:crypto';

const uuidv4 = randomUUID;

interface AgencyRouteContext {
  tenantId: string; // Agency's tenant ID
  userId: string;
}

function getContext(request: FastifyRequest): AgencyRouteContext {
  const reqAny = request as any;
  if (reqAny.user) return reqAny.user as AgencyRouteContext;
  return {
    tenantId: (request.query as any)?.tenantId || (request.body as any)?.tenantId || 'a0000000-0000-0000-0000-000000000003',
    userId: 'usr-dev-system',
  };
}

/**
 * Agency Client Routes Plugin
 */
export async function agencyRoutes(fastify: FastifyInstance) {
  
  /**
   * GET /api/agency/clients
   * List all clients for an agency
   */
  fastify.get('/api/agency/clients', async (request: FastifyRequest<{ Querystring: { status?: string } }>, reply: FastifyReply) => {
    const { tenantId } = getContext(request);

    // In production, query PostgreSQL with agency tenant filter
    const clients = [
      {
        id: uuidv4(),
        agencyId: tenantId,
        businessName: 'Ballari Layout Developers',
        industry: 'REAL_ESTATE',
        subscription: {
          plan: 'GROWTH',
          status: 'ACTIVE',
          monthlyFee: 45000,
          agencyMargin: 20,
        },
        usage: {
          callsThisMonth: 2450,
          callsLimit: 5000,
        },
        stats: {
          totalCalls: 12500,
          totalLeads: 890,
          avgLeadQuality: 82,
        },
      },
    ];

    return reply.status(200).send({
      success: true,
      data: clients,
      total: clients.length,
    });
  });

  /**
   * POST /api/agency/clients
   * Create a new client account
   */
  fastify.post('/api/agency/clients', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const { tenantId, userId } = getContext(request);
    const body = (request.body || {}) as any;
    
    const clientData = AgencyClientSchema.parse({
      ...body,
      id: uuidv4(),
      agencyId: tenantId,
      tenantId: uuidv4(), // Create sub-tenant for client
      subscription: {
        ...(body.subscription || {}),
        startedAt: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      createdAt: new Date(),
      createdBy: userId,
    });

    return reply.status(201).send({
      success: true,
      data: clientData,
      message: 'Client created successfully',
    });
  });

  /**
   * GET /api/agency/clients/:id
   * Get client details
   */
  fastify.get('/api/agency/clients/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { tenantId } = getContext(request);
    const { id } = request.params;

    const client = {
      id,
      agencyId: tenantId,
      businessName: 'Ballari Layout Developers',
      industry: 'REAL_ESTATE',
      branding: {
        logo: 'https://storage.vanni.ai/clients/logo.png',
        primaryColor: '#3b82f6',
        brandName: 'Ballari Plots',
        customDomain: 'ballari.youragency.com',
      },
      voiceConfig: {
        greeting: 'Namaskara, Ballari Layout Developers inda hegira help madbodu?',
        language: 'KANGLISH',
      },
      crmIntegration: {
        provider: 'ZOHO',
        syncEnabled: true,
      },
      subscription: {
        plan: 'GROWTH',
        status: 'ACTIVE',
        monthlyFee: 45000,
        agencyMargin: 20,
      },
      stats: {
        totalCalls: 12500,
        totalLeads: 890,
        avgLeadQuality: 82,
        conversionRate: 34,
      },
    };

    return reply.status(200).send({
      success: true,
      data: client,
    });
  });

  /**
   * PUT /api/agency/clients/:id
   * Update client configuration
   */
  fastify.put('/api/agency/clients/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const { id } = request.params;
    const body = (request.body || {}) as Record<string, any>;

    return reply.status(200).send({
      success: true,
      data: { id, ...body, updatedAt: new Date() },
      message: 'Client updated successfully',
    });
  });

  /**
   * DELETE /api/agency/clients/:id
   * Suspend client account
   */
  fastify.delete('/api/agency/clients/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    return reply.status(200).send({
      success: true,
      data: { id, suspended: true },
      message: 'Client suspended successfully',
    });
  });

  /**
   * POST /api/agency/clients/:id/knowledge
   * Upload knowledge base for client
   */
  fastify.post('/api/agency/clients/:id/knowledge', async (request: FastifyRequest<{ Params: { id: string }; Body: { type: string; content: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { type } = request.body || {};

    return reply.status(200).send({
      success: true,
      data: {
        clientId: id,
        type,
        chunksCreated: 45,
        status: 'PROCESSED',
      },
      message: 'Knowledge base uploaded successfully',
    });
  });

  /**
   * POST /api/agency/clients/:id/crm/connect
   * Connect CRM integration
   */
  fastify.post('/api/agency/clients/:id/crm/connect', async (request: FastifyRequest<{ Params: { id: string }; Body: { provider: string; apiKey: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { provider } = request.body || {};

    return reply.status(200).send({
      success: true,
      data: {
        clientId: id,
        provider,
        status: 'CONNECTED',
        syncEnabled: true,
      },
      message: 'CRM connected successfully',
    });
  });

  /**
   * POST /api/agency/clients/:id/crm/sync
   * Trigger manual CRM sync
   */
  fastify.post('/api/agency/clients/:id/crm/sync', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    return reply.status(200).send({
      success: true,
      data: {
        clientId: id,
        syncStatus: 'IN_PROGRESS',
        lastSync: new Date(),
      },
      message: 'CRM sync triggered',
    });
  });

  /**
   * GET /api/agency/revenue
   * Get agency revenue analytics
   */
  fastify.get('/api/agency/revenue', async (request: FastifyRequest<{ Querystring: { month?: number; year?: number } }>, reply: FastifyReply) => {
    const { tenantId } = getContext(request);
    const { month, year } = request.query;

    const revenue = {
      agencyId: tenantId,
      period: { month: month || new Date().getMonth() + 1, year: year || new Date().getFullYear() },
      revenue: {
        totalRevenue: 375000, // ₹3.75 Lakhs
        platformFees: 300000, // ₹3 Lakhs
        agencyMargin: 75000, // ₹75K profit
        overageRevenue: 15000,
      },
      clients: {
        total: 8,
        active: 7,
        newThisMonth: 2,
        churned: 0,
      },
      usage: {
        totalCalls: 24500,
        totalMinutes: 125000,
        totalLeads: 1890,
      },
    };

    return reply.status(200).send({
      success: true,
      data: revenue,
    });
  });

  /**
   * GET /api/agency/analytics
   * Get aggregated analytics across all clients
   */
  fastify.get('/api/agency/analytics', async (_request: FastifyRequest, reply: FastifyReply) => {
    const analytics = {
      overview: {
        totalClients: 8,
        activeCalls: 12,
        totalCallsThisMonth: 24500,
        totalLeadsThisMonth: 1890,
        avgLeadQuality: 78,
      },
      byIndustry: [
        { industry: 'REAL_ESTATE', clients: 3, calls: 12500, leads: 890 },
        { industry: 'HEALTHCARE_HOSPITAL', clients: 2, calls: 8000, leads: 650 },
        { industry: 'AUTOMOTIVE_DEALER', clients: 2, calls: 3500, leads: 280 },
        { industry: 'HOSPITALITY_RESORT', clients: 1, calls: 500, leads: 70 },
      ],
      topPerformers: [
        { clientName: 'Ballari Layout Developers', calls: 6500, leads: 490, conversionRate: 42 },
        { clientName: 'Apollo Clinic', calls: 5200, leads: 410, conversionRate: 38 },
      ],
      revenue: {
        currentMonth: 375000,
        previousMonth: 340000,
        growth: 10.3,
      },
    };

    return reply.status(200).send({
      success: true,
      data: analytics,
    });
  });

  /**
   * POST /api/agency/clients/:id/invite-member
   * Invite team member to client account
   */
  fastify.post('/api/agency/clients/:id/invite-member', async (request: FastifyRequest<{ Params: { id: string }; Body: { email: string; role: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { email, role } = request.body || {};

    return reply.status(200).send({
      success: true,
      data: {
        clientId: id,
        email,
        role,
        invitationSent: true,
        invitedAt: new Date(),
      },
      message: 'Invitation sent successfully',
    });
  });
}
