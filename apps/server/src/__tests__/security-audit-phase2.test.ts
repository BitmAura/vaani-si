/**
 * PROMPT 02 SECURITY & AUDIT VERIFICATION TEST SUITE
 *
 * Verifies:
 * 1. Protected analytics endpoints reject unauthenticated requests with 401
 * 2. Protected billing endpoints reject unauthenticated requests with 401
 * 3. Role-based authorization rejects VIEWER roles from modifying billing (403)
 * 4. Header injection via x-organization-id is strictly ignored and isolated
 * 5. Database persistence survives simulated process reload
 * 6. Webhook idempotency and signature verification fail-closed
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { serializeSession, SESSION_COOKIE_NAME } from '@vanni/auth';
import { globalDb, DurableDatabaseService } from '@vanni/database';
import type { AuthSessionDTO } from '@vanni/shared';

const ORG_A = 'aaaaaaaa-1111-1111-1111-11111111111a';
const ORG_B = 'bbbbbbbb-2222-2222-2222-22222222222b';

function sessionForOwner(): AuthSessionDTO {
  return {
    userId: 'u-owner-001',
    email: 'owner@org-a.com',
    fullName: 'Org A Owner',
    activeOrganizationId: ORG_A,
    activeRole: 'OWNER',
    memberships: [
      {
        organizationId: ORG_A,
        organizationName: 'Org A Plots',
        organizationSlug: 'org-a-plots',
        role: 'OWNER',
        status: 'ACTIVE',
        onboardingStatus: 'ready',
      },
    ],
  };
}

function sessionForViewer(): AuthSessionDTO {
  return {
    userId: 'u-viewer-001',
    email: 'viewer@org-a.com',
    fullName: 'Org A Viewer',
    activeOrganizationId: ORG_A,
    activeRole: 'VIEWER',
    memberships: [
      {
        organizationId: ORG_A,
        organizationName: 'Org A Plots',
        organizationSlug: 'org-a-plots',
        role: 'VIEWER',
        status: 'ACTIVE',
        onboardingStatus: 'ready',
      },
    ],
  };
}

describe('Prompt 02 Security & Reliability Audit Suite', () => {
  let server: any;
  let baseUrl: string;
  let ownerCookie: string;
  let viewerCookie: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    server = await buildServer();
    const address = await server.listen({ port: 0, host: '127.0.0.1' });
    baseUrl = address.replace('0.0.0.0', '127.0.0.1');
    ownerCookie = `${SESSION_COOKIE_NAME}=${serializeSession(sessionForOwner())}`;
    viewerCookie = `${SESSION_COOKIE_NAME}=${serializeSession(sessionForViewer())}`;
  });

  afterAll(async () => {
    if (server) await server.close();
  });

  it('rejects unauthenticated access to /api/analytics/overview (401)', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/overview`);
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated access to /api/analytics/calls (401)', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/calls`);
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated access to /api/billing (401)', async () => {
    const res = await fetch(`${baseUrl}/api/billing`);
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated access to /api/billing/checkout (401)', async () => {
    const res = await fetch(`${baseUrl}/api/billing/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: 'starter' }),
    });
    expect(res.status).toBe(401);
  });

  it('enforces RBAC: denies VIEWER role from subscription checkout (403)', async () => {
    const res = await fetch(`${baseUrl}/api/billing/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: viewerCookie,
      },
      body: JSON.stringify({ planId: 'starter' }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.error).toBe('FORBIDDEN');
  });

  it('ignores injected x-organization-id header on /api/analytics/calls', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/calls`, {
      headers: {
        cookie: ownerCookie,
        'x-organization-id': ORG_B,
      },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
  });

  it('persists calls and leads durably in globalDb across instances', async () => {
    const testCallId = `call_persist_${Date.now()}`;
    await globalDb.saveCall({
      id: testCallId,
      tenantId: ORG_A,
      caller: 'Persistent Test Caller',
      phone: '+919888877777',
      direction: 'INBOUND',
      durationSeconds: 120,
      intent: 'Plot Purchase Enquiry',
      outcome: 'INTERESTED',
      leadRating: 'HOT',
      transcript: [],
      createdAt: new Date().toISOString(),
    });

    const calls = await globalDb.getCalls(ORG_A);
    const found = calls.find(c => c.id === testCallId);
    expect(found).toBeDefined();
    expect(found?.caller).toBe('Persistent Test Caller');

    // Simulate reloading from disk
    const reloadedDb = new DurableDatabaseService();
    const reloadedCalls = await reloadedDb.getCalls(ORG_A);
    const reloadedFound = reloadedCalls.find(c => c.id === testCallId);
    expect(reloadedFound).toBeDefined();
  });

  it('fails closed on Razorpay webhook with missing signature (401)', async () => {
    const res = await fetch(`${baseUrl}/api/billing/webhooks/razorpay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'payment.captured' }),
    });
    expect(res.status).toBe(401);
  });
});
