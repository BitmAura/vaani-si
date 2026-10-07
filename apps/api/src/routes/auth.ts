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
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { IdentityService } from '@vanni/auth';
import { logger } from '@vanni/observability';

const identityService = new IdentityService();

// In-memory session store (keyed by session token)
// In production this would be Redis/Supabase
const sessionStore = new Map<string, any>();

// Seed a default admin session so demo works without login
const DEMO_SESSION = {
  token: 'vanni-demo-admin-session-2026',
  userId: 'u0000000-0000-0000-0000-000000000001',
  email: 'admin@vanni.ai',
  fullName: 'VANNI Administrator',
  activeOrganizationId: 'a0000000-0000-0000-0000-000000000001',
  activeRole: 'OWNER',
  memberships: [
    {
      organizationId: 'a0000000-0000-0000-0000-000000000001',
      organizationName: 'Ballari Residential Layouts',
      organizationSlug: 'ballari-plots',
      role: 'OWNER',
      status: 'ACTIVE',
      onboardingStatus: 'ready',
    },
    {
      organizationId: 'a0000000-0000-0000-0000-000000000002',
      organizationName: 'Apollo Specialty Clinic',
      organizationSlug: 'apollo-clinic',
      role: 'OWNER',
      status: 'ACTIVE',
      onboardingStatus: 'ready',
    },
    {
      organizationId: 'a0000000-0000-0000-0000-000000000003',
      organizationName: 'Dr. Sneha Multispecialty Dental',
      organizationSlug: 'sneha-dental',
      role: 'OWNER',
      status: 'ACTIVE',
      onboardingStatus: 'ready',
    },
  ],
  createdAt: new Date().toISOString(),
};
sessionStore.set(DEMO_SESSION.token, DEMO_SESSION);

function getSessionFromRequest(req: FastifyRequest): any | null {
  // Check Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const session = sessionStore.get(token);
    if (session) return session;
  }

  // Check X-Session-Token header (used by frontend apps)
  const sessionToken = req.headers['x-session-token'] as string;
  if (sessionToken) {
    const session = sessionStore.get(sessionToken);
    if (session) return session;
  }

  // Check Cookie
  const cookieHeader = req.headers.cookie || '';
  const tokenMatch = cookieHeader.match(/vanni_session=([^;]+)/);
  if (tokenMatch) {
    const token = decodeURIComponent(tokenMatch[1]);
    const session = sessionStore.get(token);
    if (session) return session;
  }

  // Fallback to demo session for development
  if (process.env.NODE_ENV !== 'production') {
    return DEMO_SESSION;
  }

  return null;
}

export async function registerAuthRoutes(fastify: FastifyInstance) {
  // POST /api/auth/login
  fastify.post('/api/auth/login', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await identityService.login(req.body);
      logger.info('User successfully authenticated', { userId: result.user.id });

      // Build session object — generate token independently (AuthSessionDTO has no token field)
      const sessionToken = `vanni-session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const sessionData = {
        token: sessionToken,
        userId: result.user.id,
        email: (req.body as any).email,
        fullName: result.user.fullName,
        activeOrganizationId: result.session.activeOrganizationId,
        activeRole: result.session.activeRole || 'OWNER',
        memberships: result.session.memberships || DEMO_SESSION.memberships,
        createdAt: new Date().toISOString(),
      };

      // Store in session store
      sessionStore.set(sessionData.token, sessionData);

      // Set cookie for browser-based sessions
      reply.header(
        'Set-Cookie',
        `vanni_session=${encodeURIComponent(sessionData.token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`
      );

      return reply.send({
        success: true,
        session: sessionData,
        user: result.user,
        token: sessionData.token,
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
      const result = await identityService.signup(req.body);
      logger.info('User registered with organization', {
        userId: result.user.id,
        organizationId: result.organization.id,
      });

      const sessionData = {
        token: `vanni-session-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        userId: result.user.id,
        email: (req.body as any).email,
        fullName: result.user.fullName,
        activeOrganizationId: result.organization.id,
        activeRole: 'OWNER',
        memberships: [
          {
            organizationId: result.organization.id,
            organizationName: result.organization.name,
            organizationSlug: result.organization.slug,
            role: 'OWNER',
            status: 'ACTIVE',
            onboardingStatus: 'pending',
          },
        ],
        createdAt: new Date().toISOString(),
      };

      sessionStore.set(sessionData.token, sessionData);

      reply.header(
        'Set-Cookie',
        `vanni_session=${encodeURIComponent(sessionData.token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`
      );

      return reply.status(201).send({
        success: true,
        session: sessionData,
        user: result.user,
        organization: result.organization,
        token: sessionData.token,
      });
    } catch (err: any) {
      logger.warn('Registration failed', { error: err.message });
      const status = err.statusCode || 400;
      return reply.status(status).send({
        success: false,
        error: err.code || 'REGISTRATION_ERROR',
        message: err.message || 'Registration could not be completed.',
      });
    }
  });

  // GET /api/auth/me — Bearer token based
  fastify.get('/api/auth/me', async (req: FastifyRequest, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ success: false, error: 'MISSING_AUTHORIZATION' });
    }

    return reply.send({
      success: true,
      user: {
        id: session.userId,
        email: session.email,
        fullName: session.fullName,
      },
      activeOrganizationId: session.activeOrganizationId,
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
      session: {
        userId: session.userId,
        email: session.email,
        fullName: session.fullName,
        activeOrganizationId: session.activeOrganizationId,
        activeRole: session.activeRole,
        memberships: session.memberships,
      },
    });
  });

  // POST /api/auth/switch-org — Switch active organization
  fastify.post('/api/auth/switch-org', async (req: FastifyRequest, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ success: false, error: 'UNAUTHORIZED' });
    }

    const { organizationId } = req.body as { organizationId: string };
    if (!organizationId) {
      return reply.status(400).send({ success: false, error: 'MISSING_ORGANIZATION_ID' });
    }

    // Verify the user is a member of the requested org
    const membership = session.memberships?.find((m: any) => m.organizationId === organizationId);
    if (!membership) {
      return reply.status(403).send({ success: false, error: 'ACCESS_DENIED', message: 'You are not a member of this organization.' });
    }

    // Update session
    session.activeOrganizationId = organizationId;
    session.activeRole = membership.role;

    // Persist updated session
    if (session.token) {
      sessionStore.set(session.token, session);
    }

    logger.info('Organization switched', { userId: session.userId, newOrgId: organizationId });

    return reply.send({
      success: true,
      activeOrganizationId: organizationId,
      activeRole: membership.role,
      organizationName: membership.organizationName,
    });
  });

  // POST /api/auth/logout
  fastify.post('/api/auth/logout', async (req: FastifyRequest, reply: FastifyReply) => {
    const cookieHeader = req.headers.cookie || '';
    const tokenMatch = cookieHeader.match(/vanni_session=([^;]+)/);
    if (tokenMatch) {
      const token = decodeURIComponent(tokenMatch[1]);
      sessionStore.delete(token);
    }

    const sessionToken = req.headers['x-session-token'] as string;
    if (sessionToken) {
      sessionStore.delete(sessionToken);
    }

    // Clear cookie
    reply.header('Set-Cookie', 'vanni_session=; Path=/; Max-Age=0; HttpOnly');

    logger.info('User logged out');
    return reply.send({ success: true, message: 'Logged out successfully.' });
  });
}
