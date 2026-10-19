import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import { InMemoryCampaignStore } from '@vanni/campaign-engine';
import { CampaignDTO, CampaignStatus, CampaignType, UserRole } from '@vanni/shared';
import { getSessionFromRequest } from '../http-auth.js';

export const globalCampaignStore = new InMemoryCampaignStore();

export function seedCampaignsForOrg(orgId: string) {
  const now = new Date().toISOString();
  const c1: CampaignDTO = {
    id: 'camp_01',
    organizationId: orgId,
    name: 'New Dental Inquiries Follow-up',
    description: 'Follow-up for inbound dental clinic inquiries',
    type: 'LEAD_FOLLOW_UP',
    status: 'ACTIVE',
    agentId: 'agent_sahana',
    agentVersion: 1,
    callerPhoneNumber: '+918047192002',
    callingPurpose: 'Follow up on dental consultation inquiry',
    identityDisclosure: 'Namaskara, nanu VANNI, an AI assistant calling on behalf of Radiant Dental Clinic.',
    timezone: 'Asia/Kolkata',
    startDate: now,
    callingWindowStart: '10:00:00',
    callingWindowEnd: '18:00:00',
    allowedDaysOfWeek: [1, 2, 3, 4, 5, 6],
    blackoutDates: [],
    maxConcurrentCalls: 2,
    maxCallsPerDay: 50,
    maxAttemptsPerTarget: 3,
    retryDelayMinutes: 60,
    requireConsent: true,
    activatedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const c2: CampaignDTO = {
    id: 'camp_02',
    organizationId: orgId,
    name: 'Site Visit 24h Reminder',
    description: 'Pre-visit confirmation call for scheduled plot visits',
    type: 'APPOINTMENT_REMINDER',
    status: 'ACTIVE',
    agentId: 'agent_vikram',
    agentVersion: 1,
    callerPhoneNumber: '+918047192001',
    callingPurpose: 'Confirm scheduled site visit and free cab pickup',
    identityDisclosure: 'Namaskara, nanu VANNI, calling from Ballari Residential Layouts.',
    timezone: 'Asia/Kolkata',
    startDate: now,
    callingWindowStart: '10:00:00',
    callingWindowEnd: '17:00:00',
    allowedDaysOfWeek: [1, 2, 3, 4, 5, 6],
    blackoutDates: [],
    maxConcurrentCalls: 2,
    maxCallsPerDay: 50,
    maxAttemptsPerTarget: 2,
    retryDelayMinutes: 120,
    requireConsent: true,
    activatedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const c3: CampaignDTO = {
    id: 'camp_03',
    organizationId: orgId,
    name: 'Weekend Callback Requests',
    description: 'Follow-up calls for Sunday offline requests',
    type: 'CALLBACK',
    status: 'PAUSED',
    agentId: 'agent_sahana',
    agentVersion: 1,
    callerPhoneNumber: '+918047192000',
    callingPurpose: 'Return weekend callback request',
    identityDisclosure: 'Namaskara, nanu VANNI AI assistant following up on your requested callback.',
    timezone: 'Asia/Kolkata',
    startDate: now,
    callingWindowStart: '11:00:00',
    callingWindowEnd: '15:00:00',
    allowedDaysOfWeek: [7],
    blackoutDates: [],
    maxConcurrentCalls: 1,
    maxCallsPerDay: 30,
    maxAttemptsPerTarget: 2,
    retryDelayMinutes: 180,
    requireConsent: true,
    pausedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  globalCampaignStore.saveCampaign(c1);
  globalCampaignStore.saveCampaign(c2);
  globalCampaignStore.saveCampaign(c3);
}

// Seed initial campaigns for demo organizations
function seedDefaultCampaigns() {
  if (process.env.NODE_ENV === 'production') return;
  const defaultOrgIds = [
    'a0000000-0000-0000-0000-000000000001',
    'org_demo_agency',
    'org_demo_real_estate',
    'org_demo_healthcare',
  ];

  for (const orgId of defaultOrgIds) {
    seedCampaignsForOrg(orgId);
  }
}

seedDefaultCampaigns();

export async function registerCampaignRoutes(fastify: FastifyInstance): Promise<void> {
  // 1. GET /api/campaigns: List campaigns for active organization
  fastify.get('/api/campaigns', async (req: FastifyRequest, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ success: false, error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const orgId = session.activeOrganizationId;
    let campaigns = await globalCampaignStore.listCampaigns(orgId);
    if (campaigns.length === 0) {
      seedCampaignsForOrg(orgId);
      campaigns = await globalCampaignStore.listCampaigns(orgId);
    }
    return reply.send({ success: true, campaigns, data: campaigns });
  });

  // 2. GET /api/campaigns/:id: Retrieve single campaign
  fastify.get('/api/campaigns/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ success: false, error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const orgId = session.activeOrganizationId;
    const { id } = req.params;
    const campaign = await globalCampaignStore.getCampaignById(id, orgId);
    if (!campaign) {
      return reply.status(404).send({ success: false, error: 'NOT_FOUND', message: 'Campaign not found' });
    }

    return reply.send({ success: true, campaign, data: campaign });
  });

  // 3. POST /api/campaigns: Create & Activate new campaign
  fastify.post('/api/campaigns', async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ success: false, error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const role = session.activeRole as UserRole;
    if (role === 'VIEWER') {
      return reply.status(403).send({ success: false, error: 'FORBIDDEN', message: 'Viewers cannot create campaigns' });
    }

    const body = (req.body as any) || {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return reply.status(400).send({ success: false, error: 'VALIDATION_ERROR', message: 'Campaign name is required' });
    }

    const now = new Date().toISOString();
    const campaignId = 'camp_' + crypto.randomUUID().slice(0, 8);
    const orgId = session.activeOrganizationId;

    const campaign: CampaignDTO = {
      id: campaignId,
      organizationId: orgId,
      name,
      description: body.description || 'Configured via Campaign Manager',
      type: (body.type as CampaignType) || 'LEAD_FOLLOW_UP',
      status: (body.status as CampaignStatus) || 'ACTIVE',
      agentId: body.agentId || 'agent_sahana',
      agentVersion: body.agentVersion || 1,
      callerPhoneNumber: body.callerPhoneNumber || '+918047192000',
      callingPurpose: body.callingPurpose || 'Customer follow-up and appointment booking',
      identityDisclosure: body.identityDisclosure || 'Namaskara, nanu VANNI AI assistant.',
      timezone: 'Asia/Kolkata',
      startDate: now,
      callingWindowStart: '10:00:00',
      callingWindowEnd: '18:00:00',
      allowedDaysOfWeek: [1, 2, 3, 4, 5, 6],
      blackoutDates: [],
      maxConcurrentCalls: 2,
      maxCallsPerDay: 50,
      maxAttemptsPerTarget: 3,
      retryDelayMinutes: 60,
      requireConsent: true,
      activatedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await globalCampaignStore.saveCampaign(campaign);

    return reply.status(201).send({
      success: true,
      campaign,
      message: `Campaign "${name}" created and activated successfully`,
    });
  });

  // 4. POST /api/campaigns/:id/status: Toggle campaign status (PAUSED <-> ACTIVE)
  fastify.post('/api/campaigns/:id/status', async (req: FastifyRequest<{ Params: { id: string }; Body: { status?: CampaignStatus } }>, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ success: false, error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const role = session.activeRole as UserRole;
    if (role === 'VIEWER') {
      return reply.status(403).send({ success: false, error: 'FORBIDDEN', message: 'Viewers cannot change campaign status' });
    }

    const orgId = session.activeOrganizationId;
    const { id } = req.params;
    let campaign = await globalCampaignStore.getCampaignById(id, orgId);
    if (!campaign) {
      return reply.status(404).send({ success: false, error: 'NOT_FOUND', message: 'Campaign not found' });
    }

    const targetStatus: CampaignStatus = req.body?.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE';
    const now = new Date().toISOString();

    const updated: CampaignDTO = {
      ...campaign,
      status: targetStatus,
      ...(targetStatus === 'PAUSED' ? { pausedAt: now } : { activatedAt: now }),
      updatedAt: now,
    };

    await globalCampaignStore.saveCampaign(updated);

    return reply.send({
      success: true,
      campaign: updated,
      message: `Campaign status updated to ${targetStatus}`,
    });
  });

  // 5. PATCH /api/campaigns/:id: Partial update
  fastify.patch('/api/campaigns/:id', async (req: FastifyRequest<{ Params: { id: string }; Body: Partial<CampaignDTO> }>, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ success: false, error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const role = session.activeRole as UserRole;
    if (role === 'VIEWER') {
      return reply.status(403).send({ success: false, error: 'FORBIDDEN', message: 'Viewers cannot modify campaigns' });
    }

    const orgId = session.activeOrganizationId;
    const { id } = req.params;
    let campaign = await globalCampaignStore.getCampaignById(id, orgId);
    if (!campaign) {
      return reply.status(404).send({ success: false, error: 'NOT_FOUND', message: 'Campaign not found' });
    }

    const body = req.body || {};
    const updated: CampaignDTO = {
      ...campaign,
      ...body,
      id: campaign.id,
      organizationId: campaign.organizationId,
      updatedAt: new Date().toISOString(),
    };

    await globalCampaignStore.saveCampaign(updated);

    return reply.send({
      success: true,
      campaign: updated,
      message: 'Campaign updated successfully',
    });
  });
}
