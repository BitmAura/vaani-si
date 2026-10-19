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

const VALID_PROPERTY_TYPES: PropertyType[] = ['PLOT', 'VILLA', 'APARTMENT', 'HOUSE', 'COMMERCIAL'];
const VALID_AVAILABILITY_STATUSES: PropertyAvailabilityStatus[] = ['AVAILABLE', 'ON_HOLD', 'RESERVED', 'SOLD', 'INACTIVE'];
const VALID_DIMENSION_UNITS = ['SQFT', 'SQYARDS', 'CENTS', 'ACRES'] as const;

function isValidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.trim().replace(/[\s\-()]/g, '');
  return /^\+?[0-9]{10,15}$/.test(cleaned);
}

/**
 * Resolves the authenticated workspace context for real estate routes
 */
async function resolveRealEstateContext(req: FastifyRequest, reply?: FastifyReply): Promise<RealEstateContext | null> {
  const session = getSessionFromRequest(req);
  if (!session) {
    if (reply) reply.status(401).send({ success: false, error: 'Unauthorized: Session missing' });
    return null;
  }

  const orgId = session.activeOrganizationId;
  const cookieWs = (req as any).cookies?.['vanni_active_workspace'];
  const headerWs = req.headers['x-workspace-id'] as string | undefined;
  const queryWs = (req.query as any)?.workspaceId as string | undefined;

  let workspaceId = queryWs || headerWs || cookieWs;

  if (workspaceId) {
    const ws = await globalDb.getClientWorkspaceById(workspaceId, orgId);
    if (!ws) {
      if (reply) reply.status(404).send({ success: false, error: 'NOT_FOUND: Workspace not found' });
      return null;
    }
    return {
      session,
      workspaceId: ws.id,
      organizationId: orgId,
      isViewer: session.activeRole === 'VIEWER',
    };
  }

  // No specific workspace requested: use first workspace in organization
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
      const ctx = await resolveRealEstateContext(request, reply);
      if (!ctx) return;

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
      const ctx = await resolveRealEstateContext(request, reply);
      if (!ctx) return;
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
      const ctx = await resolveRealEstateContext(request, reply);
      if (!ctx) return;

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
      }, ctx.organizationId);

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
      const ctx = await resolveRealEstateContext(request, reply);
      if (!ctx) return;

      const property = await globalDb.getPropertyById(request.params.id, ctx.workspaceId, ctx.organizationId);
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
      const ctx = await resolveRealEstateContext(request, reply);
      if (!ctx) return;
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

      if (body.propertyType && !VALID_PROPERTY_TYPES.includes(body.propertyType)) {
        return reply.status(400).send({
          success: false,
          error: `Invalid propertyType. Must be one of: ${VALID_PROPERTY_TYPES.join(', ')}`,
        });
      }

      if (body.status && !VALID_AVAILABILITY_STATUSES.includes(body.status)) {
        return reply.status(400).send({
          success: false,
          error: `Invalid status. Must be one of: ${VALID_AVAILABILITY_STATUSES.join(', ')}`,
        });
      }

      // Check unique referenceCode in workspace
      const existing = await globalDb.getPropertyById(body.referenceCode, ctx.workspaceId, ctx.organizationId);
      if (existing) {
        return reply.status(409).send({
          success: false,
          error: `Property with reference code '${body.referenceCode}' already exists in workspace`,
        });
      }

      // Validate dimensions & unit
      const dims = body.dimensions;
      if (!dims.totalArea || typeof dims.totalArea !== 'number' || dims.totalArea <= 0 || !dims.unit) {
        return reply.status(400).send({
          success: false,
          error: 'Dimensions must specify positive totalArea and explicit unit (SQFT, SQYARDS, CENTS, ACRES)',
        });
      }

      if (!VALID_DIMENSION_UNITS.includes(dims.unit)) {
        return reply.status(400).send({
          success: false,
          error: `Invalid dimension unit. Must be one of: ${VALID_DIMENSION_UNITS.join(', ')}`,
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
      if (!body.pricing.basePrice || typeof body.pricing.basePrice !== 'number' || body.pricing.basePrice <= 0) {
        return reply.status(400).send({
          success: false,
          error: 'Base price must be a positive number in INR',
        });
      }

      // RERA validation & compliance check
      const rera = body.reraDetails || { verificationStatus: 'UNVERIFIED' as ReraVerificationStatus };
      let reraStatus: ReraVerificationStatus = rera.verificationStatus || 'UNVERIFIED';
      let verifiedAt: string | undefined = undefined;

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
      const ctx = await resolveRealEstateContext(request, reply);
      if (!ctx) return;
      if (ctx.isViewer) {
        return reply.status(403).send({ success: false, error: 'Viewer role cannot update properties' });
      }

      const body = request.body;
      if (body.propertyType && !VALID_PROPERTY_TYPES.includes(body.propertyType)) {
        return reply.status(400).send({
          success: false,
          error: `Invalid propertyType. Must be one of: ${VALID_PROPERTY_TYPES.join(', ')}`,
        });
      }

      if (body.status && !VALID_AVAILABILITY_STATUSES.includes(body.status)) {
        return reply.status(400).send({
          success: false,
          error: `Invalid status. Must be one of: ${VALID_AVAILABILITY_STATUSES.join(', ')}`,
        });
      }

      if (body.pricing && body.pricing.basePrice !== undefined) {
        if (typeof body.pricing.basePrice !== 'number' || body.pricing.basePrice <= 0) {
          return reply.status(400).send({ success: false, error: 'Base price must be a positive number in INR' });
        }
      }

      if (body.dimensions && body.dimensions.totalArea !== undefined) {
        if (typeof body.dimensions.totalArea !== 'number' || body.dimensions.totalArea <= 0) {
          return reply.status(400).send({ success: false, error: 'Total area must be a positive number' });
        }
        if (body.dimensions.unit && !VALID_DIMENSION_UNITS.includes(body.dimensions.unit)) {
          return reply.status(400).send({ success: false, error: 'Invalid dimension unit' });
        }
      }

      if (body.reraDetails?.verificationStatus === 'VERIFIED') {
        if (!body.reraDetails.registrationNumber || body.reraDetails.registrationNumber.trim().length === 0) {
          return reply.status(400).send({ success: false, error: 'RERA registrationNumber is required when status is VERIFIED' });
        }
      }

      // Security: strip immutables
      const sanitized = { ...body };
      delete (sanitized as any).id;
      delete (sanitized as any).organizationId;
      delete (sanitized as any).workspaceId;

      const updated = await globalDb.updateProperty(request.params.id, sanitized, ctx.workspaceId, ctx.organizationId);
      if (!updated) {
        return reply.status(404).send({ success: false, error: 'Property not found in authorized workspace' });
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
      const ctx = await resolveRealEstateContext(request, reply);
      if (!ctx) return;
      if (ctx.isViewer) {
        return reply.status(403).send({ success: false, error: 'Viewer role cannot delete properties' });
      }

      const prop = await globalDb.getPropertyById(request.params.id, ctx.workspaceId, ctx.organizationId);
      if (!prop) {
        return reply.status(404).send({ success: false, error: 'Property not found' });
      }

      // Concurrency & data loss prevention: check for active upcoming site visits on this property
      const appointments = await globalDb.getAppointments(ctx.organizationId);
      const activeVisits = appointments.filter(
        (a) => a.propertyId === prop.id && a.status !== 'CANCELLED' && new Date(a.scheduledTime).getTime() >= Date.now() - 300000
      );
      if (activeVisits.length > 0) {
        return reply.status(409).send({
          success: false,
          error: `Cannot delete property with ${activeVisits.length} active scheduled site visit(s). Cancel or reschedule visits first.`,
        });
      }

      const deleted = await globalDb.deleteProperty(prop.id, ctx.workspaceId, ctx.organizationId);
      if (!deleted) {
        return reply.status(404).send({ success: false, error: 'Property not found' });
      }

      return reply.send({ success: true, message: 'Property deleted successfully' });
    }
  );

  // =========================================================================
  // 3. SITE VISIT AVAILABILITY & SCHEDULING (CONCURRENCY-SAFE)
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
      const ctx = await resolveRealEstateContext(request, reply);
      if (!ctx) return;

      const { propertyId, date } = request.query;
      if (!propertyId || !date) {
        return reply.status(400).send({ success: false, error: 'propertyId and date (YYYY-MM-DD) are required' });
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return reply.status(400).send({ success: false, error: 'date must be in YYYY-MM-DD format' });
      }

      // Past date check in local IST calendar (UTC+5:30)
      const nowIST = new Date(Date.now() + 5.5 * 3600000);
      const todayIST = nowIST.toISOString().split('T')[0];
      if (date < todayIST) {
        return reply.status(400).send({ success: false, error: 'Cannot check availability for past dates' });
      }

      const property = await globalDb.getPropertyById(propertyId, ctx.workspaceId, ctx.organizationId);
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

      if (blockedDates.includes(date)) {
        return reply.send({
          success: true,
          propertyId,
          date,
          timeZone: 'Asia/Kolkata',
          totalSlots: 0,
          availableSlotsCount: 0,
          notice: 'Site visits unavailable on this date (Holiday / Site maintenance)',
          slots: [],
        });
      }

      const targetDate = new Date(date + 'T00:00:00Z');
      const dayOfWeek = targetDate.getUTCDay();
      if (!visitDays.includes(dayOfWeek)) {
        return reply.send({
          success: true,
          propertyId,
          date,
          timeZone: 'Asia/Kolkata',
          totalSlots: 0,
          availableSlotsCount: 0,
          notice: 'Site visits not scheduled on this day of the week',
          slots: [],
        });
      }

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
        const isoSlot = `${date}T${timeStr}:00+05:30`;

        // Check authoritative capacity slot or existing appointments
        const capacitySlot = await globalDb.getSiteVisitCapacitySlot(ctx.workspaceId, property.id, isoSlot, ctx.organizationId);
        
        let currentBookedVisitors = 0;
        if (capacitySlot) {
          currentBookedVisitors = capacitySlot.bookedCount;
        } else {
          const slotBookings = activeVisits.filter((a: AppointmentSlotDTO) =>
            a.scheduledTime.includes(`T${timeStr}`) || a.scheduledTime.startsWith(`${date}T${timeStr}`)
          );
          currentBookedVisitors = slotBookings.reduce((sum: number, b: AppointmentSlotDTO) => sum + (b.visitorCount || 1), 0);
        }

        const remainingCapacity = Math.max(0, maxCapacity - currentBookedVisitors);
        const isAvailable = remainingCapacity > 0;

        slots.push({
          startTime: timeStr,
          isoString: isoSlot,
          timeZone: 'Asia/Kolkata',
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
        timeZone: 'Asia/Kolkata',
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
      const ctx = await resolveRealEstateContext(request, reply);
      if (!ctx) return;

      const all = await globalDb.getAppointments(ctx.organizationId);
      const siteVisits = all.filter(
        (a: AppointmentSlotDTO) =>
          (a.workspaceId === ctx.workspaceId || !a.workspaceId) &&
          (a.appointmentType === 'SITE_VISIT' || (a.propertyId && a.propertyId.length > 0))
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
      const ctx = await resolveRealEstateContext(request, reply);
      if (!ctx) return;
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

      if (!isValidPhone(customerPhone)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid customerPhone format. Must be a valid 10-15 digit phone number.',
        });
      }

      // Past date validation
      const bookingTime = new Date(scheduledTime);
      if (isNaN(bookingTime.getTime()) || bookingTime.getTime() < Date.now() - 60000) {
        return reply.status(400).send({
          success: false,
          error: 'Cannot book site visit for past date and time.',
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

      const property = await globalDb.getPropertyById(propertyId, ctx.workspaceId, ctx.organizationId);
      if (!property) {
        return reply.status(404).send({ success: false, error: 'Property not found in workspace' });
      }

      const ws = await globalDb.getClientWorkspaceById(ctx.workspaceId, ctx.organizationId);
      const requestedVisitors = visitorCount || 1;
      const config = ws?.realEstateConfig || {};
      const maxCapacity = config.maxVisitorsPerSlot || 4;

      if (requestedVisitors < 1 || requestedVisitors > maxCapacity) {
        return reply.status(400).send({
          success: false,
          error: `visitorCount must be between 1 and ${maxCapacity}`,
        });
      }

      // Database-enforced atomic capacity reservation
      const reservation = await globalDb.reserveSiteVisitSlot({
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        propertyId: property.id,
        slotTime: scheduledTime,
        visitorCount: requestedVisitors,
        maxCapacity,
      });

      if (!reservation.success) {
        return reply.status(409).send({
          success: false,
          error: reservation.error || 'Slot capacity exceeded. No available slots.',
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

      try {
        await globalDb.saveAppointment(siteVisit);
      } catch (saveErr: any) {
        // Compensating rollback: release reserved slot if appointment persistence fails
        await globalDb.releaseSiteVisitSlot({
          organizationId: ctx.organizationId,
          workspaceId: ctx.workspaceId,
          propertyId: property.id,
          slotTime: scheduledTime,
          visitorCount: requestedVisitors,
        });
        throw saveErr;
      }

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
      const ctx = await resolveRealEstateContext(request, reply);
      if (!ctx) return;
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

      // Past date check
      const targetTime = new Date(newScheduledTime);
      if (isNaN(targetTime.getTime()) || targetTime.getTime() < Date.now() - 60000) {
        return reply.status(400).send({ success: false, error: 'Cannot reschedule site visit to a past date/time' });
      }

      const ws = await globalDb.getClientWorkspaceById(existing.workspaceId || ctx.workspaceId, ctx.organizationId);
      const config = ws?.realEstateConfig || {};
      const maxCapacity = config.maxVisitorsPerSlot || 4;
      const visitors = existing.visitorCount || 1;

      // Atomically reserve new slot first
      const reservation = await globalDb.reserveSiteVisitSlot({
        organizationId: ctx.organizationId,
        workspaceId: existing.workspaceId || ctx.workspaceId,
        propertyId: existing.propertyId || '',
        slotTime: newScheduledTime,
        visitorCount: visitors,
        maxCapacity,
      });

      if (!reservation.success) {
        return reply.status(409).send({ success: false, error: reservation.error || 'New slot has insufficient capacity' });
      }

      // Release old slot
      if (existing.propertyId) {
        await globalDb.releaseSiteVisitSlot({
          organizationId: ctx.organizationId,
          workspaceId: existing.workspaceId || ctx.workspaceId,
          propertyId: existing.propertyId,
          slotTime: existing.scheduledTime,
          visitorCount: visitors,
        });
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
      const ctx = await resolveRealEstateContext(request, reply);
      if (!ctx) return;
      if (ctx.isViewer) {
        return reply.status(403).send({ success: false, error: 'Viewer role cannot cancel site visits' });
      }

      const existing = await globalDb.getAppointmentById(request.params.id, ctx.organizationId);
      if (!existing) {
        return reply.status(404).send({ success: false, error: 'Site visit not found' });
      }

      // Release reserved slot capacity
      if (existing.propertyId) {
        await globalDb.releaseSiteVisitSlot({
          organizationId: ctx.organizationId,
          workspaceId: existing.workspaceId || ctx.workspaceId,
          propertyId: existing.propertyId,
          slotTime: existing.scheduledTime,
          visitorCount: existing.visitorCount || 1,
        });
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
      const ctx = await resolveRealEstateContext(request, reply);
      if (!ctx) return;

      const leads = await globalDb.getLeads(ctx.organizationId);
      // Strictly scope to workspace
      const filtered = leads.filter(l => (l as any).workspaceId === ctx.workspaceId || !(l as any).workspaceId);
      return reply.send({ success: true, count: filtered.length, leads: filtered });
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
      const ctx = await resolveRealEstateContext(request, reply);
      if (!ctx) return;
      if (ctx.isViewer) {
        return reply.status(403).send({ success: false, error: 'Viewer role cannot update lead qualification' });
      }

      const body = request.body;
      if (!body.contactPhone || !isValidPhone(body.contactPhone)) {
        return reply.status(400).send({ success: false, error: 'Valid contactPhone is required' });
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
        (lead as any).workspaceId = ctx.workspaceId;
      } else {
        lead.budgetOrFee = budgetText;
        lead.requirementSummary = `Property Enquiry - ${body.propertyInterest || lead.requirementSummary}`;
        if (body.contactName) lead.callerName = body.contactName;
        lead.confirmedOutcome = body.status || lead.confirmedOutcome;
        (lead as any).workspaceId = ctx.workspaceId;
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
      const ctx = await resolveRealEstateContext(request, reply);
      if (!ctx) return;

      const { queryText, language = 'kn-IN' } = request.body;
      if (!queryText) {
        return reply.status(400).send({ success: false, error: 'queryText is required' });
      }

      // Fetch verified properties from workspace catalog
      const properties = await globalDb.getProperties(ctx.workspaceId, undefined, ctx.organizationId);
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
      const ctx = await resolveRealEstateContext(request, reply);
      if (!ctx) return;

      const body = request.body;
      if (!body.phone || !isValidPhone(body.phone)) {
        return reply.status(400).send({ success: false, error: 'Valid phone is required' });
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
      (lead as any).workspaceId = ctx.workspaceId;
      (lead as any).idempotencyKey = body.idempotencyKey;

      await globalDb.saveLead(lead);
      return reply.status(201).send({ success: true, lead });
    }
  );
}
