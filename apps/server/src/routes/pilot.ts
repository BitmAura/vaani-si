/**
 * @vanni/server — Customer Launch Readiness, Voice Agent Activation & Pilot Operations Router (Prompt 11)
 *
 * Implements:
 * - GET  /api/voice-agent/supported-voices       - Matrix of certified supported voice options
 * - GET  /api/workspaces/:id/readiness           - Server-backed 15-dimension preflight readiness checker
 * - GET  /api/workspaces/:id/voice-agent         - Retrieve voice agent settings, hours, and dialect
 * - PUT  /api/workspaces/:id/voice-agent         - Save and validate voice agent configuration with audit trail
 * - GET  /api/workspaces/:id/activation          - Retrieve current activation state, blockers & history
 * - POST /api/workspaces/:id/activation         - Gated state transitions (DRAFT -> TESTING -> ACTIVE -> SUSPENDED)
 * - GET  /api/pilot/operations                   - Pilot operations dashboard backed strictly by durable DB records
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import { globalDb } from '@vanni/database';
import { globalEntitlementEngine } from '@vanni/billing';
import {
  WorkspaceActivationStatus,
  ActivationTransitionDTO,
  VoiceAgentConfigDTO,
  PilotOperationsSummaryDTO,
  AuditLogDTO,
} from '@vanni/shared';
import { getSessionFromRequest } from '../http-auth.js';
import { PreflightReadinessEngine, SUPPORTED_VOICES } from '../readiness-engine.js';

export async function registerPilotRoutes(fastify: FastifyInstance): Promise<void> {
  const readinessEngine = new PreflightReadinessEngine(globalDb);

  // 1. GET /api/voice-agent/supported-voices: Certified voice options
  fastify.get('/api/voice-agent/supported-voices', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      success: true,
      voices: SUPPORTED_VOICES,
      total: SUPPORTED_VOICES.length,
    });
  });

  // 2. GET /api/workspaces/:id/readiness: 15-dimension preflight readiness check
  fastify.get('/api/workspaces/:id/readiness', async (req: FastifyRequest, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const { id } = req.params as { id: string };
    const workspace = await globalDb.getClientWorkspaceById(id);
    if (!workspace) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Workspace not found' });
    }

    const hasAccess = session.memberships.some((m) => m.organizationId === workspace.organizationId);
    if (!hasAccess) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Access denied to this workspace' });
    }

    const report = await readinessEngine.evaluateWorkspace(workspace.id, workspace.organizationId);
    return reply.send({
      success: true,
      report,
    });
  });

  // 3. GET /api/workspaces/:id/voice-agent: Voice agent configuration
  fastify.get('/api/workspaces/:id/voice-agent', async (req: FastifyRequest, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const { id } = req.params as { id: string };
    const workspace = await globalDb.getClientWorkspaceById(id);
    if (!workspace) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Workspace not found' });
    }

    const hasAccess = session.memberships.some((m) => m.organizationId === workspace.organizationId);
    if (!hasAccess) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Access denied to this workspace' });
    }

    const config: VoiceAgentConfigDTO = workspace.voiceAgentConfig || {
      agentName: workspace.aiEmployee?.name || (workspace.industryCategory === 'HEALTHCARE' ? 'Kavya' : 'Sahana'),
      displayName: `${workspace.aiEmployee?.name || 'Sahana'} — Voice Assistant`,
      speakerId: workspace.aiEmployee?.speakerId || 'meera',
      engine: workspace.aiEmployee?.engine || 'sarvam_bulbul_v3',
      primaryLanguage: workspace.languagePreferences?.primary || 'kn-IN',
      regionalDialect: workspace.languagePreferences?.regionalDialect || 'KANGLISH_BUSINESS',
      greetingKannada: workspace.industryCategory === 'HEALTHCARE'
        ? 'ನಮಸ್ಕಾರ, ಅಪೋಲೋ ಕ್ಲಿನಿಕ್ ಗೆ ಸ್ವಾಗತ. ನಾನು ಕಾವ್ಯ, ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?'
        : 'ನಮಸ್ಕಾರ, ಬಳ್ಳಾರಿ ರೆಸಿಡೆನ್ಶಿಯಲ್ ಲೇಔಟ್ಸ್ ಗೆ ಸ್ವಾಗತ. ನಾನು ಸಹನಾ, ನಿವೇಶನಗಳ ಬಗ್ಗೆ ವಿಚಾರಿಸಲು ಕರೆ ಮಾಡಿದ್ದೀರಾ?',
      greetingEnglish: 'Hello, welcome. How may I assist you today?',
      conversationalStyle: workspace.languagePreferences?.conversationalStyle || 'POLITE_BUSINESS',
      toolPermissions: workspace.industryCategory === 'HEALTHCARE'
        ? ['check_availability', 'book_appointment', 'cancel_appointment', 'get_clinic_faqs']
        : ['check_property_availability', 'schedule_site_visit', 'qualify_lead'],
      operatingHours: {
        opensAt: '09:00',
        closesAt: '20:00',
        timezone: workspace.timezone || 'Asia/Kolkata',
      },
      afterHoursBehavior: 'TAKE_MESSAGE',
      humanHandoffPhone: workspace.primaryPhone,
      emergencyContactPhone: workspace.industryCategory === 'HEALTHCARE' ? '108' : undefined,
      maxCallDurationSeconds: 300,
      monthlyUsageLimitMinutes: 1000,
      status: workspace.aiEmployee?.status === 'ACTIVE' ? 'ENABLED' : 'SAVED',
      version: 1,
      updatedAt: workspace.updatedAt || workspace.createdAt,
    };

    return reply.send({
      success: true,
      workspaceId: workspace.id,
      voiceAgent: config,
    });
  });

  // 4. PUT /api/workspaces/:id/voice-agent: Update and validate voice agent configuration
  fastify.put('/api/workspaces/:id/voice-agent', async (req: FastifyRequest, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    if (session.activeRole === 'VIEWER') {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Viewers cannot modify voice agent configuration.' });
    }

    const { id } = req.params as { id: string };
    const workspace = await globalDb.getClientWorkspaceById(id);
    if (!workspace) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Workspace not found' });
    }

    const hasAccess = session.memberships.some((m) => m.organizationId === workspace.organizationId);
    if (!hasAccess) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Access denied to this workspace' });
    }

    const body = (req.body || {}) as Partial<VoiceAgentConfigDTO>;

    // Validate speaker if provided
    if (body.speakerId) {
      const isSupported = SUPPORTED_VOICES.some((v) => v.id.toLowerCase() === body.speakerId?.toLowerCase());
      if (!isSupported) {
        return reply.status(400).send({
          error: 'UNSUPPORTED_VOICE',
          message: `Speaker '${body.speakerId}' is not supported. Supported voices: ${SUPPORTED_VOICES.map((v) => v.id).join(', ')}.`,
        });
      }
    }

    const prevVersion = workspace.voiceAgentConfig?.version || 1;
    const newVersion = prevVersion + 1;
    const now = new Date().toISOString();

    const updatedConfig: VoiceAgentConfigDTO = {
      ...(workspace.voiceAgentConfig || {
        agentName: workspace.aiEmployee?.name || 'Sahana',
        displayName: 'Voice AI Employee',
        speakerId: 'meera',
        engine: 'sarvam_bulbul_v3',
        primaryLanguage: 'kn-IN',
        regionalDialect: 'KANGLISH_BUSINESS',
        greetingKannada: 'ನಮಸ್ಕಾರ, ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?',
        conversationalStyle: 'POLITE_BUSINESS',
        toolPermissions: ['check_availability'],
        operatingHours: { opensAt: '09:00', closesAt: '20:00', timezone: 'Asia/Kolkata' },
        afterHoursBehavior: 'TAKE_MESSAGE',
        maxCallDurationSeconds: 300,
        status: 'SAVED',
        version: 1,
        updatedAt: now,
      }),
      ...body,
      version: newVersion,
      status: 'VALIDATED',
      updatedAt: now,
    };

    const updatedWs = await globalDb.updateClientWorkspace(
      workspace.id,
      {
        voiceAgentConfig: updatedConfig,
        aiEmployee: {
          name: updatedConfig.agentName,
          gender: SUPPORTED_VOICES.find((v) => v.id === updatedConfig.speakerId)?.gender || 'FEMALE',
          speakerId: updatedConfig.speakerId,
          engine: updatedConfig.engine,
          status: updatedConfig.status === 'ENABLED' ? 'ACTIVE' : 'READY',
        },
      },
      workspace.organizationId
    );

    // Save audit log
    await globalDb.saveAuditLog({
      id: `audit_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      organizationId: workspace.organizationId,
      actorUserId: session.userId,
      action: 'voice_agent_config_updated',
      resourceType: 'VOICE_AGENT',
      resourceId: workspace.id,
      metadata: {
        version: newVersion,
        speakerId: updatedConfig.speakerId,
        agentName: updatedConfig.agentName,
      },
      createdAt: now,
    });

    return reply.send({
      success: true,
      message: `Voice agent configuration updated to version ${newVersion}.`,
      voiceAgent: updatedConfig,
      workspace: updatedWs,
    });
  });

  // 5. GET /api/workspaces/:id/activation: Current state, blockers, and history
  fastify.get('/api/workspaces/:id/activation', async (req: FastifyRequest, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const { id } = req.params as { id: string };
    const workspace = await globalDb.getClientWorkspaceById(id);
    if (!workspace) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Workspace not found' });
    }

    const hasAccess = session.memberships.some((m) => m.organizationId === workspace.organizationId);
    if (!hasAccess) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Access denied to this workspace' });
    }

    const report = await readinessEngine.evaluateWorkspace(workspace.id, workspace.organizationId);
    const currentStatus: WorkspaceActivationStatus = workspace.activationStatus || 'DRAFT';

    return reply.send({
      success: true,
      workspaceId: workspace.id,
      currentStatus,
      canTest: report.canTest,
      canActivateLive: report.canActivateLive,
      blockers: report.blockers,
      testingBlockers: report.testingBlockers,
      readinessSummary: report.summary,
    });
  });

  // 6. POST /api/workspaces/:id/activation: Gated state transitions with safety enforcement
  fastify.post('/api/workspaces/:id/activation', async (req: FastifyRequest, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    // Role check: Only OWNER or ADMIN can activate or suspend agents
    if (session.activeRole !== 'OWNER' && session.activeRole !== 'ADMIN') {
      return reply.status(403).send({
        error: 'FORBIDDEN',
        message: 'Only Organization Owners and Admins can transition workspace activation state.',
      });
    }

    const { id } = req.params as { id: string };
    const workspace = await globalDb.getClientWorkspaceById(id);
    if (!workspace) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Workspace not found' });
    }

    const hasAccess = session.memberships.some((m) => m.organizationId === workspace.organizationId);
    if (!hasAccess) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Access denied to this workspace' });
    }

    const body = req.body as ActivationTransitionDTO;
    if (!body || !body.targetStatus) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'targetStatus is required' });
    }

    const validStatuses: WorkspaceActivationStatus[] = [
      'DRAFT',
      'CONFIGURATION_INCOMPLETE',
      'READY_FOR_TESTING',
      'TESTING',
      'READY_FOR_LIVE_ACTIVATION',
      'ACTIVE',
      'SUSPENDED',
      'FAILED',
    ];

    if (!validStatuses.includes(body.targetStatus)) {
      return reply.status(400).send({
        error: 'INVALID_STATUS',
        message: `Status '${body.targetStatus}' is invalid. Allowed: ${validStatuses.join(', ')}.`,
      });
    }

    const report = await readinessEngine.evaluateWorkspace(workspace.id, workspace.organizationId);

    // Safety Gate: Transition to ACTIVE or READY_FOR_LIVE_ACTIVATION requires all mandatory checks
    if (body.targetStatus === 'ACTIVE' || body.targetStatus === 'READY_FOR_LIVE_ACTIVATION') {
      if (!report.canActivateLive) {
        return reply.status(400).send({
          error: 'ACTIVATION_GATED',
          message: 'Workspace cannot be activated live because mandatory preflight readiness checks failed.',
          blockers: report.blockers,
          summary: report.summary,
        });
      }
    }

    // Safety Gate: Transition to TESTING requires testing-mandatory checks
    if (body.targetStatus === 'TESTING' || body.targetStatus === 'READY_FOR_TESTING') {
      if (!report.canTest) {
        return reply.status(400).send({
          error: 'TESTING_GATED',
          message: 'Workspace cannot enter test mode because mandatory profile or roster checks failed.',
          testingBlockers: report.testingBlockers,
        });
      }
    }

    const now = new Date().toISOString();
    const previousStatus = workspace.activationStatus || 'DRAFT';

    const updates: Partial<typeof workspace> = {
      activationStatus: body.targetStatus,
      onboardingData: {
        ...(workspace.onboardingData || {}),
        whitelistedTestNumbers: body.whitelistedTestNumbers || workspace.onboardingData?.whitelistedTestNumbers || [],
        lastActivationTransition: {
          from: previousStatus,
          to: body.targetStatus,
          reason: body.reason || 'User triggered transition',
          actorUserId: session.userId,
          timestamp: now,
        },
      },
    };

    if (body.targetStatus === 'ACTIVE') {
      updates.aiEmployee = {
        ...(workspace.aiEmployee || {
          name: 'Sahana',
          gender: 'FEMALE',
          speakerId: 'meera',
          engine: 'sarvam_bulbul_v3',
          status: 'ACTIVE',
        }),
        status: 'ACTIVE',
      };
      if (workspace.voiceAgentConfig) {
        updates.voiceAgentConfig = {
          ...workspace.voiceAgentConfig,
          status: 'ENABLED',
          updatedAt: now,
        };
      }
    } else if (body.targetStatus === 'SUSPENDED') {
      updates.aiEmployee = {
        ...(workspace.aiEmployee || {
          name: 'Sahana',
          gender: 'FEMALE',
          speakerId: 'meera',
          engine: 'sarvam_bulbul_v3',
          status: 'DRAFT',
        }),
        status: 'DRAFT',
      };
      if (workspace.voiceAgentConfig) {
        updates.voiceAgentConfig = {
          ...workspace.voiceAgentConfig,
          status: 'DISABLED',
          updatedAt: now,
        };
      }
    }

    const updatedWs = await globalDb.updateClientWorkspace(workspace.id, updates, workspace.organizationId);

    // Save audit log
    await globalDb.saveAuditLog({
      id: `audit_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      organizationId: workspace.organizationId,
      actorUserId: session.userId,
      action: `workspace_status_${body.targetStatus.toLowerCase()}`,
      resourceType: 'WORKSPACE_ACTIVATION',
      resourceId: workspace.id,
      metadata: {
        from: previousStatus,
        to: body.targetStatus,
        reason: body.reason,
        notes: body.notes,
      },
      createdAt: now,
    });

    return reply.send({
      success: true,
      message: `Workspace activation status transitioned from ${previousStatus} to ${body.targetStatus}.`,
      workspace: updatedWs,
      previousStatus,
      currentStatus: body.targetStatus,
    });
  });

  // 7. GET /api/pilot/operations: Pilot operations dashboard with real persisted data
  fastify.get('/api/pilot/operations', async (req: FastifyRequest, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const orgId = session.activeOrganizationId;
    const workspaces = await globalDb.getClientWorkspacesByOrg(orgId);

    // 1. Workspaces by status
    const statusCounts: Record<WorkspaceActivationStatus, number> = {
      DRAFT: 0,
      CONFIGURATION_INCOMPLETE: 0,
      READY_FOR_TESTING: 0,
      TESTING: 0,
      READY_FOR_LIVE_ACTIVATION: 0,
      ACTIVE: 0,
      SUSPENDED: 0,
      FAILED: 0,
    };

    const blockersPerWorkspace: Array<{
      workspaceId: string;
      workspaceName: string;
      activationStatus: WorkspaceActivationStatus;
      blockers: string[];
    }> = [];

    for (const ws of workspaces) {
      const st: WorkspaceActivationStatus = ws.activationStatus || 'DRAFT';
      if (statusCounts[st] !== undefined) {
        statusCounts[st]++;
      } else {
        statusCounts.DRAFT++;
      }

      const rep = await readinessEngine.evaluateWorkspace(ws.id, orgId);
      if (rep.blockers.length > 0) {
        blockersPerWorkspace.push({
          workspaceId: ws.id,
          workspaceName: ws.name,
          activationStatus: st,
          blockers: rep.blockers,
        });
      }
    }

    // 2. Real Call Metrics from Durable DB
    const allOrgCalls = await globalDb.getCalls(orgId);
    let totalAttempted = allOrgCalls.length;
    let completed = 0;
    let answered = 0;
    let unanswered = 0;
    let busy = 0;
    let failed = 0;
    let interrupted = 0;
    let confirmedDurationSeconds = 0;

    for (const c of allOrgCalls) {
      const st = (c.status || '').toUpperCase();
      const outcome = (c.outcome || '').toUpperCase();

      if (st === 'COMPLETED' || outcome.includes('SUCCESS') || outcome.includes('COMPLETED')) {
        completed++;
        answered++;
      } else if (st === 'NO_ANSWER' || outcome.includes('NO_ANSWER')) {
        unanswered++;
      } else if (st === 'BUSY' || outcome.includes('BUSY')) {
        busy++;
      } else if (st === 'FAILED' || outcome.includes('FAIL')) {
        failed++;
      } else {
        answered++;
      }

      if (c.outcome === 'INTERRUPTED') {
        interrupted++;
      }

      confirmedDurationSeconds += c.durationSeconds || 0;
    }

    const meteredVoiceMinutes = Math.ceil(confirmedDurationSeconds / 60);

    // 3. Subscription & Entitlement Info
    const sub = await globalDb.getSubscription(orgId);
    const plan = sub ? await globalDb.getPlanById(sub.planId) : null;
    const voiceMinutesAllowance = plan?.entitlements?.maxMonthlyVoiceMinutes || 500;
    const remainingAllowance = Math.max(0, voiceMinutesAllowance - meteredVoiceMinutes);
    const overageMinutes = Math.max(0, meteredVoiceMinutes - voiceMinutesAllowance);

    // 4. Provider Health Probes
    const dbHealth = await globalDb.healthCheck();
    const hasExotel = Boolean(process.env.EXOTEL_ACCOUNT_SID && process.env.EXOTEL_API_KEY);
    const hasSarvam = Boolean(process.env.SARVAM_API_KEY);
    const hasGemini = Boolean(process.env.GEMINI_API_KEY);

    // 5. Recent Audit Logs
    const auditLogs = await globalDb.getAuditLogs(orgId);
    const recentAuditChanges = auditLogs.slice(0, 10).map((a) => ({
      id: a.id,
      action: a.action,
      resourceType: a.resourceType,
      resourceId: a.resourceId || 'unknown',
      actorUserId: a.actorUserId,
      timestamp: a.createdAt,
      details: a.metadata,
    }));

    const summary: PilotOperationsSummaryDTO = {
      organizationId: orgId,
      totalWorkspaces: workspaces.length,
      workspacesByStatus: statusCounts,
      readyForTestingCount: statusCounts.READY_FOR_TESTING,
      readyForLiveCount: statusCounts.READY_FOR_LIVE_ACTIVATION,
      activeAgentsCount: statusCounts.ACTIVE,
      suspendedAgentsCount: statusCounts.SUSPENDED,
      callMetrics: {
        totalAttempted,
        completed,
        answered,
        unanswered,
        busy,
        failed,
        interrupted,
        confirmedDurationSeconds,
        meteredVoiceMinutes,
      },
      subscriptionUsage: {
        planId: sub?.planId || 'starter',
        planName: plan?.name || 'Starter Plan',
        voiceMinutesAllowance,
        voiceMinutesUsed: meteredVoiceMinutes,
        remainingAllowance,
        overageMinutes,
        status: sub?.status || 'ACTIVE',
      },
      providerHealth: {
        database: {
          status: dbHealth.ok ? 'HEALTHY' : 'DEGRADED',
          latencyMs: dbHealth.latencyMs !== undefined ? dbHealth.latencyMs : null,
          adapter: dbHealth.adapter,
        },
        telephony: {
          provider: 'exotel',
          configured: hasExotel,
          status: hasExotel ? 'READY' : (process.env.NODE_ENV === 'production' ? 'UNCONFIGURED' : 'SIMULATED'),
        },
        speechServices: {
          sttProvider: 'sarvam_stt',
          ttsProvider: 'sarvam_bulbul_v3',
          status: hasSarvam ? 'READY' : (process.env.NODE_ENV === 'production' ? 'UNCONFIGURED' : 'SIMULATED'),
        },
        languageModel: {
          provider: 'google_gemini_flash',
          status: hasGemini ? 'READY' : (process.env.NODE_ENV === 'production' ? 'UNCONFIGURED' : 'SIMULATED'),
        },
      },
      recentAuditChanges,
      workspaceBlockers: blockersPerWorkspace,
    };

    return reply.send({
      success: true,
      operations: summary,
    });
  });
}
