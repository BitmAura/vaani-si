/**
 * Healthcare Doctor Schedule API Routes
 * Dhwani SI — Layer 5: Fastify Routes
 * Handles doctor management and appointment scheduling
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DoctorSchema, AppointmentSchema } from '../../../../packages/core/src/schemas/doctor-schema';
import { randomUUID } from 'node:crypto';

const uuidv4 = randomUUID;

interface DoctorRouteContext {
  tenantId: string;
  userId: string;
}

function getContext(request: FastifyRequest): DoctorRouteContext {
  const reqAny = request as any;
  if (reqAny.user) return reqAny.user as DoctorRouteContext;
  return {
    tenantId: (request.query as any)?.tenantId || (request.body as any)?.tenantId || 'a0000000-0000-0000-0000-000000000002',
    userId: 'usr-dev-system',
  };
}

/**
 * Doctor & Appointment Routes Plugin
 */
export async function doctorRoutes(fastify: FastifyInstance) {
  
  /**
   * GET /api/doctors
   * List all doctors for a hospital
   */
  fastify.get('/api/doctors', async (request: FastifyRequest<{ Querystring: { specialization?: string } }>, reply: FastifyReply) => {
    const { tenantId } = getContext(request);
    const { specialization: _specialization } = request.query;

    const doctors = [
      {
        id: uuidv4(),
        tenantId,
        firstName: 'Ramesh',
        lastName: 'Patil',
        specialization: 'CARDIOLOGY',
        qualifications: ['MBBS', 'MD', 'DM'],
        consultationFee: 750,
        consultationDuration: 15,
        isActive: true,
        nextAvailable: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
      },
    ];

    return reply.status(200).send({
      success: true,
      data: doctors,
      total: doctors.length,
    });
  });

  /**
   * GET /api/doctors/:id
   * Get doctor details
   */
  fastify.get('/api/doctors/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { tenantId } = getContext(request);
    const { id } = request.params;

    const doctor = {
      id,
      tenantId,
      firstName: 'Ramesh',
      lastName: 'Patil',
      fullName: 'Dr. Ramesh Patil',
      specialization: 'CARDIOLOGY',
      qualifications: ['MBBS', 'MD', 'DM'],
      consultationFee: 750,
      yearsOfExperience: 15,
      consultationDuration: 15,
      languages: ['English', 'Kannada', 'Hindi'],
      bio: 'Senior Cardiologist with 15 years of experience in interventional cardiology.',
    };

    return reply.status(200).send({
      success: true,
      data: doctor,
    });
  });

  /**
   * POST /api/doctors
   * Add a new doctor
   */
  fastify.post('/api/doctors', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const { tenantId, userId } = getContext(request);
    const body = (request.body || {}) as any;
    
    const doctorData = DoctorSchema.parse({
      ...body,
      id: uuidv4(),
      tenantId,
      fullName: `${body.firstName || 'Dr.'} ${body.lastName || 'Doctor'}`,
      createdAt: new Date(),
      createdBy: userId,
    });

    return reply.status(201).send({
      success: true,
      data: doctorData,
      message: 'Doctor added successfully',
    });
  });

  /**
   * GET /api/doctors/:id/availability
   * Get available slots for a doctor on a specific date
   */
  fastify.get('/api/doctors/:id/availability', async (request: FastifyRequest<{ Params: { id: string }; Querystring: { date: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { date } = request.query;

    const slots = [
      { startTime: '09:00', endTime: '09:15', isAvailable: true },
      { startTime: '09:15', endTime: '09:30', isAvailable: true },
      { startTime: '09:30', endTime: '09:45', isAvailable: false, reason: 'Booked' },
      { startTime: '09:45', endTime: '10:00', isAvailable: true },
      { startTime: '10:00', endTime: '10:15', isAvailable: true },
      { startTime: '10:15', endTime: '10:30', isAvailable: false, reason: 'Break' },
      { startTime: '10:30', endTime: '10:45', isAvailable: true },
      { startTime: '10:45', endTime: '11:00', isAvailable: true },
      { startTime: '11:00', endTime: '11:15', isAvailable: false, reason: 'Booked' },
      { startTime: '11:15', endTime: '11:30', isAvailable: true },
    ];

    return reply.status(200).send({
      success: true,
      data: {
        doctorId: id,
        date,
        slots,
        totalAvailable: slots.filter(s => s.isAvailable).length,
      },
    });
  });

  /**
   * POST /api/appointments
   * Book an appointment
   */
  fastify.post('/api/appointments', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const { tenantId, userId } = getContext(request);
    const body = (request.body || {}) as any;
    
    const appointmentData = AppointmentSchema.parse({
      ...body,
      id: uuidv4(),
      tenantId,
      status: 'SCHEDULED',
      createdAt: new Date(),
      createdBy: userId,
    });

    return reply.status(201).send({
      success: true,
      data: appointmentData,
      message: 'Appointment booked successfully',
    });
  });

  /**
   * GET /api/appointments
   * List appointments (with filters)
   */
  fastify.get('/api/appointments/list', async (request: FastifyRequest<{ Querystring: { doctorId?: string; date?: string; status?: string } }>, reply: FastifyReply) => {
    const { tenantId } = getContext(request);
    const { doctorId, date } = request.query;

    const appointments = [
      {
        id: uuidv4(),
        tenantId,
        doctorId,
        patientId: uuidv4(),
        appointmentDate: date || new Date(),
        startTime: '09:30',
        endTime: '09:45',
        status: 'CONFIRMED',
        patientName: 'Anand Kulkarni',
        patientPhone: '+91 9845012345',
        reasonForVisit: 'Chest pain evaluation',
        fee: 750,
      },
    ];

    return reply.status(200).send({
      success: true,
      data: appointments,
      total: appointments.length,
    });
  });

  /**
   * PUT /api/appointments/:id
   * Update appointment status
   */
  fastify.put('/api/appointments/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: { status: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { status } = request.body || { status: 'UPDATED' };

    return reply.status(200).send({
      success: true,
      data: { id, status },
      message: 'Appointment updated successfully',
    });
  });

  /**
   * DELETE /api/appointments/:id
   * Cancel appointment
   */
  fastify.delete('/api/appointments/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    return reply.status(200).send({
      success: true,
      data: { id, cancelled: true },
      message: 'Appointment cancelled successfully',
    });
  });

  /**
   * POST /api/appointments/:id/check-in
   * Patient check-in
   */
  fastify.post('/api/appointments/:id/check-in', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    return reply.status(200).send({
      success: true,
      data: {
        appointmentId: id,
        checkInTime: new Date(),
        status: 'IN_PROGRESS',
      },
      message: 'Patient checked in successfully',
    });
  });

  /**
   * POST /api/appointments/:id/complete
   * Mark appointment as completed
   */
  fastify.post('/api/appointments/:id/complete', async (request: FastifyRequest<{ Params: { id: string }; Body: { prescription?: string; followUpRecommended?: boolean } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { prescription, followUpRecommended } = request.body || {};

    return reply.status(200).send({
      success: true,
      data: {
        appointmentId: id,
        status: 'COMPLETED',
        checkOutTime: new Date(),
        prescription,
        followUpRecommended,
      },
      message: 'Appointment completed successfully',
    });
  });
}
