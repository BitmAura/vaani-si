/**
 * @vanni/server — Digital Marketing Agency Client Management & Overview Router (Prompt 04)
 * 
 * Multi-Client Architecture:
 * - Agencies manage multiple client businesses (Healthcare clinics, Real Estate developers/brokers, etc.)
 * - Each client business has its own workspace, business profile, industry/subcategory, AI employee, and ledgers
 * - All metrics are computed strictly from real database records (no fake/hardcoded stats)
 * - Server enforces tenant-isolation and viewer permissions
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import { globalDb } from '@vanni/database';
import { globalEntitlementEngine } from '@vanni/billing';
import {
  AuthSessionDTO,
  ClientWorkspaceDTO,
  BusinessModelType,
  IndustryCategory,
  IndustrySubcategory,
  CreateClientWorkspaceInputSchema,
} from '@vanni/shared';
import { DEFAULT_COOKIE_OPTIONS, requireUser } from '@vanni/auth';
import { getSessionFromRequest } from '../http-auth.js';

interface ClientMetricsSummary {
  totalCalls: number;
  completedCalls: number;
  qualifiedLeads: number;
  appointmentsConfirmed: number;
  appointmentsRequested: number;
  followUpsRequiringAttention: number;
  totalVoiceMinutes: number;
  lastActivity: string;
}

/**
 * Computes live metrics for a client workspace from durable database records
 */
async function computeClientMetrics(ws: ClientWorkspaceDTO, period?: string): Promise<ClientMetricsSummary> {
  const allCalls = await globalDb.getCalls(ws.id);
  const allLeads = await globalDb.getLeads(ws.id);
  const allAppointments = await globalDb.getAppointments(ws.id);

  const now = Date.now();
  const filterByDate = (dateStr: string) => {
    if (!period || period === 'all') return true;
    const t = new Date(dateStr).getTime();
    if (isNaN(t)) return true;
    if (period === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return t >= today.getTime();
    }
    if (period === '7d') {
      return t >= (now - 7 * 24 * 60 * 60 * 1000);
    }
    if (period === '30d') {
      return t >= (now - 30 * 24 * 60 * 60 * 1000);
    }
    return true;
  };

  const periodCalls = allCalls.filter(c => filterByDate(c.createdAt));
  const periodLeads = allLeads.filter(l => filterByDate(l.createdAt));
  const periodAppointments = allAppointments.filter(a => filterByDate(a.scheduledTime));

  const totalCalls = periodCalls.length;
  const completedCalls = periodCalls.filter(c => c.outcome !== 'FAILED' && c.outcome !== 'DISQUALIFIED').length;
  const qualifiedLeads = periodLeads.filter(l => l.leadRating === 'HOT' || l.leadRating === 'WARM').length;
  const appointmentsConfirmed = periodAppointments.filter(a => a.status === 'CONFIRMED').length;
  const appointmentsRequested = periodAppointments.filter(a => a.status === 'PENDING').length;
  
  const followUpsRequiringAttention = periodLeads.filter(
    l => l.leadRating === 'HOT' || l.confirmedOutcome === 'FOLLOW_UP_REQUIRED' || l.confirmedOutcome === 'ESCALATED'
  ).length;

  const totalDurationSec = periodCalls.reduce((sum, c) => sum + (c.durationSeconds || 0), 0);
  const totalVoiceMinutes = Math.round((totalDurationSec / 60) * 10) / 10;

  // Find latest activity timestamp
  const activityTimestamps = [
    ws.updatedAt || ws.createdAt,
    ...periodCalls.map(c => c.createdAt),
    ...periodLeads.map(l => l.createdAt),
  ].filter(Boolean);

  const lastActivity = activityTimestamps.length > 0
    ? new Date(Math.max(...activityTimestamps.map(t => new Date(t).getTime()))).toISOString()
    : ws.createdAt;

  return {
    totalCalls,
    completedCalls,
    qualifiedLeads,
    appointmentsConfirmed,
    appointmentsRequested,
    followUpsRequiringAttention,
    totalVoiceMinutes,
    lastActivity,
  };
}

export async function agencyRoutes(fastify: FastifyInstance): Promise<void> {
  
  /**
   * GET /api/agency/overview
   * Consolidated agency dashboard metrics and client summary for active agency organization
   */
  fastify.get('/api/agency/overview', async (req: FastifyRequest<{ Querystring: { period?: string; industry?: string } }>, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const orgId = session.activeOrganizationId;
    const orgMembership = session.memberships.find(m => m.organizationId === orgId);
    const agencyName = orgMembership?.organizationName || 'Agency Hub';

    const { period, industry } = req.query || {};
    let workspaces = await globalDb.getClientWorkspacesByOrg(orgId);

    if (industry && industry !== 'ALL') {
      workspaces = workspaces.filter(w => w.industryCategory === industry || w.subcategory === industry);
    }

    // Compute metrics for each client
    const clientRows = [];
    let aggTotalCalls = 0;
    let aggCompletedCalls = 0;
    let aggQualifiedLeads = 0;
    let aggAppointmentsConfirmed = 0;
    let aggAppointmentsRequested = 0;
    let aggFollowUps = 0;
    let aggVoiceMinutes = 0;
    let activeAiEmployeesCount = 0;

    for (const ws of workspaces) {
      const metrics = await computeClientMetrics(ws, period);
      aggTotalCalls += metrics.totalCalls;
      aggCompletedCalls += metrics.completedCalls;
      aggQualifiedLeads += metrics.qualifiedLeads;
      aggAppointmentsConfirmed += metrics.appointmentsConfirmed;
      aggAppointmentsRequested += metrics.appointmentsRequested;
      aggFollowUps += metrics.followUpsRequiringAttention;
      aggVoiceMinutes += metrics.totalVoiceMinutes;

      const aiStatus = ws.aiEmployee?.status || 'DRAFT';
      if (aiStatus === 'ACTIVE') {
        activeAiEmployeesCount++;
      }

      clientRows.push({
        id: ws.id,
        name: ws.name,
        slug: ws.slug,
        industryCategory: ws.industryCategory,
        subcategory: ws.subcategory,
        operatingLocation: ws.operatingLocation,
        primaryPhone: ws.primaryPhone,
        primaryEmail: ws.primaryEmail,
        aiEmployee: ws.aiEmployee || {
          name: ws.industryCategory === 'HEALTHCARE' ? 'Kavya' : 'Sahana',
          status: 'DRAFT',
        },
        onboardingStep: ws.onboardingStep,
        onboardingCompleted: ws.onboardingCompleted,
        metrics,
        createdAt: ws.createdAt,
        updatedAt: ws.updatedAt,
      });
    }

    return reply.send({
      success: true,
      agencyName,
      organizationId: orgId,
      period: period || 'all',
      summary: {
        totalClients: workspaces.length,
        activeAiEmployees: activeAiEmployeesCount,
        totalCalls: aggTotalCalls,
        completedCalls: aggCompletedCalls,
        qualifiedLeads: aggQualifiedLeads,
        appointmentsConfirmed: aggAppointmentsConfirmed,
        appointmentsRequested: aggAppointmentsRequested,
        followUpsRequiringAttention: aggFollowUps,
        totalVoiceMinutes: Math.round(aggVoiceMinutes * 10) / 10,
      },
      clients: clientRows,
    });
  });

  /**
   * GET /api/agency/clients
   * List client workspaces for the active agency organization with live performance metrics
   */
  fastify.get('/api/agency/clients', async (req: FastifyRequest<{ Querystring: { search?: string; industry?: string; status?: string } }>, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const orgId = session.activeOrganizationId;
    let workspaces = await globalDb.getClientWorkspacesByOrg(orgId);

    const { search, industry } = req.query || {};

    if (industry && industry !== 'ALL') {
      workspaces = workspaces.filter(w => w.industryCategory === industry || w.subcategory === industry);
    }

    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      workspaces = workspaces.filter(w =>
        w.name.toLowerCase().includes(q) ||
        w.operatingLocation.toLowerCase().includes(q) ||
        (w.primaryPhone && w.primaryPhone.includes(q))
      );
    }

    const results = [];
    for (const ws of workspaces) {
      const metrics = await computeClientMetrics(ws);
      results.push({
        id: ws.id,
        name: ws.name,
        slug: ws.slug,
        industryCategory: ws.industryCategory,
        subcategory: ws.subcategory,
        operatingLocation: ws.operatingLocation,
        primaryPhone: ws.primaryPhone,
        primaryEmail: ws.primaryEmail,
        aiEmployee: ws.aiEmployee || {
          name: ws.industryCategory === 'HEALTHCARE' ? 'Kavya' : 'Sahana',
          status: 'DRAFT',
        },
        onboardingStep: ws.onboardingStep,
        onboardingCompleted: ws.onboardingCompleted,
        metrics,
        createdAt: ws.createdAt,
        updatedAt: ws.updatedAt,
      });
    }

    return reply.status(200).send({
      success: true,
      data: results,
      total: results.length,
    });
  });

  /**
   * POST /api/agency/clients
   * Agency creates a new client business account (validated, tenant-isolated, non-viewer role checked)
   */
  fastify.post('/api/agency/clients', async (req: FastifyRequest, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    if (session.activeRole === 'VIEWER') {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Viewers cannot create client workspaces.' });
    }

    const parsed = CreateClientWorkspaceInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message || 'Invalid client workspace payload',
      });
    }

    const orgId = session.activeOrganizationId;

    // Server-Side Entitlement Check: Verify maximum client workspaces entitlement
    const limitCheck = await globalEntitlementEngine.canCreateClientWorkspace(orgId);
    if (!limitCheck.allowed) {
      return reply.status(403).send({
        error: 'ENTITLEMENT_LIMIT_EXCEEDED',
        message: limitCheck.reason,
        currentCount: limitCheck.currentCount,
        maxAllowed: limitCheck.maxAllowed,
      });
    }

    const {
      name,
      industryCategory,
      subcategory,
      operatingLocation,
      primaryPhone,
      primaryEmail,
      timezone,
      languagePreferences,
      startingTemplateId,
    } = parsed.data;

    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .slice(0, 50) || 'client';

    const newClient: ClientWorkspaceDTO = {
      id: `ws_${crypto.randomUUID()}`,
      organizationId: orgId,
      name,
      slug: `${slug}-${Date.now().toString(36)}`,
      modelType: 'AGENCY' as BusinessModelType,
      industryCategory: industryCategory as IndustryCategory,
      subcategory: subcategory as IndustrySubcategory,
      operatingLocation,
      primaryPhone,
      primaryEmail,
      timezone: timezone || 'Asia/Kolkata',
      languagePreferences: {
        primary: languagePreferences.primary,
        conversationalStyle: languagePreferences.conversationalStyle,
        regionalDialect: languagePreferences.regionalDialect,
      },
      startingTemplateId,
      onboardingStep: 1,
      onboardingCompleted: false,
      onboardingData: {},
      aiEmployee: {
        name: industryCategory === 'HEALTHCARE' ? 'Kavya' : 'Sahana',
        gender: 'FEMALE',
        speakerId: 'meera',
        engine: 'sarvam_bulbul_v2',
        status: 'DRAFT',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await globalDb.saveClientWorkspace(newClient);
    fastify.log.info({ clientId: newClient.id, orgId }, '[Agency Client Created]');

    return reply.status(201).send({
      success: true,
      data: newClient,
      workspace: newClient,
      message: 'Client business workspace created successfully',
    });
  });

  /**
   * GET /api/agency/clients/:id
   * Get single client business details, config, and live operational stats
   */
  fastify.get('/api/agency/clients/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const { id } = req.params;
    const client = await globalDb.getClientWorkspaceById(id);
    if (!client) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Client workspace not found' });
    }

    const hasAccess = session.memberships.some(m => m.organizationId === client.organizationId);
    if (!hasAccess) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Access denied to this client' });
    }

    const metrics = await computeClientMetrics(client);

    return reply.status(200).send({
      success: true,
      data: {
        ...client,
        metrics,
      },
    });
  });

  /**
   * PUT /api/agency/clients/:id
   * Update client business details or AI configuration
   */
  fastify.put('/api/agency/clients/:id', async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    if (session.activeRole === 'VIEWER') {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Viewers cannot modify client workspaces.' });
    }

    const { id } = req.params;
    const client = await globalDb.getClientWorkspaceById(id);
    if (!client) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Client workspace not found' });
    }

    const hasAccess = session.memberships.some(m => m.organizationId === client.organizationId);
    if (!hasAccess) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Access denied to this client' });
    }

    const body = (req.body as Partial<ClientWorkspaceDTO>) || {};
    delete (body as any).id;
    delete (body as any).organizationId;

    const updated = await globalDb.updateClientWorkspace(id, body, client.organizationId);
    return reply.status(200).send({
      success: true,
      data: updated,
      message: 'Client workspace updated successfully',
    });
  });

  /**
   * DELETE /api/agency/clients/:id
   * Delete client business workspace (OWNER or ADMIN role only)
   */
  fastify.delete('/api/agency/clients/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    if (session.activeRole !== 'OWNER' && session.activeRole !== 'ADMIN') {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Only agency owners and admins can remove client accounts.' });
    }

    const { id } = req.params;
    const client = await globalDb.getClientWorkspaceById(id);
    if (!client) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Client workspace not found' });
    }

    const hasAccess = session.memberships.some(m => m.organizationId === client.organizationId);
    if (!hasAccess) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Access denied to this client' });
    }

    await globalDb.deleteClientWorkspace(id, client.organizationId);
    return reply.status(200).send({
      success: true,
      message: 'Client workspace deleted successfully',
    });
  });

  /**
   * POST /api/agency/clients/:id/switch
   * Safely switches active client workspace context for the current session
   */
  fastify.post('/api/agency/clients/:id/switch', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const { id } = req.params;
    const client = await globalDb.getClientWorkspaceById(id);
    if (!client) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Client workspace not found' });
    }

    const hasAccess = session.memberships.some(m => m.organizationId === client.organizationId);
    if (!hasAccess) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Access denied to this client' });
    }

    reply.setCookie('vanni_active_workspace', id, {
      ...DEFAULT_COOKIE_OPTIONS,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return reply.status(200).send({
      success: true,
      activeWorkspace: client,
      organizationId: client.organizationId,
      message: `Switched to client context: ${client.name}`,
    });
  });

  /**
   * GET /api/agency/usage
   * Per-client voice minutes and telephony usage summary based on actual audio session logs
   */
  fastify.get('/api/agency/usage', async (req: FastifyRequest, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const orgId = session.activeOrganizationId;
    const workspaces = await globalDb.getClientWorkspacesByOrg(orgId);

    const clientUsageBreakdown = [];
    let totalRecordedMinutes = 0;

    for (const ws of workspaces) {
      const calls = await globalDb.getCalls(ws.id);
      const totalSec = calls.reduce((acc, c) => acc + (c.durationSeconds || 0), 0);
      const minutes = Math.round((totalSec / 60) * 10) / 10;
      totalRecordedMinutes += minutes;

      clientUsageBreakdown.push({
        clientId: ws.id,
        clientName: ws.name,
        industry: ws.industryCategory,
        totalCalls: calls.length,
        durationMinutes: minutes,
      });
    }

    return reply.status(200).send({
      success: true,
      organizationId: orgId,
      totalRecordedMinutes: Math.round(totalRecordedMinutes * 10) / 10,
      clientCount: workspaces.length,
      clients: clientUsageBreakdown,
      providerCost: null,
      billingStatus: 'RECORDED_USAGE_ONLY',
      notice: 'Direct carrier billing and telephony markup integration in progress. Showing actual audio call minutes.',
    });
  });
}
