/**
 * @vanni/api — Organization Management Routes
 *
 * Provides:
 * - GET  /api/organization  - Get current org details
 * - GET  /api/orgs          - List all orgs for the user
 * - POST /api/orgs          - Create a new organization
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { globalDb } from '@vanni/database';
import { logger } from '@vanni/observability';
import crypto from 'node:crypto';

function getOrgId(req: FastifyRequest): string {
  return (req.headers['x-organization-id'] as string) || 'a0000000-0000-0000-0000-000000000001';
}

// Demo organization dataset for Karnataka
const DEMO_ORGS = [
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    name: 'Ballari Residential Layouts',
    slug: 'ballari-plots',
    industry: 'REAL_ESTATE',
    city: 'Ballari',
    state: 'Karnataka',
    phone: '+91 80 4719 2001',
    language: 'kn',
    agentName: 'Sahana',
    status: 'ACTIVE',
    billingTier: 'PRO',
    createdAt: '2026-01-15T09:00:00.000Z',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000002',
    name: 'Apollo Specialty Clinic',
    slug: 'apollo-clinic',
    industry: 'HEALTHCARE_HOSPITAL',
    city: 'Ballari',
    state: 'Karnataka',
    phone: '+91 83 5201 4500',
    language: 'kn',
    agentName: 'Kavya',
    status: 'ACTIVE',
    billingTier: 'GROWTH',
    createdAt: '2026-02-01T09:00:00.000Z',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000003',
    name: 'Dr. Sneha Multispecialty Dental',
    slug: 'sneha-dental',
    industry: 'DENTAL',
    city: 'Hosapete',
    state: 'Karnataka',
    phone: '+91 83 5210 7200',
    language: 'kn',
    agentName: 'Priya',
    status: 'ACTIVE',
    billingTier: 'STARTER',
    createdAt: '2026-03-10T09:00:00.000Z',
  },
];

export async function registerOrganizationRoutes(fastify: FastifyInstance) {
  // GET /api/organization — Current org details (used by app-agents.html)
  fastify.get('/api/organization', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const org = DEMO_ORGS.find(o => o.id === orgId) || DEMO_ORGS[0];

    return reply.send({
      success: true,
      organization: org,
    });
  });

  // GET /api/orgs — List all orgs (used by app-organization-select.html)
  fastify.get('/api/orgs', async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      success: true,
      organizations: DEMO_ORGS,
    });
  });

  // POST /api/orgs — Create a new organization (used by app-organization-create.html)
  fastify.post('/api/orgs', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any;
    if (!body || !body.name) {
      return reply.status(400).send({ success: false, error: 'MISSING_NAME', message: 'Organization name is required.' });
    }

    const newOrg = {
      id: `a${crypto.randomUUID()}`,
      name: body.name,
      slug: body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50),
      industry: body.industry || 'OTHER',
      city: body.city || 'Bengaluru',
      state: body.state || 'Karnataka',
      phone: body.phone || '',
      language: body.language || 'kn',
      agentName: body.agentName || 'Sahana',
      status: 'ACTIVE',
      billingTier: 'STARTER',
      createdAt: new Date().toISOString(),
    };

    DEMO_ORGS.push(newOrg);

    logger.info('New organization created', { name: newOrg.name, industry: newOrg.industry });

    return reply.status(201).send({
      success: true,
      organization: newOrg,
      redirectUrl: '/app/onboarding',
    });
  });
}
