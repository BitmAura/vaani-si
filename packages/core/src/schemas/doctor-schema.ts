/**
 * Healthcare Doctor & Schedule Schema
 * Dhwani SI — Layer 1 Domain Entity
 * Doctor availability, specializations, and appointment slots
 */

import { z } from 'zod';

export const DoctorSpecialization = z.enum([
  'CARDIOLOGY',
  'ORTHOPEDICS',
  'PEDIATRICS',
  'GYNECOLOGY',
  'DERMATOLOGY',
  'NEUROLOGY',
  'ONCOLOGY',
  'UROLOGY',
  'GASTROENTEROLOGY',
  'PULMONOLOGY',
  'GENERAL_MEDICINE',
  'ENT',
  'OPHTHALMOLOGY',
  'PSYCHIATRY',
  'RADIOLOGY',
]);

export const DayOfWeek = z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']);

export const AppointmentStatus = z.enum(['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW']);

export const DoctorSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(), // Multi-tenant hospital isolation
  
  // Personal info
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  fullName: z.string(), // Calculated: firstName + lastName
  phone: z.string().min(10).max(15),
  email: z.string().email().optional(),
  
  // Professional details
  specialization: DoctorSpecialization,
  qualifications: z.array(z.string()), // e.g., ["MBBS", "MD", "DM"]
  registrationNumber: z.string(), // Medical council registration
  yearsOfExperience: z.number().int().min(0),
  
  // Consultation details
  consultationFee: z.number().positive(), // OPD fee
  followUpFee: z.number().positive().optional(),
  emergencyConsultationFee: z.number().positive().optional(),
  
  // Availability
  consultationDuration: z.number().int().min(5).max(120), // Minutes per patient
  maxAppointmentsPerDay: z.number().int().min(1).max(100),
  
  // Schedule
  weeklySchedule: z.array(z.object({
    day: DayOfWeek,
    isAvailable: z.boolean(),
    slots: z.array(z.object({
      startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/), // HH:MM format
      endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
      slotType: z.enum(['CONSULTATION', 'PROCEDURE', 'EMERGENCY', 'BREAK']),
    })),
  })),
  
  // Leave and holidays
  leaves: z.array(z.object({
    startDate: z.date(),
    endDate: z.date(),
    reason: z.string(),
    type: z.enum(['PLANNED', 'EMERGENCY', 'CONFERENCE', 'VACATION']),
  })),
  
  // Status
  isActive: z.boolean().default(true),
  isOnCall: z.boolean().default(false), // Emergency on-call duty
  onCallDays: z.array(DayOfWeek).optional(),
  
  // Metadata
  languages: z.array(z.string()).default(['English', 'Kannada']),
  bio: z.string().optional(),
  avatar: z.string().url().optional(),
  
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type Doctor = z.infer<typeof DoctorSchema>;
export type DoctorSpecializationType = z.infer<typeof DoctorSpecialization>;
export type DayOfWeekType = z.infer<typeof DayOfWeek>;

/**
 * Appointment Schema
 */
export const AppointmentSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  
  // References
  doctorId: z.string().uuid(),
  patientId: z.string().uuid(),
  leadId: z.string().uuid().optional(), // If booked from lead
  
  // Timing
  appointmentDate: z.date(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  
  // Details
  status: AppointmentStatus.default('SCHEDULED'),
  type: z.enum(['NEW_CONSULTATION', 'FOLLOW_UP', 'EMERGENCY', 'PROCEDURE']),
  reasonForVisit: z.string().optional(),
  notes: z.string().optional(),
  
  // Payment
  fee: z.number().positive(),
  paymentStatus: z.enum(['PENDING', 'PAID', 'WAIVED', 'INSURANCE']),
  paymentMethod: z.enum(['CASH', 'CARD', 'UPI', 'INSURANCE']).optional(),
  
  // Reminders
  smsReminderSent: z.boolean().default(false),
  callReminderSent: z.boolean().default(false),
  whatsappReminderSent: z.boolean().default(false),
  
  // Check-in
  checkInTime: z.date().optional(),
  checkOutTime: z.date().optional(),
  
  // Post-appointment
  prescription: z.string().optional(),
  followUpRecommended: z.boolean().default(false),
  followUpDate: z.date().optional(),
  
  createdAt: z.date().default(() => new Date()),
  createdBy: z.string().optional(),
});

export type Appointment = z.infer<typeof AppointmentSchema>;

/**
 * Available Slot Schema
 */
export const AvailableSlotSchema = z.object({
  doctorId: z.string().uuid(),
  date: z.date(),
  startTime: z.string(),
  endTime: z.string(),
  isAvailable: z.boolean(),
  reason: z.string().optional(), // If not available
});

export type AvailableSlot = z.infer<typeof AvailableSlotSchema>;
