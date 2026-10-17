/**
 * @vanni/server — Multi-Tenant Client Workspaces & Onboarding Router (Prompt 03)
 *
 * Implements:
 * - GET    /api/workspaces           - List client workspaces for active organization
 * - POST   /api/workspaces           - Create new client workspace under organization
 * - GET    /api/workspaces/:id       - Get workspace details (strictly authorized)
 * - PUT    /api/workspaces/:id       - Update workspace / industry config
 * - DELETE /api/workspaces/:id       - Delete workspace (OWNER/ADMIN only)
 * - POST   /api/workspaces/:id/switch - Switch active client context
 * - GET    /api/onboarding/state     - Retrieve resumable onboarding progress
 * - POST   /api/onboarding/step      - Idempotent step-saving with server validation
 * - GET    /api/onboarding/templates - Data-driven starter templates for industries
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import { globalDb } from '@vanni/database';
import {
  AuthSessionDTO,
  ClientWorkspaceDTO,
  BusinessModelType,
  IndustryCategory,
  IndustrySubcategory,
  CreateClientWorkspaceInputSchema,
  SaveOnboardingStepInputSchema,
  StarterTemplateDTO,
} from '@vanni/shared';
import {
  SESSION_COOKIE_NAME,
  DEFAULT_COOKIE_OPTIONS,
} from '@vanni/auth';
import { getSessionFromRequest } from '../http-auth.js';

// Curated starter templates tailored to Karnataka voice AI
const STARTER_TEMPLATES: StarterTemplateDTO[] = [
  {
    id: 'lead-followup',
    title: 'Speed-to-Lead Follow-up Agent',
    description: 'Instant bilingual callback agent contacting enquiries within 15 seconds of form fill.',
    industryCategory: 'REAL_ESTATE',
    subcategory: 'SALES',
    recommendedDialect: 'KANGLISH_BUSINESS',
    defaultAgentName: 'Sahana',
    sampleUseCases: ['Meta Lead Ad instant callbacks', 'Website plot enquiry follow-up', 'Housing portal lead triage'],
    capabilities: ['Sub-120ms latency', 'Weekend site-visit scheduling', 'WhatsApp brochure dispatch'],
  },
  {
    id: 'property-qualification',
    title: 'Plot & Villa Qualification Desk',
    description: 'Conversational agent qualifying plot dimensions (30x40, 40x60), budget, and bank loan needs.',
    industryCategory: 'REAL_ESTATE',
    subcategory: 'DEVELOPER',
    recommendedDialect: 'KANGLISH_BUSINESS',
    defaultAgentName: 'Sahana',
    sampleUseCases: ['Siruguppa Road layout inquiries', 'DC conversion & RERA approval questions', 'Down-payment triage'],
    capabilities: ['Price per sqft quote', 'Free Sunday cab coordination', 'CRM lead ranking (HOT/WARM/COLD)'],
  },
  {
    id: 'appointment-coordination',
    title: 'Clinic Appointment Coordinator',
    description: 'Polite Kannada healthcare receptionist coordinating doctor consultations, token numbers, and timings.',
    industryCategory: 'HEALTHCARE',
    subcategory: 'HOSPITAL',
    recommendedDialect: 'KANNADA_STANDARD_POLITE',
    defaultAgentName: 'Kavya',
    sampleUseCases: ['Outpatient consultation booking', 'Duty doctor availability', 'Clinic timing verification'],
    capabilities: ['Multi-slot scheduling', 'Consultation fee quotation', 'Instant SMS/WhatsApp token confirmation'],
  },
  {
    id: 'inbound-receptionist',
    title: 'Dental & Specialty Triage Receptionist',
    description: 'Specialized clinic receptionist for root canals, teeth cleaning, and emergency toothache triage.',
    industryCategory: 'HEALTHCARE',
    subcategory: 'DENTAL',
    recommendedDialect: 'KANNADA_STANDARD_POLITE',
    defaultAgentName: 'Priya',
    sampleUseCases: ['Toothache emergency handling', 'Implant consultation enquiry', 'Evening clinic appointment booking'],
    capabilities: ['Emergency instant transfer', 'Doctor specialization matching', 'Appointment reschedule/cancellation'],
  },
  {
    id: 'client-acquisition-agency',
    title: 'Agency Inbound Client Qualifier',
    description: 'Digital agency representative qualifying brand marketing budgets, PPC requirements, and retainer scopes.',
    industryCategory: 'DIGITAL_AGENCY',
    subcategory: 'MARKETING_AGENCY',
    recommendedDialect: 'KANGLISH_BUSINESS',
    defaultAgentName: 'Arjun',
    sampleUseCases: ['Inbound marketing client calls', 'Voice AI reseller inquiries', 'Performance marketing audit booking'],
    capabilities: ['Budget tier qualification', 'Multi-client attribution', 'Automated proposal discovery'],
  },
];

export async function registerWorkspaceRoutes(fastify: FastifyInstance): Promise<void> {
  // 1. GET /api/workspaces: List all client workspaces for active organization
  fastify.get('/api/workspaces', async (req: FastifyRequest, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const orgId = session.activeOrganizationId;
    const workspaces = await globalDb.getClientWorkspacesByOrg(orgId);
    return reply.send({ success: true, workspaces });
  });

  // 2. POST /api/workspaces: Create new client workspace under organization
  fastify.post('/api/workspaces', async (req: FastifyRequest, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    if (session.activeRole === 'VIEWER') {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Viewers cannot create workspaces.' });
    }

    const parsed = CreateClientWorkspaceInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message || 'Invalid workspace payload',
      });
    }

    const orgId = session.activeOrganizationId;
    const {
      name,
      modelType,
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
      .slice(0, 50) || 'workspace';

    const newWorkspace: ClientWorkspaceDTO = {
      id: `ws_${crypto.randomUUID()}`,
      organizationId: orgId,
      name,
      slug: `${slug}-${Date.now().toString(36)}`,
      modelType: modelType as BusinessModelType,
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

    await globalDb.saveClientWorkspace(newWorkspace);
    fastify.log.info({ workspaceId: newWorkspace.id, orgId }, '[Workspace Created]');

    return reply.status(201).send({ success: true, workspace: newWorkspace });
  });

  // 3. GET /api/workspaces/:id: Get specific workspace details (with strict tenant membership authorization)
  fastify.get('/api/workspaces/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const { id } = req.params as { id: string };
    const workspace = await globalDb.getClientWorkspaceById(id);
    if (!workspace) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Client workspace not found' });
    }

    // Verify caller belongs to the owning organization
    const hasAccess = session.memberships.some((m: any) => m.organizationId === workspace.organizationId);
    if (!hasAccess) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Access denied to this workspace' });
    }

    return reply.send({ success: true, workspace });
  });

  // 4. PUT /api/workspaces/:id: Update workspace / industry config
  fastify.put('/api/workspaces/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    if (session.activeRole === 'VIEWER') {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Viewers cannot modify workspaces.' });
    }

    const { id } = req.params as { id: string };
    const workspace = await globalDb.getClientWorkspaceById(id);
    if (!workspace) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Client workspace not found' });
    }

    const hasAccess = session.memberships.some((m: any) => m.organizationId === workspace.organizationId);
    if (!hasAccess) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Access denied to this workspace' });
    }

    const body = (req.body as Partial<ClientWorkspaceDTO>) || {};
    // Never allow updating id or foreign organizationId
    delete (body as any).id;
    delete (body as any).organizationId;

    const updated = await globalDb.updateClientWorkspace(id, body, workspace.organizationId);
    return reply.send({ success: true, workspace: updated });
  });

  // 5. DELETE /api/workspaces/:id: Delete workspace (OWNER or ADMIN only)
  fastify.delete('/api/workspaces/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    if (session.activeRole !== 'OWNER' && session.activeRole !== 'ADMIN') {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Only organization owners and admins can remove workspaces.' });
    }

    const { id } = req.params as { id: string };
    const workspace = await globalDb.getClientWorkspaceById(id);
    if (!workspace) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Client workspace not found' });
    }

    const hasAccess = session.memberships.some((m: any) => m.organizationId === workspace.organizationId);
    if (!hasAccess) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Access denied to this workspace' });
    }

    await globalDb.deleteClientWorkspace(id, workspace.organizationId);
    return reply.send({ success: true, message: 'Client workspace deleted successfully' });
  });

  // 6. POST /api/workspaces/:id/switch: Safely set active client workspace context
  fastify.post('/api/workspaces/:id/switch', async (req: FastifyRequest, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const { id } = req.params as { id: string };
    const workspace = await globalDb.getClientWorkspaceById(id);
    if (!workspace) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Client workspace not found' });
    }

    const hasAccess = session.memberships.some((m: any) => m.organizationId === workspace.organizationId);
    if (!hasAccess) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Access denied to this workspace' });
    }

    reply.setCookie('vanni_active_workspace', id, {
      ...DEFAULT_COOKIE_OPTIONS,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return reply.send({
      success: true,
      activeWorkspace: workspace,
      organizationId: workspace.organizationId,
    });
  });

  // 7. GET /api/onboarding/state: Retrieve current onboarding progress for organization & workspaces
  fastify.get('/api/onboarding/state', async (req: FastifyRequest, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const orgId = session.activeOrganizationId;
    const workspaces = await globalDb.getClientWorkspacesByOrg(orgId);

    // Read active workspace cookie or pick the first workspace
    const cookieWorkspaceId = req.cookies['vanni_active_workspace'];
    let activeWorkspace = workspaces.find((w) => w.id === cookieWorkspaceId) || workspaces[0] || null;

    const currentStep = activeWorkspace ? activeWorkspace.onboardingStep : 1;
    const isCompleted = activeWorkspace ? activeWorkspace.onboardingCompleted : false;

    return reply.send({
      success: true,
      organizationId: orgId,
      organizationName: session.memberships.find((m: any) => m.organizationId === orgId)?.organizationName || 'My Organization',
      currentStep,
      isCompleted,
      activeWorkspace,
      workspaces,
    });
  });

  // 8. POST /api/onboarding/step: Save onboarding step data idempotently
  fastify.post('/api/onboarding/step', async (req: FastifyRequest, reply: FastifyReply) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    if (session.activeRole === 'VIEWER') {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Viewers cannot modify onboarding configuration.' });
    }

    const parsed = SaveOnboardingStepInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message || 'Invalid step payload',
      });
    }

    const orgId = session.activeOrganizationId;
    const { step, workspaceId, data, complete } = parsed.data;

    let targetWorkspace: ClientWorkspaceDTO | null = null;

    if (workspaceId) {
      targetWorkspace = await globalDb.getClientWorkspaceById(workspaceId);
      if (!targetWorkspace || targetWorkspace.organizationId !== orgId) {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'Workspace does not belong to your organization.' });
      }
    } else {
      // Look for an existing workspace or create an initial one
      const existing = await globalDb.getClientWorkspacesByOrg(orgId);
      if (existing.length > 0) {
        targetWorkspace = existing[0];
      } else {
        // Auto-create initial workspace from submitted onboarding data
        const modelType: BusinessModelType = data.modelType === 'AGENCY' ? 'AGENCY' : 'DIRECT_BUSINESS';
        const industryCategory: IndustryCategory =
          data.industryCategory || (data.modelType === 'AGENCY' ? 'DIGITAL_AGENCY' : (data.industry === 'HEALTHCARE' ? 'HEALTHCARE' : 'REAL_ESTATE'));
        const subcategory: IndustrySubcategory =
          data.subcategory || (industryCategory === 'HEALTHCARE' ? 'DENTAL' : (industryCategory === 'REAL_ESTATE' ? 'DEVELOPER' : 'MARKETING_AGENCY'));

        const wsName = data.clientName || data.businessName || data.organizationName || 'Primary Workspace';
        const slug = wsName.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').slice(0, 50) || 'workspace';

        targetWorkspace = {
          id: `ws_${crypto.randomUUID()}`,
          organizationId: orgId,
          name: wsName,
          slug: `${slug}-${Date.now().toString(36)}`,
          modelType,
          industryCategory,
          subcategory,
          operatingLocation: data.operatingLocation || 'Karnataka, India',
          primaryPhone: data.primaryPhone || '+91 80 4719 2000',
          primaryEmail: data.primaryEmail,
          timezone: data.timezone || 'Asia/Kolkata',
          languagePreferences: {
            primary: data.primaryLanguage || 'kn-IN',
            conversationalStyle: data.conversationalStyle || 'POLITE_BUSINESS',
            regionalDialect: data.regionalDialect || 'KANGLISH_BUSINESS',
          },
          startingTemplateId: data.startingTemplateId || (industryCategory === 'HEALTHCARE' ? 'appointment-coordination' : 'lead-followup'),
          onboardingStep: step,
          onboardingCompleted: Boolean(complete || step >= 7),
          onboardingData: { ...data },
          aiEmployee: {
            name: data.agentName || (industryCategory === 'HEALTHCARE' ? 'Kavya' : 'Sahana'),
            gender: 'FEMALE',
            speakerId: 'meera',
            engine: 'sarvam_bulbul_v2',
            status: Boolean(complete || step >= 7) ? 'READY' : 'DRAFT',
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await globalDb.saveClientWorkspace(targetWorkspace);
      }
    }

    if (targetWorkspace) {
      const mergedData = { ...(targetWorkspace.onboardingData || {}), ...data };
      const isComplete = Boolean(complete || step >= 7);

      const updates: Partial<ClientWorkspaceDTO> = {
        onboardingStep: Math.max(targetWorkspace.onboardingStep, step),
        onboardingCompleted: isComplete || targetWorkspace.onboardingCompleted,
        onboardingData: mergedData,
      };

      if (data.businessName || data.clientName) {
        updates.name = data.businessName || data.clientName;
      }
      if (data.industryCategory) {
        updates.industryCategory = data.industryCategory;
      }
      if (data.subcategory) {
        updates.subcategory = data.subcategory;
      }
      if (data.primaryPhone) {
        updates.primaryPhone = data.primaryPhone;
      }
      if (data.languagePreferences) {
        updates.languagePreferences = {
          ...targetWorkspace.languagePreferences,
          ...data.languagePreferences,
        };
      }
      if (data.startingTemplateId) {
        updates.startingTemplateId = data.startingTemplateId;
      }
      if (data.agentName) {
        updates.aiEmployee = {
          ...(targetWorkspace.aiEmployee || {
            name: 'Sahana',
            gender: 'FEMALE',
            speakerId: 'meera',
            engine: 'sarvam_bulbul_v2',
            status: 'DRAFT',
          }),
          name: data.agentName,
          status: isComplete ? 'READY' : 'DRAFT',
        };
      }

      const updatedWs = await globalDb.updateClientWorkspace(targetWorkspace.id, updates, orgId);

      // Set cookie for continuity
      reply.setCookie('vanni_active_workspace', targetWorkspace.id, {
        ...DEFAULT_COOKIE_OPTIONS,
        maxAge: 60 * 60 * 24 * 30,
      });

      return reply.send({
        success: true,
        step,
        nextStep: Math.min(7, step + 1),
        isComplete: updatedWs.onboardingCompleted,
        workspace: updatedWs,
      });
    }

    return reply.status(500).send({ error: 'SERVER_ERROR', message: 'Failed to process onboarding step.' });
  });

  // 9. GET /api/onboarding/templates: List data-driven starter templates
  fastify.get('/api/onboarding/templates', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { industry?: string; subcategory?: string };
    let list = [...STARTER_TEMPLATES];

    if (query?.industry) {
      list = list.filter((t) => t.industryCategory === query.industry);
    }
    if (query?.subcategory) {
      list = list.filter((t) => t.subcategory === query.subcategory);
    }

    return reply.send({ success: true, templates: list });
  });
}
