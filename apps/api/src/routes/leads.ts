/**
 * @vanni/api — Hardened CRM & Leads Route
 *
 * Enforces:
 * - Server-resolved tenant isolation
 * - RBAC permission check (lead:read, lead:write)
 * - Single source of truth (globalDb)
 * - Input validation
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { globalDb } from '@vanni/database';
import { PermissionService } from '@vanni/auth';
import { LeadDossierDTO } from '@vanni/shared';

export async function registerLeadRoutes(fastify: FastifyInstance) {
  // 1. GET /api/leads — Fetch tenant-isolated leads
  fastify.get('/api/leads', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = PermissionService.resolveAuthContext(request.headers);
    if (!auth.isAuthenticated) {
      return reply.status(401).send({ success: false, error: 'UNAUTHORIZED' });
    }

    PermissionService.assertPermission(auth.role, 'lead:read', 'List Leads');

    // Never accept tenantId from query params; strictly use verified server session
    const leads = await globalDb.getLeads(auth.organizationId);
    return reply.send({ success: true, leads });
  });

  // 2. POST /api/leads — Save or update lead
  fastify.post('/api/leads', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = PermissionService.resolveAuthContext(request.headers);
    if (!auth.isAuthenticated) {
      return reply.status(401).send({ success: false, error: 'UNAUTHORIZED' });
    }

    PermissionService.assertPermission(auth.role, 'lead:write', 'Create Lead');

    const body = request.body as LeadDossierDTO;
    if (!body || !body.id) {
      return reply.status(400).send({ success: false, error: 'INVALID_PAYLOAD', message: 'Lead ID is required.' });
    }

    // Force tenantId to match authenticated session
    const securedLead: LeadDossierDTO = {
      ...body,
      tenantId: auth.organizationId,
    };

    await globalDb.saveLead(securedLead);
    return reply.send({ success: true, savedId: securedLead.id });
  });
}
