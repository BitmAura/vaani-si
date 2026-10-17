/**
 * PROMPT 03: MULTI-TENANT WORKSPACE & INDUSTRY-AWARE ONBOARDING TEST SUITE
 *
 * Verifies:
 * 1. Path A: New agency user creates agency and first client workspace
 * 2. Path A: Agency creates multiple clients (Healthcare + Real Estate)
 * 3. Path B: Direct clinic user completes direct-business path
 * 4. Path B: Direct real estate user completes direct-business path
 * 5. Resuming onboarding progress on browser refresh
 * 6. Switching between two authorized client workspaces
 * 7. Tenant isolation: Attempting to access another org's workspace is rejected (403)
 * 8. Idempotency: Retrying step submissions does not duplicate records
 * 9. Changing industry configuration preserves existing data
 * 10. Persistence: Workspaces survive process reload
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { serializeSession, SESSION_COOKIE_NAME } from '@vanni/auth';
import { globalDb, DurableDatabaseService } from '@vanni/database';
import type { AuthSessionDTO } from '@vanni/shared';

const AGENCY_ORG_ID = 'agency-org-0000-0000-000000000001';
const DIRECT_CLINIC_ORG_ID = 'clinic-org-0000-0000-000000000002';
const VICTIM_ORG_ID = 'victim-org-0000-0000-000000000003';

function sessionForAgency(): AuthSessionDTO {
  return {
    userId: 'u-agency-001',
    email: 'agency@apexmarketing.in',
    fullName: 'Apex Growth Partner',
    activeOrganizationId: AGENCY_ORG_ID,
    activeRole: 'OWNER',
    memberships: [
      {
        organizationId: AGENCY_ORG_ID,
        organizationName: 'Apex Growth Agency',
        organizationSlug: 'apex-growth',
        role: 'OWNER',
        status: 'ACTIVE',
        onboardingStatus: 'ready',
      },
    ],
  };
}

function sessionForDirectClinic(): AuthSessionDTO {
  return {
    userId: 'u-clinic-001',
    email: 'admin@dr-sneha-dental.com',
    fullName: 'Dr. Sneha Hegde',
    activeOrganizationId: DIRECT_CLINIC_ORG_ID,
    activeRole: 'OWNER',
    memberships: [
      {
        organizationId: DIRECT_CLINIC_ORG_ID,
        organizationName: 'Dr. Sneha Multispecialty Dental',
        organizationSlug: 'sneha-dental',
        role: 'OWNER',
        status: 'ACTIVE',
        onboardingStatus: 'created',
      },
    ],
  };
}

function sessionForVictimOrg(): AuthSessionDTO {
  return {
    userId: 'u-victim-001',
    email: 'ceo@victim-builders.com',
    fullName: 'Victim Builders CEO',
    activeOrganizationId: VICTIM_ORG_ID,
    activeRole: 'OWNER',
    memberships: [
      {
        organizationId: VICTIM_ORG_ID,
        organizationName: 'Victim Heights',
        organizationSlug: 'victim-heights',
        role: 'OWNER',
        status: 'ACTIVE',
        onboardingStatus: 'ready',
      },
    ],
  };
}

describe('Prompt 03 — Multi-Tenant Workspace & Onboarding Framework', () => {
  let server: any;

  beforeAll(async () => {
    process.env.COOKIE_SECRET = 'test-secret-at-least-32-chars-long-12345';
    process.env.SESSION_SECRET = 'test-secret-at-least-32-chars-long-12345';
    process.env.DISABLE_AUTH_PERSISTENCE = 'true';
    server = await buildServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  // Test 1: Path A — Agency user creates agency and first client workspace
  it('1. allows agency user to create a client workspace under their organization', async () => {
    const session = sessionForAgency();
    const token = serializeSession(session);

    const res = await server.inject({
      method: 'POST',
      url: '/api/workspaces',
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      payload: {
        name: 'Ballari Residential Layouts',
        modelType: 'AGENCY',
        industryCategory: 'REAL_ESTATE',
        subcategory: 'SALES',
        operatingLocation: 'Siruguppa Road, Ballari, Karnataka',
        primaryPhone: '+91 80 4719 2001',
        startingTemplateId: 'lead-followup',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.workspace.name).toBe('Ballari Residential Layouts');
    expect(body.workspace.organizationId).toBe(AGENCY_ORG_ID);
    expect(body.workspace.modelType).toBe('AGENCY');
    expect(body.workspace.industryCategory).toBe('REAL_ESTATE');
  });

  // Test 2: Path A — Agency creates a second client in Healthcare
  it('2. allows agency to manage multiple distinct client workspaces across industries', async () => {
    const session = sessionForAgency();
    const token = serializeSession(session);

    // Create healthcare client
    const res = await server.inject({
      method: 'POST',
      url: '/api/workspaces',
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      payload: {
        name: 'KIMS Orthopaedic Hospital',
        modelType: 'AGENCY',
        industryCategory: 'HEALTHCARE',
        subcategory: 'HOSPITAL',
        operatingLocation: 'Hubballi, Karnataka',
        primaryPhone: '+91 83 6237 0000',
        startingTemplateId: 'appointment-coordination',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.workspace.industryCategory).toBe('HEALTHCARE');

    // Fetch all workspaces for agency
    const listRes = await server.inject({
      method: 'GET',
      url: '/api/workspaces',
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });

    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.body);
    expect(listBody.workspaces.length).toBeGreaterThanOrEqual(2);
    const industries = listBody.workspaces.map((w: any) => w.industryCategory);
    expect(industries).toContain('REAL_ESTATE');
    expect(industries).toContain('HEALTHCARE');
  });

  // Test 3: Path B — Direct clinic user completes direct-business path
  it('3. allows direct clinic user to configure their business workspace without agency friction', async () => {
    const session = sessionForDirectClinic();
    const token = serializeSession(session);

    const stepRes = await server.inject({
      method: 'POST',
      url: '/api/onboarding/step',
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      payload: {
        step: 4,
        data: {
          clientName: 'Dr. Sneha Dental Multispecialty',
          modelType: 'DIRECT_BUSINESS',
          industryCategory: 'HEALTHCARE',
          subcategory: 'DENTAL',
          operatingLocation: 'Hosapete, Karnataka',
          primaryPhone: '+91 83 9422 1100',
        },
      },
    });

    expect(stepRes.statusCode).toBe(200);
    const body = JSON.parse(stepRes.body);
    expect(body.success).toBe(true);
    expect(body.workspace.modelType).toBe('DIRECT_BUSINESS');
    expect(body.workspace.subcategory).toBe('DENTAL');
    expect(body.workspace.organizationId).toBe(DIRECT_CLINIC_ORG_ID);
  });

  // Test 4: Path B — Direct real estate user completes onboarding
  it('4. allows direct real-estate user to complete onboarding and launch agent', async () => {
    const session = sessionForVictimOrg();
    const token = serializeSession(session);

    const finishRes = await server.inject({
      method: 'POST',
      url: '/api/onboarding/step',
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      payload: {
        step: 7,
        complete: true,
        data: {
          clientName: 'Victim Heights Layout',
          modelType: 'DIRECT_BUSINESS',
          industryCategory: 'REAL_ESTATE',
          subcategory: 'SALES',
          agentName: 'Sahana',
          startingTemplateId: 'lead-followup',
        },
      },
    });

    expect(finishRes.statusCode).toBe(200);
    const body = JSON.parse(finishRes.body);
    expect(body.isComplete).toBe(true);
    expect(body.workspace.onboardingCompleted).toBe(true);
    expect(body.workspace.aiEmployee.status).toBe('READY');
  });

  // Test 5: Resuming onboarding progress on browser reload
  it('5. returns current onboarding state and resumes progress on refresh', async () => {
    const session = sessionForDirectClinic();
    const token = serializeSession(session);

    const res = await server.inject({
      method: 'GET',
      url: '/api/onboarding/state',
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.organizationId).toBe(DIRECT_CLINIC_ORG_ID);
    expect(body.workspaces.length).toBeGreaterThanOrEqual(1);
    expect(body.currentStep).toBeGreaterThanOrEqual(4);
  });

  // Test 6: Switching between two authorized client workspaces
  it('6. allows agency to switch active client workspace context safely', async () => {
    const session = sessionForAgency();
    const token = serializeSession(session);

    const listRes = await server.inject({
      method: 'GET',
      url: '/api/workspaces',
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
    const workspaces = JSON.parse(listRes.body).workspaces;
    const targetWs = workspaces[0];

    const switchRes = await server.inject({
      method: 'POST',
      url: `/api/workspaces/${targetWs.id}/switch`,
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });

    expect(switchRes.statusCode).toBe(200);
    const cookies = switchRes.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies?.toString()).toContain('vanni_active_workspace');
  });

  // Test 7: Unauthorized access rejection (Tenant Isolation)
  it('7. strictly rejects access to another organization workspace with 403 Forbidden', async () => {
    // Agency user tries to access Victim Org's workspace
    const victimSession = sessionForVictimOrg();
    const victimToken = serializeSession(victimSession);

    // Get victim workspace ID
    const victimListRes = await server.inject({
      method: 'GET',
      url: '/api/workspaces',
      headers: { cookie: `${SESSION_COOKIE_NAME}=${victimToken}` },
    });
    const victimWsId = JSON.parse(victimListRes.body).workspaces[0].id;

    // Attacker (agency) tries to access victim workspace
    const attackerSession = sessionForAgency();
    const attackerToken = serializeSession(attackerSession);

    const breachRes = await server.inject({
      method: 'GET',
      url: `/api/workspaces/${victimWsId}`,
      headers: { cookie: `${SESSION_COOKIE_NAME}=${attackerToken}` },
    });

    expect(breachRes.statusCode).toBe(403);
    const body = JSON.parse(breachRes.body);
    expect(body.error).toBe('FORBIDDEN');
  });

  // Test 8: Idempotent step submission
  it('8. handles duplicate step submissions idempotently without creating redundant records', async () => {
    const session = sessionForDirectClinic();
    const token = serializeSession(session);

    const payload = {
      step: 5,
      data: {
        languagePreferences: {
          primary: 'kn-IN',
          conversationalStyle: 'POLITE_BUSINESS',
          regionalDialect: 'KANNADA_STANDARD_POLITE',
        },
      },
    };

    const res1 = await server.inject({
      method: 'POST',
      url: '/api/onboarding/step',
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      payload,
    });

    const res2 = await server.inject({
      method: 'POST',
      url: '/api/onboarding/step',
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      payload,
    });

    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(200);
    expect(JSON.parse(res1.body).workspace.id).toBe(JSON.parse(res2.body).workspace.id);
  });

  // Test 9: Changing client industry with data preservation
  it('9. preserves existing data when updating client industry configuration', async () => {
    const session = sessionForAgency();
    const token = serializeSession(session);

    const listRes = await server.inject({
      method: 'GET',
      url: '/api/workspaces',
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
    const ws = JSON.parse(listRes.body).workspaces[0];

    const updateRes = await server.inject({
      method: 'PUT',
      url: `/api/workspaces/${ws.id}`,
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      payload: {
        subcategory: 'DEVELOPER',
        operatingLocation: 'New Central Office, Ballari',
      },
    });

    expect(updateRes.statusCode).toBe(200);
    const updated = JSON.parse(updateRes.body).workspace;
    expect(updated.subcategory).toBe('DEVELOPER');
    expect(updated.name).toBe(ws.name); // Preserved
    expect(updated.primaryPhone).toBe(ws.primaryPhone); // Preserved
  });

  // Test 10: Process restart persistence verification
  it('10. guarantees client workspaces survive backend process reload', async () => {
    const session = sessionForAgency();
    const token = serializeSession(session);

    // Fetch existing workspaces
    const preRes = await server.inject({
      method: 'GET',
      url: '/api/workspaces',
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
    const preCount = JSON.parse(preRes.body).workspaces.length;
    expect(preCount).toBeGreaterThan(0);

    // Simulate process reboot by creating new DurableDatabaseService instance
    const freshDb = new DurableDatabaseService();
    const recoveredWorkspaces = await freshDb.getClientWorkspacesByOrg(AGENCY_ORG_ID);
    expect(recoveredWorkspaces.length).toBe(preCount);
    expect(recoveredWorkspaces[0].name).toBeDefined();
  });
});
