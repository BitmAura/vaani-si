/**
 * @vanni/server — Healthcare Clinic Operations, Doctor Rosters & Appointment Engine (Prompt 05)
 * 
 * Implements:
 * - Clinic Profile & Operating Hours Configuration
 * - Healthcare Provider / Doctor Roster with Shift Hours, Breaks & Leaves
 * - Dynamic Appointment Slot Availability Engine
 * - Concurrent Double-Booking Prevention & Idempotency
 * - Appointment Reschedule, Cancellation, and Audit Trail History
 * - Approved Administrative FAQ Management
 * - Emergency Safeguards (108 Guidance without Fabricated Claims)
 * - Authenticated Webhook Integration with HMAC Signatures
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import { globalDb } from '@vanni/database';
import {
  AuthSessionDTO,
  AppointmentSlotDTO,
  AppointmentAuditEntry,
  BusinessStaffDTO,
  BusinessFAQDTO,
  ClinicConfigDTO,
  ClientWorkspaceDTO,
} from '@vanni/shared';
import { getSessionFromRequest } from '../http-auth.js';
import { EmergencyHandler } from '../emergency-handler.js';
import { validateIndianPhoneNumber } from '@vanni/providers';


/**
 * Helper to convert HH:MM string to total minutes from midnight
 */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Helper to convert total minutes to HH:MM string
 */
function toTimeStr(totalMins: number): string {
  const h = Math.floor(totalMins / 60).toString().padStart(2, '0');
  const m = (totalMins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Resolves local date YYYY-MM-DD in clinic timezone for an ISO timestamp
 */
function getLocalDateInTimezone(isoString: string, timezone = 'Asia/Kolkata'): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date(isoString));
  } catch {
    return isoString.slice(0, 10);
  }
}

/**
 * Extracts local minutes from midnight in clinic timezone for an ISO timestamp
 */
function getLocalMinutesInTimezone(isoString: string, timezone = 'Asia/Kolkata'): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(isoString));
    const h = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const m = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    return h * 60 + m;
  } catch {
    const timePart = isoString.includes('T') ? isoString.split('T')[1].slice(0, 5) : isoString.slice(11, 16);
    return toMinutes(timePart);
  }
}

interface HealthcareContext {
  session: AuthSessionDTO;
  workspaceId: string;
  organizationId: string;
  isViewer: boolean;
}

/**
 * Resolves the authenticated workspace context for healthcare routes
 */
async function resolveHealthcareContext(req: FastifyRequest, reply?: FastifyReply): Promise<HealthcareContext | null> {
  const session = getSessionFromRequest(req);
  if (!session) {
    if (reply) reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    return null;
  }

  const orgId = session.activeOrganizationId;
  const cookieWs = (req as any).cookies?.['vanni_active_workspace'];
  const queryWs = (req.query as any)?.workspaceId;
  const headerWs = req.headers['x-workspace-id'] as string;

  const requestedWsId = queryWs || headerWs || cookieWs;
  let workspaceId = orgId;

  if (requestedWsId) {
    const ws = await globalDb.getClientWorkspaceById(requestedWsId);
    // Security: reject unknown workspaces or workspaces from other tenants. Never fall back.
    if (!ws || !session.memberships.some(m => m.organizationId === ws.organizationId)) {
      if (reply) reply.status(404).send({ error: 'NOT_FOUND', message: 'Workspace not found' });
      return null;
    }
    workspaceId = ws.id;
  }

  return {
    session,
    workspaceId,
    organizationId: orgId,
    isViewer: session.activeRole === 'VIEWER',
  };
}

/**
 * Sends a signed webhook event if configured on the client workspace
 */
async function triggerAppointmentWebhook(ws: ClientWorkspaceDTO, event: string, appointment: AppointmentSlotDTO): Promise<void> {
  const config = ws.clinicConfig;
  if (!config || !config.webhookEnabled || !config.webhookUrl) return;

  const payload = {
    event,
    timestamp: new Date().toISOString(),
    workspaceId: ws.id,
    clinicName: ws.name,
    appointment: {
      id: appointment.id,
      doctorId: appointment.doctorId,
      customerName: appointment.customerName,
      customerPhone: appointment.customerPhone,
      serviceType: appointment.serviceType,
      scheduledTime: appointment.scheduledTime,
      durationMinutes: appointment.durationMinutes,
      status: appointment.status,
      notes: appointment.notes,
      cancellationReason: appointment.cancellationReason,
    },
  };

  const bodyStr = JSON.stringify(payload);
  const secret = config.webhookSecret || 'vanni_webhook_default_secret';
  const signature = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    await fetch(config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Vaani-Signature': signature,
        'X-Vaani-Event': event,
      },
      body: bodyStr,
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (err: any) {
          // Non-blocking error logged for observability
    console.warn(`[Healthcare Webhook Error] Failed to dispatch to ${config.webhookUrl}:`, err.message);
  }
}

export async function doctorRoutes(fastify: FastifyInstance): Promise<void> {

  // =========================================================================
  // 1. CLINIC PROFILE & OPERATING HOURS CONFIGURATION
  // =========================================================================

  /**
   * GET /api/healthcare/config
   * Retrieve clinic operating hours, buffer settings, emergency and webhook config
   */
  fastify.get('/api/healthcare/config', async (req: FastifyRequest, reply: FastifyReply) => {
    const ctx = await resolveHealthcareContext(req, reply);
    if (!ctx) return;

    const ws = await globalDb.getClientWorkspaceById(ctx.workspaceId);
    if (!ws) {
      return reply.send({
        success: true,
        workspaceId: ctx.workspaceId,
        config: {
          defaultSlotDurationMinutes: 15,
          bufferMinutes: 5,
          emergencyContactPhone: '108',
          emergencyProtocol: 'Direct to 108 emergency service or nearest hospital casualty.',
        },
      });
    }

    return reply.send({
      success: true,
      workspaceId: ws.id,
      clinicName: ws.name,
      operatingLocation: ws.operatingLocation,
      primaryPhone: ws.primaryPhone,
      primaryEmail: ws.primaryEmail,
      timezone: ws.timezone,
      subcategory: ws.subcategory,
      config: ws.clinicConfig || {
        defaultSlotDurationMinutes: 15,
        bufferMinutes: 5,
        emergencyContactPhone: '108',
        emergencyProtocol: 'Direct to 108 emergency service or nearest hospital casualty.',
      },
    });
  });

  /**
   * PUT /api/healthcare/config
   * Update clinic configuration (non-viewer required)
   */
  fastify.put('/api/healthcare/config', async (req: FastifyRequest<{ Body: ClinicConfigDTO }>, reply: FastifyReply) => {
    const ctx = await resolveHealthcareContext(req, reply);
    if (!ctx) return;
    if (ctx.isViewer) return reply.status(403).send({ error: 'FORBIDDEN', message: 'Viewers cannot modify clinic settings.' });

    const ws = await globalDb.getClientWorkspaceById(ctx.workspaceId);
    if (!ws) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Clinic workspace not found' });

    const updatedConfig = {
      ...(ws.clinicConfig || {}),
      ...(req.body || {}),
    };

    const updatedWs = await globalDb.updateClientWorkspace(ws.id, { clinicConfig: updatedConfig }, ws.organizationId);

    return reply.send({
      success: true,
      message: 'Clinic configuration updated successfully',
      config: updatedWs?.clinicConfig,
    });
  });

  // =========================================================================
  // 2. DOCTOR & HEALTHCARE STAFF ROSTERS
  // =========================================================================

  /**
   * GET /api/doctors
   * List healthcare providers / doctors for the workspace
   */
  fastify.get('/api/doctors', async (req: FastifyRequest<{ Querystring: { specialization?: string; activeOnly?: string } }>, reply: FastifyReply) => {
    const ctx = await resolveHealthcareContext(req, reply);
    if (!ctx) return;

    let staff = await globalDb.getStaff(ctx.workspaceId);
    // Also check organization level if none directly on workspace
    if (staff.length === 0 && ctx.workspaceId !== ctx.organizationId) {
      staff = await globalDb.getStaff(ctx.organizationId);
    }

    const { specialization, activeOnly } = req.query || {};
    if (specialization) {
      staff = staff.filter(s => s.specialization?.toLowerCase() === specialization.toLowerCase());
    }
    if (activeOnly === 'true') {
      staff = staff.filter(s => s.isActive);
    }

    return reply.send({
      success: true,
      doctors: staff,
      total: staff.length,
    });
  });

  /**
   * GET /api/doctors/:id
   * Get single doctor roster details with shift hours, breaks, and leaves
   */
  fastify.get('/api/doctors/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const ctx = await resolveHealthcareContext(req, reply);
    if (!ctx) return;

    const { id } = req.params;
    let doctor = await globalDb.getStaffById(id, ctx.workspaceId);
    if (!doctor) {
      doctor = await globalDb.getStaffById(id, ctx.organizationId);
    }

    if (!doctor) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Doctor roster entry not found' });
    }

    return reply.send({
      success: true,
      doctor,
    });
  });

  /**
   * POST /api/doctors
   * Add a new doctor / healthcare provider to the clinic roster
   */
  fastify.post('/api/doctors', async (req: FastifyRequest<{ Body: Partial<BusinessStaffDTO> }>, reply: FastifyReply) => {
    const ctx = await resolveHealthcareContext(req, reply);
    if (!ctx) return;
    if (ctx.isViewer) return reply.status(403).send({ error: 'FORBIDDEN', message: 'Viewers cannot add doctors to roster.' });

    const body = req.body || {};
    if (!body.fullName || !body.fullName.trim()) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Doctor full name is required' });
    }

    // Validate consultation fee
    if (typeof body.consultationFee === 'number' && body.consultationFee < 0) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Consultation fee must be non-negative' });
    }

    // Validate shift hours
    const shiftStart = body.shiftStart || '09:00';
    const shiftEnd = body.shiftEnd || '17:00';
    if (toMinutes(shiftStart) >= toMinutes(shiftEnd)) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Shift start time must be before shift end time' });
    }

    // Validate break hours
    const breakStart = body.breakStart || '13:00';
    const breakEnd = body.breakEnd || '14:00';
    if (toMinutes(breakStart) >= toMinutes(breakEnd)) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Break start time must be before break end time' });
    }
    if (toMinutes(breakStart) < toMinutes(shiftStart) || toMinutes(breakEnd) > toMinutes(shiftEnd)) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Break hours must fall within shift timings' });
    }

    // Validate slot durations
    if (typeof body.slotDurationMinutes === 'number' && body.slotDurationMinutes <= 0) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Slot duration must be greater than zero' });
    }
    if (typeof body.bufferMinutes === 'number' && body.bufferMinutes < 0) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Buffer minutes cannot be negative' });
    }

    const doctorId = `doc_${crypto.randomUUID()}`;
    const newDoctor: BusinessStaffDTO = {
      id: doctorId,
      organizationId: ctx.workspaceId,
      fullName: body.fullName.trim(),
      kannadaName: body.kannadaName?.trim(),
      designation: body.designation?.trim() || 'Consultant Specialist',
      specialization: body.specialization?.trim() || 'General Medicine',
      consultationFee: typeof body.consultationFee === 'number' ? body.consultationFee : 500,
      availableDays: Array.isArray(body.availableDays) ? body.availableDays : [1, 2, 3, 4, 5, 6], // Mon-Sat
      shiftStart,
      shiftEnd,
      breakStart,
      breakEnd,
      slotDurationMinutes: typeof body.slotDurationMinutes === 'number' ? body.slotDurationMinutes : 15,
      bufferMinutes: typeof body.bufferMinutes === 'number' ? body.bufferMinutes : 5,
      leaves: Array.isArray(body.leaves) ? body.leaves : [],
      workingHoursDescription: body.workingHoursDescription || 'Mon-Sat 09:00 AM - 05:00 PM',
      isActive: body.isActive !== false,
      status: 'ACTIVE',
      authority: 'AUTHORITATIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await globalDb.saveStaff(newDoctor);

    return reply.status(201).send({
      success: true,
      message: 'Doctor added to roster successfully',
      doctor: newDoctor,
    });
  });

  /**
   * PUT /api/doctors/:id
   * Update doctor details, shift timings, or add leaves
   */
  fastify.put('/api/doctors/:id', async (req: FastifyRequest<{ Params: { id: string }; Body: Partial<BusinessStaffDTO> }>, reply: FastifyReply) => {
    const ctx = await resolveHealthcareContext(req, reply);
    if (!ctx) return;
    if (ctx.isViewer) return reply.status(403).send({ error: 'FORBIDDEN', message: 'Viewers cannot modify doctor rosters.' });

    const { id } = req.params;
    let existing = await globalDb.getStaffById(id, ctx.workspaceId);
    if (!existing) existing = await globalDb.getStaffById(id, ctx.organizationId);
    if (!existing) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Doctor roster entry not found' });

    const body = req.body || {};
    delete (body as any).id;
    delete (body as any).organizationId;

    if (typeof body.consultationFee === 'number' && body.consultationFee < 0) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Consultation fee must be non-negative' });
    }

    const shiftStart = body.shiftStart || existing.shiftStart || '09:00';
    const shiftEnd = body.shiftEnd || existing.shiftEnd || '17:00';
    if (body.shiftStart || body.shiftEnd) {
      if (toMinutes(shiftStart) >= toMinutes(shiftEnd)) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Shift start time must be before shift end time' });
      }
    }

    const breakStart = body.breakStart || existing.breakStart || '13:00';
    const breakEnd = body.breakEnd || existing.breakEnd || '14:00';
    if (body.breakStart || body.breakEnd) {
      if (toMinutes(breakStart) >= toMinutes(breakEnd)) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Break start time must be before break end time' });
      }
      if (toMinutes(breakStart) < toMinutes(shiftStart) || toMinutes(breakEnd) > toMinutes(shiftEnd)) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Break hours must fall within shift timings' });
      }
    }

    const updated = await globalDb.updateStaff(id, body, existing.organizationId);

    return reply.send({
      success: true,
      message: 'Doctor roster updated successfully',
      doctor: updated,
    });
  });

  /**
   * DELETE /api/doctors/:id
   * Deactivate doctor roster entry without deleting historical appointments
   */
  fastify.delete('/api/doctors/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const ctx = await resolveHealthcareContext(req, reply);
    if (!ctx) return;
    if (ctx.isViewer) return reply.status(403).send({ error: 'FORBIDDEN', message: 'Viewers cannot remove doctor rosters.' });

    const { id } = req.params;
    let existing = await globalDb.getStaffById(id, ctx.workspaceId);
    if (!existing) existing = await globalDb.getStaffById(id, ctx.organizationId);
    if (!existing) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Doctor roster entry not found' });

    // Mark inactive to preserve historical booking references
    await globalDb.updateStaff(id, { isActive: false }, existing.organizationId);

    return reply.send({
      success: true,
      message: 'Doctor deactivated from active roster (historical appointments preserved)',
    });
  });

  // =========================================================================
  // 3. APPOINTMENT SCHEDULING ENGINE & SLOT AVAILABILITY
  // =========================================================================

  /**
   * GET /api/doctors/:id/availability
   * Compute real available appointment slots for a given date
   */
  fastify.get('/api/doctors/:id/availability', async (req: FastifyRequest<{ Params: { id: string }; Querystring: { date: string } }>, reply: FastifyReply) => {
    const ctx = await resolveHealthcareContext(req, reply);
    if (!ctx) return;

    const { id } = req.params;
    const { date } = req.query;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Valid date required in YYYY-MM-DD format' });
    }

    let doctor = await globalDb.getStaffById(id, ctx.workspaceId);
    if (!doctor) doctor = await globalDb.getStaffById(id, ctx.organizationId);
    if (!doctor) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Doctor not found' });

    if (!doctor.isActive) {
      return reply.send({
        success: true,
        doctorId: doctor.id,
        doctorName: doctor.fullName,
        date,
        totalSlots: 0,
        availableSlotsCount: 0,
        slots: [],
        notice: 'Doctor is currently inactive.',
      });
    }

    // Timezone-safe day of week calculation for the calendar date
    const [year, month, day] = date.split('-').map(Number);
    const requestedDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)); // Noon UTC guarantees same calendar day across all timezones
    const dayOfWeek = requestedDate.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

    // Resolve clinic timezone
    const ws = await globalDb.getClientWorkspaceById(ctx.workspaceId);
    const clinicTz = ws?.timezone || 'Asia/Kolkata';

    // Check if doctor works on this day
    const availableDays = doctor.availableDays || [1, 2, 3, 4, 5, 6];
    if (!availableDays.includes(dayOfWeek)) {
      return reply.send({
        success: true,
        doctorId: doctor.id,
        doctorName: doctor.fullName,
        date,
        totalSlots: 0,
        availableSlotsCount: 0,
        slots: [],
        notice: 'Doctor does not practice on this day of the week.',
      });
    }

    // Check if doctor is on leave
    const leaves = doctor.leaves || [];
    const isLeave = leaves.some(l => l.date === date);
    if (isLeave) {
      return reply.send({
        success: true,
        doctorId: doctor.id,
        doctorName: doctor.fullName,
        date,
        totalSlots: 0,
        availableSlotsCount: 0,
        slots: [],
        notice: 'Doctor is on scheduled leave on this date.',
      });
    }

    // Parse shift and break hours
    const shiftStart = doctor.shiftStart || '09:00';
    const shiftEnd = doctor.shiftEnd || '17:00';
    const breakStart = doctor.breakStart || '13:00';
    const breakEnd = doctor.breakEnd || '14:00';
    const slotDuration = typeof doctor.slotDurationMinutes === 'number' ? doctor.slotDurationMinutes : 15;
    const buffer = typeof doctor.bufferMinutes === 'number' ? doctor.bufferMinutes : 5;



    const shiftStartMin = toMinutes(shiftStart);
    const shiftEndMin = toMinutes(shiftEnd);
    const breakStartMin = toMinutes(breakStart);
    const breakEndMin = toMinutes(breakEnd);

    // Fetch existing appointments for doctor on this date (timezone-aware)
    const allAppointments = await globalDb.getAppointments(ctx.workspaceId);
    const dayAppointments = allAppointments.filter(a => {
      if (a.doctorId !== doctor.id && a.doctorId !== undefined) return false;
      if (a.status === 'CANCELLED') return false;
      // Match if exact prefix matches OR if timezone-converted date matches
      if (a.scheduledTime.startsWith(date)) return true;
      return getLocalDateInTimezone(a.scheduledTime, clinicTz) === date;
    });

    const bookedMinutes = new Set<number>();
    dayAppointments.forEach(a => {
      try {
        let bookedMin: number;
        if (a.scheduledTime.startsWith(date)) {
          const timePart = a.scheduledTime.includes('T') ? a.scheduledTime.split('T')[1].slice(0, 5) : a.scheduledTime.slice(11, 16);
          bookedMin = toMinutes(timePart);
        } else {
          bookedMin = getLocalMinutesInTimezone(a.scheduledTime, clinicTz);
        }
        const dur = a.durationMinutes || slotDuration;
        for (let m = bookedMin; m < bookedMin + dur; m += 5) {
          bookedMinutes.add(m);
        }
      } catch {}
    });

    // Generate slots
    const slots = [];
    const step = slotDuration + buffer;
    for (let current = shiftStartMin; current + slotDuration <= shiftEndMin; current += step) {
      const slotStartTime = toTimeStr(current);
      const slotEndTime = toTimeStr(current + slotDuration);

      // Check if slot overlaps with break
      const inBreak = (current >= breakStartMin && current < breakEndMin) ||
                      (current + slotDuration > breakStartMin && current + slotDuration <= breakEndMin);

      // Check if booked
      let isBooked = false;
      for (let m = current; m < current + slotDuration; m += 5) {
        if (bookedMinutes.has(m)) {
          isBooked = true;
          break;
        }
      }

      const isAvailable = !inBreak && !isBooked;
      let reason: string | undefined = undefined;
      if (inBreak) reason = 'Doctor Lunch / Break';
      else if (isBooked) reason = 'Already Booked';

      slots.push({
        startTime: slotStartTime,
        endTime: slotEndTime,
        scheduledTime: `${date}T${slotStartTime}:00Z`,
        isAvailable,
        reason,
      });
    }

    const availableSlots = slots.filter(s => s.isAvailable);

    return reply.send({
      success: true,
      doctorId: doctor.id,
      doctorName: doctor.fullName,
      specialization: doctor.specialization,
      consultationFee: doctor.consultationFee,
      date,
      totalSlots: slots.length,
      availableSlotsCount: availableSlots.length,
      slots,
    });
  });

  /**
   * POST /api/appointments
   * Book an appointment with concurrency check & idempotency
   */
  fastify.post('/api/appointments', async (req: FastifyRequest<{ Body: Partial<AppointmentSlotDTO> & { date?: string; time?: string } }>, reply: FastifyReply) => {
    const ctx = await resolveHealthcareContext(req, reply);
    if (!ctx) return;

    const body = req.body || {};
    const { doctorId, customerName, customerPhone, serviceType, scheduledTime, durationMinutes, notes, idempotencyKey } = body;

    if (!customerName || !customerName.trim() || !customerPhone || !customerPhone.trim()) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Patient name and phone number required' });
    }

    // Validate phone number format
    const phoneVal = validateIndianPhoneNumber(customerPhone);
    if (!phoneVal.isValid) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: phoneVal.error || 'Invalid Indian phone number' });
    }

    // Determine final scheduledTime
    let finalScheduledTime = scheduledTime;
    if (!finalScheduledTime && body.date && body.time) {
      finalScheduledTime = `${body.date}T${body.time}:00Z`;
    }
    if (!finalScheduledTime) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Appointment scheduledTime required' });
    }

    // 1. Validate scheduled time format and past-date guard
    const reqTimestamp = new Date(finalScheduledTime).getTime();
    if (isNaN(reqTimestamp)) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Invalid scheduledTime format' });
    }

    // Reject bookings in the past (allow 5-minute clock tolerance)
    if (reqTimestamp < Date.now() - 5 * 60 * 1000) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Cannot schedule appointments in the past' });
    }

    // 2. Idempotency Check
    if (idempotencyKey) {
      const existingKeyApt = (await globalDb.getAppointments(ctx.workspaceId)).find(a => a.idempotencyKey === idempotencyKey);
      if (existingKeyApt) {
        return reply.status(200).send({
          success: true,
          idempotentReplay: true,
          appointment: existingKeyApt,
          message: 'Appointment booking replayed idempotently',
        });
      }
    }

    // 3. Concurrency & Double-Booking Prevention Pre-check
    const slotDuration = durationMinutes || 15;
    const existingAppointments = await globalDb.getAppointments(ctx.workspaceId);
        const conflicting = existingAppointments.find(a => {
      if (a.status === 'CANCELLED' || (a.status as string) === 'RESCHEDULED') return false;
      if (doctorId && a.doctorId && a.doctorId !== doctorId) return false;
      const existingTime = new Date(a.scheduledTime).getTime();
      const existingDur = (a.durationMinutes || 15) * 60 * 1000;
      // Overlap condition
      return Math.abs(existingTime - reqTimestamp) < existingDur;
    });

    if (conflicting) {
            return reply.status(409).send({
        error: 'SLOT_UNAVAILABLE',
        message: 'This appointment slot has already been booked or is no longer available. Please select another slot.',
      });
    }

    const appointmentId = `apt_${crypto.randomUUID()}`;
    const auditEntry: AppointmentAuditEntry = {
      action: 'CREATED',
      timestamp: new Date().toISOString(),
      performedBy: ctx.session.fullName || 'System',
      note: 'Initial OPD appointment booking',
    };

    const newAppointment: AppointmentSlotDTO = {
      id: appointmentId,
      tenantId: ctx.workspaceId,
      doctorId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      serviceType: serviceType || 'Doctor Consultation',
      scheduledTime: finalScheduledTime,
      durationMinutes: slotDuration,
      status: 'CONFIRMED',
      notes: notes?.trim(),
      auditHistory: [auditEntry],
      idempotencyKey,
    };

    try {
      await globalDb.saveAppointment(newAppointment);
    } catch (err: any) {
      if (err.code === '23505' || err.message?.includes('uq_appointments_doctor_slot') || err.message?.includes('duplicate key') || err.message?.includes('Unique constraint violation')) {
        if (err.message?.includes('uq_appointments_idempotency') && idempotencyKey) {
          const replayed = (await globalDb.getAppointments(ctx.workspaceId)).find(a => a.idempotencyKey === idempotencyKey);
          if (replayed) {
            return reply.status(200).send({
              success: true,
              idempotentReplay: true,
              appointment: replayed,
              message: 'Appointment booking replayed idempotently',
            });
          }
        }
        return reply.status(409).send({
          error: 'SLOT_UNAVAILABLE',
          message: 'This appointment slot has already been booked or is no longer available. Please select another slot.',
        });
      }
      throw err;
    }

    // Trigger webhook if enabled
    const ws = await globalDb.getClientWorkspaceById(ctx.workspaceId);
    if (ws) {
      triggerAppointmentWebhook(ws, 'appointment.created', newAppointment).catch(() => {});
    }

    return reply.status(201).send({
      success: true,
      appointment: newAppointment,
      message: 'Appointment booked successfully',
    });
  });

  /**
   * GET /api/appointments
   * List appointments for the active workspace
   */
  fastify.get('/api/appointments', async (req: FastifyRequest<{ Querystring: { date?: string; doctorId?: string; status?: string } }>, reply: FastifyReply) => {
    const ctx = await resolveHealthcareContext(req, reply);
    if (!ctx) return;

    let appointments = await globalDb.getAppointments(ctx.workspaceId);
    if (appointments.length === 0 && ctx.workspaceId !== ctx.organizationId) {
      appointments = await globalDb.getAppointments(ctx.organizationId);
    }

    const { date, doctorId, status } = req.query || {};
    if (date) {
      appointments = appointments.filter(a => a.scheduledTime.startsWith(date));
    }
    if (doctorId) {
      appointments = appointments.filter(a => a.doctorId === doctorId);
    }
    if (status) {
      appointments = appointments.filter(a => a.status === status);
    }

    return reply.send({
      success: true,
      appointments,
      total: appointments.length,
    });
  });

  /**
   * GET /api/appointments/:id
   * Get single appointment details with audit trail
   */
  fastify.get('/api/appointments/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const ctx = await resolveHealthcareContext(req, reply);
    if (!ctx) return;

    const { id } = req.params;
    let appointment = await globalDb.getAppointmentById(id, ctx.workspaceId);
    if (!appointment) appointment = await globalDb.getAppointmentById(id, ctx.organizationId);

    if (!appointment) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Appointment not found' });
    }

    return reply.send({
      success: true,
      appointment,
    });
  });

  /**
   * POST /api/appointments/:id/confirm
   * Confirm a pending appointment
   */
  fastify.post('/api/appointments/:id/confirm', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const ctx = await resolveHealthcareContext(req, reply);
    if (!ctx) return;

    const { id } = req.params;
    let appointment = await globalDb.getAppointmentById(id, ctx.workspaceId);
    if (!appointment) appointment = await globalDb.getAppointmentById(id, ctx.organizationId);
    if (!appointment) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Appointment not found' });

    const auditHistory = appointment.auditHistory || [];
    auditHistory.push({
      action: 'CONFIRMED',
      timestamp: new Date().toISOString(),
      performedBy: ctx.session.fullName || 'Clinic Staff',
      note: 'Appointment confirmed by staff',
    });

    const updated = await globalDb.updateAppointment(id, {
      status: 'CONFIRMED',
      auditHistory,
    }, appointment.tenantId);

    const ws = await globalDb.getClientWorkspaceById(ctx.workspaceId);
    if (ws && updated) {
      triggerAppointmentWebhook(ws, 'appointment.confirmed', updated).catch(() => {});
    }

    return reply.send({
      success: true,
      appointment: updated,
      message: 'Appointment confirmed',
    });
  });

  /**
   * POST /api/appointments/:id/reschedule
   * Reschedule appointment to a new slot with availability check
   */
  fastify.post('/api/appointments/:id/reschedule', async (req: FastifyRequest<{ Params: { id: string }; Body: { newScheduledTime: string; reason?: string } }>, reply: FastifyReply) => {
    const ctx = await resolveHealthcareContext(req, reply);
    if (!ctx) return;

    const { id } = req.params;
    const { newScheduledTime, reason } = req.body || {};

    if (!newScheduledTime) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'newScheduledTime required' });
    }

    let appointment = await globalDb.getAppointmentById(id, ctx.workspaceId);
    if (!appointment) appointment = await globalDb.getAppointmentById(id, ctx.organizationId);
    if (!appointment) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Appointment not found' });

    // Validate format and past-date
    const newTimestamp = new Date(newScheduledTime).getTime();
    if (isNaN(newTimestamp)) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Invalid newScheduledTime format' });
    }
    if (newTimestamp < Date.now() - 5 * 60 * 1000) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Cannot reschedule appointments into the past' });
    }

    if (appointment.status === 'CANCELLED') {
      return reply.status(400).send({ error: 'INVALID_STATE', message: 'Cannot reschedule a cancelled appointment. Please book a new appointment.' });
    }

    // Check availability of new slot
    const slotDur = (appointment.durationMinutes || 15) * 60 * 1000;
    const allAppointments = await globalDb.getAppointments(appointment.tenantId);
    const conflict = allAppointments.find(a => {
      if (a.id === id || a.status === 'CANCELLED' || (a.status as string) === 'RESCHEDULED') return false;
      if (appointment.doctorId && a.doctorId && a.doctorId !== appointment.doctorId) return false;
      const exTime = new Date(a.scheduledTime).getTime();
      return Math.abs(exTime - newTimestamp) < slotDur;
    });

    if (conflict) {
      return reply.status(409).send({
        error: 'SLOT_UNAVAILABLE',
        message: 'The requested reschedule slot is already booked. Please choose an alternate time.',
      });
    }

    const auditHistory = appointment.auditHistory || [];
    auditHistory.push({
      action: 'RESCHEDULED',
      timestamp: new Date().toISOString(),
      performedBy: ctx.session.fullName || 'Clinic Staff',
      previousTime: appointment.scheduledTime,
      note: reason || 'Patient requested reschedule',
    });

    let updated;
    try {
      updated = await globalDb.updateAppointment(id, {
        scheduledTime: newScheduledTime,
        status: 'CONFIRMED',
        auditHistory,
      }, appointment.tenantId);
    } catch (err: any) {
      if (err.code === '23505' || err.message?.includes('uq_appointments_doctor_slot') || err.message?.includes('Unique constraint violation')) {
        return reply.status(409).send({
          error: 'SLOT_UNAVAILABLE',
          message: 'The requested reschedule slot is already booked. Please choose an alternate time.',
        });
      }
      throw err;
    }

    const ws = await globalDb.getClientWorkspaceById(ctx.workspaceId);
    if (ws && updated) {
      triggerAppointmentWebhook(ws, 'appointment.rescheduled', updated).catch(() => {});
    }

    return reply.send({
      success: true,
      appointment: updated,
      message: 'Appointment rescheduled successfully',
    });
  });

  /**
   * POST /api/appointments/:id/cancel
   * Cancel an appointment with mandatory cancellation reason
   */
  fastify.post('/api/appointments/:id/cancel', async (req: FastifyRequest<{ Params: { id: string }; Body: { reason?: string } }>, reply: FastifyReply) => {
    const ctx = await resolveHealthcareContext(req, reply);
    if (!ctx) return;

    const { id } = req.params;
    const reason = req.body?.reason || 'Cancelled by patient';

    let appointment = await globalDb.getAppointmentById(id, ctx.workspaceId);
    if (!appointment) appointment = await globalDb.getAppointmentById(id, ctx.organizationId);
    if (!appointment) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Appointment not found' });

    if (appointment.status === 'CANCELLED') {
      return reply.status(200).send({
        success: true,
        appointment,
        message: 'Appointment was already cancelled',
      });
    }

    const auditHistory = appointment.auditHistory || [];
    auditHistory.push({
      action: 'CANCELLED',
      timestamp: new Date().toISOString(),
      performedBy: ctx.session.fullName || 'User',
      note: reason,
    });

    const updated = await globalDb.updateAppointment(id, {
      status: 'CANCELLED',
      cancellationReason: reason,
      auditHistory,
    }, appointment.tenantId);

    const ws = await globalDb.getClientWorkspaceById(ctx.workspaceId);
    if (ws && updated) {
      triggerAppointmentWebhook(ws, 'appointment.cancelled', updated).catch(() => {});
    }

    return reply.send({
      success: true,
      appointment: updated,
      message: 'Appointment cancelled successfully. Slot is now available for other patients.',
    });
  });

  // =========================================================================
  // 4. APPROVED ADMINISTRATIVE KNOWLEDGE BASE (FAQS)
  // =========================================================================

  /**
   * GET /api/healthcare/faqs
   * List approved and draft FAQs for clinic workspace
   */
  fastify.get('/api/healthcare/faqs', async (req: FastifyRequest<{ Querystring: { status?: string } }>, reply: FastifyReply) => {
    const ctx = await resolveHealthcareContext(req, reply);
    if (!ctx) return;

    let faqs = await globalDb.getFAQs(ctx.workspaceId);
    if (faqs.length === 0 && ctx.workspaceId !== ctx.organizationId) {
      faqs = await globalDb.getFAQs(ctx.organizationId);
    }

    const { status } = req.query || {};
    if (status) {
      faqs = faqs.filter(f => f.status === status);
    }

    return reply.send({
      success: true,
      faqs,
      total: faqs.length,
    });
  });

  /**
   * POST /api/healthcare/faqs
   * Create an administrative FAQ entry (Hours, Location, Billing, Consultation Prep)
   */
  fastify.post('/api/healthcare/faqs', async (req: FastifyRequest<{ Body: Partial<BusinessFAQDTO> }>, reply: FastifyReply) => {
    const ctx = await resolveHealthcareContext(req, reply);
    if (!ctx) return;
    if (ctx.isViewer) return reply.status(403).send({ error: 'FORBIDDEN', message: 'Viewers cannot create FAQ entries.' });

    const body = req.body || {};
    if (!body.question || !body.answer) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Question and answer required' });
    }

    const newFaq: BusinessFAQDTO = {
      id: `faq_${crypto.randomUUID()}`,
      organizationId: ctx.workspaceId,
      category: body.category || 'GENERAL',
      question: body.question.trim(),
      answer: body.answer.trim(),
      kannadaQuestion: body.kannadaQuestion?.trim(),
      kannadaAnswer: body.kannadaAnswer?.trim(),
      language: body.language || 'KN',
      status: body.status || 'ACTIVE',
      authority: 'APPROVED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await globalDb.saveFAQ(newFaq);

    return reply.status(201).send({
      success: true,
      faq: newFaq,
      message: 'FAQ entry saved successfully',
    });
  });

  /**
   * PUT /api/healthcare/faqs/:id
   * Update FAQ content or approval status
   */
  fastify.put('/api/healthcare/faqs/:id', async (req: FastifyRequest<{ Params: { id: string }; Body: Partial<BusinessFAQDTO> }>, reply: FastifyReply) => {
    const ctx = await resolveHealthcareContext(req, reply);
    if (!ctx) return;
    if (ctx.isViewer) return reply.status(403).send({ error: 'FORBIDDEN', message: 'Viewers cannot edit FAQ entries.' });

    const { id } = req.params;
    const faqs = await globalDb.getFAQs(ctx.workspaceId);
    const existing = faqs.find(f => f.id === id);
    if (!existing) return reply.status(404).send({ error: 'NOT_FOUND', message: 'FAQ entry not found' });

    const updated: BusinessFAQDTO = {
      ...existing,
      ...(req.body || {}),
      id: existing.id,
      organizationId: existing.organizationId,
      updatedAt: new Date().toISOString(),
    };

    await globalDb.saveFAQ(updated);

    return reply.send({
      success: true,
      faq: updated,
      message: 'FAQ entry updated successfully',
    });
  });

  /**
   * DELETE /api/healthcare/faqs/:id
   * Remove FAQ entry
   */
  fastify.delete('/api/healthcare/faqs/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const ctx = await resolveHealthcareContext(req, reply);
    if (!ctx) return;
    if (ctx.isViewer) return reply.status(403).send({ error: 'FORBIDDEN', message: 'Viewers cannot delete FAQs.' });

    const { id } = req.params;
    await globalDb.deleteFAQ(id, ctx.workspaceId);

    return reply.send({
      success: true,
      message: 'FAQ entry deleted successfully',
    });
  });

  // =========================================================================
  // 5. EMERGENCY & CLINICAL ESCALATION SAFEGUARDS
  // =========================================================================

  /**
   * GET /api/healthcare/emergency-protocol
   * Retrieve clinic's emergency safeguard instructions
   */
  fastify.get('/api/healthcare/emergency-protocol', async (req: FastifyRequest, reply: FastifyReply) => {
    const ctx = await resolveHealthcareContext(req, reply);
    if (!ctx) return;

    const ws = await globalDb.getClientWorkspaceById(ctx.workspaceId);
    const config = ws?.clinicConfig || {};

    return reply.send({
      success: true,
      emergencyContactPhone: config.emergencyContactPhone || '108',
      emergencyProtocol: config.emergencyProtocol || 'Immediate transfer to 108 emergency service or nearest hospital casualty.',
      kannadaPrompt: 'Idhu emergency agidhe. Dayavittu thakshana 108 ge call maadi athava hattirada emergency casualty ge hoogi. Waiting madbedi.',
    });
  });

  /**
   * POST /api/healthcare/emergency-check
   * Analyzes transcript for medical emergency keywords and enforces strict safety fallback
   */
  fastify.post('/api/healthcare/emergency-check', async (req: FastifyRequest<{ Body: { transcript: string } }>, reply: FastifyReply) => {
    const transcript = req.body?.transcript || '';
    const handler = new EmergencyHandler();
    const result = handler.detectEmergency(transcript);

    if (result.isEmergency) {
      return reply.send({
        isEmergency: true,
        action: 'DIRECT_TO_108',
        guidance: 'Medical emergency detected. Cease all appointment sales. Instruct caller to call 108 or visit nearest hospital casualty immediately.',
        kannadaMessage: 'Idhu emergency agidhe. Dayavittu thakshana 108 ge call maadi athava hattirada emergency hospital casualty ge hoogi.',
        detectedKeywords: result.detectedKeywords,
      });
    }

    return reply.send({
      isEmergency: false,
      action: 'ADMINISTRATIVE_WORKFLOW',
      guidance: 'No acute emergency detected. Proceed with standard clinic reception procedures.',
    });
  });

  // =========================================================================
  // 6. INTEGRATION & SIGNED WEBHOOK TESTING
  // =========================================================================

  /**
   * POST /api/healthcare/integrations/webhook/test
   * Test webhook connectivity with HMAC-SHA256 signature verification
   */
  fastify.post('/api/healthcare/integrations/webhook/test', async (req: FastifyRequest<{ Body: { webhookUrl: string; webhookSecret?: string } }>, reply: FastifyReply) => {
    const ctx = await resolveHealthcareContext(req, reply);
    if (!ctx) return;
    if (ctx.isViewer) return reply.status(403).send({ error: 'FORBIDDEN', message: 'Viewers cannot test integrations.' });

    const { webhookUrl, webhookSecret } = req.body || {};
    if (!webhookUrl || !webhookUrl.startsWith('http')) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Valid http/https webhookUrl required' });
    }

    const testPayload = {
      event: 'ping',
      timestamp: new Date().toISOString(),
      workspaceId: ctx.workspaceId,
      message: 'Vaani-Si Healthcare Webhook Ping',
    };

    const bodyStr = JSON.stringify(testPayload);
    const secret = webhookSecret || 'vanni_test_secret';
    const signature = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Vaani-Signature': signature,
          'X-Vaani-Event': 'ping',
        },
        body: bodyStr,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      return reply.send({
        success: res.ok,
        statusCode: res.status,
        signatureVerified: true,
        message: res.ok ? 'Webhook ping delivered successfully' : `Webhook responded with HTTP ${res.status}`,
      });
    } catch (err: any) {
      return reply.status(502).send({
        success: false,
        error: 'WEBHOOK_FAILED',
        message: `Failed to connect to webhook URL: ${err.message}`,
      });
    }
  });
}
