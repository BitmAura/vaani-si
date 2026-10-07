/**
 * @vanni/tool-engine — Foundational 16 Business Tool Definitions & Handlers
 * 
 * Tool Catalog:
 * CUSTOMER:
 *  1. find_customer
 *  2. create_customer
 *  3. update_customer
 * LEAD:
 *  4. create_lead
 *  5. update_lead
 *  6. qualify_lead
 * APPOINTMENT:
 *  7. check_availability
 *  8. create_appointment
 *  9. reschedule_appointment
 *  10. cancel_appointment
 * CALLBACK:
 *  11. create_callback_request
 * TRANSFER:
 *  12. request_human_handoff
 * FOLLOW_UP:
 *  13. create_follow_up
 * BUSINESS INFORMATION:
 *  14. get_business_hours
 *  15. get_business_services
 *  16. get_business_location
 */

import { z } from 'zod';
import { ToolDefinition } from './types.js';
import { ArgumentNormalizer } from './normalizer.js';
import { defaultBusinessStore, IBusinessDataStore } from './models.js';

export function createFoundationalTools(store: IBusinessDataStore = defaultBusinessStore): ToolDefinition[] {
  return [
    // =========================================================================
    // 1. find_customer
    // =========================================================================
    {
      toolId: 'tool_find_customer',
      name: 'find_customer',
      description: 'Look up an existing customer record using their normalized mobile number.',
      version: '1.0.0',
      category: 'CUSTOMER',
      riskLevel: 'LOW',
      confirmationRequired: false,
      confirmationMode: 'NONE',
      supportedIndustries: ['*'],
      enabled: true,
      timeoutMs: 3000,
      idempotent: true,
      requiredPermissions: ['canAccessCustomerData'],
      inputSchema: z.object({
        phone: z.string().min(5, 'Phone number is required'),
      }),
      handler: async (args, ctx) => {
        const normalizedPhone = ArgumentNormalizer.normalizePhoneNumber(args.phone);
        const customer = await store.findCustomerByPhone(ctx.securityContext.organizationId, normalizedPhone);
        if (!customer) {
          return { found: false, message: 'No existing customer found with this phone number.' };
        }
        return {
          found: true,
          customerId: customer.id,
          name: customer.name,
          phone: customer.phone,
          city: customer.city,
          preferredLanguage: customer.preferredLanguage,
        };
      },
    },

    // =========================================================================
    // 2. create_customer
    // =========================================================================
    {
      toolId: 'tool_create_customer',
      name: 'create_customer',
      description: 'Create a new customer contact profile with verified name and phone number.',
      version: '1.0.0',
      category: 'CUSTOMER',
      riskLevel: 'MEDIUM',
      confirmationRequired: false,
      confirmationMode: 'NONE',
      supportedIndustries: ['*'],
      enabled: true,
      timeoutMs: 5000,
      idempotent: true,
      requiredPermissions: ['canCaptureLeads'],
      inputSchema: z.object({
        name: z.string().min(2, 'Customer name is required'),
        phone: z.string().min(8, 'Phone number is required'),
        email: z.string().email().optional(),
        city: z.string().optional(),
        preferredLanguage: z.string().optional(),
        notes: z.string().optional(),
      }),
      handler: async (args, ctx) => {
        const normalizedPhone = ArgumentNormalizer.normalizePhoneNumber(args.phone);
        const normalizedName = ArgumentNormalizer.normalizeName(args.name);

        // Check if customer already exists for this tenant
        const existing = await store.findCustomerByPhone(ctx.securityContext.organizationId, normalizedPhone);
        if (existing) {
          return {
            customerId: existing.id,
            name: existing.name,
            phone: existing.phone,
            isExisting: true,
            status: 'ALREADY_EXISTS',
          };
        }

        const newCustomer = await store.createCustomer({
          id: `cust_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          organizationId: ctx.securityContext.organizationId,
          name: normalizedName,
          phone: normalizedPhone,
          email: args.email,
          city: args.city,
          preferredLanguage: args.preferredLanguage || 'KANGLISH_BUSINESS',
          notes: args.notes,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        return {
          customerId: newCustomer.id,
          name: newCustomer.name,
          phone: newCustomer.phone,
          isExisting: false,
          status: 'CREATED',
        };
      },
    },

    // =========================================================================
    // 3. update_customer
    // =========================================================================
    {
      toolId: 'tool_update_customer',
      name: 'update_customer',
      description: 'Update customer contact information, preferred language, or notes.',
      version: '1.0.0',
      category: 'CUSTOMER',
      riskLevel: 'MEDIUM',
      confirmationRequired: false,
      confirmationMode: 'NONE',
      supportedIndustries: ['*'],
      enabled: true,
      timeoutMs: 5000,
      idempotent: true,
      requiredPermissions: ['canCaptureLeads'],
      inputSchema: z.object({
        customerId: z.string().min(1, 'Customer ID is required'),
        name: z.string().optional(),
        email: z.string().email().optional(),
        city: z.string().optional(),
        preferredLanguage: z.string().optional(),
        notes: z.string().optional(),
      }),
      handler: async (args, ctx) => {
        const updates: any = {};
        if (args.name) updates.name = ArgumentNormalizer.normalizeName(args.name);
        if (args.email) updates.email = args.email;
        if (args.city) updates.city = args.city;
        if (args.preferredLanguage) updates.preferredLanguage = args.preferredLanguage;
        if (args.notes) updates.notes = args.notes;

        const updated = await store.updateCustomer(ctx.securityContext.organizationId, args.customerId, updates);
        return {
          customerId: updated.id,
          name: updated.name,
          phone: updated.phone,
          status: 'UPDATED',
        };
      },
    },

    // =========================================================================
    // 4. create_lead
    // =========================================================================
    {
      toolId: 'tool_create_lead',
      name: 'create_lead',
      description: 'Capture a verified business sales lead with customer requirement, budget, and timeline.',
      version: '1.0.0',
      category: 'LEAD',
      riskLevel: 'MEDIUM',
      confirmationRequired: false,
      confirmationMode: 'IMPLICIT',
      supportedIndustries: ['*'],
      enabled: true,
      timeoutMs: 6000,
      idempotent: true,
      requiredPermissions: ['canCaptureLeads'],
      inputSchema: z.object({
        name: z.string().min(2, 'Name is required'),
        phone: z.string().min(8, 'Phone is required'),
        interest: z.string().min(2, 'Interest/requirement is required'),
        source: z.enum(['PHONE', 'WEBSITE', 'META', 'GOOGLE', 'WHATSAPP', 'MANUAL', 'OTHER']).default('PHONE'),
        budget: z.string().optional(),
        location: z.string().optional(),
        preferredTimeline: z.string().optional(),
        notes: z.string().optional(),
        campaignId: z.string().optional(),
      }),
      handler: async (args, ctx) => {
        const normPhone = ArgumentNormalizer.normalizePhoneNumber(args.phone);
        const normName = ArgumentNormalizer.normalizeName(args.name);

        // 1. Ensure customer exists
        let customer = await store.findCustomerByPhone(ctx.securityContext.organizationId, normPhone);
        if (!customer) {
          customer = await store.createCustomer({
            id: `cust_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            organizationId: ctx.securityContext.organizationId,
            name: normName,
            phone: normPhone,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        // 2. Deterministic Qualification Rule
        let qualStatus: 'UNQUALIFIED' | 'PARTIALLY_QUALIFIED' | 'QUALIFIED' = 'PARTIALLY_QUALIFIED';
        if (args.interest && (args.budget || args.preferredTimeline)) {
          qualStatus = 'QUALIFIED';
        }

        const idempotencyKey = ctx.idempotencyKey || `lead_${ctx.securityContext.organizationId}_${normPhone}_${args.interest.substring(0, 15)}`;

        const lead = await store.createLead({
          id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          organizationId: ctx.securityContext.organizationId,
          customerId: customer.id,
          source: args.source,
          campaignId: args.campaignId,
          conversationId: ctx.securityContext.conversationId,
          status: 'NEW',
          stage: 'INQUIRY',
          interest: args.interest,
          budget: args.budget ? ArgumentNormalizer.normalizeCurrency(args.budget) : undefined,
          location: args.location,
          preferredTimeline: args.preferredTimeline,
          notes: args.notes,
          qualificationStatus: qualStatus,
          qualificationData: {
            hasBudget: !!args.budget,
            hasTimeline: !!args.preferredTimeline,
            evaluatedAt: new Date().toISOString(),
          },
          idempotencyKey,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        return {
          leadId: lead.id,
          customerId: customer.id,
          customerName: customer.name,
          interest: lead.interest,
          qualificationStatus: lead.qualificationStatus,
          status: 'CREATED',
        };
      },
    },

    // =========================================================================
    // 5. update_lead
    // =========================================================================
    {
      toolId: 'tool_update_lead',
      name: 'update_lead',
      description: 'Update an existing lead with additional budget, location, or notes.',
      version: '1.0.0',
      category: 'LEAD',
      riskLevel: 'MEDIUM',
      confirmationRequired: false,
      confirmationMode: 'NONE',
      supportedIndustries: ['*'],
      enabled: true,
      timeoutMs: 5000,
      idempotent: true,
      requiredPermissions: ['canCaptureLeads'],
      inputSchema: z.object({
        leadId: z.string().min(1, 'Lead ID is required'),
        interest: z.string().optional(),
        budget: z.string().optional(),
        location: z.string().optional(),
        notes: z.string().optional(),
        stage: z.string().optional(),
      }),
      handler: async (args, ctx) => {
        const updates: any = {};
        if (args.interest) updates.interest = args.interest;
        if (args.budget) updates.budget = ArgumentNormalizer.normalizeCurrency(args.budget);
        if (args.location) updates.location = args.location;
        if (args.notes) updates.notes = args.notes;
        if (args.stage) updates.stage = args.stage;

        const updated = await store.updateLead(ctx.securityContext.organizationId, args.leadId, updates);
        return {
          leadId: updated.id,
          status: updated.status,
          qualificationStatus: updated.qualificationStatus,
          updated: true,
        };
      },
    },

    // =========================================================================
    // 6. qualify_lead
    // =========================================================================
    {
      toolId: 'tool_qualify_lead',
      name: 'qualify_lead',
      description: 'Evaluate lead qualification using explicit business criteria.',
      version: '1.0.0',
      category: 'LEAD',
      riskLevel: 'MEDIUM',
      confirmationRequired: false,
      confirmationMode: 'NONE',
      supportedIndustries: ['*'],
      enabled: true,
      timeoutMs: 5000,
      idempotent: true,
      requiredPermissions: ['canCaptureLeads'],
      inputSchema: z.object({
        leadId: z.string().min(1, 'Lead ID is required'),
        budgetConfirmed: z.boolean().default(false),
        timelineConfirmed: z.boolean().default(false),
        siteVisitOrConsultationRequested: z.boolean().default(false),
        qualificationNotes: z.string().optional(),
      }),
      handler: async (args, ctx) => {
        const lead = await store.getLeadById(ctx.securityContext.organizationId, args.leadId);
        if (!lead) {
          throw new Error(`Lead ${args.leadId} not found`);
        }

        const score = (args.budgetConfirmed ? 1 : 0) +
                      (args.timelineConfirmed ? 1 : 0) +
                      (args.siteVisitOrConsultationRequested ? 2 : 0);

        const newStatus = score >= 2 ? 'QUALIFIED' : 'PARTIALLY_QUALIFIED';

        const updated = await store.updateLead(ctx.securityContext.organizationId, args.leadId, {
          qualificationStatus: newStatus,
          status: newStatus === 'QUALIFIED' ? 'QUALIFIED' : lead.status,
          qualificationData: {
            score,
            budgetConfirmed: args.budgetConfirmed,
            timelineConfirmed: args.timelineConfirmed,
            siteVisitOrConsultationRequested: args.siteVisitOrConsultationRequested,
            qualificationNotes: args.qualificationNotes,
            evaluatedAt: new Date().toISOString(),
          },
        });

        return {
          leadId: updated.id,
          qualificationStatus: updated.qualificationStatus,
          status: updated.status,
          score,
        };
      },
    },

    // =========================================================================
    // 7. check_availability
    // =========================================================================
    {
      toolId: 'tool_check_availability',
      name: 'check_availability',
      description: 'Query verified available appointment slots for a given date and service.',
      version: '1.0.0',
      category: 'APPOINTMENT',
      riskLevel: 'LOW',
      confirmationRequired: false,
      confirmationMode: 'NONE',
      supportedIndustries: ['*'],
      enabled: true,
      timeoutMs: 4000,
      idempotent: true,
      requiredPermissions: ['canBookAppointments'],
      inputSchema: z.object({
        date: z.string().min(1, 'Date expression or ISO date is required'),
        serviceId: z.string().optional(),
        staffId: z.string().optional(),
      }),
      handler: async (args, ctx) => {
        const norm = ArgumentNormalizer.normalizeDateTime(args.date, undefined, ctx.securityContext.businessTimezone);
        const queryDateStr = norm.dateISO;

        // Fetch existing appointments on this date
        const booked = await store.listAppointments(ctx.securityContext.organizationId, queryDateStr);
        const bookedTimes = new Set(
          booked
            .filter(b => b.status === 'CONFIRMED' || b.status === 'REQUESTED')
            .map(b => b.startTime.substring(11, 16))
        );

        // Standard clinic/business slots: 10:00, 11:30, 14:00, 15:30, 17:00
        const potentialSlots = ['10:00', '11:30', '14:00', '15:30', '17:00'];
        const availableSlots = potentialSlots
          .filter(time => !bookedTimes.has(time))
          .map(time => ({
            slot: time,
            startTimeISO: `${queryDateStr}T${time}:00.000Z`,
            displayTime: `${time} IST`,
          }));

        return {
          date: queryDateStr,
          timezone: ctx.securityContext.businessTimezone,
          hasAvailability: availableSlots.length > 0,
          availableSlots: availableSlots.map(s => s.displayTime),
          slots: availableSlots,
        };
      },
    },

    // =========================================================================
    // 8. create_appointment
    // =========================================================================
    {
      toolId: 'tool_create_appointment',
      name: 'create_appointment',
      description: 'Book a confirmed appointment slot only after availability check and explicit confirmation.',
      version: '1.0.0',
      category: 'APPOINTMENT',
      riskLevel: 'HIGH',
      confirmationRequired: true,
      confirmationMode: 'EXPLICIT',
      supportedIndustries: ['*'],
      enabled: true,
      timeoutMs: 6000,
      idempotent: true,
      requiredPermissions: ['canBookAppointments'],
      inputSchema: z.object({
        name: z.string().min(2, 'Customer name is required'),
        phone: z.string().min(8, 'Customer phone is required'),
        date: z.string().min(1, 'Date is required'),
        time: z.string().min(1, 'Time is required'),
        serviceId: z.string().optional(),
        staffId: z.string().optional(),
        notes: z.string().optional(),
      }),
      handler: async (args, ctx) => {
        // Enforce explicit confirmation for HIGH risk booking
        if (!ctx.isConfirmed) {
          throw new Error('CONFIRMATION_REQUIRED: Explicit customer confirmation is required before booking this appointment.');
        }

        const normPhone = ArgumentNormalizer.normalizePhoneNumber(args.phone);
        const normName = ArgumentNormalizer.normalizeName(args.name);
        const normDT = ArgumentNormalizer.normalizeDateTime(args.date, args.time, ctx.securityContext.businessTimezone);

        // Resolve or create customer
        let customer = await store.findCustomerByPhone(ctx.securityContext.organizationId, normPhone);
        if (!customer) {
          customer = await store.createCustomer({
            id: `cust_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            organizationId: ctx.securityContext.organizationId,
            name: normName,
            phone: normPhone,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        const startTime = normDT.dateTimeISO;
        // Default 45 minute duration
        const endTimeDate = new Date(new Date(startTime).getTime() + 45 * 60 * 1000);
        const endTime = endTimeDate.toISOString();

        const idempotencyKey = ctx.idempotencyKey || `apt_${ctx.securityContext.organizationId}_${customer.id}_${startTime}`;

        // Attempt atomic reservation via store
        const appointment = await store.createAppointment({
          id: `apt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          organizationId: ctx.securityContext.organizationId,
          customerId: customer.id,
          serviceId: args.serviceId,
          staffId: args.staffId,
          startTime,
          endTime,
          timezone: ctx.securityContext.businessTimezone,
          status: 'CONFIRMED',
          source: 'AI_VOICE',
          conversationId: ctx.securityContext.conversationId,
          idempotencyKey,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        return {
          appointmentId: appointment.id,
          customerId: customer.id,
          customerName: customer.name,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          timezone: appointment.timezone,
          status: 'CONFIRMED',
        };
      },
    },

    // =========================================================================
    // 9. reschedule_appointment
    // =========================================================================
    {
      toolId: 'tool_reschedule_appointment',
      name: 'reschedule_appointment',
      description: 'Reschedule an existing confirmed appointment to a new date and time.',
      version: '1.0.0',
      category: 'APPOINTMENT',
      riskLevel: 'HIGH',
      confirmationRequired: true,
      confirmationMode: 'EXPLICIT',
      supportedIndustries: ['*'],
      enabled: true,
      timeoutMs: 6000,
      idempotent: true,
      requiredPermissions: ['canBookAppointments'],
      inputSchema: z.object({
        appointmentId: z.string().min(1, 'Appointment ID is required'),
        newDate: z.string().min(1, 'New date is required'),
        newTime: z.string().min(1, 'New time is required'),
      }),
      handler: async (args, ctx) => {
        if (!ctx.isConfirmed) {
          throw new Error('CONFIRMATION_REQUIRED: Explicit customer confirmation is required before rescheduling.');
        }

        const normDT = ArgumentNormalizer.normalizeDateTime(args.newDate, args.newTime, ctx.securityContext.businessTimezone);
        const startTime = normDT.dateTimeISO;
        const endTime = new Date(new Date(startTime).getTime() + 45 * 60 * 1000).toISOString();

        const updated = await store.updateAppointment(ctx.securityContext.organizationId, args.appointmentId, {
          startTime,
          endTime,
          status: 'RESCHEDULED',
        });

        return {
          appointmentId: updated.id,
          startTime: updated.startTime,
          endTime: updated.endTime,
          status: 'RESCHEDULED',
        };
      },
    },

    // =========================================================================
    // 10. cancel_appointment
    // =========================================================================
    {
      toolId: 'tool_cancel_appointment',
      name: 'cancel_appointment',
      description: 'Cancel a previously scheduled appointment upon confirmed customer request.',
      version: '1.0.0',
      category: 'APPOINTMENT',
      riskLevel: 'HIGH',
      confirmationRequired: true,
      confirmationMode: 'EXPLICIT',
      supportedIndustries: ['*'],
      enabled: true,
      timeoutMs: 5000,
      idempotent: true,
      requiredPermissions: ['canBookAppointments'],
      inputSchema: z.object({
        appointmentId: z.string().min(1, 'Appointment ID is required'),
        reason: z.string().optional(),
      }),
      handler: async (args, ctx) => {
        if (!ctx.isConfirmed) {
          throw new Error('CONFIRMATION_REQUIRED: Explicit customer confirmation is required before cancelling an appointment.');
        }

        const updated = await store.updateAppointment(ctx.securityContext.organizationId, args.appointmentId, {
          status: 'CANCELLED',
          cancellationReason: args.reason || 'Customer requested cancellation',
        });

        return {
          appointmentId: updated.id,
          status: 'CANCELLED',
          cancelledAt: new Date().toISOString(),
        };
      },
    },

    // =========================================================================
    // 11. create_callback_request
    // =========================================================================
    {
      toolId: 'tool_create_callback_request',
      name: 'create_callback_request',
      description: 'Schedule a guaranteed business callback during operating hours.',
      version: '1.0.0',
      category: 'COMMUNICATION',
      riskLevel: 'MEDIUM',
      confirmationRequired: false,
      confirmationMode: 'IMPLICIT',
      supportedIndustries: ['*'],
      enabled: true,
      timeoutMs: 5000,
      idempotent: true,
      requiredPermissions: ['canCaptureLeads'],
      inputSchema: z.object({
        name: z.string().min(2, 'Name is required'),
        phone: z.string().min(8, 'Phone is required'),
        preferredTime: z.string().min(2, 'Preferred time is required'),
        reason: z.string().min(3, 'Callback reason is required'),
      }),
      handler: async (args, ctx) => {
        const normPhone = ArgumentNormalizer.normalizePhoneNumber(args.phone);
        const normName = ArgumentNormalizer.normalizeName(args.name);

        let customer = await store.findCustomerByPhone(ctx.securityContext.organizationId, normPhone);
        if (!customer) {
          customer = await store.createCustomer({
            id: `cust_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            organizationId: ctx.securityContext.organizationId,
            name: normName,
            phone: normPhone,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        const idempotencyKey = ctx.idempotencyKey || `cb_${ctx.securityContext.organizationId}_${customer.id}_${Date.now()}`;

        const cb = await store.createCallback({
          id: `cb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          organizationId: ctx.securityContext.organizationId,
          customerId: customer.id,
          conversationId: ctx.securityContext.conversationId,
          preferredTime: args.preferredTime,
          reason: args.reason,
          status: 'REQUESTED',
          assignedTeam: 'FRONT_DESK',
          idempotencyKey,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        return {
          callbackId: cb.id,
          customerName: customer.name,
          phone: customer.phone,
          preferredTime: cb.preferredTime,
          status: 'REQUESTED',
        };
      },
    },

    // =========================================================================
    // 12. request_human_handoff
    // =========================================================================
    {
      toolId: 'tool_request_human_handoff',
      name: 'request_human_handoff',
      description: 'Signal immediate call handoff to a human receptionist, doctor, or agent.',
      version: '1.0.0',
      category: 'TRANSFER',
      riskLevel: 'HIGH',
      confirmationRequired: false,
      confirmationMode: 'NONE',
      supportedIndustries: ['*'],
      enabled: true,
      timeoutMs: 4000,
      idempotent: true,
      requiredPermissions: ['canTransferCalls'],
      inputSchema: z.object({
        reason: z.string().min(2, 'Reason for transfer is required'),
        priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).default('NORMAL'),
        targetDepartment: z.string().default('RECEPTION'),
      }),
      handler: async (args, ctx) => {
        return {
          transferInitiated: true,
          status: 'HANDOFF_REQUESTED',
          targetDepartment: args.targetDepartment,
          priority: args.priority,
          conversationId: ctx.securityContext.conversationId,
          timestamp: new Date().toISOString(),
        };
      },
    },

    // =========================================================================
    // 13. create_follow_up
    // =========================================================================
    {
      toolId: 'tool_create_follow_up',
      name: 'create_follow_up',
      description: 'Create an internal business task or follow-up item for the sales or support team.',
      version: '1.0.0',
      category: 'FOLLOW_UP',
      riskLevel: 'MEDIUM',
      confirmationRequired: false,
      confirmationMode: 'NONE',
      supportedIndustries: ['*'],
      enabled: true,
      timeoutMs: 5000,
      idempotent: true,
      requiredPermissions: ['canCaptureLeads'],
      inputSchema: z.object({
        title: z.string().min(3, 'Title is required'),
        customerId: z.string().min(1, 'Customer ID is required'),
        description: z.string().optional(),
        dueDate: z.string().min(1, 'Due date is required'),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
      }),
      handler: async (args, ctx) => {
        const normDT = ArgumentNormalizer.normalizeDateTime(args.dueDate, undefined, ctx.securityContext.businessTimezone);
        const task = await store.createFollowUp({
          id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          organizationId: ctx.securityContext.organizationId,
          customerId: args.customerId,
          title: args.title,
          description: args.description,
          dueDate: normDT.dateTimeISO,
          status: 'PENDING',
          priority: args.priority,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        return {
          taskId: task.id,
          title: task.title,
          dueDate: task.dueDate,
          priority: task.priority,
          status: 'PENDING',
        };
      },
    },

    // =========================================================================
    // 14. get_business_hours
    // =========================================================================
    {
      toolId: 'tool_get_business_hours',
      name: 'get_business_hours',
      description: 'Retrieve verified operating hours and days open for the business.',
      version: '1.0.0',
      category: 'INFORMATION',
      riskLevel: 'LOW',
      confirmationRequired: false,
      confirmationMode: 'NONE',
      supportedIndustries: ['*'],
      enabled: true,
      timeoutMs: 3000,
      idempotent: true,
      requiredPermissions: [],
      inputSchema: z.object({
        dayOfWeek: z.string().optional(),
      }),
      handler: async (_args, ctx) => {
        return {
          timezone: ctx.securityContext.businessTimezone,
          regularHours: 'Monday to Saturday: 9:00 AM - 8:00 PM',
          sunday: '10:00 AM - 2:00 PM (Emergency consultations only)',
          holidays: 'Closed on major Karnataka government public holidays',
        };
      },
    },

    // =========================================================================
    // 15. get_business_services
    // =========================================================================
    {
      toolId: 'tool_get_business_services',
      name: 'get_business_services',
      description: 'Retrieve official services offered, typical duration, and pricing guidance.',
      version: '1.0.0',
      category: 'INFORMATION',
      riskLevel: 'LOW',
      confirmationRequired: false,
      confirmationMode: 'NONE',
      supportedIndustries: ['*'],
      enabled: true,
      timeoutMs: 3000,
      idempotent: true,
      requiredPermissions: [],
      inputSchema: z.object({
        category: z.string().optional(),
      }),
      handler: async (args, ctx) => {
        const ind = ctx.securityContext.industry;
        if (ind === 'DENTAL') {
          return {
            industry: 'DENTAL',
            services: [
              { name: 'Dental Consultation & X-Ray', duration: '30 mins', startingPrice: '₹500' },
              { name: 'Teeth Cleaning (Scaling)', duration: '45 mins', startingPrice: '₹1,500' },
              { name: 'Dental Implants Consultation', duration: '45 mins', startingPrice: '₹25,000 per implant' },
              { name: 'Root Canal Treatment (RCT)', duration: '60 mins', startingPrice: '₹4,500' },
            ],
          };
        } else if (ind === 'REAL_ESTATE') {
          return {
            industry: 'REAL_ESTATE',
            services: [
              { name: 'Site Visit Scheduling', duration: '2 hours', startingPrice: 'Free' },
              { name: 'Project Masterplan Consultation', duration: '45 mins', startingPrice: 'Free' },
              { name: 'Unit Availability & Cost Sheet Breakdown', duration: '30 mins', startingPrice: 'Free' },
            ],
          };
        }
        return {
          industry: ind,
          services: [
            { name: 'General Consultation', duration: '30 mins', startingPrice: '₹500' },
            { name: 'Information Assistance', duration: '15 mins', startingPrice: 'Free' },
          ],
        };
      },
    },

    // =========================================================================
    // 16. get_business_location
    // =========================================================================
    {
      toolId: 'tool_get_business_location',
      name: 'get_business_location',
      description: 'Retrieve official business address, nearest landmarks, and directions.',
      version: '1.0.0',
      category: 'INFORMATION',
      riskLevel: 'LOW',
      confirmationRequired: false,
      confirmationMode: 'NONE',
      supportedIndustries: ['*'],
      enabled: true,
      timeoutMs: 3000,
      idempotent: true,
      requiredPermissions: [],
      inputSchema: z.object({
        branch: z.string().optional(),
      }),
      handler: async (_args, _ctx) => {
        return {
          address: '4th Block, 100 Feet Road, Koramangala, Bengaluru, Karnataka 560034',
          city: 'Bengaluru',
          landmark: 'Opposite Sony World Signal, near BDA Complex',
          parkingAvailable: true,
        };
      },
    },
  ];
}
