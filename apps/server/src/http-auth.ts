/**
 * Shared HTTP authentication & tenant-scope resolution for route plugins.
 *
 * SECURITY: every route plugin must derive its tenant scope from the
 * authenticated session — never from a client-supplied `tenantId` query/body
 * parameter and never from a hardcoded demo tenant fallback.
 */

import { FastifyRequest } from 'fastify';
import { AuthSessionDTO } from '@vanni/shared';
import { SESSION_COOKIE_NAME, deserializeSession, requireUser } from '@vanni/auth';

/**
 * Extracts the session from the vanni_session cookie or an Authorization: Bearer
 * token. Returns null when neither carries a valid, signed session.
 */
export function getSessionFromRequest(req: FastifyRequest): AuthSessionDTO | null {
  const cookieToken = (req as any).cookies?.[SESSION_COOKIE_NAME];
  if (cookieToken) {
    const session = deserializeSession(cookieToken);
    if (session) return session;
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const session = deserializeSession(authHeader.slice(7).trim());
    if (session) return session;
  }

  return null;
}

/**
 * Resolves the tenant context strictly from the authenticated session.
 * Throws UnauthorizedError (401) for anonymous callers.
 */
export function requireTenantContext(request: FastifyRequest): { tenantId: string; userId: string } {
  const session = requireUser(getSessionFromRequest(request));
  return {
    tenantId: session.activeOrganizationId,
    userId: session.userId,
  };
}
