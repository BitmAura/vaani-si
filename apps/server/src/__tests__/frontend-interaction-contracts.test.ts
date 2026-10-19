import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { SESSION_COOKIE_NAME } from '@vanni/auth';

describe('Prompt 03: Frontend Interaction & API Contract Remediation', () => {
  let app: any;
  let authCookie: string;
  let orgId: string;

  beforeAll(async () => {
    app = await buildServer();

    // Create an owner account for authenticated tests
    const ownerEmail = `owner_p03_${Date.now()}@vanni.ai`;
    const ownerRes = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: {
        fullName: 'Prompt03 Owner',
        organizationName: 'Prompt03 Hospital & Plots',
        email: ownerEmail,
        password: 'Password123!',
        industry: 'HEALTHCARE',
      },
    });

    expect(ownerRes.statusCode).toBe(200);
    const ownerBody = JSON.parse(ownerRes.payload);
    orgId = ownerBody.session.activeOrganizationId;

    const rawCookies = ownerRes.cookies;
    const sessionCookieObj = rawCookies.find((c: any) => c.name === SESSION_COOKIE_NAME);
    authCookie = `${sessionCookieObj.name}=${sessionCookieObj.value}`;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // ==============================================================================
  // 1. CAMPAIGN API CONTRACT & STATUS TOGGLE
  // ==============================================================================
  describe('1. Campaign API Endpoints & State Management', () => {
    let createdCampaignId: string;

    it('returns 401 when accessing campaigns without authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/campaigns',
      });
      expect(res.statusCode).toBe(401);
    });

    it('GET /api/campaigns returns seed demo campaigns for authenticated user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/campaigns',
        headers: { cookie: authCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.campaigns)).toBe(true);
      expect(body.campaigns.length).toBeGreaterThanOrEqual(3);
      expect(body.campaigns.some((c: any) => c.id === 'camp_01')).toBe(true);
    });

    it('POST /api/campaigns rejects empty campaign name with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/campaigns',
        headers: { cookie: authCookie },
        payload: { name: '   ', status: 'ACTIVE' },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(false);
      expect(body.message).toContain('name is required');
    });

    it('POST /api/campaigns creates a new active campaign and returns 201', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/campaigns',
        headers: { cookie: authCookie },
        payload: {
          name: 'Q4 Health Checkup Outreach',
          status: 'ACTIVE',
          language: 'kn',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.campaign).toBeDefined();
      expect(body.campaign.name).toBe('Q4 Health Checkup Outreach');
      expect(body.campaign.status).toBe('ACTIVE');
      createdCampaignId = body.campaign.id;
    });

    it('GET /api/campaigns/:id retrieves the created campaign', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/campaigns/${createdCampaignId}`,
        headers: { cookie: authCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.campaign.id).toBe(createdCampaignId);
    });

    it('POST /api/campaigns/:id/status pauses an active campaign', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/campaigns/${createdCampaignId}/status`,
        headers: { cookie: authCookie },
        payload: { status: 'PAUSED' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.campaign.status).toBe('PAUSED');
    });

    it('POST /api/campaigns/:id/status resumes a paused campaign', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/campaigns/${createdCampaignId}/status`,
        headers: { cookie: authCookie },
        payload: { status: 'ACTIVE' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.campaign.status).toBe('ACTIVE');
    });

    it('POST /api/campaigns/:id/status returns 404 for nonexistent campaign', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/campaigns/nonexistent_camp_999/status',
        headers: { cookie: authCookie },
        payload: { status: 'PAUSED' },
      });
      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(false);
    });
  });

  // ==============================================================================
  // 2. DASHBOARD ORGANIZATION SETTINGS (PATCH /api/organization)
  // ==============================================================================
  describe('2. Organization Settings (PATCH /api/organization)', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/organization',
        payload: { name: 'Unauthorized Hospital' },
      });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(false);
    });

    it('persists name and industry updates for authorized owner', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/organization',
        headers: { cookie: authCookie },
        payload: {
          name: 'Ballari Multispeciality Hospital',
          industry: 'HEALTHCARE',
        },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.organization.name).toBe('Ballari Multispeciality Hospital');
      expect(body.organization.industry).toBe('HEALTHCARE');

      // Verify GET returns updated data
      const getRes = await app.inject({
        method: 'GET',
        url: '/api/organization',
        headers: { cookie: authCookie },
      });
      expect(getRes.statusCode).toBe(200);
      const getBody = JSON.parse(getRes.payload);
      expect(getBody.organization.name).toBe('Ballari Multispeciality Hospital');
    });
  });

  // ==============================================================================
  // 3. BILLING CONTRACT (REQUEST & RESPONSE COMPATIBILITY)
  // ==============================================================================
  describe('3. Billing Request & Response Contracts', () => {
    it('accepts billingInterval: MONTHLY and returns shortUrl, checkoutUrl, planName, amount', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/billing/checkout',
        headers: { cookie: authCookie },
        payload: {
          planId: 'plan_growth',
          billingInterval: 'MONTHLY',
        },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.shortUrl).toBeDefined();
      expect(body.data.checkoutUrl).toBeDefined();
      expect(body.data.planName).toBe('Growth Plan');
      expect(body.data.amount).toBeGreaterThan(0);
      expect(body.data.providerSubscriptionId).toBeDefined();
    });

    it('accepts billingPeriod: ANNUAL and returns annual plan pricing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/billing/checkout',
        headers: { cookie: authCookie },
        payload: {
          planId: 'plan_growth',
          billingPeriod: 'ANNUAL',
        },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.amount).toBeGreaterThan(0);
    });

    it('rejects checkout attempts with unknown planId with 404', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/billing/checkout',
        headers: { cookie: authCookie },
        payload: {
          planId: 'plan_nonexistent_xyz',
          billingInterval: 'MONTHLY',
        },
      });
      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(false);
    });
  });

  // ==============================================================================
  // 4. APPOINTMENT RESCHEDULING CONTRACT
  // ==============================================================================
  describe('4. Appointment Rescheduling Contract', () => {
    it('returns 401 when rescheduling without authentication', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/appointments/apt_sample_01/reschedule',
        payload: { newScheduledTime: '2026-10-25T11:00:00Z' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 400 when newScheduledTime is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/appointments/apt_sample_01/reschedule',
        headers: { cookie: authCookie },
        payload: {},
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when appointment does not exist', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/appointments/nonexistent_apt_99999/reschedule',
        headers: { cookie: authCookie },
        payload: { newScheduledTime: '2026-10-25T11:00:00Z' },
      });
      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.payload);
      expect(body.error).toBe('NOT_FOUND');
    });
  });

  // ==============================================================================
  // 5. PROTECTED ROUTE REDIRECTION & STATIC ALIASES
  // ==============================================================================
  describe('5. Protected Navigation Routes & Route Aliases', () => {
    const protectedRoutes = [
      '/app/campaigns',
      '/app/campaigns/new',
      '/app/billing',
      '/app/appointments',
      '/app/analytics',
      '/app/calls',
      '/app/leads',
    ];

    for (const route of protectedRoutes) {
      it(`unauthenticated GET ${route} redirects to /login?redirect=${encodeURIComponent(route)}`, async () => {
        const res = await app.inject({
          method: 'GET',
          url: route,
        });
        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toContain('/login?redirect=');
        expect(res.headers.location).toContain(encodeURIComponent(route));
      });
    }

    const aliases = [
      { alias: '/app/campaigns.html', canonical: '/app/campaigns' },
      { alias: '/app/campaigns/new.html', canonical: '/app/campaigns/new' },
      { alias: '/app/billing.html', canonical: '/app/billing' },
      { alias: '/app/appointments.html', canonical: '/app/appointments' },
      { alias: '/app/analytics.html', canonical: '/app/analytics' },
    ];

    for (const { alias, canonical } of aliases) {
      it(`GET ${alias} redirects to canonical ${canonical}`, async () => {
        const res = await app.inject({
          method: 'GET',
          url: alias,
        });
        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe(canonical);
      });
    }
  });
});
