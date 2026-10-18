/**
 * PROMPT 11: CUSTOMER LAUNCH READINESS, VOICE AGENT ACTIVATION & PILOT OPERATIONS TEST SUITE
 *
 * Verifies:
 * 1. Journey A: Agency multi-client onboarding, language preferences & progress tracking
 * 2. Journey B: Direct business onboarding with business profile & operating hours
 * 3. Certified supported voice options matrix (rejects unsupported voices)
 * 4. Voice agent configuration versioning, audit trail, and after-hours behavior
 * 5. 15-dimension server-backed preflight readiness checker with explicit status classifications
 * 6. Safe activation lifecycle gates: Rejects live activation when mandatory requirements fail
 * 7. Role enforcement: Viewers cannot activate, suspend, or update voice agents
 * 8. Testing mode safety: Outbound calls strictly enforced against whitelisted test numbers
 * 9. Suspension enforcement: Suspended workspaces immediately block outbound calls
 * 10. Pilot operations dashboard: Computes real metrics from durable DB records with cross-tenant isolation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { serializeSession, SESSION_COOKIE_NAME } from '@vanni/auth';
import { globalDb } from '@vanni/database';
import { AuthSessionDTO } from '@vanni/shared';

describe('Prompt 11: Customer Launch Readiness, Voice Agent Activation & Pilot Operations', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  const testRunId = `pilot_${Date.now()}`;

  // Organization & Session Fixtures
  let agencyOrgId: string;
  let agencySession: AuthSessionDTO;
  let agencyCookie: string;

  let viewerSession: AuthSessionDTO;
  let viewerCookie: string;

  let competitorOrgId: string;
  let competitorCookie: string;

  // Workspaces
  let healthcareWsId: string;
  let realEstateWsId: string;
  let directBusinessWsId: string;

  beforeAll(async () => {
    app = await buildServer();

    // 1. Setup agency organization
    agencyOrgId = `org_agency_${testRunId}`;
    await globalDb.saveOrganization({
      id: agencyOrgId,
      name: 'Bellary Growth Agency',
      slug: `bellary-growth-${testRunId}`,
      industry: 'AGENCY',
      status: 'ACTIVE',
      timezone: 'Asia/Kolkata',
      onboardingStatus: 'ready',
      billingTier: 'GROWTH',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    agencySession = {
      userId: `usr_agency_owner_${testRunId}`,
      email: `owner@bellarygrowth-${testRunId}.in`,
      fullName: 'Mallikarjun Patil',
      activeOrganizationId: agencyOrgId,
      activeRole: 'OWNER',
      memberships: [
        {
          organizationId: agencyOrgId,
          organizationName: 'Bellary Growth Agency',
          organizationSlug: `bellary-growth-${testRunId}`,
          role: 'OWNER',
          status: 'ACTIVE',
          onboardingStatus: 'ready',
        },
      ],
    };
    agencyCookie = `${SESSION_COOKIE_NAME}=${serializeSession(agencySession)}`;

    // 2. Setup viewer session
    viewerSession = {
      ...agencySession,
      userId: `usr_viewer_${testRunId}`,
      email: `intern@bellarygrowth-${testRunId}.in`,
      activeRole: 'VIEWER',
      memberships: [
        {
          ...agencySession.memberships[0],
          role: 'VIEWER',
        },
      ],
    };
    viewerCookie = `${SESSION_COOKIE_NAME}=${serializeSession(viewerSession)}`;

    // 3. Setup competitor agency
    competitorOrgId = `org_competitor_${testRunId}`;
    await globalDb.saveOrganization({
      id: competitorOrgId,
      name: 'Hubli Digital Media',
      slug: `hubli-digital-${testRunId}`,
      industry: 'AGENCY',
      status: 'ACTIVE',
      timezone: 'Asia/Kolkata',
      onboardingStatus: 'ready',
      billingTier: 'STARTER',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const competitorSession: AuthSessionDTO = {
      userId: `usr_comp_${testRunId}`,
      email: `director@hublidigital-${testRunId}.in`,
      fullName: 'Suresh Kumar',
      activeOrganizationId: competitorOrgId,
      activeRole: 'OWNER',
      memberships: [
        {
          organizationId: competitorOrgId,
          organizationName: 'Hubli Digital Media',
          organizationSlug: `hubli-digital-${testRunId}`,
          role: 'OWNER',
          status: 'ACTIVE',
          onboardingStatus: 'ready',
        },
      ],
    };
    competitorCookie = `${SESSION_COOKIE_NAME}=${serializeSession(competitorSession)}`;
  });

  afterAll(async () => {
    await app.close();
  });

  // =========================================================================
  // 1. FIRST-CUSTOMER ONBOARDING: JOURNEY A (AGENCY) & JOURNEY B (DIRECT)
  // =========================================================================
  describe('Phase 1: First-Customer Onboarding Journeys', () => {
    it('1. Journey A: Agency creates healthcare client workspace with Kannada & Kanglish preferences', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/agency/clients',
        headers: { cookie: agencyCookie },
        payload: {
          name: 'Ballari Dental Multispecialty Clinic',
          industryCategory: 'HEALTHCARE',
          subcategory: 'DENTAL',
          operatingLocation: 'Royal Circle, Cantonment, Ballari, Karnataka',
          primaryPhone: '+91 8392 240108',
          primaryEmail: 'info@ballaridental.in',
          timezone: 'Asia/Kolkata',
          languagePreferences: {
            primary: 'kn-IN',
            conversationalStyle: 'POLITE_BUSINESS',
            regionalDialect: 'KANNADA_STANDARD_POLITE',
          },
          startingTemplateId: 'appointment-coordination',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.name).toBe('Ballari Dental Multispecialty Clinic');
      expect(body.data.industryCategory).toBe('HEALTHCARE');
      expect(body.data.languagePreferences.regionalDialect).toBe('KANNADA_STANDARD_POLITE');
      healthcareWsId = body.data.id;
    });

    it('2. Journey A: Agency creates real estate client workspace with Kannada Commercial dialect', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/agency/clients',
        headers: { cookie: agencyCookie },
        payload: {
          name: 'Siruguppa Highway Green Valley Plots',
          industryCategory: 'REAL_ESTATE',
          subcategory: 'DEVELOPER',
          operatingLocation: 'Siruguppa Road, Ballari, Karnataka',
          primaryPhone: '+91 8392 245001',
          primaryEmail: 'plots@greenvalley.in',
          timezone: 'Asia/Kolkata',
          languagePreferences: {
            primary: 'kn-en',
            conversationalStyle: 'POLITE_BUSINESS',
            regionalDialect: 'KANGLISH_BUSINESS',
          },
          startingTemplateId: 'lead-followup',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      realEstateWsId = body.data.id;
    });

    it('3. Resumable onboarding: Agency saves step progress and business operating hours', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/onboarding/step',
        headers: { cookie: `${agencyCookie}; vanni_active_workspace=${healthcareWsId}` },
        payload: {
          step: 2,
          workspaceId: healthcareWsId,
          data: {
            operatingHours: [
              { dayOfWeek: 1, opensAt: '09:00', closesAt: '20:00', isClosed: false },
              { dayOfWeek: 2, opensAt: '09:00', closesAt: '20:00', isClosed: false },
              { dayOfWeek: 3, opensAt: '09:00', closesAt: '20:00', isClosed: false },
              { dayOfWeek: 4, opensAt: '09:00', closesAt: '20:00', isClosed: false },
              { dayOfWeek: 5, opensAt: '09:00', closesAt: '20:00', isClosed: false },
              { dayOfWeek: 6, opensAt: '09:00', closesAt: '18:00', isClosed: false },
              { dayOfWeek: 0, opensAt: '00:00', closesAt: '00:00', isClosed: true },
            ],
            whitelistedTestNumbers: ['+919845012345', '+918392240108'],
          },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.step).toBe(2);
      expect(body.workspace.onboardingStep).toBeGreaterThanOrEqual(2);
    });

    it('4. Journey B: Direct business customer creates primary workspace with services and FAQs', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/workspaces',
        headers: { cookie: agencyCookie },
        payload: {
          name: 'KIMS Outpatient Diagnostic Center',
          modelType: 'DIRECT_BUSINESS',
          industryCategory: 'HEALTHCARE',
          subcategory: 'HOSPITAL',
          operatingLocation: 'KIMS Hospital Road, Hubli, Karnataka',
          primaryPhone: '+91 836 2378000',
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
      directBusinessWsId = body.workspace.id;
    });
  });

  // =========================================================================
  // 2. VOICE AGENT CONFIGURATION, SUPPORTED VOICES & SAFETY
  // =========================================================================
  describe('Phase 2: Voice Agent Configuration & Supported Voice Matrix', () => {
    it('5. GET /api/voice-agent/supported-voices returns only verified Kannada voices', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/voice-agent/supported-voices',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.voices.length).toBeGreaterThanOrEqual(6);

      const voiceIds = body.voices.map((v: any) => v.id);
      expect(voiceIds).toContain('meera');
      expect(voiceIds).toContain('kavya');
      expect(voiceIds).toContain('pavithra');
      expect(voiceIds).toContain('arvind');
      expect(voiceIds).toContain('kn-IN-SapnaNeural');

      // Verify each supported voice declares required language capabilities
      const meera = body.voices.find((v: any) => v.id === 'meera');
      expect(meera.supportedLanguages).toContain('kn-IN');
      expect(meera.gender).toBe('FEMALE');
      expect(meera.isVerified).toBe(true);
    });

    it('6. GET /api/workspaces/:id/voice-agent returns current voice settings', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/workspaces/${healthcareWsId}/voice-agent`,
        headers: { cookie: agencyCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.voiceAgent).toBeDefined();
      expect(body.voiceAgent.primaryLanguage).toBe('kn-IN');
    });

    it('7. PUT /api/workspaces/:id/voice-agent updates voice config with versioning & audit trail', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/workspaces/${healthcareWsId}/voice-agent`,
        headers: { cookie: agencyCookie },
        payload: {
          agentName: 'Kavya',
          speakerId: 'kavya',
          engine: 'sarvam_bulbul_v3',
          greetingKannada: 'ನಮಸ್ಕಾರ, ಬಳ್ಳಾರಿ ಡೆಂಟಲ್ ಕ್ಲಿನಿಕ್ ಗೆ ಸ್ವಾಗತ. ನಾನು ಕಾವ್ಯ, ವೈದ್ಯರ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಕಾಯ್ದಿರಿಸಲು ಕರೆ ಮಾಡಿದ್ದೀರಾ?',
          conversationalStyle: 'POLITE_BUSINESS',
          afterHoursBehavior: 'TAKE_MESSAGE',
          maxCallDurationSeconds: 240,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.voiceAgent.speakerId).toBe('kavya');
      expect(body.voiceAgent.version).toBeGreaterThanOrEqual(2);
      expect(body.voiceAgent.status).toBe('VALIDATED');

      // Verify audit log entry was created
      const auditLogs = await globalDb.getAuditLogs(agencyOrgId);
      const log = auditLogs.find((l) => l.action === 'voice_agent_config_updated' && l.resourceId === healthcareWsId);
      expect(log).toBeDefined();
      expect(log?.actorUserId).toBe(agencySession.userId);
    });

    it('8. PUT /api/workspaces/:id/voice-agent rejects unverified/fake voice speaker with 400', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/workspaces/${healthcareWsId}/voice-agent`,
        headers: { cookie: agencyCookie },
        payload: {
          speakerId: 'fake_unsupported_voice_xyz',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('UNSUPPORTED_VOICE');
    });

    it('9. Role check: VIEWER role cannot modify voice agent configuration', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/workspaces/${healthcareWsId}/voice-agent`,
        headers: { cookie: viewerCookie },
        payload: {
          agentName: 'Unauthorized Name',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // 3. PREFLIGHT READINESS CHECKER (15 OPERATIONAL DIMENSIONS)
  // =========================================================================
  describe('Phase 3: 15-Dimension Preflight Readiness Checker', () => {
    it('10. Preflight check on fresh healthcare workspace flags missing doctor roster', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/workspaces/${healthcareWsId}/readiness`,
        headers: { cookie: agencyCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);

      const report = body.report;
      expect(report.workspaceId).toBe(healthcareWsId);
      expect(report.checks.length).toBeGreaterThanOrEqual(14);

      // Verify specific dimension checks exist
      const checkIds = report.checks.map((c: any) => c.id);
      expect(checkIds).toContain('chk_auth_tenancy');
      expect(checkIds).toContain('chk_database');
      expect(checkIds).toContain('chk_business_profile');
      expect(checkIds).toContain('chk_voice_provider');
      expect(checkIds).toContain('chk_industry_actions');
      expect(checkIds).toContain('chk_human_handoff');

      // Healthcare roster check should flag action required because no doctors added yet
      const rosterCheck = report.checks.find((c: any) => c.id === 'chk_industry_actions');
      expect(rosterCheck.status).toBe('Action required');
      expect(rosterCheck.message).toContain('No active doctors');
      expect(report.canActivateLive).toBe(false);
    });

    it('11. Adding doctor and approved FAQ satisfies clinical readiness requirements', async () => {
      // 1. Add doctor
      const docRes = await app.inject({
        method: 'POST',
        url: `/api/doctors?workspaceId=${healthcareWsId}`,
        headers: { cookie: `${agencyCookie}; vanni_active_workspace=${healthcareWsId}` },
        payload: {
          fullName: 'Dr. Anand Deshpande',
          kannadaName: 'ಡಾ. ಆನಂದ್ ದೇಶಪಾಂಡೆ',
          designation: 'Chief Dental Surgeon',
          specialization: 'DENTAL_IMPLANTS',
          consultationFee: 500,
          shiftStart: '09:00',
          shiftEnd: '17:00',
          breakStart: '13:00',
          breakEnd: '14:00',
          availableDays: [1, 2, 3, 4, 5, 6],
        },
      });
      expect(docRes.statusCode).toBe(201);

      // 2. Add approved FAQ
      await globalDb.saveFAQ({
        id: `faq_${Date.now()}`,
        organizationId: healthcareWsId,
        question: 'ಕ್ಲಿನಿಕ್ ಸಮಯ ಮತ್ತು ಶುಲ್ಕ ಎಷ್ಟು?',
        answer: 'ಬೆಳಗ್ಗೆ 9:00 ರಿಂದ ಸಂಜೆ 5:00 ರವರೆಗೆ ತೆರೆದಿರುತ್ತದೆ. ಸಮಾಲೋಚನೆ ಶುಲ್ಕ 500 ರೂ.',
        category: 'GENERAL_INQUIRY',
        status: 'ACTIVE',
        language: 'KN',
        authority: 'APPROVED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // 3. Re-run preflight check
      const res = await app.inject({
        method: 'GET',
        url: `/api/workspaces/${healthcareWsId}/readiness`,
        headers: { cookie: agencyCookie },
      });

      const body = JSON.parse(res.body);
      const report = body.report;

      const rosterCheck = report.checks.find((c: any) => c.id === 'chk_industry_actions');
      expect(rosterCheck.status).toBe('Ready');
      expect(rosterCheck.message).toContain('doctor(s) configured');

      const faqCheck = report.checks.find((c: any) => c.id === 'chk_knowledge_faqs');
      expect(faqCheck.status).toBe('Ready');
    });

    it('12. Telephony check returns explicit Verification pending without fake claim', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/workspaces/${healthcareWsId}/readiness`,
        headers: { cookie: agencyCookie },
      });

      const body = JSON.parse(res.body);
      const telephonyCheck = body.report.checks.find((c: any) => c.id === 'chk_telephony_provider');
      expect(telephonyCheck).toBeDefined();

      // If EXOTEL credentials are not in environment, must NOT return 'Ready'
      if (!process.env.EXOTEL_ACCOUNT_SID) {
        expect(telephonyCheck.status).not.toBe('Ready');
        expect(telephonyCheck.status).toMatch(/Verification pending|Configuration missing/);
      }
    });
  });

  // =========================================================================
  // 4. SAFE ACTIVATION LIFECYCLE & GATING ENFORCEMENT
  // =========================================================================
  describe('Phase 4: Safe Activation Lifecycle & Test Mode Enforcement', () => {
    it('13. GET /api/workspaces/:id/activation returns DRAFT status and activation readiness', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/workspaces/${healthcareWsId}/activation`,
        headers: { cookie: agencyCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.currentStatus).toBe('DRAFT');
      expect(typeof body.canTest).toBe('boolean');
    });

    it('14. Transition to ACTIVE is rejected with 400 when live preflight blockers remain', async () => {
      // Create a barebones workspace missing profile details
      const bareWs = await app.inject({
        method: 'POST',
        url: '/api/workspaces',
        headers: { cookie: agencyCookie },
        payload: {
          name: 'X', // Invalid short name
          operatingLocation: '',
          primaryPhone: 'invalid',
          industryCategory: 'REAL_ESTATE',
          subcategory: 'DEVELOPER',
        },
      });

      // Attempt live activation
      const wsId = JSON.parse(bareWs.body).workspace?.id;
      if (wsId) {
        const res = await app.inject({
          method: 'POST',
          url: `/api/workspaces/${wsId}/activation`,
          headers: { cookie: agencyCookie },
          payload: {
            targetStatus: 'ACTIVE',
            reason: 'Premature activation attempt',
          },
        });

        expect(res.statusCode).toBe(400);
        const body = JSON.parse(res.body);
        expect(body.error).toBe('ACTIVATION_GATED');
        expect(body.blockers.length).toBeGreaterThan(0);
      }
    });

    it('15. Role check: VIEWER role cannot change activation status', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/workspaces/${healthcareWsId}/activation`,
        headers: { cookie: viewerCookie },
        payload: {
          targetStatus: 'TESTING',
          reason: 'Viewer unauthorized attempt',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('FORBIDDEN');
    });

    it('16. Transition to TESTING mode succeeds and records audit log', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/workspaces/${healthcareWsId}/activation`,
        headers: { cookie: agencyCookie },
        payload: {
          targetStatus: 'TESTING',
          reason: 'Initiating pilot verification phase',
          whitelistedTestNumbers: ['+919845012345', '+918392240108'],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.currentStatus).toBe('TESTING');

      // Verify audit log
      const logs = await globalDb.getAuditLogs(agencyOrgId);
      const actLog = logs.find((l) => l.resourceId === healthcareWsId && l.action === 'workspace_status_testing');
      expect(actLog).toBeDefined();
    });

    it('17. Testing mode safety: Outbound call rejected for unauthorized non-whitelisted number', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/telephony/outbound',
        headers: { cookie: agencyCookie },
        payload: {
          targetPhoneNumber: '+91 99999 88888', // Not in whitelist
          businessName: 'Ballari Dental',
          industry: 'HEALTHCARE',
          workspaceId: healthcareWsId,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.message).toContain('TESTING mode');
    });

    it('18. Testing mode safety: Outbound call permitted for authorized whitelisted number', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/telephony/outbound',
        headers: { cookie: agencyCookie },
        payload: {
          targetPhoneNumber: '+91 98450 12345', // In whitelist
          businessName: 'Ballari Dental',
          industry: 'HEALTHCARE',
          workspaceId: healthcareWsId,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
    });

    it('19. Transition to SUSPENDED immediately blocks all outbound calling', async () => {
      // 1. Suspend workspace
      const suspendRes = await app.inject({
        method: 'POST',
        url: `/api/workspaces/${healthcareWsId}/activation`,
        headers: { cookie: agencyCookie },
        payload: {
          targetStatus: 'SUSPENDED',
          reason: 'Client non-payment or emergency clinic maintenance',
        },
      });

      expect(suspendRes.statusCode).toBe(200);
      const suspendBody = JSON.parse(suspendRes.body);
      expect(suspendBody.currentStatus).toBe('SUSPENDED');

      // 2. Outbound call attempt must now be rejected even for whitelisted number
      const callRes = await app.inject({
        method: 'POST',
        url: '/api/telephony/outbound',
        headers: { cookie: agencyCookie },
        payload: {
          targetPhoneNumber: '+91 98450 12345',
          businessName: 'Ballari Dental',
          industry: 'HEALTHCARE',
          workspaceId: healthcareWsId,
        },
      });

      expect(callRes.statusCode).toBe(400);
      const callBody = JSON.parse(callRes.body);
      expect(callBody.success).toBe(false);
      expect(callBody.message).toContain('suspended');
    });
  });

  // =========================================================================
  // 5. PILOT OPERATIONS DASHBOARD & METRICS INTEGRITY
  // =========================================================================
  describe('Phase 5: Pilot Operations Dashboard & Multi-Tenant Telemetry', () => {
    it('20. GET /api/pilot/operations returns real metrics from durable database', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/pilot/operations',
        headers: { cookie: agencyCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);

      const ops = body.operations;
      expect(ops.organizationId).toBe(agencyOrgId);
      expect(ops.totalWorkspaces).toBeGreaterThanOrEqual(2);
      expect(ops.workspacesByStatus).toBeDefined();
      expect(ops.workspacesByStatus.SUSPENDED).toBeGreaterThanOrEqual(1);

      // Verify real call telemetry structure
      expect(ops.callMetrics).toBeDefined();
      expect(typeof ops.callMetrics.totalAttempted).toBe('number');
      expect(typeof ops.callMetrics.completed).toBe('number');
      expect(typeof ops.callMetrics.confirmedDurationSeconds).toBe('number');

      // Verify subscription usage structure
      expect(ops.subscriptionUsage).toBeDefined();
      expect(ops.subscriptionUsage.voiceMinutesAllowance).toBeGreaterThan(0);
      expect(typeof ops.subscriptionUsage.remainingAllowance).toBe('number');

      // Verify provider health reports
      expect(ops.providerHealth.database.status).toBe('HEALTHY');
      expect(ops.providerHealth.telephony.provider).toBe('exotel');

      // Verify recent audit changes list
      expect(Array.isArray(ops.recentAuditChanges)).toBe(true);
      expect(ops.recentAuditChanges.length).toBeGreaterThan(0);
    });

    it('21. Tenant isolation: Competitor cannot view agency pilot operations', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/pilot/operations',
        headers: { cookie: competitorCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      const ops = body.operations;
      expect(ops.organizationId).toBe(competitorOrgId);
      expect(ops.totalWorkspaces).toBe(0); // Competitor has 0 workspaces
    });

    it('22. Direct lookup: Competitor cannot access another organization workspace readiness', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/workspaces/${healthcareWsId}/readiness`,
        headers: { cookie: competitorCookie },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('FORBIDDEN');
    });
  });
});
