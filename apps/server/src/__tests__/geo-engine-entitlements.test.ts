import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../server';

describe('Prompt 10: Autonomous GEO & AEO Engine & Entitlements', () => {
  let server: FastifyInstance;
  const KILL_SWITCH_SECRET = 'test-geo-kill-switch';

  beforeAll(async () => {
    process.env.GEO_KILL_SWITCH_SECRET = KILL_SWITCH_SECRET;
    server = await buildServer();
    await server.ready();
  });

  it('lists pre-seeded institutional demo entities including Punarvaas Hospital', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/geo/demos',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.demos).toBeDefined();
    expect(body.demos.length).toBeGreaterThanOrEqual(3);

    const punarvaas = body.demos.find((d: any) => d.slug === 'punarvaas');
    expect(punarvaas).toBeDefined();
    expect(punarvaas.name).toContain('Punarvaas');
    expect(punarvaas.industry).toBe('HEALTHCARE');
  });

  it('serves dynamic WordPress loader.js for active entity with MedicalBusiness schema', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/geo/punarvaas/loader.js',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/javascript');
    expect(res.payload).toContain('vanni-geo-schema');
    expect(res.payload).toContain('MedicalBusiness');
    expect(res.payload).toContain('Dr. Ramesh Kumar');
    expect(res.payload).toContain('Stroke & Paralysis Rehabilitation');
  });

  it('serves canonical /llms.txt markdown feed for AI search crawlers', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/geo/punarvaas/llms.txt',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/markdown');
    expect(res.payload).toContain('# Punarvaas Rehabilitation Hospital');
    expect(res.payload).toContain('## Core Services, Therapies & Catalog');
    expect(res.payload).toContain('## Verified Doctors & Leadership Team');
    expect(res.payload).toContain('## Verified Frequently Asked Questions (Q&A)');
    expect(res.payload).toContain('+918884880095');
  });

  it('serves raw Schema.org JSON-LD graph', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/geo/punarvaas/schema.json',
    });

    expect(res.statusCode).toBe(200);
    const schema = JSON.parse(res.payload);
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@graph']).toBeDefined();
    expect(schema['@graph'].length).toBeGreaterThanOrEqual(2);
  });

  it('triggers Kill-Switch when geoEnabled is toggled to false', async () => {
    const unauth = await server.inject({
      method: 'POST',
      url: '/api/geo/punarvaas/toggle',
      headers: { 'Content-Type': 'application/json' },
      payload: { geoEnabled: false, subscriptionStatus: 'ACTIVE' },
    });
    expect(unauth.statusCode).toBe(401);

    // 1. Deactivate GEO for Punarvaas (authorized kill-switch)
    const toggleRes = await server.inject({
      method: 'POST',
      url: '/api/geo/punarvaas/toggle',
      headers: {
        'Content-Type': 'application/json',
        'x-vanni-kill-switch': KILL_SWITCH_SECRET,
      },
      payload: { geoEnabled: false, subscriptionStatus: 'CANCELLED' },
    });
    expect(toggleRes.statusCode).toBe(200);
    const toggleData = JSON.parse(toggleRes.payload);
    expect(toggleData.geoEnabled).toBe(false);
    // Paywall: toggle must not accept subscriptionStatus mutations
    expect(toggleData.subscriptionStatus).toBe('ACTIVE');

    // 2. loader.js now returns suspended notice
    const loaderRes = await server.inject({
      method: 'GET',
      url: '/api/geo/punarvaas/loader.js',
    });
    expect(loaderRes.statusCode).toBe(200);
    expect(loaderRes.payload).toContain('Service Suspended or Deactivated');
    expect(loaderRes.payload).not.toContain('MedicalBusiness');

    // 3. llms.txt now returns 403 Forbidden
    const llmsRes = await server.inject({
      method: 'GET',
      url: '/api/geo/punarvaas/llms.txt',
    });
    expect(llmsRes.statusCode).toBe(403);

    // 4. Restore for subsequent tests
    await server.inject({
      method: 'POST',
      url: '/api/geo/punarvaas/toggle',
      headers: {
        'Content-Type': 'application/json',
        'x-vanni-kill-switch': KILL_SWITCH_SECRET,
      },
      payload: { geoEnabled: true, voiceEnabled: true },
    });
  });

  it('refuses to publish a GEO profile without a telephone and address', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/geo/extract',
      headers: { 'Content-Type': 'application/json' },
      payload: {
        url: 'https://example.com',
        slug: 'missing-facts',
        name: 'Example Clinic',
      },
    });

    expect(res.statusCode).toBe(422);
    const data = JSON.parse(res.payload);
    expect(data.error).toMatch(/telephone, and address are required/);

    const checkRes = await server.inject({
      method: 'GET',
      url: '/api/geo/missing-facts/status',
    });
    expect(checkRes.statusCode).toBe(404);
  });

  it('extracts a new website URL and dynamically generates GEO package', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/geo/extract',
      headers: { 'Content-Type': 'application/json' },
      payload: {
        url: 'https://myspecialtyclinic.com',
        slug: 'my-specialty-clinic',
        industry: 'HEALTHCARE',
        name: 'Bangalore Ortho & Joint Clinic',
        telephone: '+918047192099',
        address: {
          street: '12 Residency Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560025',
          country: 'IN',
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.payload);
    expect(data.success).toBe(true);
    expect(data.paymentRequired).toBe(true);
    expect(data.profile.slug).toBeUndefined();
    expect(data.embedSnippet).toBeUndefined();
    expect(data.profile.subscriptionStatus).toBe('PENDING_PAYMENT');

    // Verify it is now immediately queryable
    const checkRes = await server.inject({
      method: 'GET',
      url: '/api/geo/my-specialty-clinic/status',
    });
    expect(checkRes.statusCode).toBe(200);
    const statusData = JSON.parse(checkRes.payload);
    expect(statusData.readinessScore).toBeGreaterThanOrEqual(70);
  });

  it('generates an institutional AI audit report for registered entity Punarvaas', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/geo/punarvaas/audit',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.entity.name).toContain('Punarvaas');
    expect(body.readinessScore).toBeGreaterThanOrEqual(80);
    expect(body.findings.length).toBeGreaterThanOrEqual(4);
    expect(body.paymentRequired).toBe(false);
    expect(body.embedCode).toContain('/api/geo/punarvaas/loader.js');
  });

  it('hides embed slug on unpaid entity audit and checkout without Razorpay keys', async () => {
    const extractRes = await server.inject({
      method: 'POST',
      url: '/api/geo/extract',
      headers: { 'Content-Type': 'application/json' },
      payload: {
        url: 'https://unpaid-ortho-clinic.example',
        slug: 'unpaid-ortho-clinic',
        industry: 'HEALTHCARE',
        name: 'Unpaid Ortho Clinic',
        telephone: '+918047192088',
        address: {
          street: '1 MG Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
          country: 'IN',
        },
      },
    });
    expect(extractRes.statusCode).toBe(200);
    expect(JSON.parse(extractRes.payload).embedSnippet).toBeUndefined();

    const auditRes = await server.inject({
      method: 'GET',
      url: '/api/geo/unpaid-ortho-clinic/audit',
    });
    expect(auditRes.statusCode).toBe(200);
    const audit = JSON.parse(auditRes.payload);
    expect(audit.paymentRequired).toBe(true);
    expect(audit.entity.slug).toBeUndefined();
    expect(audit.embedCode).toBeUndefined();
    expect(audit.downloadUrls).toBeUndefined();

    const checkoutRes = await server.inject({
      method: 'POST',
      url: '/api/geo/unpaid-ortho-clinic/checkout',
      headers: { 'Content-Type': 'application/json' },
      payload: { name: 'Dr Test', email: 'test@example.com', phone: '+918047192088' },
    });
    expect(checkoutRes.statusCode).toBe(200);
    const checkout = JSON.parse(checkoutRes.payload);
    expect(checkout.configured).toBe(false);
    expect(checkout.paymentRequired).toBe(true);
    expect(checkout.embedSnippet).toBeUndefined();

    const activateRes = await server.inject({
      method: 'POST',
      url: '/api/geo/unpaid-ortho-clinic/activate',
      headers: { 'Content-Type': 'application/json' },
      payload: {},
    });
    expect(activateRes.statusCode).toBe(402);
  });

  it('generates a prospective client audit report for unonboarded prospect', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/geo/audit',
      headers: { 'Content-Type': 'application/json' },
      payload: {
        businessName: "Kumar's Microscopic Dental Care",
        city: 'Yelahanka, Bangalore',
        industry: 'DENTAL',
        url: 'https://kumarsdental.com',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.audit.businessName).toBe("Kumar's Microscopic Dental Care");
    expect(body.audit.currentScore).toBe(25);
    expect(body.audit.projectedScore).toBe(95);
    expect(body.audit.findings.length).toBeGreaterThanOrEqual(4);
  });
});
