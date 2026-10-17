/**
 * PROMPT 04: AGENCY CLIENT MANAGEMENT & DASHBOARD TEST SUITE
 * 
 * Verifies:
 * 1. Agency creates a Healthcare client (Dental clinic)
 * 2. Agency creates a Real Estate client (Layout Developer)
 * 3. Client configurations retain their distinct industries, subcategories, and AI employees
 * 4. Agency Overview returns aggregated summary metrics computed from real database records
 * 5. Searching and filtering clients by industry without cross-organization leakage
 * 6. Switching client context sets vanni_active_workspace and updates context
 * 7. Tenant isolation: Unauthorized user cannot read or modify another agency's client workspace
 * 8. Viewer role cannot create client workspaces (403 Forbidden)
 * 9. Updating client details persists changes safely
 * 10. Agency usage returns real recorded audio minutes without fabricated carrier billing
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { serializeSession, SESSION_COOKIE_NAME } from '@vanni/auth';
import { globalDb, DurableDatabaseService } from '@vanni/database';
import type { AuthSessionDTO } from '@vanni/shared';

const AGENCY_A_ORG_ID = 'agency-a-0000-0000-000000000001';
const AGENCY_B_ORG_ID = 'agency-b-0000-0000-000000000002';

function sessionForAgencyOwner(orgId: string = AGENCY_A_ORG_ID): AuthSessionDTO {
  return {
    userId: `u-owner-${orgId.slice(0, 8)}`,
    email: `owner@${orgId.slice(0, 8)}.in`,
    fullName: 'Agency Managing Director',
    activeOrganizationId: orgId,
    activeRole: 'OWNER',
    memberships: [
      {
        organizationId: orgId,
        organizationName: orgId === AGENCY_A_ORG_ID ? 'Karnataka Digital Growth Hub' : 'Competitor Media Agency',
        organizationSlug: orgId === AGENCY_A_ORG_ID ? 'karnataka-digital' : 'competitor-media',
        role: 'OWNER',
        status: 'ACTIVE',
        onboardingStatus: 'ready',
      },
    ],
  };
}

function sessionForAgencyViewer(orgId: string = AGENCY_A_ORG_ID): AuthSessionDTO {
  return {
    userId: 'u-viewer-001',
    email: 'intern@karnatakadigital.in',
    fullName: 'Agency Marketing Intern',
    activeOrganizationId: orgId,
    activeRole: 'VIEWER',
    memberships: [
      {
        organizationId: orgId,
        organizationName: 'Karnataka Digital Growth Hub',
        organizationSlug: 'karnataka-digital',
        role: 'VIEWER',
        status: 'ACTIVE',
        onboardingStatus: 'ready',
      },
    ],
  };
}

describe('Agency Client Management & Multi-Client Dashboard (Prompt 04)', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let agencyACookie: string;
  let agencyBCookie: string;
  let agencyAViewerCookie: string;

  let dentalClientId: string;
  let realEstateClientId: string;

  beforeAll(async () => {
    app = await buildServer();
    agencyACookie = `${SESSION_COOKIE_NAME}=${serializeSession(sessionForAgencyOwner(AGENCY_A_ORG_ID))}`;
    agencyBCookie = `${SESSION_COOKIE_NAME}=${serializeSession(sessionForAgencyOwner(AGENCY_B_ORG_ID))}`;
    agencyAViewerCookie = `${SESSION_COOKIE_NAME}=${serializeSession(sessionForAgencyViewer(AGENCY_A_ORG_ID))}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Agency creates a Healthcare client (Dental Practice)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/agency/clients',
      headers: { cookie: agencyACookie },
      payload: {
        name: 'Ballari Dental Care & Smile Clinic',
        industryCategory: 'HEALTHCARE',
        subcategory: 'DENTAL',
        operatingLocation: 'Cantonment, Ballari, Karnataka',
        primaryPhone: '+91 8392 245001',
        primaryEmail: 'info@ballaridental.in',
        timezone: 'Asia/Kolkata',
        languagePreferences: {
          primary: 'kn-IN',
          conversationalStyle: 'POLITE_BUSINESS',
          regionalDialect: 'NORTH_KARNATAKA_COMMERCIAL',
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Ballari Dental Care & Smile Clinic');
    expect(body.data.industryCategory).toBe('HEALTHCARE');
    expect(body.data.subcategory).toBe('DENTAL');
    expect(body.data.modelType).toBe('AGENCY');
    expect(body.data.aiEmployee.name).toBe('Kavya');

    dentalClientId = body.data.id;
    expect(dentalClientId).toMatch(/^ws_/);
  });

  it('2. Same agency creates a Real Estate client (Developer Layout)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/agency/clients',
      headers: { cookie: agencyACookie },
      payload: {
        name: 'Tungabhadra Green Meadows Plots',
        industryCategory: 'REAL_ESTATE',
        subcategory: 'DEVELOPER',
        operatingLocation: 'Siruguppa Road, Ballari, Karnataka',
        primaryPhone: '+91 9448 012345',
        primaryEmail: 'sales@tungabhadragreen.in',
        timezone: 'Asia/Kolkata',
        languagePreferences: {
          primary: 'kn-en',
          conversationalStyle: 'POLITE_BUSINESS',
          regionalDialect: 'KANGLISH_BUSINESS',
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Tungabhadra Green Meadows Plots');
    expect(body.data.industryCategory).toBe('REAL_ESTATE');
    expect(body.data.subcategory).toBe('DEVELOPER');
    expect(body.data.aiEmployee.name).toBe('Sahana');

    realEstateClientId = body.data.id;
  });

  it('3. Seed real calls, leads, and appointments under each client workspace', async () => {
    // Call 1 under Dental client
    await globalDb.saveCall({
      id: 'call-dental-001',
      tenantId: dentalClientId,
      caller: 'Basavaraj Patil',
      phone: '+91 98450 11223',
      direction: 'INBOUND',
      durationSeconds: 154, // ~2.5 mins
      intent: 'Root Canal Appointment',
      outcome: 'APPOINTMENT_REQUESTED',
      leadRating: 'HOT',
      transcript: [{ speaker: 'AI', text: 'Namaskara, Ballari Dental clinic...', timestamp: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
    });

    // Lead under Dental client
    await globalDb.saveLead({
      id: 'lead-dental-001',
      callId: 'call-dental-001',
      tenantId: dentalClientId,
      callerName: 'Basavaraj Patil',
      callerPhone: '+91 98450 11223',
      requirementSummary: 'Severe molar ache, wants root canal specialist on Saturday',
      confirmedOutcome: 'FOLLOW_UP_REQUIRED',
      leadRating: 'HOT',
      createdAt: new Date().toISOString(),
    });

    // Call 2 under Real Estate client
    await globalDb.saveCall({
      id: 'call-realestate-001',
      tenantId: realEstateClientId,
      caller: 'Suresh Gowda',
      phone: '+91 94481 99887',
      direction: 'INBOUND',
      durationSeconds: 240, // 4 mins
      intent: '30x40 Plot Inquiry',
      outcome: 'SITE_VISIT_CONFIRMED',
      leadRating: 'HOT',
      transcript: [{ speaker: 'AI', text: 'Namaskara, Tungabhadra Meadows layout...', timestamp: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
    });

    // Appointment (Site Visit) under Real Estate client
    await globalDb.saveAppointment({
      id: 'apt-realestate-001',
      tenantId: realEstateClientId,
      leadId: 'lead-realestate-001',
      customerName: 'Suresh Gowda',
      customerPhone: '+91 94481 99887',
      serviceType: 'Site Visit',
      scheduledTime: new Date(Date.now() + 86400000).toISOString(),
      durationMinutes: 45,
      status: 'CONFIRMED',
    });

    const calls = await globalDb.getCalls(dentalClientId);
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });

  it('4. GET /api/agency/overview computes accurate aggregate metrics from real data', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/agency/overview',
      headers: { cookie: agencyACookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.agencyName).toBe('Karnataka Digital Growth Hub');
    expect(body.summary.totalClients).toBeGreaterThanOrEqual(2);
    expect(body.summary.totalCalls).toBeGreaterThanOrEqual(2);
    expect(body.summary.qualifiedLeads).toBeGreaterThanOrEqual(1);
    expect(body.summary.appointmentsConfirmed).toBeGreaterThanOrEqual(1);
    expect(body.summary.totalVoiceMinutes).toBeGreaterThanOrEqual(6.5); // 154s + 240s = 394s = ~6.6 min

    const dentalRow = body.clients.find((c: any) => c.id === dentalClientId);
    expect(dentalRow).toBeDefined();
    expect(dentalRow.industryCategory).toBe('HEALTHCARE');
    expect(dentalRow.metrics.totalCalls).toBe(1);
    expect(dentalRow.metrics.qualifiedLeads).toBe(1);
  });

  it('5. GET /api/agency/clients supports searching and industry filtering without leakage', async () => {
    // Filter by HEALTHCARE
    const resHealthcare = await app.inject({
      method: 'GET',
      url: '/api/agency/clients?industry=HEALTHCARE',
      headers: { cookie: agencyACookie },
    });

    expect(resHealthcare.statusCode).toBe(200);
    const bodyHealth = JSON.parse(resHealthcare.body);
    expect(bodyHealth.data.every((c: any) => c.industryCategory === 'HEALTHCARE')).toBe(true);
    expect(bodyHealth.data.some((c: any) => c.id === dentalClientId)).toBe(true);
    expect(bodyHealth.data.some((c: any) => c.id === realEstateClientId)).toBe(false);

    // Search by "Tungabhadra"
    const resSearch = await app.inject({
      method: 'GET',
      url: '/api/agency/clients?search=Tungabhadra',
      headers: { cookie: agencyACookie },
    });

    expect(resSearch.statusCode).toBe(200);
    const bodySearch = JSON.parse(resSearch.body);
    expect(bodySearch.data.some((c: any) => c.id === realEstateClientId)).toBe(true);
    expect(bodySearch.data.some((c: any) => c.id === dentalClientId)).toBe(false);
  });

  it('6. POST /api/agency/clients/:id/switch sets cookie and authorizes context', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/agency/clients/${dentalClientId}/switch`,
      headers: { cookie: agencyACookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.activeWorkspace.id).toBe(dentalClientId);
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie']?.toString()).toContain('vanni_active_workspace=');
  });

  it('7. Tenant Isolation: Competitor Agency B cannot access Agency A client workspace', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/agency/clients/${dentalClientId}`,
      headers: { cookie: agencyBCookie },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('FORBIDDEN');

    // Switch attempt also rejected
    const resSwitch = await app.inject({
      method: 'POST',
      url: `/api/agency/clients/${dentalClientId}/switch`,
      headers: { cookie: agencyBCookie },
    });
    expect(resSwitch.statusCode).toBe(403);
  });

  it('8. Role Security: Viewer role cannot create new client workspaces', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/agency/clients',
      headers: { cookie: agencyAViewerCookie },
      payload: {
        name: 'Unauthorized Viewer Client',
        industryCategory: 'REAL_ESTATE',
        subcategory: 'SALES',
        operatingLocation: 'Hubballi',
        primaryPhone: '+91 836 220011',
        languagePreferences: {
          primary: 'kn-IN',
          conversationalStyle: 'POLITE_BUSINESS',
          regionalDialect: 'NORTH_KARNATAKA_COMMERCIAL',
        },
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('FORBIDDEN');
    expect(body.message).toContain('Viewers cannot create');
  });

  it('9. PUT /api/agency/clients/:id updates client configuration safely', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/agency/clients/${dentalClientId}`,
      headers: { cookie: agencyACookie },
      payload: {
        operatingLocation: 'Near Royal Circle, Cantonment, Ballari, Karnataka',
        aiEmployee: {
          name: 'Kavya',
          gender: 'FEMALE',
          speakerId: 'meera',
          engine: 'sarvam_bulbul_v2',
          status: 'ACTIVE',
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.operatingLocation).toContain('Royal Circle');
    expect(body.data.aiEmployee.status).toBe('ACTIVE');
  });

  it('10. GET /api/agency/usage returns real audio minutes without fake provider cost', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/agency/usage',
      headers: { cookie: agencyACookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.totalRecordedMinutes).toBeGreaterThanOrEqual(6.5);
    expect(body.providerCost).toBeNull();
    expect(body.billingStatus).toBe('RECORDED_USAGE_ONLY');
    expect(body.clients.length).toBeGreaterThanOrEqual(2);
  });
});
