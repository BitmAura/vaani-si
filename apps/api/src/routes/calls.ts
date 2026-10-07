/**
 * @vanni/api — Hardened Call Routes
 *
 * Enforces:
 * - Server-resolved tenant isolation
 * - RBAC permission check (call:read, call:write)
 * - Single source of truth (globalDb)
 * - Input validation
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { globalDb } from '@vanni/database';
import { PermissionService } from '@vanni/auth';
import { CallRecordDTO } from '@vanni/shared';

export async function registerCallRoutes(fastify: FastifyInstance) {
  // 1. GET /api/calls — Tenant-isolated call history
  fastify.get('/api/calls', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = PermissionService.resolveAuthContext(request.headers);
    if (!auth.isAuthenticated) {
      return reply.status(401).send({ success: false, error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    PermissionService.assertPermission(auth.role, 'call:read', 'List Calls');

    // Never accept tenantId from query params; use verified server session
    const calls = await globalDb.getCalls(auth.organizationId);
    return reply.send({ success: true, calls });
  });

  // 2. POST /api/calls/cdr — Save Call Detail Record
  fastify.post('/api/calls/cdr', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = PermissionService.resolveAuthContext(request.headers);
    if (!auth.isAuthenticated) {
      return reply.status(401).send({ success: false, error: 'UNAUTHORIZED' });
    }

    PermissionService.assertPermission(auth.role, 'call:write', 'Record Call Detail Record');

    const body = request.body as CallRecordDTO;
    if (!body || !body.id) {
      return reply.status(400).send({ success: false, error: 'INVALID_PAYLOAD', message: 'Call ID is required.' });
    }

    // Force organizationId to match authenticated tenant
    const securedCall: CallRecordDTO = {
      ...body,
      tenantId: auth.organizationId,
    };

    await globalDb.saveCall(securedCall);
    return reply.send({ success: true, savedId: securedCall.id });
  });
}
