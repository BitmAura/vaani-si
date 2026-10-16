/**
 * FALSIFIABLE SECURITY TESTS — Tenant Isolation, Auth & Webhook Fail-Closed
 *
 * Unlike the older "invariant" suite (which asserted test-local literals), these
 * tests drive the real HTTP server and assert observable authorization behavior.
 * Each test fails against the pre-hardening implementation:
 *   - anonymous access used to return 200 (guarded `if (session)` checks)
 *   - cross-tenant reads used to return 200 (hardcoded tenant fallbacks)
 *   - switch-org used to mint an OWNER session for anonymous callers
 *   - CORS used to reflect any Origin with credentials: true
 *   - the Meta webhook used to accept unsigned payloads
 *
 * The session token is minted with the same @vanni/auth module instance the
 * server uses, so the HMAC signature is genuinely valid in-process.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { serializeSession, SESSION_COOKIE_NAME } from '@vanni/auth';
import type { AuthSessionDTO } from '@vanni/shared';

const ORG_A = 'aaaaaaaa-0000-0000-0000-00000000000a';
const ORG_A_SLUG = 'org-a-plots';
const ORG_B = 'bbbbbbbb-0000-0000-0000-00000000000b';
const ORG_B_SLUG = 'org-b-clinic';
const ORG_B_SLUG_ENCODED = encodeURIComponent(ORG_B_SLUG);

function sessionForOrgA(): AuthSessionDTO {
  return {
    userId: 'u-test-0001',
    email: 'owner@org-a.test',
    fullName: 'Org A Owner',
    activeOrganizationId: ORG_A,
    activeRole: 'OWNER',
    memberships: [
      {
        organizationId: ORG_A,
        organizationName: 'Org A Plots',
        organizationSlug: ORG_A_SLUG,
        role: 'OWNER',
        status: 'ACTIVE',
        onboardingStatus: 'ready',
      },
    ],
  };
}

describe('Tenant isolation & authorization (hardened)', () => {
  let server: any;
  let baseUrl: string;
  let orgACookie: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.META_APP_SECRET;
    delete process.env.META_WEBHOOK_ALLOW_UNSIGNED;
    server = await buildServer();
    const address = await server.listen({ port: 0, host: '127.0.0.1' });
    baseUrl = address.replace('0.0.0.0', '127.0.0.1');
    orgACookie = `${SESSION_COOKIE_NAME}=${serializeSession(sessionForOrgA())}`;
  });

  afterAll(async () => {
    if (server) await server.close();
  });

  const get = (path: string, headers: Record<string, string> = {}) =>
    fetch(`${baseUrl}${path}`, { headers });

  it('rejects anonymous access to /api/organization with 401', async () => {
    const res = await get('/api/organization');
    expect(res.status).toBe(401);
  });

  it('rejects anonymous access to /api/calls with 401 (no benchmark-tenant read)', async () => {
    const res = await get('/api/calls?tenant=real_estate');
    expect(res.status).toBe(401);
  });

  it('rejects anonymous access to /api/business-brain with 401', async () => {
    const res = await get('/api/business-brain');
    expect(res.status).toBe(401);
  });

  it('rejects anonymous access to vertical route plugins that used a client tenantId', async () => {
    // plots / doctors / agency route plugins previously trusted ?tenantId and
    // defaulted to a hardcoded demo tenant without any authentication.
    for (const path of ['/api/plots', '/api/doctors', '/api/agency/clients']) {
      const res = await get(path);
      expect(res.status, `${path} should require auth`).toBe(401);
    }
  });

  it('rejects anonymous organization switching (no OWNER session minting)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/switch-org`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: ORG_B }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.session).toBeUndefined();
  });

  it('denies cross-tenant call access for a member of a different org (403)', async () => {
    const res = await get(`/api/calls?tenant=${ORG_B_SLUG_ENCODED}`, { cookie: orgACookie });
    expect(res.status).toBe(403);
  });

  it('allows an authenticated member to read calls for their own org', async () => {
    const res = await get('/api/calls', { cookie: orgACookie });
    expect(res.status).toBe(200);
  });

  it('derives tenant scope from the session, ignoring x-organization-id', async () => {
    const res = await get('/api/organization', {
      cookie: orgACookie,
      'x-organization-id': ORG_B,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.organization.id).toBe(ORG_A);
  });

  it('rejects a tampered session token (HMAC signature enforced)', async () => {
    const token = serializeSession(sessionForOrgA());
    const [payload, sig] = token.split('.');
    const tampered = `${payload}.${sig.slice(0, -2)}xx`;
    const res = await get('/api/organization', {
      cookie: `${SESSION_COOKIE_NAME}=${tampered}`,
    });
    expect(res.status).toBe(401);
  });

  it('does NOT reflect a disallowed Origin in CORS headers', async () => {
    const res = await get('/api/organization', { origin: 'https://evil.example' });
    expect(res.headers.get('access-control-allow-origin')).not.toBe('https://evil.example');
  });

  it('reflects an allowlisted Origin in CORS headers', async () => {
    const res = await get('/api/organization', { origin: 'http://localhost:3000' });
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
  });

  it('fails closed on the Meta lead webhook when no secret is configured (503)', async () => {
    const res = await fetch(`${baseUrl}/api/webhooks/meta-lead?tenant=real_estate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: '+919999999999', name: 'Attacker' }),
    });
    expect(res.status).toBe(503);
    const body = (await res.json()) as any;
    expect(body.action).toBeUndefined();
  });
});
