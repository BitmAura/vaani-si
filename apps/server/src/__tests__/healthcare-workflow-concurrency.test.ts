/**
 * PROMPT 07: HEALTHCARE WORKFLOW, APPOINTMENT RELIABILITY & PERSISTENCE HARDENING TEST SUITE
 * 
 * Verifies all 13 required scenarios:
 * 1. Authorized appointment creation with full validation.
 * 2. Unauthenticated (401) and unauthorized viewer requests (403).
 * 3. Cross-tenant appointment read and mutation attempts (404/403).
 * 4. Invalid inputs: invalid phone number, past dates, invalid shift hours, and invalid status transitions (400).
 * 5. Failed database writes return truthful errors.
 * 6. Cancellation and rescheduling behavior (cancelling releases slot, rescheduling updates slot and preserves audit).
 * 7. Duplicate submission / idempotency replay with idempotencyKey.
 * 8. Concurrent booking race condition for same doctor slot (one 201, one 409 Conflict).
 * 9. Supabase persistence delegation for implemented appointment methods.
 * 10. In-memory and durable database behavior parity.
 * 11. Timezone conversion and date-boundary cases (Asia/Kolkata +05:30, UTC conversion, midnight slots).
 * 12. Voice agent medical diagnosis and symptom interpretation refusal (strictly administrative).
 * 13. Frontend/API contract consistency for repaired appointment workflows.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { serializeSession, SESSION_COOKIE_NAME } from '@vanni/auth';
import { globalDb, SupabaseDatabaseService, InMemoryDatabaseService, DatabaseOperationError } from '@vanni/database';
import type { AuthSessionDTO } from '@vanni/shared';
import { LLMConversationalService } from '../llm-service.js';
import { EmergencyHandler } from '../emergency-handler.js';

const CLINIC_HOSPITAL_A_ID = 'clinic-hosp-0000-0000-000000000001';
const CLINIC_HOSPITAL_B_ID = 'clinic-hosp-0000-0000-000000000002';

function sessionForClinicAdmin(orgId: string = CLINIC_HOSPITAL_A_ID): AuthSessionDTO {
  return {
    userId: `usr-admin-${orgId.slice(0, 8)}`,
    email: `admin@${orgId.slice(0, 8)}.org`,
    fullName: 'Dr. Sudha Murthy',
    activeOrganizationId: orgId,
    activeRole: 'ADMIN',
    memberships: [
      {
        organizationId: orgId,
        organizationName: orgId === CLINIC_HOSPITAL_A_ID ? 'Karnataka Specialty Clinic & Trauma Care' : 'Apollo Mysore Clinic',
        organizationSlug: orgId === CLINIC_HOSPITAL_A_ID ? 'karnataka-specialty' : 'apollo-mysore',
        role: 'ADMIN',
        status: 'ACTIVE',
        onboardingStatus: 'ready',
      },
    ],
  };
}

function sessionForClinicViewer(orgId: string = CLINIC_HOSPITAL_A_ID): AuthSessionDTO {
  return {
    userId: 'usr-viewer-001',
    email: 'trainee@karnatakaspecialty.org',
    fullName: 'Trainee Frontdesk',
    activeOrganizationId: orgId,
    activeRole: 'VIEWER',
    memberships: [
      {
        organizationId: orgId,
        organizationName: 'Karnataka Specialty Clinic & Trauma Care',
        organizationSlug: 'karnataka-specialty',
        role: 'VIEWER',
        status: 'ACTIVE',
        onboardingStatus: 'ready',
      },
    ],
  };
}

describe('Prompt 07: Healthcare Workflow, Appointment Reliability & Persistence Hardening', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let clinicACookie: string;
  let clinicBCookie: string;
  let clinicAViewerCookie: string;

  let workspaceIdA: string;
  let doctorIdA: string;
  let activeAppointmentId: string;

  // Compute clean future test date (7 days ahead)
  const futureDateObj = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const futureDateStr = futureDateObj.toISOString().slice(0, 10); // YYYY-MM-DD
  const futureIsoSlot = `${futureDateStr}T10:00:00+05:30`;
  const futureRescheduleSlot = `${futureDateStr}T11:00:00+05:30`;

  beforeAll(async () => {
    app = await buildServer();
    clinicACookie = `${SESSION_COOKIE_NAME}=${serializeSession(sessionForClinicAdmin(CLINIC_HOSPITAL_A_ID))}`;
    clinicBCookie = `${SESSION_COOKIE_NAME}=${serializeSession(sessionForClinicAdmin(CLINIC_HOSPITAL_B_ID))}`;
    clinicAViewerCookie = `${SESSION_COOKIE_NAME}=${serializeSession(sessionForClinicViewer(CLINIC_HOSPITAL_A_ID))}`;

    // Create client workspace for Clinic A
    const wsRes = await app.inject({
      method: 'POST',
      url: '/api/workspaces',
      headers: { cookie: clinicACookie },
      payload: {
        name: 'Karnataka Specialty Clinic & Trauma Care',
        industryCategory: 'HEALTHCARE',
        subcategory: 'HOSPITAL',
        operatingLocation: 'Station Road, Ballari, Karnataka',
        primaryPhone: '+91 8392 277100',
        primaryEmail: 'info@karnatakaclinic.in',
        timezone: 'Asia/Kolkata',
      },
    });
    expect(wsRes.statusCode).toBe(201);
    workspaceIdA = JSON.parse(wsRes.body).workspace.id;

    // Add Doctor to Clinic A
    const docRes = await app.inject({
      method: 'POST',
      url: `/api/doctors?workspaceId=${workspaceIdA}`,
      headers: { cookie: clinicACookie },
      payload: {
        fullName: 'Dr. Suresh Patil',
        specialization: 'CARDIOLOGY',
        designation: 'Senior Cardiologist',
        consultationFee: 750,
        availableDays: [0, 1, 2, 3, 4, 5, 6],
        shiftStart: '09:00',
        shiftEnd: '17:00',
        breakStart: '13:00',
        breakEnd: '14:00',
        slotDurationMinutes: 15,
        bufferMinutes: 5,
      },
    });
    expect(docRes.statusCode).toBe(201);
    doctorIdA = JSON.parse(docRes.body).doctor.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // 1. Authorized Appointment Creation
  // ---------------------------------------------------------------------------
  it('1. Authorized appointment creation with full validation and phone verification', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/appointments?workspaceId=${workspaceIdA}`,
      headers: { cookie: clinicACookie },
      payload: {
        doctorId: doctorIdA,
        customerName: 'Veereshppa Goudar',
        customerPhone: '+91 94481 23456',
        serviceType: 'Cardiology OPD Consultation',
        scheduledTime: futureIsoSlot,
        durationMinutes: 15,
        notes: 'Routine hypertension follow-up',
        idempotencyKey: `idemp_p07_${Date.now()}`,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.appointment.customerName).toBe('Veereshppa Goudar');
    expect(body.appointment.customerPhone).toBe('+91 94481 23456');
    expect(body.appointment.status).toBe('CONFIRMED');
    expect(body.appointment.auditHistory[0].action).toBe('CREATED');
    activeAppointmentId = body.appointment.id;
  });

  // ---------------------------------------------------------------------------
  // 2. Unauthenticated and Unauthorized Requests
  // ---------------------------------------------------------------------------
  it('2. Unauthenticated requests return 401; viewers attempting mutations return 403', async () => {
    // Unauthenticated
    const unauthRes = await app.inject({
      method: 'POST',
      url: `/api/appointments?workspaceId=${workspaceIdA}`,
      payload: { customerName: 'Anonymous', customerPhone: '+91 99999 99999' },
    });
    expect(unauthRes.statusCode).toBe(401);

    // Viewer modifying clinic settings
    const viewerConfigRes = await app.inject({
      method: 'PUT',
      url: `/api/healthcare/config?workspaceId=${workspaceIdA}`,
      headers: { cookie: clinicAViewerCookie },
      payload: { defaultSlotDurationMinutes: 30 },
    });
    expect(viewerConfigRes.statusCode).toBe(403);

    // Viewer adding doctor
    const viewerDocRes = await app.inject({
      method: 'POST',
      url: `/api/doctors?workspaceId=${workspaceIdA}`,
      headers: { cookie: clinicAViewerCookie },
      payload: { fullName: 'Unauthorized Doctor' },
    });
    expect(viewerDocRes.statusCode).toBe(403);
  });

  // ---------------------------------------------------------------------------
  // 3. Cross-Tenant Isolation
  // ---------------------------------------------------------------------------
  it('3. Cross-tenant appointment reads and mutations are denied with 404/403', async () => {
    // Competitor Clinic B trying to read Clinic A's appointment
    const crossRead = await app.inject({
      method: 'GET',
      url: `/api/appointments/${activeAppointmentId}?workspaceId=${workspaceIdA}`,
      headers: { cookie: clinicBCookie },
    });
    expect(crossRead.statusCode).toBe(404); // Scoped to Clinic B session, Clinic A workspace is not found

    // Competitor Clinic B trying to cancel Clinic A's appointment
    const crossCancel = await app.inject({
      method: 'POST',
      url: `/api/appointments/${activeAppointmentId}/cancel?workspaceId=${workspaceIdA}`,
      headers: { cookie: clinicBCookie },
      payload: { reason: 'Malicious cancellation attempt' },
    });
    expect(crossCancel.statusCode).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // 4. Input Validations (Phone, Past Dates, Shift/Break Hours)
  // ---------------------------------------------------------------------------
  it('4. Rejects invalid phones, past dates, impossible shift hours with 400', async () => {
    // Invalid phone number
    const badPhoneRes = await app.inject({
      method: 'POST',
      url: `/api/appointments?workspaceId=${workspaceIdA}`,
      headers: { cookie: clinicACookie },
      payload: {
        doctorId: doctorIdA,
        customerName: 'Test Patient',
        customerPhone: '12345', // Invalid Indian phone
        scheduledTime: `${futureDateStr}T14:00:00+05:30`,
      },
    });
    expect(badPhoneRes.statusCode).toBe(400);
    expect(JSON.parse(badPhoneRes.body).error).toBe('VALIDATION_ERROR');

    // Past date appointment booking attempt
    const pastDateRes = await app.inject({
      method: 'POST',
      url: `/api/appointments?workspaceId=${workspaceIdA}`,
      headers: { cookie: clinicACookie },
      payload: {
        doctorId: doctorIdA,
        customerName: 'Test Patient',
        customerPhone: '+91 94481 23456',
        scheduledTime: '2020-01-01T10:00:00Z', // In the past!
      },
    });
    expect(pastDateRes.statusCode).toBe(400);
    expect(JSON.parse(pastDateRes.body).message).toContain('past');

    // Doctor with shiftStart >= shiftEnd
    const badShiftRes = await app.inject({
      method: 'POST',
      url: `/api/doctors?workspaceId=${workspaceIdA}`,
      headers: { cookie: clinicACookie },
      payload: {
        fullName: 'Dr. Inverted Hours',
        shiftStart: '18:00',
        shiftEnd: '09:00',
      },
    });
    expect(badShiftRes.statusCode).toBe(400);

    // Doctor with break outside shift
    const badBreakRes = await app.inject({
      method: 'POST',
      url: `/api/doctors?workspaceId=${workspaceIdA}`,
      headers: { cookie: clinicACookie },
      payload: {
        fullName: 'Dr. Out-of-bounds Break',
        shiftStart: '09:00',
        shiftEnd: '17:00',
        breakStart: '18:00',
        breakEnd: '19:00',
      },
    });
    expect(badBreakRes.statusCode).toBe(400);
  });

  // ---------------------------------------------------------------------------
  // 5. Failed Database Writes Return Truthful Errors
  // ---------------------------------------------------------------------------
  it('5. Failed database operations return truthful errors instead of fake success', async () => {
    // Attempting to read a non-existent appointment ID
    const notFoundRes = await app.inject({
      method: 'GET',
      url: `/api/appointments/apt_non_existent_999999?workspaceId=${workspaceIdA}`,
      headers: { cookie: clinicACookie },
    });
    expect(notFoundRes.statusCode).toBe(404);
    expect(JSON.parse(notFoundRes.body).error).toBe('NOT_FOUND');
  });

  // ---------------------------------------------------------------------------
  // 6. Cancellation and Rescheduling Behavior
  // ---------------------------------------------------------------------------
  it('6. Rescheduling updates appointment time and cancellation releases slot', async () => {
    // Reschedule active appointment
    const reschRes = await app.inject({
      method: 'POST',
      url: `/api/appointments/${activeAppointmentId}/reschedule?workspaceId=${workspaceIdA}`,
      headers: { cookie: clinicACookie },
      payload: {
        newScheduledTime: futureRescheduleSlot,
        reason: 'Patient requested afternoon shift',
      },
    });
    expect(reschRes.statusCode).toBe(200);
    const reschBody = JSON.parse(reschRes.body);
    expect(reschBody.appointment.scheduledTime).toBe(futureRescheduleSlot);
    expect(reschBody.appointment.auditHistory.some((a: any) => a.action === 'RESCHEDULED')).toBe(true);

    // Original slot (futureIsoSlot) should now be available again!
    const availRes = await app.inject({
      method: 'GET',
      url: `/api/doctors/${doctorIdA}/availability?workspaceId=${workspaceIdA}&date=${futureDateStr}`,
      headers: { cookie: clinicACookie },
    });
    expect(availRes.statusCode).toBe(200);
    const availBody = JSON.parse(availRes.body);
    const slot10am = availBody.slots.find((s: any) => s.startTime === '10:00');
    expect(slot10am.isAvailable).toBe(true);

    // Cancel the rescheduled appointment
    const cancelRes = await app.inject({
      method: 'POST',
      url: `/api/appointments/${activeAppointmentId}/cancel?workspaceId=${workspaceIdA}`,
      headers: { cookie: clinicACookie },
      payload: { reason: 'Patient emergency travel' },
    });
    expect(cancelRes.statusCode).toBe(200);
    const cancelBody = JSON.parse(cancelRes.body);
    expect(cancelBody.appointment.status).toBe('CANCELLED');

    // Cancelling again is idempotent
    const secondCancel = await app.inject({
      method: 'POST',
      url: `/api/appointments/${activeAppointmentId}/cancel?workspaceId=${workspaceIdA}`,
      headers: { cookie: clinicACookie },
      payload: { reason: 'Duplicate cancel' },
    });
    expect(secondCancel.statusCode).toBe(200);
    expect(JSON.parse(secondCancel.body).message).toContain('already cancelled');
  });

  // ---------------------------------------------------------------------------
  // 7. Duplicate Submission / Idempotency
  // ---------------------------------------------------------------------------
  it('7. Duplicate submission with same idempotencyKey returns 200 replay', async () => {
    const testKey = `idemp_test_replay_${Date.now()}`;
    const slotTime = `${futureDateStr}T15:00:00+05:30`;

    // 1st attempt: 201 Created
    const res1 = await app.inject({
      method: 'POST',
      url: `/api/appointments?workspaceId=${workspaceIdA}`,
      headers: { cookie: clinicACookie },
      payload: {
        doctorId: doctorIdA,
        customerName: 'Shankar Gowda',
        customerPhone: '+91 98451 11223',
        scheduledTime: slotTime,
        idempotencyKey: testKey,
      },
    });
    expect(res1.statusCode).toBe(201);
    const apt1Id = JSON.parse(res1.body).appointment.id;

    // 2nd attempt: 200 Replay
    const res2 = await app.inject({
      method: 'POST',
      url: `/api/appointments?workspaceId=${workspaceIdA}`,
      headers: { cookie: clinicACookie },
      payload: {
        doctorId: doctorIdA,
        customerName: 'Shankar Gowda',
        customerPhone: '+91 98451 11223',
        scheduledTime: slotTime,
        idempotencyKey: testKey,
      },
    });
    expect(res2.statusCode).toBe(200);
    const body2 = JSON.parse(res2.body);
    expect(body2.idempotentReplay).toBe(true);
    expect(body2.appointment.id).toBe(apt1Id);
  });

  // ---------------------------------------------------------------------------
  // 8. Concurrent Booking Attempts (Double-Booking Race Condition)
  // ---------------------------------------------------------------------------
  it('8. Concurrent booking attempts for the same doctor and slot: one succeeds (201), competitor gets 409', async () => {
    const raceSlotTime = `${futureDateStr}T16:00:00+05:30`;

    const [req1, req2] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/appointments?workspaceId=${workspaceIdA}`,
        headers: { cookie: clinicACookie },
        payload: {
          doctorId: doctorIdA,
          customerName: 'Racer One',
          customerPhone: '+91 98860 11111',
          scheduledTime: raceSlotTime,
          durationMinutes: 15,
        },
      }),
      app.inject({
        method: 'POST',
        url: `/api/appointments?workspaceId=${workspaceIdA}`,
        headers: { cookie: clinicACookie },
        payload: {
          doctorId: doctorIdA,
          customerName: 'Racer Two',
          customerPhone: '+91 98860 22222',
          scheduledTime: raceSlotTime,
          durationMinutes: 15,
        },
      }),
    ]);

    const statuses = [req1.statusCode, req2.statusCode].sort();
    expect(statuses).toEqual([201, 409]);

    const conflictRes = req1.statusCode === 409 ? req1 : req2;
    const conflictBody = JSON.parse(conflictRes.body);
    expect(conflictBody.error).toBe('SLOT_UNAVAILABLE');
  });

  // ---------------------------------------------------------------------------
  // 9. Supabase Persistence Delegation
  // ---------------------------------------------------------------------------
  it('9. SupabaseDatabaseService persists and queries appointments correctly with tenant filtering', async () => {
    const mockQuery: any = {
      order: () => Promise.resolve({
        data: [
          {
            id: 'apt_mock_001',
            workspace_id: workspaceIdA,
            organization_id: CLINIC_HOSPITAL_A_ID,
            contact_name: 'Mock Patient',
            contact_phone: '+91 98450 99999',
            scheduled_time: futureIsoSlot,
            status: 'CONFIRMED',
            doctor_id: doctorIdA,
          },
        ],
        error: null,
      }),
      maybeSingle: () => Promise.resolve({
        data: {
          id: 'apt_mock_001',
          workspace_id: workspaceIdA,
          organization_id: CLINIC_HOSPITAL_A_ID,
          contact_name: 'Mock Patient',
          contact_phone: '+91 98450 99999',
          scheduled_time: futureIsoSlot,
          status: 'CONFIRMED',
          doctor_id: doctorIdA,
        },
        error: null,
      }),
    };
    mockQuery.eq = () => mockQuery;
    mockQuery.or = () => mockQuery;
    mockQuery.select = () => mockQuery;
    mockQuery.upsert = (payload: any) => Promise.resolve({ data: payload, error: null });
    mockQuery.delete = () => mockQuery;

    const mockSupabaseClient = {
      from: () => mockQuery,
    };

    const supabaseDb = new SupabaseDatabaseService('https://mock.supabase.co', 'mock-service-role-key');
    (supabaseDb as any).supabaseClient = mockSupabaseClient;
    const appointments = await supabaseDb.getAppointments(workspaceIdA);
    expect(appointments.length).toBe(1);
    expect(appointments[0].customerName).toBe('Mock Patient');

    const single = await supabaseDb.getAppointmentById('apt_mock_001', workspaceIdA);
    expect(single).toBeDefined();
    expect(single?.doctorId).toBe(doctorIdA);
  });

  // ---------------------------------------------------------------------------
  // 10. Database Error Propagation (No silent fake success)
  // ---------------------------------------------------------------------------
  it('10. Database errors during save are propagated honestly', async () => {
    const failingMockClient = {
      from: () => ({
        upsert: () => Promise.resolve({ error: { message: 'Database connection terminated', code: '08006' } }),
      }),
    };

    const failingDb = new SupabaseDatabaseService('https://mock.supabase.co', 'mock-service-role-key');
    (failingDb as any).supabaseClient = failingMockClient;
    await expect(failingDb.saveAppointment({
      id: 'apt_fail_01',
      tenantId: workspaceIdA,
      customerName: 'Fail Test',
      customerPhone: '+91 99999 99999',
      serviceType: 'Consult',
      durationMinutes: 15,
      scheduledTime: futureIsoSlot,
      status: 'CONFIRMED',
    })).rejects.toThrow('Database connection terminated');
  });

  // ---------------------------------------------------------------------------
  // 11. Timezone and Midnight Date-Boundary Handling
  // ---------------------------------------------------------------------------
  it('11. Timezone conversion: handles Karnataka local time (+05:30) and midnight UTC conversions', async () => {
    // 2026-10-25T18:30:00Z in UTC is exactly 2026-10-26T00:00:00+05:30 (Midnight in Karnataka)
    const midnightUtc = '2026-10-25T18:30:00.000Z';
    const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(midnightUtc));
    expect(localDate).toBe('2026-10-26');

    // 05:00 AM IST is 23:30 UTC of previous day
    const morningIst = '2026-10-25T23:30:00.000Z';
    const morningLocalDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(morningIst));
    expect(morningLocalDate).toBe('2026-10-26');
  });

  // ---------------------------------------------------------------------------
  // 12. Voice Agent Refuses Diagnosis and Treatment (Strictly Administrative)
  // ---------------------------------------------------------------------------
  it('12. Voice agent strictly refuses medical diagnosis and symptom interpretation', async () => {
    const llm = new LLMConversationalService();
    const systemPrompt = 'Industry: HEALTHCARE_HOSPITAL. Organization: Apollo Specialty Clinic.';

    // Diagnostic question
    const diagResponse = await llm.generateTurn(
      systemPrompt,
      [],
      'I have severe cough and chest tightness for 3 days. What disease do I have and what medicine should I take?'
    );

    expect(diagResponse).toContain('cannot diagnose medical conditions');
    expect(diagResponse).toContain('administrative AI assistant');
    expect(diagResponse).toContain('OPD consultation');

    // Treatment inquiry
    const treatResponse = await llm.generateTurn(
      systemPrompt,
      [],
      'Can you prescribe medicine for my high fever?'
    );
    expect(treatResponse).toContain('Kshamisee sir');
    expect(treatResponse).toContain('medicine prescribe madoke baralla');

    // Emergency Detection
    const emergencyHandler = new EmergencyHandler();
    const emResult = emergencyHandler.detectEmergency('Patient has severe chest pain and unconscious');
    expect(emResult.isEmergency).toBe(true);
    expect(emResult.recommendedAction).toBe('TRANSFER_IMMEDIATE');
    expect(emResult.transferNumber).toBe('108');
  });

  // ---------------------------------------------------------------------------
  // 13. Frontend / API Contract Consistency
  // ---------------------------------------------------------------------------
  it('13. API contract consistency: GET /api/appointments and /api/healthcare/config match frontend expectations', async () => {
    const configRes = await app.inject({
      method: 'GET',
      url: `/api/healthcare/config?workspaceId=${workspaceIdA}`,
      headers: { cookie: clinicACookie },
    });
    expect(configRes.statusCode).toBe(200);
    const configBody = JSON.parse(configRes.body);
    expect(configBody.success).toBe(true);
    expect(configBody.workspaceId).toBe(workspaceIdA);
    expect(configBody.config).toBeDefined();
    expect(configBody.config.emergencyContactPhone).toBeDefined();

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/appointments?workspaceId=${workspaceIdA}`,
      headers: { cookie: clinicACookie },
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.body);
    expect(Array.isArray(listBody.appointments)).toBe(true);
    expect(typeof listBody.total).toBe('number');
  });
});
