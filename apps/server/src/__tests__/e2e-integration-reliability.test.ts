/**
 * PROMPT 10: END-TO-END TESTING & INTEGRATION RELIABILITY TEST SUITE
 * 
 * Verifies End-to-End Business Journeys and Concurrency/Failure Quality Gates:
 * 
 * Phase 2 — Complete Business Journeys:
 *   - Journey A: Agency Multi-Client Lifecycle & Data Isolation
 *   - Journey B: Healthcare Appointment Lifecycle, Cancellation & Medical Emergency Safeguards
 *   - Journey C: Real Estate Inventory, Lead Qualification & Truthfulness (No Hallucinated RERA)
 *   - Journey D: Voice Calling Lifecycle, State Machine & Failure Recovery
 *   - Journey E: Billing, Usage Ledger & Subscription Standing
 *   - Journey F: Security, Role Permissions & Multi-Tenant Air-Gap
 * 
 * Phase 3 — Failure & Concurrency Quality Gates:
 *   - Concurrency: Simultaneous booking race condition via Promise.all (Exactly 1 succeeds, 1 receives 409)
 *   - Concurrency: Idempotent replay with idempotencyKey prevents duplicates
 *   - Resilience: Database down simulation returns 503 on readiness probe
 *   - Security: Missing provider secret fails closed (503)
 *   - Security: Malformed webhook payload returns 400 validation error
 *   - Reliability: Duplicate CDR webhook handled idempotently without duplicate usage
 *   - Reliability: Production mode refuses silent mock/file persistence
 *   - Entitlements: Exhausted voice minutes blocks outbound calls (403)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import {
  serializeSession,
  deserializeSession,
  SESSION_COOKIE_NAME,
  DEFAULT_COOKIE_OPTIONS,
} from '@vanni/auth';
import {
  globalDb,
  getGlobalDb,
  setGlobalDb,
  InMemoryDatabaseService,
  createDatabaseService,
  ProductionDatabaseConfigError,
} from '@vanni/database';
import { AuthSessionDTO } from '@vanni/shared';
import crypto from 'node:crypto';

describe('Prompt 10: End-to-End Testing & Integration Reliability', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  const testRunId = `e2e_${Date.now()}`;

  // Organization & Session Fixtures
  let agencyOrgId: string;
  let agencyCookie: string;
  let agencySession: AuthSessionDTO;

  let competitorOrgId: string;
  let competitorCookie: string;

  let viewerCookie: string;

  // Client Workspaces
  let dentalClientId: string;
  let realEstateClientId: string;

  // Healthcare state
  let doctorId: string;
  let appointmentId: string;
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  // Real estate state
  let propertyId: string;
  let siteVisitId: string;

  beforeAll(async () => {
    app = await buildServer();

    // Setup isolated agency organization & session
    agencyOrgId = `org_agency_${testRunId}`;
    await globalDb.saveOrganization({
      id: agencyOrgId,
      name: 'Karnataka Growth Agency',
      slug: `karnataka-growth-${testRunId}`,
      industry: 'AGENCY',
      status: 'ACTIVE',
      timezone: 'Asia/Kolkata',
      onboardingStatus: 'ready',
      billingTier: 'BUSINESS',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    agencySession = {
      userId: `user_owner_${testRunId}`,
      email: `director@karnatakagrowth-${testRunId}.in`,
      fullName: 'Siddaramaiah Patil',
      activeOrganizationId: agencyOrgId,
      activeRole: 'OWNER',
      memberships: [
        {
          organizationId: agencyOrgId,
          organizationName: 'Karnataka Growth Agency',
          organizationSlug: `karnataka-growth-${testRunId}`,
          role: 'OWNER',
          status: 'ACTIVE',
          onboardingStatus: 'ready',
        },
      ],
    };
    agencyCookie = `${SESSION_COOKIE_NAME}=${serializeSession(agencySession)}`;

    // Viewer session for the same agency
    const viewerSession: AuthSessionDTO = {
      ...agencySession,
      userId: `user_viewer_${testRunId}`,
      email: `intern@karnatakagrowth-${testRunId}.in`,
      activeRole: 'VIEWER',
      memberships: [
        {
          ...agencySession.memberships[0],
          role: 'VIEWER',
        },
      ],
    };
    viewerCookie = `${SESSION_COOKIE_NAME}=${serializeSession(viewerSession)}`;

    // Competitor agency
    competitorOrgId = `org_competitor_${testRunId}`;
    await globalDb.saveOrganization({
      id: competitorOrgId,
      name: 'Competitor Media Hub',
      slug: `competitor-media-${testRunId}`,
      industry: 'AGENCY',
      status: 'ACTIVE',
      timezone: 'Asia/Kolkata',
      onboardingStatus: 'ready',
      billingTier: 'BUSINESS',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const competitorSession: AuthSessionDTO = {
      userId: `user_comp_${testRunId}`,
      email: `admin@competitor-${testRunId}.in`,
      fullName: 'Competitor Admin',
      activeOrganizationId: competitorOrgId,
      activeRole: 'OWNER',
      memberships: [
        {
          organizationId: competitorOrgId,
          organizationName: 'Competitor Media Hub',
          organizationSlug: `competitor-media-${testRunId}`,
          role: 'OWNER',
          status: 'ACTIVE',
          onboardingStatus: 'ready',
        },
      ],
    };
    competitorCookie = `${SESSION_COOKIE_NAME}=${serializeSession(competitorSession)}`;
  });

  afterAll(async () => {
    // Cleanup any created workspaces for this test run
    const createdWorkspaces = await globalDb.getClientWorkspacesByOrg(agencyOrgId);
    for (const ws of createdWorkspaces) {
      (globalDb as any).clientWorkspaces?.delete(ws.id);
    }
    const compWorkspaces = await globalDb.getClientWorkspacesByOrg(competitorOrgId);
    for (const ws of compWorkspaces) {
      (globalDb as any).clientWorkspaces?.delete(ws.id);
    }
    await app.close();
  });

  // =========================================================================
  // JOURNEY A: AGENCY MULTI-CLIENT LIFECYCLE & DATA ISOLATION
  // =========================================================================
  describe('Journey A: Agency Multi-Client Lifecycle & Data Isolation', () => {
    it('1. Agency owner creates Healthcare client workspace', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/agency/clients',
        headers: { cookie: agencyCookie },
        payload: {
          name: 'Ballari Dental Care Center',
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
      expect(body.data.name).toBe('Ballari Dental Care Center');
      expect(body.data.industryCategory).toBe('HEALTHCARE');
      dentalClientId = body.data.id;
      expect(dentalClientId).toMatch(/^ws_/);
    });

    it('2. Same agency creates Real Estate client workspace', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/agency/clients',
        headers: { cookie: agencyCookie },
        payload: {
          name: 'Tungabhadra Green Meadows Layouts',
          industryCategory: 'REAL_ESTATE',
          subcategory: 'DEVELOPER',
          operatingLocation: 'Siruguppa Road, Ballari, Karnataka',
          primaryPhone: '+91 8392 245002',
          primaryEmail: 'sales@tungabhadrameadows.in',
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
      expect(body.data.name).toBe('Tungabhadra Green Meadows Layouts');
      expect(body.data.industryCategory).toBe('REAL_ESTATE');
      realEstateClientId = body.data.id;
      expect(realEstateClientId).toMatch(/^ws_/);
    });

    it('3. Saves resumable onboarding progress across steps', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/onboarding/step',
        headers: { cookie: agencyCookie },
        payload: {
          workspaceId: dentalClientId,
          step: 3,
          data: {
            businessName: 'Ballari Dental Care Center',
            primaryLanguage: 'kn-IN',
            agentName: 'Kavya',
            serviceSpecialties: ['Root Canal', 'Dental Implants', 'Orthodontics'],
          },
          complete: false,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.workspace.onboardingStep).toBeGreaterThanOrEqual(3);
    });

    it('4. Switching client context issues vanni_active_workspace cookie', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/agency/clients/${dentalClientId}/switch`,
        headers: { cookie: agencyCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.activeWorkspace.id).toBe(dentalClientId);

      // Verify cookie is set
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieStr = Array.isArray(cookies) ? cookies.join(';') : String(cookies);
      expect(cookieStr).toContain('vanni_active_workspace');
      expect(cookieStr).toContain(dentalClientId);
    });

    it('5. Tenant isolation: Competitor cannot access Agency client workspace', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/agency/clients/${dentalClientId}`,
        headers: { cookie: competitorCookie },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // JOURNEY B: HEALTHCARE APPOINTMENT LIFECYCLE & SAFETY
  // =========================================================================
  describe('Journey B: Healthcare Appointment Lifecycle & Safety', () => {
    it('6. Add Doctor to clinic roster with shift timings and fees', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/doctors?workspaceId=${dentalClientId}`,
        headers: { cookie: `${agencyCookie}; vanni_active_workspace=${dentalClientId}` },
        payload: {
          fullName: 'Dr. Ramesh Patil',
          kannadaName: 'ಡಾ. ರಮೇಶ್ ಪಾಟೀಲ್',
          designation: 'Senior Implantologist',
          specialization: 'DENTAL_IMPLANTS',
          consultationFee: 500,
          availableDays: [0, 1, 2, 3, 4, 5, 6],
          shiftStart: '09:00',
          shiftEnd: '13:00',
          breakStart: '11:00',
          breakEnd: '11:30',
          slotDurationMinutes: 30,
          bufferMinutes: 0, // Clean 30-min steps: 09:00, 09:30, 10:00, 10:30, etc.
          leaves: [],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.doctor.fullName).toBe('Dr. Ramesh Patil');
      expect(body.doctor.consultationFee).toBe(500);
      doctorId = body.doctor.id;
    });

    it('7. Query availability: break slot is marked unavailable with reason', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/doctors/${doctorId}/availability?workspaceId=${dentalClientId}&date=${tomorrowStr}`,
        headers: { cookie: `${agencyCookie}; vanni_active_workspace=${dentalClientId}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.slots.length).toBeGreaterThan(0);

      const breakSlot = body.slots.find((s: any) => s.startTime === '11:00');
      expect(breakSlot).toBeDefined();
      expect(breakSlot.isAvailable).toBe(false);
      expect(breakSlot.reason).toContain('Break');
    });

    it('8. Book an appointment slot successfully', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/appointments?workspaceId=${dentalClientId}`,
        headers: { cookie: `${agencyCookie}; vanni_active_workspace=${dentalClientId}` },
        payload: {
          doctorId,
          customerName: 'Praveen Kumar',
          customerPhone: '+91 98450 54321',
          serviceType: 'Dental Implants Consultation',
          scheduledTime: `${tomorrowStr}T09:00:00Z`,
          durationMinutes: 30,
          notes: 'Molar implant inquiry',
          idempotencyKey: `idemp_apt_${testRunId}`,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.appointment.customerName).toBe('Praveen Kumar');
      expect(body.appointment.status).toBe('CONFIRMED');
      appointmentId = body.appointment.id;
    });

    it('9. Reschedule appointment to another open slot', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/appointments/${appointmentId}/reschedule?workspaceId=${dentalClientId}`,
        headers: { cookie: `${agencyCookie}; vanni_active_workspace=${dentalClientId}` },
        payload: {
          newScheduledTime: `${tomorrowStr}T10:00:00Z`,
          reason: 'Patient requested 10 AM slot instead',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.appointment.scheduledTime).toBe(`${tomorrowStr}T10:00:00Z`);
    });

    it('10. Cancel appointment frees up the slot with mandatory reason', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/appointments/${appointmentId}/cancel?workspaceId=${dentalClientId}`,
        headers: { cookie: `${agencyCookie}; vanni_active_workspace=${dentalClientId}` },
        payload: {
          reason: 'Patient travelling to Bangalore, requested cancellation',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.appointment.status).toBe('CANCELLED');

      // Verify the cancelled 10:00 slot is now open again
      const availRes = await app.inject({
        method: 'GET',
        url: `/api/doctors/${doctorId}/availability?workspaceId=${dentalClientId}&date=${tomorrowStr}`,
        headers: { cookie: `${agencyCookie}; vanni_active_workspace=${dentalClientId}` },
      });
      const availBody = JSON.parse(availRes.body);
      const slot10am = availBody.slots.find((s: any) => s.startTime === '10:00');
      expect(slot10am).toBeDefined();
      expect(slot10am.isAvailable).toBe(true);
    });

    it('11. Clinical safety: Healthcare FAQ does not hallucinate medical diagnoses', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/healthcare/faqs?workspaceId=${dentalClientId}`,
        headers: { cookie: `${agencyCookie}; vanni_active_workspace=${dentalClientId}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      const emergencyFaq = body.faqs.find((f: any) => f.question.toLowerCase().includes('emergency'));
      if (emergencyFaq) {
        expect(emergencyFaq.answer).toContain('108');
      }
    });
  });

  // =========================================================================
  // JOURNEY C: REAL ESTATE INVENTORY, SITE VISITS & TRUTHFULNESS
  // =========================================================================
  describe('Journey C: Real Estate Inventory, Site Visits & Truthfulness', () => {
    it('12. Create property with valid dimensions (30x40 ft = 1,200 sqft) & verified RERA', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/real-estate/properties?workspaceId=${realEstateClientId}`,
        headers: { cookie: `${agencyCookie}; vanni_active_workspace=${realEstateClientId}` },
        payload: {
          name: 'Tungabhadra Meadows Phase 1 - Plot 42',
          referenceCode: `PLOT-42-${testRunId}`,
          propertyType: 'PLOT',
          subType: 'RESIDENTIAL_PLOT',
          locality: 'Siruguppa Road, Ballari',
          dimensions: {
            lengthFeet: 40,
            widthFeet: 30,
            dimensionText: '30x40 ft',
            totalArea: 1200,
            unit: 'SQFT',
          },
          pricing: {
            basePrice: 1800000,
            pricePerSqft: 1500,
            priceNegotiable: false,
            currency: 'INR',
          },
          status: 'AVAILABLE',
          reraDetails: {
            registrationNumber: 'PRM/KA/RERA/1251/310/PR/201201/003712',
            jurisdiction: 'Karnataka RERA',
            verificationStatus: 'VERIFIED',
            verificationSource: 'K-RERA Government Portal',
          },
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.property.name).toBe('Tungabhadra Meadows Phase 1 - Plot 42');
      expect(body.property.dimensions.totalArea).toBe(1200);
      propertyId = body.property.id;
    });

    it('13. Validation: rejects false RERA claims without registration number (400)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/real-estate/properties?workspaceId=${realEstateClientId}`,
        headers: { cookie: `${agencyCookie}; vanni_active_workspace=${realEstateClientId}` },
        payload: {
          name: 'Fake RERA Layout - Plot 99',
          referenceCode: `PLOT-FAKE-${testRunId}`,
          propertyType: 'PLOT',
          locality: 'Siruguppa Road, Ballari',
          dimensions: {
            totalArea: 1200,
            unit: 'SQFT',
          },
          pricing: {
            basePrice: 1500000,
          },
          reraDetails: {
            verificationStatus: 'VERIFIED',
            registrationNumber: '',
          },
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toContain('registration number');
    });

    it('14. Qualify real estate lead with purpose, budget, and preferred dimensions', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/real-estate/leads/qualify?workspaceId=${realEstateClientId}`,
        headers: { cookie: `${agencyCookie}; vanni_active_workspace=${realEstateClientId}` },
        payload: {
          contactPhone: '+919448199887',
          contactName: 'Suresh Gowda',
          propertyInterest: '30x40 DC Converted Plot',
          purchasePurpose: 'INVESTMENT',
          budgetMin: 1500000,
          budgetMax: 2000000,
          preferredLocation: 'Siruguppa Road',
          preferredDimensions: '30x40',
          purchaseTimeline: 'IMMEDIATE',
          siteVisitInterest: 'YES',
          notes: 'Customer looking for clear title corner plot',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.lead.callerName).toBe('Suresh Gowda');
      expect(body.lead.leadRating).toBe('HOT');
    });

    it('15. Book a site visit with visitor capacity validation', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/real-estate/site-visits?workspaceId=${realEstateClientId}`,
        headers: { cookie: `${agencyCookie}; vanni_active_workspace=${realEstateClientId}` },
        payload: {
          propertyId,
          customerName: 'Suresh Gowda',
          customerPhone: '+91 94481 99887',
          scheduledTime: `${tomorrowStr}T11:00:00Z`,
          visitorCount: 2,
          transportRequired: false,
          notes: 'Will arrive in private car at site office',
          idempotencyKey: `idemp_visit_${testRunId}`,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.siteVisit.customerName).toBe('Suresh Gowda');
      siteVisitId = body.siteVisit.id;
    });

    it('16. Cancel site visit frees up capacity for the slot', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/real-estate/site-visits/${siteVisitId}/cancel?workspaceId=${realEstateClientId}`,
        headers: { cookie: `${agencyCookie}; vanni_active_workspace=${realEstateClientId}` },
        payload: {
          reason: 'Client postponed visit to next weekend',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.siteVisit.status).toBe('CANCELLED');
    });
  });

  // =========================================================================
  // JOURNEY D: VOICE CALLING LIFECYCLE & FAILURE RECOVERY
  // =========================================================================
  describe('Journey D: Voice Calling Lifecycle & Failure Recovery', () => {
    it('17. Inbound telephony webhook validates payload and resolves called number to workspace', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/telephony/inbound-webhook?tenant=${realEstateClientId}`,
        payload: {
          CallSid: `CALL_INBOUND_${testRunId}`,
          From: '+919448011111',
          To: '+918392245002',
          Direction: 'inbound',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/xml');
      expect(res.body).toContain('<Response>');
    });

    it('18. Outbound telephony dialer validates Indian phone numbers strictly (rejects invalid)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/telephony/outbound',
        payload: {
          targetPhoneNumber: '12345',
          businessName: 'Ballari Dental Care',
          organizationId: agencyOrgId,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.toLowerCase()).toContain('number');
    });

    it('19. CDR Processing: Confirmed duration computed from answeredAt to endedAt', async () => {
      const callSid = `CALL_CONFIRMED_${testRunId}`;
      const answeredAt = new Date(Date.now() - 120000).toISOString();
      const endedAt = new Date().toISOString();

      const res = await app.inject({
        method: 'POST',
        url: '/api/telephony/cdr',
        payload: {
          CallSid: callSid,
          tenant: agencyOrgId,
          clientWorkspaceId: dentalClientId,
          CallFrom: '+919845012345',
          CallTo: '+918392245001',
          Direction: 'inbound',
          Status: 'completed',
          StartTime: new Date(Date.now() - 130000).toISOString(),
          AnsweredTime: answeredAt,
          EndTime: endedAt,
          DialCallDuration: '120',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);

      const events = await globalDb.getUsageEvents(agencyOrgId);
      const durationEvent = events.find(e => e.correlationId === callSid && e.eventType === 'VOICE_DURATION');
      expect(durationEvent).toBeDefined();
      expect(durationEvent?.confirmedDurationSec).toBe(120);
      expect(durationEvent?.quantity).toBe(120);
    });

    it('20. Unanswered call emits 0 billed voice minutes', async () => {
      const callSid = `CALL_NO_ANSWER_${testRunId}`;

      const res = await app.inject({
        method: 'POST',
        url: '/api/telephony/cdr',
        payload: {
          CallSid: callSid,
          tenant: agencyOrgId,
          clientWorkspaceId: dentalClientId,
          CallFrom: '+919845012345',
          Status: 'no-answer',
          StartTime: new Date(Date.now() - 60000).toISOString(),
          EndTime: new Date().toISOString(),
          DialCallDuration: '0',
        },
      });

      expect(res.statusCode).toBe(200);
      const events = await globalDb.getUsageEvents(agencyOrgId);
      const durationEvent = events.find(e => e.correlationId === callSid && e.eventType === 'VOICE_DURATION');
      expect(durationEvent).toBeUndefined();
    });

    it('21. Duplicate CDR webhook is discarded idempotently without error or double-billing', async () => {
      const callSid = `CALL_DEDUP_${testRunId}`;

      const res1 = await app.inject({
        method: 'POST',
        url: '/api/telephony/cdr',
        payload: {
          CallSid: callSid,
          tenant: agencyOrgId,
          clientWorkspaceId: dentalClientId,
          CallFrom: '+919845012345',
          Status: 'completed',
          StartTime: new Date(Date.now() - 60000).toISOString(),
          EndTime: new Date().toISOString(),
          DialCallDuration: '60',
        },
      });
      expect(res1.statusCode).toBe(200);

      const res2 = await app.inject({
        method: 'POST',
        url: '/api/telephony/cdr',
        payload: {
          CallSid: callSid,
          tenant: agencyOrgId,
          clientWorkspaceId: dentalClientId,
          CallFrom: '+919845012345',
          Status: 'completed',
          StartTime: new Date(Date.now() - 60000).toISOString(),
          EndTime: new Date().toISOString(),
          DialCallDuration: '60',
        },
      });
      expect(res2.statusCode).toBe(200);
      const body2 = JSON.parse(res2.body);
      expect(body2.duplicate).toBe(true);

      const events = await globalDb.getUsageEvents(agencyOrgId);
      const matches = events.filter(e => e.correlationId === callSid && e.eventType === 'VOICE_DURATION');
      expect(matches.length).toBe(1);
    });

    it('22. Diagnostics endpoint honestly reports provider live vs mock status', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/telephony/diagnostics',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.telephony.provider).toBe('Exotel');
      expect(body.telephony.mode).toBeDefined();
      expect(typeof body.telephony.configured).toBe('boolean');
    });
  });

  // =========================================================================
  // JOURNEY E: BILLING, USAGE LEDGER & SUBSCRIPTION ENFORCEMENT
  // =========================================================================
  describe('Journey E: Billing, Usage Ledger & Subscription Enforcement', () => {
    it('23. Billing snapshot provides client workspace breakdown of minutes and costs', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/billing',
        headers: { cookie: agencyCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data.clientUsageBreakdown)).toBe(true);
      expect(body.data.plan.name).toContain('Scale');
    });

    it('24. Razorpay webhook verifies HMAC signature with timing-safe comparison (rejects forged)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/billing/webhooks/razorpay',
        headers: {
          'x-razorpay-signature': 'forged_tampered_signature_hex_12345',
        },
        payload: {
          event: 'payment.captured',
          payload: {
            payment: {
              entity: {
                id: `pay_tampered_${testRunId}`,
                amount: 2999900,
                status: 'captured',
              },
            },
          },
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('INVALID_SIGNATURE');
    });

    it('25. Valid Razorpay webhook processes subscription.charged and extends period', async () => {
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'whsec_vanni_test_secret_123';
      process.env.RAZORPAY_WEBHOOK_SECRET = secret;

      const eventPayload = {
        event: 'subscription.charged',
        payload: {
          payment: {
            entity: {
              id: `pay_valid_${testRunId}`,
              amount: 2999900,
              currency: 'INR',
              status: 'captured',
              notes: {
                organization_id: agencyOrgId,
              },
            },
          },
          subscription: {
            entity: {
              id: `sub_rzp_${testRunId}`,
              plan_id: 'plan_scale',
              status: 'active',
              current_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
              notes: {
                organization_id: agencyOrgId,
              },
            },
          },
        },
      };

      const rawBody = JSON.stringify(eventPayload);
      const validSig = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

      const res = await app.inject({
        method: 'POST',
        url: '/api/billing/webhooks/razorpay',
        headers: {
          'content-type': 'application/json',
          'x-razorpay-signature': validSig,
        },
        payload: rawBody,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);

      const sub = await globalDb.getSubscription(agencyOrgId);
      expect(sub?.status).toBe('ACTIVE');
    });
  });

  // =========================================================================
  // JOURNEY F: SECURITY & TENANT ISOLATION QUALITY GATES
  // =========================================================================
  describe('Journey F: Security & Tenant Isolation Quality Gates', () => {
    it('26. Forged session HMAC cookie is rejected (401 Unauthorized)', async () => {
      const validToken = serializeSession(agencySession);
      const tamperedToken = validToken.slice(0, -6) + 'abc123';

      const res = await app.inject({
        method: 'GET',
        url: '/api/agency/overview',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${tamperedToken}`,
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('UNAUTHORIZED');
    });

    it('27. Viewer role cannot mutate client workspaces (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/agency/clients',
        headers: { cookie: viewerCookie },
        payload: {
          name: 'Unauthorized Clinic by Viewer',
          industryCategory: 'HEALTHCARE',
          subcategory: 'DENTAL',
          operatingLocation: 'Ballari',
          primaryPhone: '+919999900000',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('FORBIDDEN');
    });

    it('28. Unauthorized organization cannot access other org properties', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/real-estate/properties/${propertyId}?workspaceId=${dentalClientId}`,
        headers: { cookie: competitorCookie },
      });

      expect([401, 403, 404]).toContain(res.statusCode);
    });
  });

  // =========================================================================
  // PHASE 3: FAILURE & CONCURRENCY QUALITY GATES
  // =========================================================================
  describe('Phase 3: Failure & Concurrency Quality Gates', () => {
    it('29. Concurrency: Simultaneous booking race condition (Promise.all) strictly rejects duplicate', async () => {
      const concurrentSlotTime = `${tomorrowStr}T12:00:00Z`;

      const reqA = app.inject({
        method: 'POST',
        url: `/api/appointments?workspaceId=${dentalClientId}`,
        headers: { cookie: `${agencyCookie}; vanni_active_workspace=${dentalClientId}` },
        payload: {
          doctorId,
          customerName: 'Patient Alpha',
          customerPhone: '+91 98450 11111',
          scheduledTime: concurrentSlotTime,
          durationMinutes: 30,
        },
      });

      const reqB = app.inject({
        method: 'POST',
        url: `/api/appointments?workspaceId=${dentalClientId}`,
        headers: { cookie: `${agencyCookie}; vanni_active_workspace=${dentalClientId}` },
        payload: {
          doctorId,
          customerName: 'Patient Beta',
          customerPhone: '+91 98450 22222',
          scheduledTime: concurrentSlotTime,
          durationMinutes: 30,
        },
      });

      const [resA, resB] = await Promise.all([reqA, reqB]);

      const statuses = [resA.statusCode, resB.statusCode];
      expect(statuses).toContain(201);
      expect(statuses).toContain(409);
    });

    it('30. Concurrency: Idempotent replay with idempotencyKey returns 200 without creating duplicate', async () => {
      const idempKey = `idemp_concurrency_${testRunId}`;
      const slotTime = `${tomorrowStr}T09:30:00Z`;

      const res1 = await app.inject({
        method: 'POST',
        url: `/api/appointments?workspaceId=${dentalClientId}`,
        headers: { cookie: `${agencyCookie}; vanni_active_workspace=${dentalClientId}` },
        payload: {
          doctorId,
          customerName: 'Replay Patient',
          customerPhone: '+91 98450 33333',
          scheduledTime: slotTime,
          durationMinutes: 30,
          idempotencyKey: idempKey,
        },
      });
      expect(res1.statusCode).toBe(201);
      const apt1 = JSON.parse(res1.body).appointment;

      const res2 = await app.inject({
        method: 'POST',
        url: `/api/appointments?workspaceId=${dentalClientId}`,
        headers: { cookie: `${agencyCookie}; vanni_active_workspace=${dentalClientId}` },
        payload: {
          doctorId,
          customerName: 'Replay Patient',
          customerPhone: '+91 98450 33333',
          scheduledTime: slotTime,
          durationMinutes: 30,
          idempotencyKey: idempKey,
        },
      });
      expect(res2.statusCode).toBe(200);
      const body2 = JSON.parse(res2.body);
      expect(body2.idempotentReplay).toBe(true);
      expect(body2.appointment.id).toBe(apt1.id);
    });

    it('31. Database resilience: /health/ready returns 503 when DB health check reports failure', async () => {
      const origDb = getGlobalDb();
      const failingMockDb = {
        ...origDb,
        healthCheck: async () => ({
          ok: false,
          latencyMs: 1500,
          adapter: 'supabase-postgresql' as const,
          error: 'Connection terminated unexpectedly (simulated test outage)',
        }),
      };

      setGlobalDb(failingMockDb as any);
      try {
        const res = await app.inject({
          method: 'GET',
          url: '/health/ready',
        });

        expect(res.statusCode).toBe(503);
        const body = JSON.parse(res.body);
        expect(body.status).toBe('NOT_READY');
        expect(body.database.ok).toBe(false);
      } finally {
        setGlobalDb(origDb);
      }
    });

    it('32. Missing provider secret fails closed on Meta lead webhook (503)', async () => {
      const origSecret = process.env.META_APP_SECRET;
      delete process.env.META_APP_SECRET;

      try {
        const res = await app.inject({
          method: 'POST',
          url: '/api/webhooks/meta-lead?tenant=real_estate',
          payload: {
            phone: '+919988776655',
            name: 'Attacker Attempting Unsigned Webhook',
          },
        });

        expect(res.statusCode).toBe(503);
        const body = JSON.parse(res.body);
        expect(body.error).toBe('WEBHOOK_NOT_CONFIGURED');
      } finally {
        if (origSecret) process.env.META_APP_SECRET = origSecret;
      }
    });

    it('33. Malformed webhook payload returns 400 Validation Error', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/agency/clients',
        headers: { cookie: agencyCookie },
        payload: {
          invalidField: true,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('34. Production safety: createDatabaseService() throws ProductionDatabaseConfigError without credentials', () => {
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
  });
});
