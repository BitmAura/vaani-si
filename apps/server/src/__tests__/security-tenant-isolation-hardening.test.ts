import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../server.js';
import { serializeSession, SESSION_COOKIE_NAME } from '@vanni/auth';
import { InMemoryDatabaseService } from '@vanni/database';
import type { AuthSessionDTO } from '@vanni/shared';
import WebSocket from 'ws';

describe('Prompt 04 — Security, Authorization & Tenant Isolation Hardening', () => {
  let app: FastifyInstance;
  let serverPort: number;

  const tenantAOrgId = 'clinic-a-0000-0000-000000000001';
  const tenantBOrgId = 'clinic-b-0000-0000-000000000002';
  const tenantAWorkspaceId = 'ws-tenant-a-001';

  const tenantAAdminSession: AuthSessionDTO = {
    userId: 'user_admin_a',
    email: 'admin@clinic-a.in',
    fullName: 'Clinic A Admin',
    activeOrganizationId: tenantAOrgId,
    activeRole: 'ADMIN',
    memberships: [
      {
        organizationId: tenantAOrgId,
        organizationName: 'Clinic A Health',
        organizationSlug: 'clinic-a',
        role: 'ADMIN',
        status: 'ACTIVE',
        onboardingStatus: 'ready',
      },
    ],
  };

  const tenantAViewerSession: AuthSessionDTO = {
    userId: 'user_viewer_a',
    email: 'viewer@clinic-a.in',
    fullName: 'Clinic A Viewer',
    activeOrganizationId: tenantAOrgId,
    activeRole: 'VIEWER',
    memberships: [
      {
        organizationId: tenantAOrgId,
        organizationName: 'Clinic A Health',
        organizationSlug: 'clinic-a',
        role: 'VIEWER',
        status: 'ACTIVE',
        onboardingStatus: 'ready',
      },
    ],
  };

  let adminCookie: string;
  let viewerCookie: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.listen({ port: 0, host: '127.0.0.1' });
    const addr = app.server.address();
    serverPort = typeof addr === 'object' && addr ? addr.port : 0;

    adminCookie = `${SESSION_COOKIE_NAME}=${serializeSession(tenantAAdminSession)}`;
    viewerCookie = `${SESSION_COOKIE_NAME}=${serializeSession(tenantAViewerSession)}`;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Unauthenticated Outbound Telephony & Costly Operation Protection', () => {
    it('rejects POST /api/telephony/outbound when unauthenticated', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/telephony/outbound',
        payload: {
          targetPhoneNumber: '+919876543210',
          businessName: 'Acme Test',
        },
      });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error).toMatch(/UNAUTHORIZED/i);
    });

    it('rejects POST /api/calls/outbound-inception when unauthenticated', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/calls/outbound-inception',
        payload: {
          targetPhone: '+919876543210',
          businessName: 'Acme Inception',
        },
      });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error).toMatch(/UNAUTHORIZED/i);
    });

    it('rejects POST /api/telephony/outbound with VIEWER role', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/telephony/outbound',
        headers: {
          cookie: viewerCookie,
        },
        payload: {
          targetPhoneNumber: '+919876543210',
          businessName: 'Acme Test',
        },
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error).toMatch(/FORBIDDEN/i);
    });

    it('rejects POST /api/tts/synthesize when text exceeds 5000 characters', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tts/synthesize',
        headers: {
          cookie: adminCookie,
        },
        payload: {
          text: 'A'.repeat(5001),
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toMatch(/Text exceeds maximum length/i);
    });
  });

  describe('2. Workspace & Cross-Tenant Boundary Enforcement', () => {
    it('fails closed when client supplies a foreign or non-existent x-workspace-id on /api/doctors', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/doctors',
        headers: {
          cookie: adminCookie,
          'x-workspace-id': 'ws_malicious_cross_tenant_probe',
        },
      });
      // Must reject unauthorized or non-existent workspace without silent fallback to another tenant
      expect([401, 403, 404]).toContain(res.statusCode);
      const body = JSON.parse(res.body);
      expect(body.error).toMatch(/UNAUTHORIZED|FORBIDDEN|NOT_FOUND|Workspace not found/i);
    });

    it('fails closed when client supplies a foreign or non-existent x-workspace-id on /api/real-estate/properties', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/real-estate/properties',
        headers: {
          cookie: adminCookie,
          'x-workspace-id': 'ws_malicious_cross_tenant_probe',
        },
      });
      // Must reject unauthorized or non-existent workspace without silent fallback
      expect([401, 403, 404]).toContain(res.statusCode);
      const body = JSON.parse(res.body);
      expect(body.error).toMatch(/Unauthorized|Forbidden|Not Found|Workspace not found/i);
    });
  });

  describe('3. WebSocket Tenant Isolation & Fail-Closed Unknown Workspace', () => {
    it('rejects websocket connection with unknown workspace and does NOT fall back to demo tenant', async () => {
      const wsUrl = `ws://127.0.0.1:${serverPort}/ws/audio-stream?workspaceId=unknown_unauthorized_ws_12345`;
      const ws = new WebSocket(wsUrl);

      const closePromise = new Promise<{ code: number; reason: string }>((resolve) => {
        ws.on('close', (code, reason) => {
          resolve({ code, reason: reason.toString() });
        });
        ws.on('error', () => {
          // ignore expected ws error
        });
      });

      const { code, reason } = await closePromise;
      expect(code).toBe(1008);
      expect(reason).toMatch(/Unauthorized.*workspace/i);
    });
  });

  describe('4. Webhook Security & Production Fail-Closed Secrets', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalExotelSecret = process.env.EXOTEL_WEBHOOK_SECRET;
    const originalRazorpaySecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
      if (originalExotelSecret) process.env.EXOTEL_WEBHOOK_SECRET = originalExotelSecret;
      else delete process.env.EXOTEL_WEBHOOK_SECRET;
      if (originalRazorpaySecret) process.env.RAZORPAY_WEBHOOK_SECRET = originalRazorpaySecret;
      else delete process.env.RAZORPAY_WEBHOOK_SECRET;
    });

    it('Exotel CDR webhook fails closed (503) in production if EXOTEL_WEBHOOK_SECRET is missing', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.EXOTEL_WEBHOOK_SECRET;
      delete process.env.EXOTEL_API_TOKEN;

      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/telephony/exotel-cdr',
        payload: {
          CallSid: 'call_123',
          Status: 'completed',
        },
      });
      expect(res.statusCode).toBe(503);
      const body = JSON.parse(res.body);
      expect(body.error).toMatch(/SERVICE_UNAVAILABLE/i);
    });

    it('Razorpay webhook fails closed (503) in production if RAZORPAY_WEBHOOK_SECRET is missing', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.RAZORPAY_WEBHOOK_SECRET;

      const res = await app.inject({
        method: 'POST',
        url: '/api/billing/webhooks/razorpay',
        headers: {
          'x-razorpay-signature': 'some_signature',
        },
        payload: {
          event: 'payment.captured',
        },
      });
      expect(res.statusCode).toBe(503);
      const body = JSON.parse(res.body);
      expect(body.error).toMatch(/SERVICE_UNAVAILABLE/i);
    });

    it('Razorpay webhook rejects request when signature header is invalid', async () => {
      process.env.NODE_ENV = 'development';
      process.env.RAZORPAY_WEBHOOK_SECRET = 'dev_secret';

      const res = await app.inject({
        method: 'POST',
        url: '/api/billing/webhooks/razorpay',
        headers: {
          'x-razorpay-signature': 'invalid_signature_hash',
        },
        payload: {
          event: 'payment.captured',
        },
      });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error).toMatch(/INVALID_SIGNATURE/i);
    });

    it('Meta leads webhook provides idempotency for duplicate leadgen events', async () => {
      process.env.NODE_ENV = 'development';
      const metaSecret = 'test_meta_webhook_secret_key';
      process.env.META_APP_SECRET = metaSecret;

      const payload = {
        object: 'page',
        entry: [
          {
            id: 'page_1',
            time: 123456789,
            changes: [
              {
                field: 'leadgen',
                value: {
                  leadgen_id: 'lead_unique_id_9999',
                  form_id: 'form_123',
                  created_time: 123456789,
                },
              },
            ],
          },
        ],
      };

      const rawBody = JSON.stringify(payload);
      const sig = 'sha256=' + require('crypto').createHmac('sha256', metaSecret).update(rawBody).digest('hex');

      const res1 = await app.inject({
        method: 'POST',
        url: '/api/webhooks/meta-lead',
        headers: {
          'x-hub-signature-256': sig,
          'content-type': 'application/json',
        },
        payload: rawBody,
      });
      expect(res1.statusCode).toBe(200);
      const body1 = JSON.parse(res1.body);
      expect(body1.success).toBe(true);

      // Second identical payload must return idempotent ok without re-dispatching call
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/webhooks/meta-lead',
        headers: {
          'x-hub-signature-256': sig,
          'content-type': 'application/json',
        },
        payload: rawBody,
      });
      expect(res2.statusCode).toBe(200);
      const body2 = JSON.parse(res2.body);
      expect(body2.status).toBe('IGNORED_DUPLICATE');

      delete process.env.META_APP_SECRET;
    });
  });

  describe('5. Database Scoping & Isolation Invariants', () => {
    it('InMemoryDatabaseService enforces organization scoping on getAppointmentById', async () => {
      const db = new InMemoryDatabaseService();
      await db.saveAppointment({
        id: 'appt_scope_100',
        tenantId: 'clinic_tenant_a',
        workspaceId: 'ws_clinic_a',
        customerName: 'Aarav Patel',
        customerPhone: '+919876543210',
        serviceType: 'GENERAL',
        scheduledTime: '2026-10-25T10:00:00Z',
        durationMinutes: 30,
        status: 'CONFIRMED',
      });

      // Query with matching tenantId returns appointment
      const matched = await db.getAppointmentById('appt_scope_100', 'clinic_tenant_a');
      expect(matched).not.toBeNull();
      expect(matched?.id).toBe('appt_scope_100');

      // Query with foreign tenantId returns null (no cross-tenant leakage)
      const foreign = await db.getAppointmentById('appt_scope_100', 'clinic_tenant_b');
      expect(foreign).toBeNull();
    });
  });
});
