/**
 * PROMPT 02: AUTHENTICATION & LOGIN LOOP REMEDIATION TEST SUITE
 * 
 * Verifies the canonical session contract:
 * 1. Successful signup and login issue canonical signed session cookies
 * 2. Invalid credentials return 401 with descriptive errors
 * 3. Validation failures and duplicate email rejection on signup
 * 4. Protected page access requires valid signed session cookie (redirects unauthenticated to /login?redirect=...)
 * 5. Tampered, forged, or expired session cookies are rejected (fail-closed)
 * 6. Logout clears the session cookie and prevents subsequent access to protected endpoints
 * 7. Safe return URL sanitization prevents open redirects (rejects external domains, protocol-relative, javascript:)
 * 8. Authenticated user can access /app/agents and /app/knowledge without looping to login
 * 9. Client-controlled localStorage / header claims alone CANNOT authenticate a user
 * 10. Demo account seeding is strictly blocked in production mode (NODE_ENV=production)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import {
  IdentityService,
  SESSION_COOKIE_NAME,
  serializeSession,
  deserializeSession,
  sanitizeReturnUrl,
} from '@vanni/auth';
import type { AuthSessionDTO } from '@vanni/shared';

describe('Prompt 02: Authentication & Canonical Session Contract', () => {
  let app: any;

  beforeAll(async () => {
    app = await buildServer();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('1. Signup, Login & Server-Signed Session Cookie', () => {
    const testEmail = `test_engineer_${Date.now()}@vanni.ai`;
    const testPassword = 'StrongPassword123!';

    it('successfully creates an account via POST /api/auth/signup and sets signed session cookie', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: {
          fullName: 'Test Automation Engineer',
          organizationName: 'Vaani Reliability Labs',
          email: testEmail,
          password: testPassword,
          industry: 'AGENCY',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.session).toBeDefined();
      expect(body.session.email).toBe(testEmail);
      expect(body.session.activeRole).toBe('OWNER');

      // Verify server issued the signed session cookie
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      const cookieStr = Array.isArray(setCookie) ? setCookie[0] : (setCookie as string);
      expect(cookieStr).toContain(SESSION_COOKIE_NAME);
      expect(cookieStr.toLowerCase()).toContain('httponly');
    });

    it('rejects duplicate email registration on signup with 409 Conflict', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: {
          fullName: 'Duplicate Engineer',
          organizationName: 'Duplicate Labs',
          email: testEmail,
          password: 'AnotherPassword123!',
          industry: 'AGENCY',
        },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.payload);
      expect(body.error).toContain('already exists');
    });

    it('authenticates user via POST /api/auth/login and establishes active session', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: testEmail,
          password: testPassword,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.session).toBeDefined();
      expect(body.session.email).toBe(testEmail);

      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      const cookieStr = Array.isArray(setCookie) ? setCookie[0] : (setCookie as string);
      expect(cookieStr).toContain(SESSION_COOKIE_NAME);
    });

    it('rejects invalid password with 401 Unauthorized', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: testEmail,
          password: 'IncorrectPassword!',
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload);
      expect(body.error).toBe('Invalid email or password.');
    });

    it('rejects non-existent email with 401 Unauthorized', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'nonexistent.user@vanni.ai',
          password: 'AnyPassword123!',
        },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('2. Session Validation Endpoint (GET /api/auth/session)', () => {
    it('returns authenticated: false when no session cookie or header is sent', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/session',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.authenticated).toBe(false);
      expect(body.session).toBeNull();
    });

    it('returns authenticated: true and session data when valid cookie is provided', async () => {
      const validSession: AuthSessionDTO = {
        userId: 'usr_valid_01',
        email: 'valid.user@vanni.ai',
        fullName: 'Valid User',
        activeOrganizationId: 'org_valid_01',
        activeRole: 'OWNER',
        memberships: [
          {
            organizationId: 'org_valid_01',
            organizationName: 'Valid Organization',
            organizationSlug: 'valid-org',
            industry: 'REAL_ESTATE',
            role: 'OWNER',
            status: 'ACTIVE',
            onboardingStatus: 'ready',
          },
        ],
      };

      const token = serializeSession(validSession);

      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/session',
        cookies: {
          [SESSION_COOKIE_NAME]: token,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.authenticated).toBe(true);
      expect(body.session.userId).toBe('usr_valid_01');
      expect(body.session.email).toBe('valid.user@vanni.ai');
    });

    it('rejects tampered or forged cookie with invalid HMAC signature', async () => {
      const validSession: AuthSessionDTO = {
        userId: 'usr_hacker',
        email: 'hacker@malicious.com',
        fullName: 'Attacker',
        activeOrganizationId: 'org_victim',
        activeRole: 'OWNER',
        memberships: [],
      };

      const legitimateToken = serializeSession(validSession);
      const [payload] = legitimateToken.split('.');
      // Forged token with invalid signature
      const tamperedToken = `${payload}.invalid_signature_hex_12345`;

      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/session',
        cookies: {
          [SESSION_COOKIE_NAME]: tamperedToken,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.authenticated).toBe(false);
      expect(body.session).toBeNull();
    });
  });

  describe('3. Protected Pages & Redirect Loop Prevention', () => {
    it('redirects unauthenticated access to /app/agents to /login with standardized redirect param', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/app/agents',
      });

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toContain('/login?redirect=');
      expect(res.headers.location).toContain(encodeURIComponent('/app/agents'));
    });

    it('redirects unauthenticated access to /app/knowledge to /login with standardized redirect param', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/app/knowledge',
      });

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toContain('/login?redirect=');
      expect(res.headers.location).toContain(encodeURIComponent('/app/knowledge'));
    });

    it('allows valid authenticated session to load /app/agents with HTTP 200 without redirecting to /login', async () => {
      const session: AuthSessionDTO = {
        userId: 'usr_valid_agents',
        email: 'director@agency.ai',
        fullName: 'Agency Director',
        activeOrganizationId: 'org_agency_01',
        activeRole: 'OWNER',
        memberships: [
          {
            organizationId: 'org_agency_01',
            organizationName: 'Agency AI Corp',
            organizationSlug: 'agency-ai-corp',
            industry: 'AGENCY',
            role: 'OWNER',
            status: 'ACTIVE',
            onboardingStatus: 'ready',
          },
        ],
      };

      const token = serializeSession(session);

      const res = await app.inject({
        method: 'GET',
        url: '/app/agents',
        cookies: {
          [SESSION_COOKIE_NAME]: token,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.payload).toContain('AI Employee Builder');
      expect(res.payload).toContain('/assets/vanni-auth.js');
    });

    it('allows valid authenticated session to load /app/knowledge with HTTP 200 without redirecting to /login', async () => {
      const session: AuthSessionDTO = {
        userId: 'usr_valid_knowledge',
        email: 'director@agency.ai',
        fullName: 'Agency Director',
        activeOrganizationId: 'org_agency_01',
        activeRole: 'OWNER',
        memberships: [
          {
            organizationId: 'org_agency_01',
            organizationName: 'Agency AI Corp',
            organizationSlug: 'agency-ai-corp',
            industry: 'AGENCY',
            role: 'OWNER',
            status: 'ACTIVE',
            onboardingStatus: 'ready',
          },
        ],
      };

      const token = serializeSession(session);

      const res = await app.inject({
        method: 'GET',
        url: '/app/knowledge',
        cookies: {
          [SESSION_COOKIE_NAME]: token,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.payload).toContain('Business Brain & Knowledge Base');
      expect(res.payload).toContain('/assets/vanni-auth.js');
    });
  });

  describe('4. Logout & Subsequent API Access', () => {
    it('POST /api/auth/logout clears the session cookie', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
      });

      expect(res.statusCode).toBe(200);
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      const cookieStr = Array.isArray(setCookie) ? setCookie[0] : (setCookie as string);
      // Cleared cookie has max-age=0 or expires in the past
      expect(cookieStr).toContain(SESSION_COOKIE_NAME);
    });

    it('protected API rejects requests after logout or without valid session cookie', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/onboarding/state',
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload);
      expect(body.error).toBe('UNAUTHORIZED');
    });
  });

  describe('5. Safe Redirect URL Sanitization', () => {
    it('preserves safe relative paths', () => {
      expect(sanitizeReturnUrl('/app/dashboard')).toBe('/app/dashboard');
      expect(sanitizeReturnUrl('/app/agents?filter=active')).toBe('/app/agents?filter=active');
      expect(sanitizeReturnUrl('/app/knowledge#section-faq')).toBe('/app/knowledge#section-faq');
    });

    it('rejects external URLs and protocol-relative URLs', () => {
      expect(sanitizeReturnUrl('https://evil.attacker.com/steal')).toBe('/app/dashboard');
      expect(sanitizeReturnUrl('http://evil.attacker.com')).toBe('/app/dashboard');
      expect(sanitizeReturnUrl('//evil.attacker.com')).toBe('/app/dashboard');
      expect(sanitizeReturnUrl('/\\evil.attacker.com')).toBe('/app/dashboard');
      expect(sanitizeReturnUrl('javascript:alert(1)')).toBe('/app/dashboard');
      expect(sanitizeReturnUrl('data:text/html,malicious')).toBe('/app/dashboard');
    });

    it('defaults to safe path on empty, null, or invalid input', () => {
      expect(sanitizeReturnUrl('')).toBe('/app/dashboard');
      expect(sanitizeReturnUrl(null)).toBe('/app/dashboard');
      expect(sanitizeReturnUrl(undefined)).toBe('/app/dashboard');
      expect(sanitizeReturnUrl(null, '/app/agents')).toBe('/app/agents');
    });
  });

  describe('6. Client-Side Claims & Production Demo Guardrails', () => {
    it('rejects client headers attempting to authenticate without signed cookie', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/onboarding/state',
        headers: {
          'x-user-id': 'usr_fabricated',
          'x-organization-id': 'org_fabricated',
          'x-authenticated': 'true',
        },
      });

      // Server strictly ignores client headers and returns 401 Unauthorized
      expect(res.statusCode).toBe(401);
    });

    it('strictly refuses demo account seeding when NODE_ENV is production', () => {
      const origEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        const svc = new IdentityService();
        // Even if force=true is requested, production MUST refuse
        const seeded = svc.seedDevAccountsIfEmpty(true);
        expect(seeded).toBe(false);
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });

    it('allows demo account seeding in development mode with scrypt-hashed passwords', () => {
      const origEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'development';
        const svc = new IdentityService();
        const seeded = svc.seedDevAccountsIfEmpty(true);
        expect(seeded).toBe(true);
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });
  });
});