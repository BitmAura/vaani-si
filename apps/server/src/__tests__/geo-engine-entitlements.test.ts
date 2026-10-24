import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../server';

describe('Prompt 10: Autonomous GEO & AEO Engine & Entitlements', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
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
    // 1. Deactivate GEO for Punarvaas
    const toggleRes = await server.inject({
      method: 'POST',
      url: '/api/geo/punarvaas/toggle',
      headers: { 'Content-Type': 'application/json' },
      payload: { geoEnabled: false },
    });
    expect(toggleRes.statusCode).toBe(200);
    const toggleData = JSON.parse(toggleRes.payload);
    expect(toggleData.geoEnabled).toBe(false);

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
      headers: { 'Content-Type': 'application/json' },
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
    expect(data.profile.slug).toBe('my-specialty-clinic');
    expect(data.embedSnippet).toContain('/api/geo/my-specialty-clinic/loader.js');
    expect(data.urls.llmsTxt).toContain('/api/geo/my-specialty-clinic/llms.txt');

    // Verify it is now immediately queryable
    const checkRes = await server.inject({
      method: 'GET',
      url: '/api/geo/my-specialty-clinic/status',
    });
    expect(checkRes.statusCode).toBe(200);
    const statusData = JSON.parse(checkRes.payload);
    expect(statusData.readinessScore).toBeGreaterThanOrEqual(70);
  });
});
