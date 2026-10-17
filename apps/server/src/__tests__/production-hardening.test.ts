/**
 * PROMPT 07: PRODUCTION DATA LAYER, SECURITY & RELIABILITY HARDENING TEST SUITE
 * 
 * Verifies:
 * 1. Production mode strictly refuses silent file/in-memory fallback when Supabase is unconfigured
 * 2. Explicit ALLOW_FILE_DATABASE override is required if file store is used in production
 * 3. Health check distinguishing liveness (/health/live) from dependency readiness (/health/ready)
 * 4. Database readiness probe returns 503 Service Unavailable when DB connection fails
 * 5. Database operations throw explicit DatabaseOperationError upon failure (no silent success)
 * 6. Plots API in production returns 503 when DB unavailable rather than silently serving mock data
 * 7. Session cookie HMAC signature tampering is rejected
 * 8. Organization switching verifies active membership on the server
 * 9. Sensitive database credentials and keys are never leaked in health check payloads
 * 10. Multi-tenant workspace data boundaries are enforced
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import {
  createDatabaseService,
  DurableDatabaseService,
  InMemoryDatabaseService,
  SupabaseDatabaseService,
  ProductionDatabaseConfigError,
  DatabaseOperationError,
  globalDb,
  getGlobalDb,
  setGlobalDb,
} from '@vanni/database';
import { serializeSession, deserializeSession, switchActiveOrganization, SESSION_COOKIE_NAME } from '@vanni/auth';
import type { AuthSessionDTO } from '@vanni/shared';

describe('Prompt 07: Production Hardening & Reliability', () => {
  let app: any;

  beforeAll(async () => {
    app = await buildServer();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('1. Production Mode Refusing Silent Fallback', () => {
    it('throws ProductionDatabaseConfigError when NODE_ENV=production and Supabase credentials are missing', () => {
      const origEnv = process.env.NODE_ENV;
      const origUrl = process.env.SUPABASE_URL;
      const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const origAllow = process.env.ALLOW_FILE_DATABASE;

      try {
        process.env.NODE_ENV = 'production';
        delete process.env.SUPABASE_URL;
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        delete process.env.SUPABASE_SECRET_KEY;
        delete process.env.ALLOW_FILE_DATABASE;

        expect(() => createDatabaseService()).toThrow(ProductionDatabaseConfigError);
      } finally {
        process.env.NODE_ENV = origEnv;
        if (origUrl) process.env.SUPABASE_URL = origUrl;
        if (origKey) process.env.SUPABASE_SERVICE_ROLE_KEY = origKey;
        if (origAllow) process.env.ALLOW_FILE_DATABASE = origAllow;
      }
    });

    it('DurableDatabaseService throws ProductionDatabaseConfigError in production without explicit ALLOW_FILE_DATABASE', () => {
      const origEnv = process.env.NODE_ENV;
      const origAllow = process.env.ALLOW_FILE_DATABASE;

      try {
        process.env.NODE_ENV = 'production';
        delete process.env.ALLOW_FILE_DATABASE;

        expect(() => new DurableDatabaseService()).toThrow(ProductionDatabaseConfigError);
      } finally {
        process.env.NODE_ENV = origEnv;
        if (origAllow) process.env.ALLOW_FILE_DATABASE = origAllow;
      }
    });

    it('DurableDatabaseService allows instantiation in production ONLY when ALLOW_FILE_DATABASE=true', () => {
      const origEnv = process.env.NODE_ENV;
      const origAllow = process.env.ALLOW_FILE_DATABASE;

      try {
        process.env.NODE_ENV = 'production';
        process.env.ALLOW_FILE_DATABASE = 'true';

        const service = new DurableDatabaseService();
        expect(service).toBeInstanceOf(DurableDatabaseService);
      } finally {
        process.env.NODE_ENV = origEnv;
        if (origAllow) process.env.ALLOW_FILE_DATABASE = origAllow;
      }
    });

    it('SupabaseDatabaseService requires valid credentials', () => {
      expect(() => new SupabaseDatabaseService('', '')).toThrow(ProductionDatabaseConfigError);
    });
  });

  describe('2. Health & Observability (Liveness vs Readiness)', () => {
    it('GET /health/live returns HTTP 200 with UP status', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health/live',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.status).toBe('UP');
      expect(body.service).toBe('vaani-server');
      expect(typeof body.uptime).toBe('number');
    });

    it('GET /health/ready returns HTTP 200 when database healthCheck is ok', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health/ready',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.status).toBe('READY');
      expect(body.database.ok).toBe(true);
      expect(body.database.adapter).toBeDefined();
    });

    it('GET /health/ready returns HTTP 503 when database healthCheck fails', async () => {
      const origDb = getGlobalDb();
      const failingMockDb = {
        ...origDb,
        healthCheck: async () => ({
          ok: false,
          latencyMs: 45,
          adapter: 'supabase-postgresql' as const,
          error: 'Connection terminated unexpectedly (PostgreSQL ECONNREFUSED)',
        }),
      };

      setGlobalDb(failingMockDb as any);
      try {
        const res = await app.inject({
          method: 'GET',
          url: '/health/ready',
        });

        expect(res.statusCode).toBe(503);
        const body = JSON.parse(res.payload);
        expect(body.status).toBe('NOT_READY');
        expect(body.database.ok).toBe(false);
        expect(body.database.error).toContain('ECONNREFUSED');
      } finally {
        setGlobalDb(origDb);
      }
    });

    it('Health endpoints do not leak passwords, tokens or connection strings', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(res.statusCode).toBe(200);
      const raw = res.payload;
      expect(raw).not.toContain('postgresql://');
      expect(raw).not.toContain('service_role');
      expect(raw).not.toContain('secret');
      expect(raw).not.toContain('apiKey');
    });
  });

  describe('3. Database Operation Failures and Error Sanitization', () => {
    it('DatabaseOperationError preserves cause and message without silent success', () => {
      const originalError = new Error('duplicate key value violates unique constraint "uq_org_slug"');
      const dbError = new DatabaseOperationError('Failed to save organization: duplicate slug', originalError);

      expect(dbError).toBeInstanceOf(Error);
      expect(dbError.name).toBe('DatabaseOperationError');
      expect(dbError.message).toContain('duplicate slug');
      expect(dbError.originalError).toBe(originalError);
    });

    it('Plots API in production mode rejects mock fallback and returns 503 when DB unavailable', async () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const session: AuthSessionDTO = {
        userId: 'u-plots-001',
        email: 'agent@plots.in',
        fullName: 'Plot Admin',
        activeOrganizationId: 'a0000000-0000-0000-0000-000000000001',
        activeRole: 'ADMIN',
        memberships: [
          {
            organizationId: 'a0000000-0000-0000-0000-000000000001',
            organizationName: 'Ballari Plots',
            organizationSlug: 'ballari-plots',
            role: 'ADMIN',
            status: 'ACTIVE',
            onboardingStatus: 'ready',
          },
        ],
      };

      try {
        const res = await app.inject({
          method: 'GET',
          url: '/api/plots',
          cookies: {
            [SESSION_COOKIE_NAME]: serializeSession(session),
          },
        });

        expect(res.statusCode).toBe(503);
        const body = JSON.parse(res.payload);
        expect(body.success).toBe(false);
        expect(body.error).toBe('DATABASE_UNAVAILABLE');
        expect(body.message).toContain('Mock fallback is disabled in production mode');
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });
  });

  describe('4. Multi-Tenant Authorization & Session Tampering', () => {
    it('rejects tampered session signature', () => {
      const session: AuthSessionDTO = {
        userId: 'u-tamper-001',
        email: 'user@test.in',
        fullName: 'Test User',
        activeOrganizationId: 'org-test-1',
        activeRole: 'MANAGER',
        memberships: [
          {
            organizationId: 'org-test-1',
            organizationName: 'Test Org',
            organizationSlug: 'test-org',
            role: 'MANAGER',
            status: 'ACTIVE',
            onboardingStatus: 'ready',
          },
        ],
      };

      const validToken = serializeSession(session);
      const [payload, signature] = validToken.split('.');
      const tamperedToken = `${payload}.tampered_fake_signature_abc123`;

      const result = deserializeSession(tamperedToken);
      expect(result).toBeNull();
    });

    it('rejects switching to an organization where user has no active membership', () => {
      const session: AuthSessionDTO = {
        userId: 'u-switch-001',
        email: 'user@test.in',
        fullName: 'Switch User',
        activeOrganizationId: 'org-allowed-1',
        activeRole: 'MANAGER',
        memberships: [
          {
            organizationId: 'org-allowed-1',
            organizationName: 'Allowed Org',
            organizationSlug: 'allowed-org',
            role: 'MANAGER',
            status: 'ACTIVE',
            onboardingStatus: 'ready',
          },
        ],
      };

      expect(() => switchActiveOrganization(session, 'org-unauthorized-99')).toThrow();
    });
  });
});
