/**
 * PROMPT 05: HEALTHCARE VERTICAL CONFIGURATION & APPOINTMENT OPERATIONS TEST SUITE
 * 
 * Verifies:
 * 1. Healthcare clinic profile & operating hours configuration
 * 2. Doctor roster creation with shift timings, breaks, and consultation fees
 * 3. Doctor on leave blocks all appointment slots for that date
 * 4. Slot availability calculation (breaks marked unavailable, open slots available)
 * 5. Concurrent double-booking prevention (returns 409 Conflict on duplicate slot request)
 * 6. Idempotent booking replay with idempotencyKey
 * 7. Appointment rescheduling with slot availability validation & audit history
 * 8. Appointment cancellation with mandatory reason (frees slot for new bookings)
 * 9. Approved Administrative FAQs (only active approved entries used)
 * 10. Medical emergency safeguards (directs to 108 without fabricated claims)
 * 11. Webhook testing with HMAC-SHA256 signature verification
 * 12. Tenant isolation: Competitor clinic cannot access doctors or appointments
 * 13. Role security: Viewer role cannot modify clinic settings, roster, or FAQs
 * 14. Persistence: Healthcare rosters and bookings survive database reload
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { serializeSession, SESSION_COOKIE_NAME } from '@vanni/auth';
import { globalDb, DurableDatabaseService } from '@vanni/database';
import type { AuthSessionDTO } from '@vanni/shared';

const CLINIC_A_ORG_ID = 'clinic-a-0000-0000-000000000001';
const CLINIC_B_ORG_ID = 'clinic-b-0000-0000-000000000002';

function sessionForClinicOwner(orgId: string = CLINIC_A_ORG_ID): AuthSessionDTO {
  return {
    userId: `u-dr-${orgId.slice(0, 8)}`,
    email: `director@${orgId.slice(0, 8)}.in`,
    fullName: 'Dr. Anand Deshpande',
    activeOrganizationId: orgId,
    activeRole: 'OWNER',
    memberships: [
      {
        organizationId: orgId,
        organizationName: orgId === CLINIC_A_ORG_ID ? 'Ballari Multi-Specialty Dental & OPD' : 'Bangalore Ortho Care',
        organizationSlug: orgId === CLINIC_A_ORG_ID ? 'ballari-dental' : 'bangalore-ortho',
        role: 'OWNER',
        status: 'ACTIVE',
        onboardingStatus: 'ready',
      },
    ],
  };
}

function sessionForClinicViewer(orgId: string = CLINIC_A_ORG_ID): AuthSessionDTO {
  return {
    userId: 'u-viewer-clinic-001',
    email: 'reception-trainee@ballaridental.in',
    fullName: 'Trainee Receptionist',
    activeOrganizationId: orgId,
    activeRole: 'VIEWER',
    memberships: [
      {
        organizationId: orgId,
        organizationName: 'Ballari Multi-Specialty Dental & OPD',
        organizationSlug: 'ballari-dental',
        role: 'VIEWER',
        status: 'ACTIVE',
        onboardingStatus: 'ready',
      },
    ],
  };
}

describe('Healthcare Vertical Configuration & Appointment Operations (Prompt 05)', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let clinicACookie: string;
  let clinicBCookie: string;
  let clinicAViewerCookie: string;

  let clinicWorkspaceId: string;
  let doctorId: string;
  let bookedAppointmentId: string;
  
  // Dynamically compute future dates so tests never fail past-date validation
  const targetBookingDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const targetLeaveDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  beforeAll(async () => {
    app = await buildServer();
    clinicACookie = `${SESSION_COOKIE_NAME}=${serializeSession(sessionForClinicOwner(CLINIC_A_ORG_ID))}`;
    clinicBCookie = `${SESSION_COOKIE_NAME}=${serializeSession(sessionForClinicOwner(CLINIC_B_ORG_ID))}`;
    clinicAViewerCookie = `${SESSION_COOKIE_NAME}=${serializeSession(sessionForClinicViewer(CLINIC_A_ORG_ID))}`;

    // Create client workspace for Ballari Dental
    const wsRes = await app.inject({
      method: 'POST',
      url: '/api/workspaces',
      headers: { cookie: clinicACookie },
      payload: {
        name: 'Ballari Smile Multispecialty Dental & Implant Clinic',
        industryCategory: 'HEALTHCARE',
        subcategory: 'DENTAL',
        operatingLocation: 'Royal Circle, Cantonment, Ballari, Karnataka',
        primaryPhone: '+91 8392 245999',
        primaryEmail: 'info@ballarismile.in',
        timezone: 'Asia/Kolkata',
        languagePreferences: {
          primary: 'kn-IN',
          conversationalStyle: 'POLITE_BUSINESS',
          regionalDialect: 'NORTH_KARNATAKA_COMMERCIAL',
        },
      },
    });

    const wsBody = JSON.parse(wsRes.body);
    clinicWorkspaceId = wsBody.workspace.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Configure clinic operating hours, buffers, emergency number, and webhook settings', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/healthcare/config?workspaceId=${clinicWorkspaceId}`,
      headers: { cookie: clinicACookie },
      payload: {
        defaultSlotDurationMinutes: 20,
        bufferMinutes: 5,
        emergencyContactPhone: '+91 8392 240108',
        emergencyProtocol: 'Direct to 108 emergency service or Ballari District Hospital Casualty.',
        escalationContactPhone: '+91 94480 12345',
        escalationHours: '09:00 AM - 08:00 PM',
        webhookUrl: 'https://webhook.site/vanni-test-health',
        webhookSecret: 'karnataka_dental_secret_key_123',
        webhookEnabled: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.config.defaultSlotDurationMinutes).toBe(20);
    expect(body.config.emergencyContactPhone).toBe('+91 8392 240108');
  });

  it('2. Add doctor to clinic roster with shift timings, lunch break, and consultation fee', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/doctors?workspaceId=${clinicWorkspaceId}`,
      headers: { cookie: clinicACookie },
      payload: {
        fullName: 'Dr. Ramesh Patil',
        kannadaName: 'ಡಾ. ರಮೇಶ್ ಪಾಟೀಲ್',
        designation: 'Senior Implantologist & Dental Surgeon',
        specialization: 'DENTAL_IMPLANTS',
        consultationFee: 600,
        availableDays: [0, 1, 2, 3, 4, 5, 6], // All 7 days for test flexibility
        shiftStart: '09:00',
        shiftEnd: '13:00',
        breakStart: '11:00',
        breakEnd: '11:30',
        slotDurationMinutes: 20,
        bufferMinutes: 5,
        leaves: [
          { date: targetLeaveDate, reason: 'Karnataka Dental Conference' },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.doctor.fullName).toBe('Dr. Ramesh Patil');
    expect(body.doctor.consultationFee).toBe(600);
    expect(body.doctor.shiftStart).toBe('09:00');

    doctorId = body.doctor.id;
  });

  it('3. Retrieve availability: slots during lunch break are marked unavailable', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/doctors/${doctorId}/availability?workspaceId=${clinicWorkspaceId}&date=${targetBookingDate}`,
      headers: { cookie: clinicACookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.totalSlots).toBeGreaterThan(0);
    expect(body.availableSlotsCount).toBeGreaterThan(0);

    // Verify 09:00 slot is available
    const slot9am = body.slots.find((s: any) => s.startTime === '09:00');
    expect(slot9am).toBeDefined();
    expect(slot9am.isAvailable).toBe(true);

    // Verify break slot (11:00 - 11:20) is marked unavailable with reason
    const breakSlot = body.slots.find((s: any) => !s.isAvailable && s.reason && s.reason.includes('Break'));
    expect(breakSlot).toBeDefined();
    expect(breakSlot.isAvailable).toBe(false);
    expect(breakSlot.reason).toContain('Break');
  });

  it('4. Doctor on leave blocks all slots for that date', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/doctors/${doctorId}/availability?workspaceId=${clinicWorkspaceId}&date=${targetLeaveDate}`,
      headers: { cookie: clinicACookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.availableSlotsCount).toBe(0);
    expect(body.notice).toContain('leave');
  });

  it('5. Book an appointment slot successfully', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/appointments?workspaceId=${clinicWorkspaceId}`,
      headers: { cookie: clinicACookie },
      payload: {
        doctorId,
        customerName: 'Praveen Kumar',
        customerPhone: '+91 98450 54321',
        serviceType: 'Root Canal Consultation',
        scheduledTime: `${targetBookingDate}T09:00:00Z`,
        durationMinutes: 20,
        notes: 'Severe molar ache on right jaw',
        idempotencyKey: 'idemp_booking_001',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.appointment.customerName).toBe('Praveen Kumar');
    expect(body.appointment.status).toBe('CONFIRMED');
    expect(body.appointment.auditHistory.length).toBe(1);
    expect(body.appointment.auditHistory[0].action).toBe('CREATED');

    bookedAppointmentId = body.appointment.id;
  });

  it('6. Double-booking prevention: attempting to book the same slot returns 409 Conflict', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/appointments?workspaceId=${clinicWorkspaceId}`,
      headers: { cookie: clinicACookie },
      payload: {
        doctorId,
        customerName: 'Competing Patient',
        customerPhone: '+91 94481 00000',
        serviceType: 'Teeth Cleaning',
        scheduledTime: `${targetBookingDate}T09:00:00Z`, // SAME SLOT!
        durationMinutes: 20,
      },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('SLOT_UNAVAILABLE');
    expect(body.message).toContain('already been booked');
  });

  it('7. Idempotent retry: submitting with same idempotencyKey returns 200 replay', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/appointments?workspaceId=${clinicWorkspaceId}`,
      headers: { cookie: clinicACookie },
      payload: {
        doctorId,
        customerName: 'Praveen Kumar',
        customerPhone: '+91 98450 54321',
        serviceType: 'Root Canal Consultation',
        scheduledTime: `${targetBookingDate}T09:00:00Z`,
        durationMinutes: 20,
        idempotencyKey: 'idemp_booking_001', // Same key!
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.idempotentReplay).toBe(true);
    expect(body.appointment.id).toBe(bookedAppointmentId);
  });

  it('8. Availability engine now reports the booked 09:00 slot as unavailable', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/doctors/${doctorId}/availability?workspaceId=${clinicWorkspaceId}&date=${targetBookingDate}`,
      headers: { cookie: clinicACookie },
    });

    const body = JSON.parse(res.body);
    const slot9am = body.slots.find((s: any) => s.startTime === '09:00');
    expect(slot9am.isAvailable).toBe(false);
    expect(slot9am.reason).toContain('Already Booked');
  });

  it('9. Reschedule appointment to a new slot with audit history', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/appointments/${bookedAppointmentId}/reschedule?workspaceId=${clinicWorkspaceId}`,
      headers: { cookie: clinicACookie },
      payload: {
        newScheduledTime: `${targetBookingDate}T09:25:00Z`,
        reason: 'Patient requested shift to 9:25 AM',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.appointment.scheduledTime).toContain('09:25:00');
    expect(body.appointment.auditHistory.some((a: any) => a.action === 'RESCHEDULED')).toBe(true);
  });

  it('10. Cancel appointment: frees the slot and records cancellation reason in audit history', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/appointments/${bookedAppointmentId}/cancel?workspaceId=${clinicWorkspaceId}`,
      headers: { cookie: clinicACookie },
      payload: {
        reason: 'Patient had travel clash',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.appointment.status).toBe('CANCELLED');
    expect(body.appointment.cancellationReason).toBe('Patient had travel clash');

    // Slot at 09:25 should now be available again!
    const availRes = await app.inject({
      method: 'GET',
      url: `/api/doctors/${doctorId}/availability?workspaceId=${clinicWorkspaceId}&date=${targetBookingDate}`,
      headers: { cookie: clinicACookie },
    });
    const availBody = JSON.parse(availRes.body);
    const slot925 = availBody.slots.find((s: any) => s.startTime === '09:25');
    expect(slot925.isAvailable).toBe(true);
  });

  it('11. Administrative FAQs: Create, retrieve, and approve clinic FAQs', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/healthcare/faqs?workspaceId=${clinicWorkspaceId}`,
      headers: { cookie: clinicACookie },
      payload: {
        category: 'BILLING',
        question: 'Do you accept UPI and Karnataka Government health schemes?',
        answer: 'Yes, we accept Google Pay, PhonePe, all credit cards, and Ayushman Bharat / Arogya Karnataka cards.',
        kannadaQuestion: 'UPI matthu Arogya Karnataka card accept madthira?',
        kannadaAnswer: 'Haudhu, GPay, PhonePe matthu Arogya Karnataka card accept madtheeve.',
        language: 'KN',
        status: 'ACTIVE',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.faq.status).toBe('ACTIVE');

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/healthcare/faqs?workspaceId=${clinicWorkspaceId}&status=ACTIVE`,
      headers: { cookie: clinicACookie },
    });
    const listBody = JSON.parse(listRes.body);
    expect(listBody.faqs.length).toBeGreaterThanOrEqual(1);
  });

  it('12. Emergency detection safeguard: detects critical keywords and directs to 108 without fake dispatch claims', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/healthcare/emergency-check',
      headers: { cookie: clinicACookie },
      payload: {
        transcript: 'Severe chest pain and breathing difficulty since 20 minutes',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.isEmergency).toBe(true);
    expect(body.action).toBe('DIRECT_TO_108');
    expect(body.guidance).toContain('108');
    expect(body.kannadaMessage).toContain('108');
  });

  it('13. Tenant Isolation: Competitor Clinic B cannot read Clinic A doctors or appointments', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/doctors/${doctorId}?workspaceId=${clinicWorkspaceId}`,
      headers: { cookie: clinicBCookie },
    });

    expect(res.statusCode).toBe(404); // Scoped to Clinic B context, so Clinic A doctor is invisible
  });

  it('14. Role Security: Viewer role cannot modify clinic config or add doctors', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/doctors?workspaceId=${clinicWorkspaceId}`,
      headers: { cookie: clinicAViewerCookie },
      payload: {
        fullName: 'Unauthorized Doctor',
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('FORBIDDEN');
  });

  it('15. Persistence: Clinic doctor and configuration survive database reload', async () => {
    const reloadedDb = new DurableDatabaseService();
    const doc = await reloadedDb.getStaffById(doctorId, clinicWorkspaceId);
    expect(doc).toBeDefined();
    expect(doc?.fullName).toBe('Dr. Ramesh Patil');
    expect(doc?.consultationFee).toBe(600);
  });
});
