import { PermissionService } from '@vanni/auth';
/**
 * @vanni/api — Agent Management Routes
 *
 * Provides:
 * - GET    /api/agents              - List AI agents for tenant
 * - POST   /api/agents              - Create new AI agent
 * - GET    /api/agents/:id          - Get agent by ID
 * - PUT    /api/agents/:id          - Update agent
 * - DELETE /api/agents/:id          - Delete agent
 * - POST   /api/agents/:id/publish  - Publish agent live
 * - GET    /api/agents/:id/test     - Get test conversation
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { INDUSTRY_TEMPLATES } from '@vanni/industry-templates';
import { logger } from '@vanni/observability';

function getOrgId(req: FastifyRequest): string {
  const auth = PermissionService.resolveAuthContext(req.headers);
  return auth.organizationId || '';
}

// In-memory agent store (seeded with 3 Karnataka businesses)
const agentStore = new Map<string, any[]>();

agentStore.set('a0000000-0000-0000-0000-000000000001', [
  {
    id: 'agent-sahana-001',
    organizationId: 'a0000000-0000-0000-0000-000000000001',
    name: 'Sahana',
    role: 'Real Estate Receptionist & Lead Qualifier',
    language: 'kn',
    voiceProvider: 'sarvam-ai',
    voiceId: 'sarvam-kannada-female-1',
    status: 'LIVE',
    systemPrompt: 'Neevu VANNI AI employee Sahana. Ballari Residential Layouts ge call bantha yaaranna professional agi welcome madkobeeku. 30x40, 40x60 plots, BUDA approval, bank loan help maadi lead qualify madabeeku.',
    personality: { tone: 'WARM_PROFESSIONAL', responseLength: 'CONCISE', formality: 'SEMI_FORMAL' },
    capabilities: ['LEAD_CAPTURE', 'APPOINTMENT_BOOKING', 'FAQ_ANSWERING', 'WHATSAPP_DISPATCH'],
    callsHandled: 1248,
    leadsConverted: 384,
    avgSatisfaction: 4.7,
    createdAt: '2026-01-15T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
  },
]);

agentStore.set('a0000000-0000-0000-0000-000000000002', [
  {
    id: 'agent-kavya-001',
    organizationId: 'a0000000-0000-0000-0000-000000000002',
    name: 'Kavya',
    role: 'Medical Receptionist & Appointment Coordinator',
    language: 'kn',
    voiceProvider: 'sarvam-ai',
    voiceId: 'sarvam-kannada-female-2',
    status: 'LIVE',
    systemPrompt: 'Neevu VANNI AI employee Kavya. Apollo Specialty Clinic ge call bantha rogigalanna professional agi welcome madkobeeku. Doctor appointments book maadi.',
    personality: { tone: 'EMPATHETIC_CARING', responseLength: 'MODERATE', formality: 'PROFESSIONAL' },
    capabilities: ['APPOINTMENT_BOOKING', 'FAQ_ANSWERING', 'HUMAN_HANDOFF'],
    callsHandled: 842,
    leadsConverted: 621,
    avgSatisfaction: 4.8,
    createdAt: '2026-02-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
  },
]);

agentStore.set('a0000000-0000-0000-0000-000000000003', [
  {
    id: 'agent-priya-001',
    organizationId: 'a0000000-0000-0000-0000-000000000003',
    name: 'Priya',
    role: 'Dental Clinic Receptionist',
    language: 'kn',
    voiceProvider: 'sarvam-ai',
    voiceId: 'sarvam-kannada-female-1',
    status: 'LIVE',
    systemPrompt: 'Neevu VANNI AI employee Priya. Dr. Sneha Dental Clinic ge call bantha rogigalanna professional agi welcome madkobeeku.',
    personality: { tone: 'FRIENDLY_PROFESSIONAL', responseLength: 'CONCISE', formality: 'SEMI_FORMAL' },
    capabilities: ['APPOINTMENT_BOOKING', 'FAQ_ANSWERING', 'LEAD_CAPTURE'],
    callsHandled: 563,
    leadsConverted: 412,
    avgSatisfaction: 4.6,
    createdAt: '2026-03-10T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
  },
]);

export async function registerAgentRoutes(fastify: FastifyInstance) {
  // GET /api/agents
  fastify.get('/api/agents', async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = PermissionService.resolveAuthContext(req.headers);
    if (!auth.isAuthenticated) {
      return reply.status(401).send({ success: false, error: 'UNAUTHORIZED' });
    }
    const orgId = auth.organizationId;
    const agents = agentStore.get(orgId) || [];
    return reply.send({
      success: true,
      agents,
      total: agents.length,
      templates: Object.values(INDUSTRY_TEMPLATES),
    });
  });

  // POST /api/agents
  fastify.post('/api/agents', async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = PermissionService.resolveAuthContext(req.headers);
    if (!auth.isAuthenticated) {
      return reply.status(401).send({ success: false, error: 'UNAUTHORIZED' });
    }
    const orgId = auth.organizationId;
    const body = req.body as any;
    if (!body?.name) {
      return reply.status(400).send({ success: false, error: 'MISSING_NAME' });
    }
    const agents = agentStore.get(orgId) || [];
    const newAgent = {
      id: `agent-${Date.now()}`,
      organizationId: orgId,
      name: body.name,
      role: body.role || 'AI Receptionist',
      language: body.language || 'kn',
      voiceProvider: body.voiceProvider || 'sarvam-ai',
      voiceId: body.voiceId || 'sarvam-kannada-female-1',
      status: 'DRAFT',
      systemPrompt: body.systemPrompt || '',
      personality: body.personality || { tone: 'WARM_PROFESSIONAL', responseLength: 'CONCISE', formality: 'SEMI_FORMAL' },
      capabilities: body.capabilities || ['FAQ_ANSWERING', 'LEAD_CAPTURE'],
      callsHandled: 0,
      leadsConverted: 0,
      avgSatisfaction: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    agents.push(newAgent);
    agentStore.set(orgId, agents);
    logger.info('Agent created', { agentId: newAgent.id, orgId });
    return reply.status(201).send({ success: true, agent: newAgent });
  });

  // GET /api/agents/:id
  fastify.get('/api/agents/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const { id } = req.params as { id: string };
    const agent = (agentStore.get(orgId) || []).find(a => a.id === id);
    if (!agent) return reply.status(404).send({ success: false, error: 'NOT_FOUND' });
    return reply.send({ success: true, agent });
  });

  // PUT /api/agents/:id
  fastify.put('/api/agents/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const { id } = req.params as { id: string };
    const body = req.body as any;
    const agents = agentStore.get(orgId) || [];
    const idx = agents.findIndex(a => a.id === id);
    if (idx === -1) return reply.status(404).send({ success: false, error: 'NOT_FOUND' });
    agents[idx] = { ...agents[idx], ...body, id, organizationId: orgId, updatedAt: new Date().toISOString() };
    agentStore.set(orgId, agents);
    return reply.send({ success: true, agent: agents[idx] });
  });

  // DELETE /api/agents/:id
  fastify.delete('/api/agents/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const { id } = req.params as { id: string };
    agentStore.set(orgId, (agentStore.get(orgId) || []).filter(a => a.id !== id));
    return reply.send({ success: true, message: 'Agent deleted.' });
  });

  // POST /api/agents/:id/publish
  fastify.post('/api/agents/:id/publish', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const { id } = req.params as { id: string };
    const agent = (agentStore.get(orgId) || []).find(a => a.id === id);
    if (!agent) return reply.status(404).send({ success: false, error: 'NOT_FOUND' });
    agent.status = 'LIVE';
    agent.publishedAt = new Date().toISOString();
    logger.info('Agent published LIVE', { agentId: id, orgId });
    return reply.send({ success: true, agent, message: `${agent.name} is now LIVE!` });
  });

  // GET /api/agents/:id/test
  fastify.get('/api/agents/:id/test', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const { id } = req.params as { id: string };
    const agent = (agentStore.get(orgId) || []).find(a => a.id === id);
    if (!agent) return reply.status(404).send({ success: false, error: 'NOT_FOUND' });
    return reply.send({
      success: true,
      testConversation: [
        { speaker: agent.name, text: `Namaskara! Naanu ${agent.name}, ${agent.role}. Neeru yenu madabahudhu?` },
        { speaker: 'Caller', text: 'Hello, appointment beku.' },
        { speaker: agent.name, text: 'Khanditha! Yaavaga barthira? Naale 4 PM slot available ide.' },
        { speaker: 'Caller', text: 'Naale fine.' },
        { speaker: agent.name, text: 'Perfect! Nimmadu hesaru mathu phone number heli, confirm maduthini.' },
      ],
    });
  });
}
