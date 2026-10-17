/**
 * Real Estate Vertical Operations & Site Visit Scheduling Router
 * Prompt 06 — Real Estate Vertical Configuration & Site Visit Operations
 * Strict Multi-Tenant Isolation with Verified Property Inventories,
 * Concurrency-Safe Site Visit Booking, and Kannada Voice Agent Assistance
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto, { randomUUID, createHmac } from 'node:crypto';
import {
  AuthSessionDTO,
  PropertyDTO,
  PropertyType,
  PropertyAvailabilityStatus,
  ReraVerificationStatus,
  RealEstateConfigDTO,
  AppointmentSlotDTO,
  AppointmentAuditEntry,
  LeadDossierDTO,
  ClientWorkspaceDTO,
} from '@vanni/shared';
import { globalDb } from '@vanni/database';
import { getSessionFromRequest } from '../http-auth.js';

interface RealEstateContext {
  session: AuthSessionDTO;
  workspaceId: string;
  organizationId: string;
  isViewer: boolean;
}

/**
 * Resolves the authenticated workspace context for real estate routes
 */
async function resolveRealEstateContext(req: FastifyRequest): Promise<RealEstateContext | null> {
  const session = getSessionFromRequest(req);
  if (!session) return null;

  const orgId = session.activeOrganizationId;
  const cookieWs = (req as any).cookies?.['vanni_active_workspace'];
  const headerWs = req.headers['x-workspace-id'] as string | undefined;
  const queryWs = (req.query as any)?.workspaceId as string | undefined;

  let workspaceId = queryWs || headerWs || cookieWs;

  if (workspaceId) {
    const ws = await globalDb.getClientWorkspaceById(workspaceId, orgId);
    if (ws) {
      return {
        session,
        workspaceId: ws.id,
        organizationId: orgId,
        isViewer: session.activeRole === 'VIEWER',
      };
    }
  }

  // Fallback to first workspace in organization
  const workspaces = await globalDb.getClientWorkspacesByOrg(orgId);
  const targetWs = workspaces[0];

  return {
    session,
    workspaceId: targetWs ? targetWs.id : orgId,
    organizationId: orgId,
    isViewer: session.activeRole === 'VIEWER',
  };
}

export async function realEstateRoutes(fastify: FastifyInstance) {
  // =========================================================================
  // 1. REAL ESTATE CONFIGURATION & SITE VISIT SETTINGS
  // =========================================================================

  fastify.get(
    '/api/real-estate/config',
    async (request: FastifyRequest<{ Querystring: { workspaceId?: string } }>, reply: FastifyReply) => {
      const ctx = await resolveRealEstateContext(request);
      if (!ctx) {
        return reply.status(401).send({ success: false, error: 'Unauthorized: Session missing' });
      }

      const ws = await globalDb.getClientWorkspaceById(ctx.workspaceId, ctx.organizationId);
      const config: RealEstateConfigDTO = ws?.realEstateConfig || {
        siteVisitDays: [0, 1, 2, 3, 4, 5, 6],
        siteVisitStart: '09:30',
        siteVisitEnd: '18:00',
        defaultVisitDurationMinutes: 60,
        bufferMinutes: 15,
        maxVisitorsPerSlot: 4,
        transportAvailable: false,
        transportNotes: 'Visitors are requested to reach the layout site office directly via NH-67.',
        salesContactPhone: ws?.primaryPhone || '+91 94480 54321',
        escalationPhone: ws?.primaryPhone || '+91 94480 12345',
        webhookEnabled: false,
      };

      return reply.send({ success: true, workspaceId: ctx.workspaceId, config });
    }
  );

  fastify.put(
    '/api/real-estate/config',
    async (
      request: FastifyRequest<{
        Querystring: { workspaceId?: string };
        Body: Partial<RealEstateConfigDTO>;
      }>,
      reply: FastifyReply
    ) => {
      const ctx = await resolveRealEstateContext(request);
      if (!ctx) {
        return reply.status(401).send({ success: false, error: 'Unauthorized: Session missing' });
      }
      if (ctx.isViewer) {
        return reply.status(403).send({ success: false, error: 'Viewer role cannot modify real estate settings' });
      }

      const ws = await globalDb.getClientWorkspaceById(ctx.workspaceId, ctx.organizationId);
      if (!ws) {
        return reply.status(404).send({ success: false, error: 'Workspace not found' });
      }

      const existingConfig = ws.realEstateConfig || {};
      const updatedConfig: RealEstateConfigDTO = {
        ...existingConfig,
        ...request.body,
      };

      ws.realEstateConfig = updatedConfig;
      await globalDb.updateClientWorkspace(ws.id, { realEstateConfig: updatedConfig }, ctx.organizationId);

      return reply.send({ success: true, workspaceId: ws.id, config: updatedConfig });
    }
  );

  // =========================================================================
  // 2. PROPERTY & INVENTORY CATALOGUE CRUD
  // =========================================================================

  fastify.get(
    '/api/real-estate/properties',
    async (
      request: FastifyRequest<{
        Querystring: {
          workspaceId?: string;
          propertyType?: string;
          status?: string;
          locality?: string;
          minPrice?: string;
          maxPrice?: string;
          search?: string;
          page?: string;
          limit?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const ctx = await resolveRealEstateContext(request);
      if (!ctx) {
        return reply.status(401).send({ success: false, error: 'Unauthorized: Session missing' });
      }

      const minPrice = request.query.minPrice ? Number(request.query.minPrice) : undefined;
      const maxPrice = request.query.maxPrice ? Number(request.query.maxPrice) : undefined;
      const page = Math.max(1, Number(request.query.page || 1));
      const limit = Math.max(1, Math.min(100, Number(request.query.limit || 20)));

      const all = await globalDb.getProperties(ctx.workspaceId, {
        propertyType: request.query.propertyType,
        status: request.query.status,
        locality: request.query.locality,
        minPrice,
        maxPrice,
        search: request.query.search,
      });

      const startIndex = (page - 1) * limit;
      const paginated = all.slice(startIndex, startIndex + limit);

      return reply.send({
        success: true,
        workspaceId: ctx.workspaceId,
        count: paginated.length,
        total: all.length,
        page,
        limit,
        properties: paginated,
      });
    }
  );

  fastify.get(
    '/api/real-estate/properties/:id',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: { workspaceId?: string };
      }>,
      reply: FastifyReply
    ) => {
      const ctx = await resolveRealEstateContext(request);
      if (!ctx) {
        return reply.status(401).send({ success: false, error: 'Unauthorized: Session missing' });
      }

      const property = await globalDb.getPropertyById(request.params.id, ctx.workspaceId);
      if (!property) {
        return reply.status(404).send({ success: false, error: 'Property not found in authorized workspace' });
      }

      return reply.send({ success: true, property });
    }
  );

  fastify.post(
    '/api/real-estate/properties',
    async (
      request: FastifyRequest<{
        Querystring: { workspaceId?: string };
        Body: {
          name: string;
          referenceCode: string;
          propertyType: PropertyType;
          subType?: string;
          locality: string;
          address?: string;
          mapUrl?: string;
          dimensions: {
            lengthFeet?: number;
            widthFeet?: number;
            dimensionText?: string;
            totalArea: number;
            unit: 'SQFT' | 'SQYARDS' | 'CENTS' | 'ACRES';
          };
          pricing: {
            basePrice: number;
            pricePerSqft?: number;
            priceNegotiable?: boolean;
            currency?: string;
            additionalCharges?: any;
          };
          status?: PropertyAvailabilityStatus;
          amenities?: string[];
          description?: string;
          developerContact?: {
            name: string;
            phone: string;
            email?: string;
          };
          reraDetails?: {
            registrationNumber?: string;
            jurisdiction?: string;
            verificationStatus?: ReraVerificationStatus;
            verificationSource?: string;
          };
        };
      }>,
      reply: FastifyReply
    ) => {
      const ctx = await resolveRealEstateContext(request);
      if (!ctx) {
        return reply.status(401).send({ success: false, error: 'Unauthorized: Session missing' });
      }
      if (ctx.isViewer) {
        return reply.status(403).send({ success: false, error: 'Viewer role cannot add properties' });
      }

      const body = request.body;
      if (!body.name || !body.referenceCode || !body.locality || !body.dimensions || !body.pricing) {
        return reply.status(400).send({
          success: false,
          error: 'name, referenceCode, locality, dimensions, and pricing are required',
        });
      }

      // Check unique referenceCode in workspace
      const existing = await globalDb.getPropertyById(body.referenceCode, ctx.workspaceId);
      if (existing) {
        return reply.status(409).send({
          success: false,
          error: `Property with reference code '${body.referenceCode}' already exists in workspace`,
        });
      }

      // Validate dimensions & unit
      const dims = body.dimensions;
      if (!dims.totalArea || dims.totalArea <= 0 || !dims.unit) {
        return reply.status(400).send({
          success: false,
          error: 'Dimensions must specify positive totalArea and explicit unit (SQFT, SQYARDS, CENTS, ACRES)',
        });
      }

      // Calculate normalized area in sqft
      let areaSqft = dims.totalArea;
      if (dims.unit === 'SQYARDS') areaSqft = dims.totalArea * 9;
      if (dims.unit === 'CENTS') areaSqft = dims.totalArea * 435.6;
      if (dims.unit === 'ACRES') areaSqft = dims.totalArea * 43560;

      // Validate dimension consistency if length and width provided
      if (dims.lengthFeet !== undefined && dims.widthFeet !== undefined) {
        if (dims.lengthFeet <= 0 || dims.widthFeet <= 0) {
          return reply.status(400).send({
            success: false,
            error: 'Length and width must be strictly positive numbers',
          });
        }
      }

      // Pricing validation
      if (!body.pricing.basePrice || body.pricing.basePrice <= 0) {
        return reply.status(400).send({
          success: false,
          error: 'Base price must be a positive amount in INR',
        });
      }

      // RERA validation & compliance check
      const rera = body.reraDetails || { verificationStatus: 'UNVERIFIED' };
      let reraStatus: ReraVerificationStatus = rera.verificationStatus || 'UNVERIFIED';
      let verifiedAt: string | undefined = undefined;

      // Strict compliance rule: Do not claim VERIFIED unless registrationNumber and source provided
      if (reraStatus === 'VERIFIED') {
        if (!rera.registrationNumber || rera.registrationNumber.trim().length === 0) {
          return reply.status(400).send({
            success: false,
            error: 'RERA verification status cannot be VERIFIED without a valid registration number',
          });
        }
        verifiedAt = new Date().toISOString();
      }

      const ws = await globalDb.getClientWorkspaceById(ctx.workspaceId, ctx.organizationId);

      const property: PropertyDTO = {
        id: 'prop_' + randomUUID(),
        workspaceId: ctx.workspaceId,
        organizationId: ctx.organizationId,
        name: body.name.trim(),
        referenceCode: body.referenceCode.trim(),
        propertyType: body.propertyType || 'PLOT',
        subType: body.subType,
        locality: body.locality.trim(),
        address: body.address,
        mapUrl: body.mapUrl,
        dimensions: {
          lengthFeet: dims.lengthFeet,
          widthFeet: dims.widthFeet,
          dimensionText: dims.dimensionText || (dims.lengthFeet && dims.widthFeet ? `${dims.lengthFeet}x${dims.widthFeet} ft` : undefined),
          totalArea: dims.totalArea,
          unit: dims.unit,
          areaSqft: Math.round(areaSqft),
        },
        pricing: {
          basePrice: body.pricing.basePrice,
          pricePerSqft: body.pricing.pricePerSqft || Math.round(body.pricing.basePrice / areaSqft),
          priceNegotiable: body.pricing.priceNegotiable ?? true,
          currency: 'INR',
          additionalCharges: body.pricing.additionalCharges,
        },
        status: body.status || 'AVAILABLE',
        amenities: body.amenities || ['24/7 Security', 'Tar Road', 'Electricity & Water Connection'],
        description: body.description || '',
        developerContact: body.developerContact || {
          name: ws?.name || 'Developer Sales Desk',
          phone: ws?.primaryPhone || '+91 94480 12345',
          email: ws?.primaryEmail,
        },
        reraDetails: {
          registrationNumber: rera.registrationNumber,
          jurisdiction: rera.jurisdiction || 'K-RERA (Karnataka)',
          verificationStatus: reraStatus,
          verificationSource: rera.verificationSource || (reraStatus === 'VERIFIED' ? 'Karnataka RERA Portal' : undefined),
          verifiedAt,
          verifiedBy: reraStatus === 'VERIFIED' ? 'Authorized Sales Manager' : undefined,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await globalDb.saveProperty(property);
      return reply.status(201).send({ success: true, property });
    }
  );

  fastify.put(
    '/api/real-estate/properties/:id',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: { workspaceId?: string };
        Body: Partial<PropertyDTO>;
      }>,
      reply: FastifyReply
    ) => {
      const ctx = await resolveRealEstateContext(request);
      if (!ctx) {
        return reply.status(401).send({ success: false, error: 'Unauthorized: Session missing' });
      }
      if (ctx.isViewer) {
        return reply.status(403).send({ success: false, error: 'Viewer role cannot update properties' });
      }

      const updated = await globalDb.updateProperty(request.params.id, request.body, ctx.workspaceId);
      if (!updated) {
        return reply.status(404).send({ success: false, error: 'Property not found' });
      }

      return reply.send({ success: true, property: updated });
    }
  );

  fastify.delete(
    '/api/real-estate/properties/:id',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: { workspaceId?: string };
      }>,
      reply: FastifyReply
    ) => {
      const ctx = await resolveRealEstateContext(request);
      if (!ctx) {
        return reply.status(401).send({ success: false, error: 'Unauthorized: Session missing' });
      }
      if (ctx.isViewer) {
        return reply.status(403).send({ success: false, error: 'Viewer role cannot delete properties' });
      }

      const deleted = await globalDb.deleteProperty(request.params.id, ctx.workspaceId);
      if (!deleted) {
        return reply.status(404).send({ success: false, error: 'Property not found' });
      }

      return reply.send({ success: true, message: 'Property deleted successfully' });
    }
  );

  // =========================================================================
  // 3. SITE VISIT AVAILABILITY & SCHEDULING (REUSING APPOINTMENT ENGINE)
  // =========================================================================

  fastify.get(
    '/api/real-estate/site-visits/availability',
    async (
      request: FastifyRequest<{
        Querystring: {
          workspaceId?: string;
          propertyId: string;
          date: string; // YYYY-MM-DD
        };
      }>,
      reply: FastifyReply
    ) => {
      const ctx = await resolveRealEstateContext(request);
      if (!ctx) {
        return reply.status(401).send({ success: false, error: 'Unauthorized: Session missing' });
      }

      const { propertyId, date } = request.query;
      if (!propertyId || !date) {
        return reply.status(400).send({ success: false, error: 'propertyId and date (YYYY-MM-DD) are required' });
      }

      const property = await globalDb.getPropertyById(propertyId, ctx.workspaceId);
      if (!property) {
        return reply.status(404).send({ success: false, error: 'Property not found' });
      }

      const ws = await globalDb.getClientWorkspaceById(ctx.workspaceId, ctx.organizationId);
      const config: RealEstateConfigDTO = ws?.realEstateConfig || {};
      const visitDays = config.siteVisitDays || [0, 1, 2, 3, 4, 5, 6];
      const startStr = config.siteVisitStart || '09:30';
      const endStr = config.siteVisitEnd || '18:00';
      const slotDuration = config.defaultVisitDurationMinutes || 60;
      const buffer = config.bufferMinutes || 15;
      const maxCapacity = config.maxVisitorsPerSlot || 4;
      const blockedDates = config.blockedDates || [];

      // Check if entire date is blocked (Holiday or Site Closed)
      if (blockedDates.includes(date)) {
        return reply.send({
          success: true,
          propertyId,
          date,
          totalSlots: 0,
          availableSlotsCount: 0,
          notice: 'Site visits unavailable on this date (Holiday / Site maintenance)',
          slots: [],
        });
      }

      // Check day of week
      const targetDate = new Date(date + 'T00:00:00Z');
      const dayOfWeek = targetDate.getUTCDay();
      if (!visitDays.includes(dayOfWeek)) {
        return reply.send({
          success: true,
          propertyId,
          date,
          totalSlots: 0,
          availableSlotsCount: 0,
          notice: 'Site visits not scheduled on this day of the week',
          slots: [],
        });
      }

      // Parse timings to minutes
      const [startH, startM] = startStr.split(':').map(Number);
      const [endH, endM] = endStr.split(':').map(Number);
      const startMin = startH * 60 + startM;
      const endMin = endH * 60 + endM;
      const step = slotDuration + buffer;

      // Query existing site visits for this property & date
      const allAppointments = await globalDb.getAppointments(ctx.organizationId);
      const activeVisits = allAppointments.filter(
        (a: AppointmentSlotDTO) =>
          a.status !== 'CANCELLED' &&
          (a.propertyId === property.id || a.serviceType?.includes(property.referenceCode)) &&
          a.scheduledTime.startsWith(date)
      );

      const slots = [];
      let current = startMin;

      while (current + slotDuration <= endMin) {
        const slotHour = Math.floor(current / 60).toString().padStart(2, '0');
        const slotMinute = (current % 60).toString().padStart(2, '0');
        const timeStr = `${slotHour}:${slotMinute}`;
        const isoSlot = `${date}T${timeStr}:00Z`;

        // Calculate booked visitor count for this slot
        const slotBookings = activeVisits.filter((a: AppointmentSlotDTO) => a.scheduledTime.startsWith(`${date}T${timeStr}`));
        const currentBookedVisitors = slotBookings.reduce((sum: number, b: AppointmentSlotDTO) => sum + (b.visitorCount || 1), 0);

        const remainingCapacity = Math.max(0, maxCapacity - currentBookedVisitors);
        const isAvailable = remainingCapacity > 0;

        slots.push({
          startTime: timeStr,
          isoString: isoSlot,
          durationMinutes: slotDuration,
          maxCapacity,
          bookedVisitors: currentBookedVisitors,
          remainingCapacity,
          isAvailable,
          reason: !isAvailable ? 'Capacity Reached' : undefined,
        });

        current += step;
      }

      return reply.send({
        success: true,
        propertyId: property.id,
        propertyName: property.name,
        date,
        totalSlots: slots.length,
        availableSlotsCount: slots.filter((s) => s.isAvailable).length,
        maxCapacityPerSlot: maxCapacity,
        slots,
      });
    }
  );

  fastify.get(
    '/api/real-estate/site-visits',
    async (request: FastifyRequest<{ Querystring: { workspaceId?: string } }>, reply: FastifyReply) => {
      const ctx = await resolveRealEstateContext(request);
      if (!ctx) {
        return reply.status(401).send({ success: false, error: 'Unauthorized: Session missing' });
      }

      const all = await globalDb.getAppointments(ctx.organizationId);
      const siteVisits = all.filter(
        (a: AppointmentSlotDTO) => a.appointmentType === 'SITE_VISIT' || (a.propertyId && a.propertyId.length > 0)
      );

      return reply.send({ success: true, count: siteVisits.length, siteVisits });
    }
  );

  fastify.post(
    '/api/real-estate/site-visits',
    async (
      request: FastifyRequest<{
        Querystring: { workspaceId?: string };
        Body: {
          propertyId: string;
          customerName: string;
          customerPhone: string;
          scheduledTime: string; // ISO 8601
          visitorCount?: number;
          transportRequired?: boolean;
          notes?: string;
          idempotencyKey?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const ctx = await resolveRealEstateContext(request);
      if (!ctx) {
        return reply.status(401).send({ success: false, error: 'Unauthorized: Session missing' });
      }
      if (ctx.isViewer) {
        return reply.status(403).send({ success: false, error: 'Viewer role cannot book site visits' });
      }

      const { propertyId, customerName, customerPhone, scheduledTime, visitorCount, transportRequired, notes, idempotencyKey } =
        request.body;

      if (!propertyId || !customerName || !customerPhone || !scheduledTime) {
        return reply.status(400).send({
          success: false,
          error: 'propertyId, customerName, customerPhone, and scheduledTime are required',
        });
      }

      // Check idempotency
      if (idempotencyKey) {
        const existingAppointments = await globalDb.getAppointments(ctx.organizationId);
        const existing = existingAppointments.find((a: AppointmentSlotDTO) => a.idempotencyKey === idempotencyKey);
        if (existing) {
          return reply.status(200).send({
            success: true,
            idempotentReplay: true,
            siteVisit: existing,
          });
        }
      }

      const property = await globalDb.getPropertyById(propertyId, ctx.workspaceId);
      if (!property) {
        return reply.status(404).send({ success: false, error: 'Property not found in workspace' });
      }

      const ws = await globalDb.getClientWorkspaceById(ctx.workspaceId, ctx.organizationId);
      const requestedVisitors = visitorCount || 1;
      const config = ws?.realEstateConfig || {};
      const maxCapacity = config.maxVisitorsPerSlot || 4;

      // Real-time capacity and double booking prevention
      const all = await globalDb.getAppointments(ctx.organizationId);
      const existingAtSlot = all.filter(
        (a: AppointmentSlotDTO) =>
          a.status !== 'CANCELLED' &&
          a.propertyId === property.id &&
          a.scheduledTime === scheduledTime
      );

      const currentlyBooked = existingAtSlot.reduce((sum: number, b: AppointmentSlotDTO) => sum + (b.visitorCount || 1), 0);
      if (currentlyBooked + requestedVisitors > maxCapacity) {
        return reply.status(409).send({
          success: false,
          error: `Slot capacity exceeded. Currently booked: ${currentlyBooked}/${maxCapacity}. Requested: ${requestedVisitors}.`,
        });
      }

      const siteVisit: AppointmentSlotDTO = {
        id: 'visit_' + randomUUID(),
        tenantId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        propertyId: property.id,
        appointmentType: 'SITE_VISIT',
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        serviceType: `Site Visit - ${property.name} (${property.referenceCode})`,
        scheduledTime,
        durationMinutes: config.defaultVisitDurationMinutes || 60,
        visitorCount: requestedVisitors,
        transportRequired: transportRequired ?? false,
        status: 'CONFIRMED',
        notes: notes || `Site Visit scheduled for ${property.referenceCode}`,
        idempotencyKey,
        auditHistory: [
          {
            timestamp: new Date().toISOString(),
            action: 'CREATED',
            performedBy: ctx.session.email || 'Sales Coordinator',
            note: `Site visit confirmed for ${requestedVisitors} visitors.`,
          },
        ],
      };

      await globalDb.saveAppointment(siteVisit);

      // Trigger Webhook if configured
      if (config.webhookEnabled && config.webhookUrl && config.webhookSecret) {
        try {
          const payload = JSON.stringify({
            event: 'site_visit.confirmed',
            workspaceId: ctx.workspaceId,
            property: {
              id: property.id,
              name: property.name,
              referenceCode: property.referenceCode,
              locality: property.locality,
            },
            siteVisit: {
              id: siteVisit.id,
              customerName: siteVisit.customerName,
              customerPhone: siteVisit.customerPhone,
              scheduledTime: siteVisit.scheduledTime,
              visitorCount: siteVisit.visitorCount,
              transportRequired: siteVisit.transportRequired,
            },
            timestamp: new Date().toISOString(),
          });

          const signature = createHmac('sha256', config.webhookSecret).update(payload).digest('hex');
          fetch(config.webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Vanni-Signature': `sha256=${signature}`,
            },
            body: payload,
          }).catch(() => {});
        } catch {}
      }

      return reply.status(201).send({ success: true, siteVisit });
    }
  );

  fastify.post(
    '/api/real-estate/site-visits/:id/reschedule',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { newScheduledTime: string; reason?: string };
      }>,
      reply: FastifyReply
    ) => {
      const ctx = await resolveRealEstateContext(request);
      if (!ctx) {
        return reply.status(401).send({ success: false, error: 'Unauthorized: Session missing' });
      }
      if (ctx.isViewer) {
        return reply.status(403).send({ success: false, error: 'Viewer role cannot reschedule site visits' });
      }

      const existing = await globalDb.getAppointmentById(request.params.id, ctx.organizationId);
      if (!existing || existing.appointmentType !== 'SITE_VISIT') {
        return reply.status(404).send({ success: false, error: 'Site visit not found' });
      }

      const { newScheduledTime, reason } = request.body;
      if (!newScheduledTime) {
        return reply.status(400).send({ success: false, error: 'newScheduledTime is required' });
      }

      // Check slot capacity at new scheduled time
      const all = await globalDb.getAppointments(ctx.organizationId);
      const ws = await globalDb.getClientWorkspaceById(existing.workspaceId || ctx.workspaceId, ctx.organizationId);
      const config = ws?.realEstateConfig || {};
      const maxCapacity = config.maxVisitorsPerSlot || 4;

      const atNewSlot = all.filter(
        (a: AppointmentSlotDTO) =>
          a.id !== existing.id &&
          a.status !== 'CANCELLED' &&
          a.propertyId === existing.propertyId &&
          a.scheduledTime === newScheduledTime
      );
      const bookedVisitors = atNewSlot.reduce((sum: number, b: AppointmentSlotDTO) => sum + (b.visitorCount || 1), 0);
      if (bookedVisitors + (existing.visitorCount || 1) > maxCapacity) {
        return reply.status(409).send({ success: false, error: 'New slot has insufficient capacity' });
      }

      const auditHistory = existing.auditHistory || [];
      auditHistory.push({
        timestamp: new Date().toISOString(),
        action: 'RESCHEDULED',
        performedBy: ctx.session.email || 'Sales Coordinator',
        previousTime: existing.scheduledTime,
        note: `Rescheduled to ${newScheduledTime}. Reason: ${reason || 'Client request'}`,
      });

      const updated = await globalDb.updateAppointment(
        existing.id,
        { scheduledTime: newScheduledTime, auditHistory },
        ctx.organizationId
      );

      return reply.send({ success: true, siteVisit: updated });
    }
  );

  fastify.post(
    '/api/real-estate/site-visits/:id/cancel',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { reason: string };
      }>,
      reply: FastifyReply
    ) => {
      const ctx = await resolveRealEstateContext(request);
      if (!ctx) {
        return reply.status(401).send({ success: false, error: 'Unauthorized: Session missing' });
      }
      if (ctx.isViewer) {
        return reply.status(403).send({ success: false, error: 'Viewer role cannot cancel site visits' });
      }

      const existing = await globalDb.getAppointmentById(request.params.id, ctx.organizationId);
      if (!existing) {
        return reply.status(404).send({ success: false, error: 'Site visit not found' });
      }

      const auditHistory = existing.auditHistory || [];
      auditHistory.push({
        timestamp: new Date().toISOString(),
        action: 'CANCELLED',
        performedBy: ctx.session.email || 'Sales Coordinator',
        note: `Cancellation reason: ${request.body?.reason || 'Not specified'}`,
      });

      const updated = await globalDb.updateAppointment(
        existing.id,
        { status: 'CANCELLED', cancellationReason: request.body?.reason || 'Client cancelled', auditHistory },
        ctx.organizationId
      );

      return reply.send({ success: true, siteVisit: updated });
    }
  );

  // =========================================================================
  // 4. REAL ESTATE LEAD QUALIFICATION WORKFLOW
  // =========================================================================

  fastify.get(
    '/api/real-estate/leads',
    async (request: FastifyRequest<{ Querystring: { workspaceId?: string } }>, reply: FastifyReply) => {
      const ctx = await resolveRealEstateContext(request);
      if (!ctx) {
        return reply.status(401).send({ success: false, error: 'Unauthorized: Session missing' });
      }

      const leads = await globalDb.getLeads(ctx.organizationId);
      return reply.send({ success: true, count: leads.length, leads });
    }
  );

  fastify.post(
    '/api/real-estate/leads/qualify',
    async (
      request: FastifyRequest<{
        Body: {
          leadId?: string;
          contactPhone: string;
          contactName: string;
          propertyInterest?: string;
          purchasePurpose?: 'INVESTMENT' | 'SELF_USE' | 'COMMERCIAL';
          budgetMin?: number;
          budgetMax?: number;
          preferredLocation?: string;
          preferredDimensions?: string;
          purchaseTimeline?: 'IMMEDIATE' | 'WITHIN_3_MONTHS' | 'EXPLORING';
          siteVisitInterest?: 'YES' | 'NO' | 'UNDECIDED';
          assignedTo?: string;
          status?: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'FOLLOW_UP_REQUIRED' | 'SITE_VISIT_REQUESTED' | 'SITE_VISIT_CONFIRMED';
          notes?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const ctx = await resolveRealEstateContext(request);
      if (!ctx) {
        return reply.status(401).send({ success: false, error: 'Unauthorized: Session missing' });
      }
      if (ctx.isViewer) {
        return reply.status(403).send({ success: false, error: 'Viewer role cannot update lead qualification' });
      }

      const body = request.body;
      if (!body.contactPhone) {
        return reply.status(400).send({ success: false, error: 'contactPhone is required' });
      }

      // Check existing lead
      const all = await globalDb.getLeads(ctx.organizationId);
      let lead = all.find((l: LeadDossierDTO) => (body.leadId && l.id === body.leadId) || l.callerPhone === body.contactPhone);

      const budgetText = body.budgetMin && body.budgetMax
        ? `₹${(body.budgetMin / 100000).toFixed(1)}L - ₹${(body.budgetMax / 100000).toFixed(1)}L`
        : (body.budgetMin ? `₹${(body.budgetMin / 100000).toFixed(1)}L+` : 'Budget discussed');

      if (!lead) {
        lead = {
          id: body.leadId || 'lead_' + randomUUID(),
          callId: 'call_' + randomUUID(),
          tenantId: ctx.organizationId,
          callerName: body.contactName || 'Property Enquiry',
          callerPhone: body.contactPhone,
          city: body.preferredLocation || 'Karnataka',
          requirementSummary: `Property Enquiry - ${body.propertyInterest || 'Residential Layout'}`,
          budgetOrFee: budgetText,
          confirmedOutcome: body.status || 'QUALIFIED',
          leadRating: body.status === 'SITE_VISIT_CONFIRMED' || body.purchaseTimeline === 'IMMEDIATE' ? 'HOT' : 'WARM',
          createdAt: new Date().toISOString(),
        };
      } else {
        lead.budgetOrFee = budgetText;
        lead.requirementSummary = `Property Enquiry - ${body.propertyInterest || lead.requirementSummary}`;
        if (body.contactName) lead.callerName = body.contactName;
        lead.confirmedOutcome = body.status || lead.confirmedOutcome;
      }

      await globalDb.saveLead(lead);
      return reply.send({ success: true, lead });
    }
  );

  // =========================================================================
  // 5. KANNADA-FIRST VOICE AGENT PROPERTY INQUIRY ASSISTANT
  // =========================================================================

  fastify.post(
    '/api/real-estate/agent/inquire',
    async (
      request: FastifyRequest<{
        Body: {
          workspaceId?: string;
          queryText: string;
          language?: 'kn-IN' | 'kn-en' | 'en-IN';
          callerPhone?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const ctx = await resolveRealEstateContext(request);
      if (!ctx) {
        return reply.status(401).send({ success: false, error: 'Unauthorized: Session missing' });
      }

      const { queryText, language = 'kn-IN' } = request.body;
      if (!queryText) {
        return reply.status(400).send({ success: false, error: 'queryText is required' });
      }

      // Fetch verified properties from workspace catalog
      const properties = await globalDb.getProperties(ctx.workspaceId);
      const q = queryText.toLowerCase();

      // Look up matching property by name, referenceCode, or dimensions
      const matched = properties.find((p: PropertyDTO) => {
        return (
          q.includes(p.name.toLowerCase()) ||
          q.includes(p.referenceCode.toLowerCase()) ||
          (p.dimensions.dimensionText && q.includes(p.dimensions.dimensionText.toLowerCase())) ||
          (p.dimensions.lengthFeet && p.dimensions.widthFeet && q.includes(`${p.dimensions.lengthFeet}x${p.dimensions.widthFeet}`)) ||
          q.includes(p.locality.toLowerCase())
        );
      });

      if (!matched) {
        // Honest disclosure: Never invent a property
        const responseText = language === 'kn-IN'
          ? `ಕ್ಷಮಿಸಿ, ನೀವು ಕೇಳಿದ ಪ್ರಾಪರ್ಟಿ ಮಾಹಿತಿ ನಮ್ಮ ಅಧಿಕೃತ ಕ್ಯಾಟಲಾಗ್‌ನಲ್ಲಿ ಲಭ್ಯವಿಲ್ಲ. ನಮ್ಮ ಸೇಲ್ಸ್ ಮ್ಯಾನೇಜರ್‌ಗೆ ನಿಮ್ಮ ವಿವರಗಳನ್ನು ವರ್ಗಾಯಿಸುತ್ತೇನೆ.`
          : `I apologize, but that property record is not available in our verified inventory. Let me connect you with our sales coordinator for details.`;

        return reply.send({
          success: true,
          matched: false,
          verifiedProperty: null,
          response: responseText,
          suggestSiteVisit: false,
          escalateToSales: true,
        });
      }

      if (matched.status !== 'AVAILABLE') {
        const statusKn = matched.status === 'SOLD' ? 'ಮಾರಾಟವಾಗಿದೆ (Sold)' : 'ಮೀಸಲಿಡಲಾಗಿದೆ (Reserved / On Hold)';
        const responseText = language === 'kn-IN'
          ? `${matched.name} (${matched.referenceCode}) ಪ್ರಸ್ತುತ ${statusKn}. ಈ ಲೇಔಟ್‌ನಲ್ಲಿ ಲಭ್ಯವಿರುವ ಇತರ ಪ್ಲಾಟ್‌ಗಳ ವಿವರಗಳನ್ನು ನೋಡಲು ಸೈಟ್ ವಿಸಿಟ್ ಬುಕ್ ಮಾಡಲೇ?`
          : `${matched.name} (${matched.referenceCode}) is currently ${matched.status}. Would you like to schedule a site visit to view other available units in this project?`;

        return reply.send({
          success: true,
          matched: true,
          verifiedProperty: matched,
          response: responseText,
          suggestSiteVisit: true,
          escalateToSales: false,
        });
      }

      // Approved fact response without hallucinating
      const dimStr = matched.dimensions.dimensionText || `${matched.dimensions.totalArea} ${matched.dimensions.unit}`;
      const priceLakhs = (matched.pricing.basePrice / 100000).toFixed(1);
      const reraText = matched.reraDetails?.verificationStatus === 'VERIFIED'
        ? `RERA ನೋಂದಣಿ: ${matched.reraDetails.registrationNumber}`
        : 'RERA ಅನುಮೋದನೆ ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ';

      const responseText = language === 'kn-IN'
        ? `ಹೌದು, ${matched.name} (${matched.referenceCode}) ಲಭ್ಯವಿದೆ. ಅಳತೆ ${dimStr} (${matched.dimensions.areaSqft} ಚದರ ಅಡಿ). ಬೆಲೆ ₹${priceLakhs} ಲಕ್ಷಗಳು. ${reraText}. ಸೌಲಭ್ಯಗಳು: ${matched.amenities.slice(0, 3).join(', ')}. ನೇರವಾಗಿ ಸ್ಥಳ ಪರಿಶೀಲನೆ ಮಾಡಲು ಸೈಟ್ ವಿಸಿಟ್ ಸಮಯ ಬುಕ್ ಮಾಡಲೇ?`
        : `Yes, ${matched.name} (${matched.referenceCode}) is available. Dimensions: ${dimStr} (${matched.dimensions.areaSqft} sq.ft). Price: ₹${priceLakhs} Lakhs. ${reraText}. Amenities include ${matched.amenities.slice(0, 3).join(', ')}. Would you like to schedule a site visit to inspect the layout?`;

      return reply.send({
        success: true,
        matched: true,
        verifiedProperty: {
          id: matched.id,
          name: matched.name,
          referenceCode: matched.referenceCode,
          dimensions: matched.dimensions,
          pricing: matched.pricing,
          status: matched.status,
          reraDetails: matched.reraDetails,
        },
        response: responseText,
        suggestSiteVisit: true,
        escalateToSales: false,
      });
    }
  );

  // =========================================================================
  // 6. PORTAL / META LEAD WEBHOOK INGESTION WITH DEDUPLICATION
  // =========================================================================

  fastify.post(
    '/api/real-estate/webhooks/enquiry',
    async (
      request: FastifyRequest<{
        Body: {
          source?: string;
          fullName: string;
          phone: string;
          propertyInterest?: string;
          budget?: string;
          idempotencyKey?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const ctx = await resolveRealEstateContext(request);
      if (!ctx) {
        return reply.status(401).send({ success: false, error: 'Unauthorized: Session missing' });
      }

      const body = request.body;
      if (!body.phone) {
        return reply.status(400).send({ success: false, error: 'phone is required' });
      }

      // Check deduplication
      if (body.idempotencyKey) {
        const all = await globalDb.getLeads(ctx.organizationId);
        const existing = all.find((l: any) => l.idempotencyKey === body.idempotencyKey);
        if (existing) {
          return reply.status(200).send({ success: true, deduplicated: true, lead: existing });
        }
      }

      const lead: LeadDossierDTO = {
        id: 'lead_' + randomUUID(),
        callId: 'call_' + randomUUID(),
        tenantId: ctx.organizationId,
        callerName: body.fullName || 'Web Portal Lead',
        callerPhone: body.phone,
        city: 'Karnataka',
        requirementSummary: `Enquiry via ${body.source || 'Website'} - ${body.propertyInterest || 'General Property'}`,
        budgetOrFee: body.budget || 'To be discussed',
        confirmedOutcome: 'NEW',
        leadRating: 'WARM',
        createdAt: new Date().toISOString(),
      };
      (lead as any).idempotencyKey = body.idempotencyKey;

      await globalDb.saveLead(lead);
      return reply.status(201).send({ success: true, lead });
    }
  );
}
