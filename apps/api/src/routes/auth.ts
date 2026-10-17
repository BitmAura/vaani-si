/**
 * @vanni/api — Authentication & Identity Routes
 *
 * Provides:
 * - POST /api/auth/login       - Login with email/password
 * - POST /api/auth/signup      - Register new user + organization
 * - GET  /api/auth/me          - Get current user (Bearer token)
 * - GET  /api/auth/session     - Get current session (used by console & apps)
 * - POST /api/auth/switch-org  - Switch active organization
 * - POST /api/auth/logout      - Clear session
 *
 * SECURITY: All sessions use HMAC-SHA256 cryptographic signatures via serializeSession / deserializeSession.
 * No hardcoded DEMO_SESSION fallback or unauthenticated backdoor exists.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { IdentityService, deserializeSession, serializeSession, switchActiveOrganization, SESSION_COOKIE_NAME } from '@vanni/auth';
import { logger } from '@vanni/observability';
import { AuthSessionDTO } from '@vanni/shared';

const identityService = new IdentityService();

export function getSessionFromRequest(req: FastifyRequest): AuthSessionDTO | null {
  let token: string | undefined;

  // 1. Check Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  // 2. Check X-Session-Token header (used by frontend apps)
  if (!token && req.headers['x-session-token']) {
    token = (req.headers['x-session-token'] as string).trim();
  }

  // 3. Check Cookie
  if (!token && req.headers.cookie) {
    const cookieHeader = Array.isArray(req.headers.cookie) ? req.headers.cookie.join('; ') : req.headers.cookie;
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
    if (match && match[1]) {
      token = decodeURIComponent(match[1]);
    }
  }

  if (!token) return null;

  return deserializeSession(token);
}

export async function registerAuthRoutes(fastify: FastifyInstance) {
  // POST /api/auth/login
  fastify.post('/api/auth/login', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await identityService.login(req.body);
      logger.info('User successfully authenticated', { userId: result.user.id });

      const token = serializeSession(result.session);

      // Set secure signed cookie for browser-based sessions
      const isProd = process.env.NODE_ENV === 'production';
      reply.header(
        'Set-Cookie',
        `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${isProd ? '; Secure' : ''}`
      );

      return reply.send({
        success: true,
        session: result.session,
        user: result.user,
        token,
      });
    } catch (err: any) {
      logger.warn('Authentication failed', { error: err.message });
      const status = err.statusCode || 401;
      return reply.status(status).send({
        success: false,
        error: err.code || 'UNAUTHORIZED',
        message: err.message || 'Invalid email or password.',
      });
    }
  });

  // POST /api/auth/signup
  fastify.post('/api/auth/signup', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = (req.body as any) || {};
      const payload = {
        ...body,
        organizationName: body.organizationName || body.companyName || 'My Organization',
        fullName: body.fullName || (body.email ? body.email.split('@')[0] : 'Administrator'),
        industry: body.industry || 'REAL_ESTATE',
      };

      const result = await identityService.signup(payload);
      logger.info('User registered with organization', {
        userId: result.user.id,
        organizationId: result.organization.id,
      });

      const token = serializeSession(result.session);

      const isProd = process.env.NODE_ENV === 'production';
      reply.header(
        'Set-Cookie',
        `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${isProd ? '; Secure' : ''}`
      );

      return reply.status(201).send({
        success: true,
        session: result.session,
        user: result.user,
        organization: result.organization,
        token,
      });
    } catch (err: any) {
      logger.warn('Signup registration failed', { error: err.message });
      const status = err.statusCode || 400;
      return reply.status(status).send({
        success: false,
        error: err.code || 'VALIDATION_ERROR',
        message: err.message || 'Signup failed.',
      });
    }
  });

  // GET /api/auth/me — Bearer token or session based
  fastify.get('/api/auth/me', async (req: FastifyRequest, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);

    if (!session) {
      return reply.status(401).send({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Valid session or Bearer token is required.',
      });
    }

    return reply.send({
      success: true,
      user: {
        id: session.userId,
        email: session.email,
        fullName: session.fullName,
      },
      activeOrganizationId: session.activeOrganizationId,
      activeRole: session.activeRole,
    });
  });

  // GET /api/auth/session — Used by console.html, app-onboarding.html, etc.
  fastify.get('/api/auth/session', async (req: FastifyRequest, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);

    if (!session) {
      return reply.send({
        authenticated: false,
        session: null,
      });
    }

    return reply.send({
      authenticated: true,
      session,
    });
  });

  // POST /api/auth/switch-org — Switch active organization
  fastify.post('/api/auth/switch-org', async (req: FastifyRequest, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ success: false, error: 'UNAUTHORIZED', message: 'Authentication required.' });
    }

    const { organizationId } = req.body as { organizationId: string };
    if (!organizationId) {
      return reply.status(400).send({ success: false, error: 'MISSING_ORGANIZATION_ID', message: 'organizationId is required.' });
    }

    try {
      const updated = switchActiveOrganization(session, organizationId);
      const token = serializeSession(updated);

      const isProd = process.env.NODE_ENV === 'production';
      reply.header(
        'Set-Cookie',
        `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${isProd ? '; Secure' : ''}`
      );

      logger.info('Organization switched', { userId: session.userId, newOrgId: organizationId });

      return reply.send({
        success: true,
        session: updated,
        activeOrganizationId: updated.activeOrganizationId,
        activeRole: updated.activeRole,
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 403).send({
        success: false,
        error: err.code || 'ACCESS_DENIED',
        message: err.message,
      });
    }
  });

  // POST /api/auth/logout
  fastify.post('/api/auth/logout', async (_req: FastifyRequest, reply: FastifyReply) => {
    // Clear cookie
    reply.header('Set-Cookie', `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
    logger.info('User logged out');
    return reply.send({ success: true, message: 'Logged out successfully.' });
  });
}
