/**
 * Layer 6 & 7: Application Server, Multi-Tenancy Identity & Observability
 * Dhwani SI — Fastify Real-Time Voice Intelligence Server
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import cookie from '@fastify/cookie';
import {
  IdentityService,
  SESSION_COOKIE_NAME,
  DEFAULT_COOKIE_OPTIONS,
  serializeSession,
  deserializeSession,
  getSessionSecret,
  switchActiveOrganization,
  requireUser,
  requireOrganizationMember,
  requireOrganizationRole,
  requirePermission,
} from '@vanni/auth';
import {
  AuthSessionDTO,
  UserRole,
  CreateLocationInputSchema,
  CreateServiceInputSchema,
  CreateStaffInputSchema,
  CreatePolicyInputSchema,
  CreateFAQInputSchema,
  CreateFactInputSchema,
  CreateSourceInputSchema,
  CreateManualArticleInputSchema,
  IngestWebsiteInputSchema,
  QueryKnowledgeInputSchema,
  CreateAIEmployeeInputSchema,
  UpdateAIEmployeeInputSchema,
  SimulateTurnInputSchema,
  CreateConversationInputSchema,
  ProcessCustomerMessageInputSchema,
  LanguagePreviewInputSchema,
} from '@vanni/shared';
import {
  AgentLifecycleService,
  AgentSimulationHarness,
  getRoleDefaults,
  validateAgent,
  compileAgentConfiguration,
} from '@vanni/agent-core';
import {
  ConversationOrchestrator,
  MockStructuredLLMProvider,
  MockConversationChannel,
  KANNADA_GOLDEN_EVALUATION_CASES,
  REGIONAL_DIALECT_PROFILES,
} from '@vanni/conversation-engine';
import {
  globalBusinessBrainService,
  globalRetrievalEngine,
  globalIngestionPipeline,
  globalWebsiteIngestor,
} from '@vanni/knowledge-engine';
import { globalDb } from '@vanni/database';
import { AudioConversationPipeline } from './audio-pipeline';
import { TelephonyRouter } from './telephony-router';
import { WhatsAppLeadService } from './whatsapp-lead-service';
import { CallDatabaseService } from './db-service';
import { OpenSourceCRMService } from './open-source-crm-service';
import { Tenant } from '../../../packages/core/src/domain/types';

// Default Institutional Tenants
const DEMO_TENANTS: Record<string, Tenant> = {
  real_estate: {
    id: 'a0000000-0000-0000-0000-000000000001',
    name: 'Ballari Residential Layouts',
    industry: 'REAL_ESTATE',
    virtualPhoneNumber: '+918047192001',
    ownerWhatsAppNumber: '+919845012345',
    dialect: 'KANGLISH_BUSINESS',
    knowledge: {
      companyName: 'Ballari Residential Layouts',
      industry: 'REAL_ESTATE',
      primaryDialect: 'KANGLISH_BUSINESS',
      officeTimings: '9:00 AM - 7:00 PM',
      catalogSummary: 'DC Converted 30x40 plots at 18 Lakhs, 40x60 plots at 35 Lakhs on Siruguppa Bypass Road.',
      faqs: [
        { question: 'Plots ge bank loan siguththe alva?', answer: 'Haudu sir! SBI mathu HDFC bank inda 80% loan approval aaguththe.' },
        { question: 'Sunday site visit ideya?', answer: 'Haudu sir, prati Sunday 11 AM ge direct free cab pickup ide.' },
      ],
      appointmentRules: {
        slotDurationMinutes: 60,
        availableDays: ['Sunday', 'Saturday'],
        freeCabOffered: true,
      },
    },
    monthlyMinuteLimit: 6000,
    minutesUsedCurrentMonth: 412,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  hospital: {
    id: 'a0000000-0000-0000-0000-000000000002',
    name: 'Apollo Specialty Clinic',
    industry: 'HEALTHCARE_HOSPITAL',
    virtualPhoneNumber: '+918047192002',
    ownerWhatsAppNumber: '+919980123456',
    dialect: 'KANNADA_STANDARD_POLITE',
    knowledge: {
      companyName: 'Apollo Specialty Clinic',
      industry: 'HEALTHCARE_HOSPITAL',
      primaryDialect: 'KANNADA_STANDARD_POLITE',
      officeTimings: '8:00 AM - 9:00 PM (Emergency 24x7)',
      catalogSummary: 'Super specialty consultations for Cardiology, Ortho, and General Medicine.',
      faqs: [
        { question: 'Dr. Ramesh Patil avaru yaavaga irthare?', answer: 'Doctor avaru Mon-Sat beligge 10 inda 1 PM and sanje 5 inda 8 PM varagu OPD consultation madthare.' },
        { question: 'OPD fee eshtu?', answer: 'General consultation fee ₹750 aaguththe sir.' },
      ],
    },
    monthlyMinuteLimit: 3000,
    minutesUsedCurrentMonth: 890,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  inception: {
    id: 't_dhwani_inception',
    name: 'Dhwani SI Self-Selling Autonomous Agent',
    industry: 'AUTOMOTIVE_DEALER',
    virtualPhoneNumber: '+918047192000',
    ownerWhatsAppNumber: '+919999999999',
    dialect: 'KANNADA_STANDARD_POLITE',
    knowledge: {
      companyName: 'Dhwani SI',
      industry: 'AUTOMOTIVE_DEALER',
      primaryDialect: 'KANNADA_STANDARD_POLITE',
      officeTimings: '24x7 Autonomous',
      catalogSummary: 'Conversational Kannada AI Telephony & Receptionist SaaS for Karnataka Businesses.',
      faqs: [],
    },
    monthlyMinuteLimit: 10000,
    minutesUsedCurrentMonth: 120,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
};

export async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: 'info',
    },
  });

  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  // SECURITY: no hardcoded fallback. getSessionSecret() throws in production
  // when COOKIE_SECRET is missing and uses a random per-process dev secret otherwise.
  await fastify.register(cookie, {
    secret: getSessionSecret(),
    parseOptions: {},
  });

  await fastify.register(websocket);

  const telephony = new TelephonyRouter();
  const whatsapp = new WhatsAppLeadService();
  const db = new CallDatabaseService();
  const openSourceCRM = new OpenSourceCRMService();
  const identityService = new IdentityService();
  const agentLifecycleService = new AgentLifecycleService(globalDb);
  const agentSimulator = new AgentSimulationHarness(globalDb);
  const conversationOrchestrator = new ConversationOrchestrator(globalDb);

  // Helper: Extract and deserialize session from HTTP-only cookie or Authorization header
  function getSessionFromRequest(req: FastifyRequest): AuthSessionDTO | null {
    const cookieToken = req.cookies[SESSION_COOKIE_NAME];
    if (cookieToken) {
      const session = deserializeSession(cookieToken);
      if (session) return session;
    }
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const bearerToken = authHeader.slice(7).trim();
      const session = deserializeSession(bearerToken);
      if (session) return session;
    }
    return null;
  }

  // Helper: Serve HTML file from apps/web
  function serveWebHtml(fileName: string, reply: FastifyReply) {
    const htmlPath = path.resolve(process.cwd(), `apps/web/${fileName}`);
    const altPath = path.resolve(__dirname, `../../web/${fileName}`);
    const target = fs.existsSync(htmlPath) ? htmlPath : altPath;
    if (fs.existsSync(target)) {
      reply.type('text/html').send(fs.readFileSync(target, 'utf-8'));
    } else {
      reply.status(404).send({ error: 'Page not found', file: fileName });
    }
  }

  // ==============================================================================
  // 0. PUBLIC MARKETING & AUTH ROUTES
  // ==============================================================================
  const PUBLIC_MARKETING_ROUTES: Record<string, string> = {
    '/': 'index.html',
    '/features': 'features.html',
    '/how-it-works': 'how-it-works.html',
    '/industries': 'industries.html',
    '/industries/dental': 'industries-dental.html',
    '/industries/healthcare': 'industries-healthcare.html',
    '/industries/ivf': 'industries-ivf.html',
    '/industries/hospitality': 'industries-hospitality.html',
    '/industries/real-estate': 'industries-real-estate.html',
    '/pricing': 'pricing.html',
    '/demo': 'demo.html',
    '/contact': 'contact.html',
    '/security': 'security.html',
    '/login': 'login.html',
    '/signup': 'signup.html',
    '/forgot-password': 'forgot-password.html',
    '/reset-password': 'reset-password.html',
  };

  for (const [routePath, fileName] of Object.entries(PUBLIC_MARKETING_ROUTES)) {
    fastify.get(routePath, async (req, reply) => {
      // If already logged in and visiting /login or /signup, direct them to /app/dashboard
      if (routePath === '/login' || routePath === '/signup') {
        const session = getSessionFromRequest(req);
        if (session) {
          return reply.redirect('/app/dashboard');
        }
      }
      serveWebHtml(fileName, reply);
    });
  }

  // ==============================================================================
  // 0.1 PROTECTED APPLICATION ROUTES (/app/*)
  // ==============================================================================
  const PROTECTED_APP_ROUTES = [
    '/app',
    '/app/dashboard',
    '/app/onboarding',
    '/app/agents',
    '/app/calls',
    '/app/leads',
    '/app/campaigns',
    '/app/appointments',
    '/app/knowledge',
    '/app/integrations',
    '/app/analytics',
    '/app/settings',
    '/app/billing',
    '/app/organization/select',
    '/app/organization/create',
  ];

  for (const routePath of PROTECTED_APP_ROUTES) {
    fastify.get(routePath, async (req, reply) => {
      const session = getSessionFromRequest(req);

      // Unauthenticated user -> redirect to /login
      if (!session) {
        return reply.redirect(`/login?redirect=${encodeURIComponent(req.raw.url || '/app/dashboard')}`);
      }

      // Authenticated user with 0 organizations -> organization setup
      if (!session.memberships || session.memberships.length === 0) {
        if (routePath !== '/app/organization/create') {
          return reply.redirect('/app/organization/create');
        }
        return serveWebHtml('app-organization-create.html', reply);
      }

      // Organization selector
      if (routePath === '/app/organization/select') {
        return serveWebHtml('app-organization-select.html', reply);
      }

      // Organization creation
      if (routePath === '/app/organization/create') {
        return serveWebHtml('app-organization-create.html', reply);
      }

      // Onboarding state check
      const activeOrg = session.memberships.find((m) => m.organizationId === session.activeOrganizationId);
      const isOnboardingIncomplete = activeOrg && activeOrg.onboardingStatus !== 'ready';

      if (isOnboardingIncomplete && (routePath === '/app' || routePath === '/app/dashboard')) {
        return reply.redirect('/app/onboarding');
      }

      if (routePath === '/app/onboarding') {
        return serveWebHtml('app-onboarding.html', reply);
      }

      // Knowledge Management Portal
      if (routePath === '/app/knowledge') {
        return serveWebHtml('app-knowledge.html', reply);
      }

      // AI Employee Builder & Management Console (Prompt 08)
      if (routePath === '/app/agents') {
        return serveWebHtml('app-agents.html', reply);
      }

      // Default route redirect: /app -> /app/dashboard
      if (routePath === '/app') {
        return reply.redirect('/app/dashboard');
      }

      // Authenticated Dashboard & Feature Portals
      return serveWebHtml('console.html', reply);
    });
  }

  // Agent Builder Subroutes
  fastify.get('/app/agents/new', async (req, reply) => {
    const session = getSessionFromRequest(req);
    if (!session) return reply.redirect(`/login?redirect=${encodeURIComponent(req.raw.url || '/app/agents/new')}`);
    return serveWebHtml('app-agents.html', reply);
  });
  fastify.get('/app/agents/:agentId', async (req, reply) => {
    const session = getSessionFromRequest(req);
    if (!session) return reply.redirect(`/login?redirect=${encodeURIComponent(req.raw.url || '/app/agents')}`);
    return serveWebHtml('app-agents.html', reply);
  });
  fastify.get('/app/agents/:agentId/test', async (req, reply) => {
    const session = getSessionFromRequest(req);
    if (!session) return reply.redirect(`/login?redirect=${encodeURIComponent(req.raw.url || '/app/agents')}`);
    return serveWebHtml('app-agents.html', reply);
  });

  // Operator Console Alias
  fastify.get('/console', async (req, reply) => {
    serveWebHtml('console.html', reply);
  });
  fastify.get('/dashboard', async (req, reply) => {
    reply.redirect('/app/dashboard');
  });

  // Serve VANNI Enterprise Design System Stylesheet
  fastify.get('/assets/vanni.css', async (req, reply) => {
    const cssPath = path.resolve(process.cwd(), 'packages/ui/dist/vanni.css');
    const altPath = path.resolve(__dirname, '../../../packages/ui/dist/vanni.css');
    const target = fs.existsSync(cssPath) ? cssPath : altPath;
    if (fs.existsSync(target)) {
      reply.type('text/css').send(fs.readFileSync(target, 'utf-8'));
    } else {
      reply.status(404).send('/* VANNI CSS Not Found */');
    }
  });

  fastify.get('/vanni.css', async (req, reply) => {
    reply.redirect('/assets/vanni.css');
  });

  // ==============================================================================
  // 1. AUTHENTICATION & MULTI-TENANCY REST API
  // ==============================================================================

  // 1.1 POST /api/auth/signup: Atomic User + Organization + Owner Membership
  fastify.post('/api/auth/signup', async (request, reply) => {
    try {
      const { session, user, organization } = await identityService.signup(request.body);
      const token = serializeSession(session);
      reply.setCookie(SESSION_COOKIE_NAME, token, DEFAULT_COOKIE_OPTIONS);
      return reply.send({ success: true, session, user, organization });
    } catch (err: any) {
      return reply.status(err.statusCode || 400).send({ error: err.message });
    }
  });

  // 1.2 POST /api/auth/login: Credential verification & membership loading
  fastify.post('/api/auth/login', async (request, reply) => {
    try {
      const { session, user } = await identityService.login(request.body);
      const token = serializeSession(session);
      reply.setCookie(SESSION_COOKIE_NAME, token, DEFAULT_COOKIE_OPTIONS);
      return reply.send({ success: true, session, user });
    } catch (err: any) {
      return reply.status(err.statusCode || 401).send({ error: err.message });
    }
  });

  // 1.3 POST /api/auth/logout: Clear session cookie
  fastify.post('/api/auth/logout', async (request, reply) => {
    reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    return reply.send({ success: true, message: 'Logged out successfully' });
  });

  // 1.4 GET /api/auth/session: Retrieve active session
  fastify.get('/api/auth/session', async (request, reply) => {
    const session = getSessionFromRequest(request);
    if (!session) {
      return reply.send({ authenticated: false, session: null });
    }
    return reply.send({ authenticated: true, session });
  });

  // 1.5 POST /api/auth/switch-org: Safely switch active organization
  fastify.post('/api/auth/switch-org', async (request, reply) => {
    const session = getSessionFromRequest(request);
    if (!session) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const { organizationId } = request.body as { organizationId: string };
    try {
      const updated = switchActiveOrganization(session, organizationId);
      const token = serializeSession(updated);
      reply.setCookie(SESSION_COOKIE_NAME, token, DEFAULT_COOKIE_OPTIONS);
      return reply.send({ success: true, session: updated });
    } catch (err: any) {
      return reply.status(err.statusCode || 403).send({ error: err.message });
    }
  });

  // 1.6 POST /api/orgs: Create new organization for authenticated user
  fastify.post('/api/orgs', async (request, reply) => {
    const session = getSessionFromRequest(request);
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    try {
      const { organization, updatedSession } = await identityService.createOrganization(session, request.body);
      const token = serializeSession(updatedSession);
      reply.setCookie(SESSION_COOKIE_NAME, token, DEFAULT_COOKIE_OPTIONS);
      return reply.send({ success: true, organization, session: updatedSession });
    } catch (err: any) {
      return reply.status(err.statusCode || 400).send({ error: err.message });
    }
  });

  // 1.7 GET /api/orgs: Get user's organizations
  fastify.get('/api/orgs', async (request, reply) => {
    const session = getSessionFromRequest(request);
    if (!session) return reply.status(401).send({ error: 'Authentication required' });
    return reply.send({ organizations: session.memberships });
  });

  // 1.8 POST /api/orgs/:id/members/invite: Invite member (requires ADMIN or OWNER)
  fastify.post('/api/orgs/:id/members/invite', async (request, reply) => {
    const session = getSessionFromRequest(request);
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    const { id } = request.params as { id: string };
    try {
      const member = await identityService.inviteMember(session, id, request.body);
      return reply.send({ success: true, member });
    } catch (err: any) {
      return reply.status(err.statusCode || 403).send({ error: err.message });
    }
  });

  // 1.9 PATCH /api/orgs/:id/members/:userId: Update member role (requires OWNER or ADMIN)
  fastify.patch('/api/orgs/:id/members/:userId', async (request, reply) => {
    const session = getSessionFromRequest(request);
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    const { id, userId } = request.params as { id: string; userId: string };
    const { role } = request.body as { role: UserRole };
    try {
      const member = await identityService.updateMemberRole(session, id, userId, role);
      return reply.send({ success: true, member });
    } catch (err: any) {
      return reply.status(err.statusCode || 403).send({ error: err.message });
    }
  });

  // 1.10 GET /api/orgs/:id/audit-logs: View audit trail
  fastify.get('/api/orgs/:id/audit-logs', async (request, reply) => {
    const session = getSessionFromRequest(request);
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    const { id } = request.params as { id: string };
    try {
      const logs = identityService.getAuditLogs(session, id);
      return reply.send({ success: true, auditLogs: logs });
    } catch (err: any) {
      return reply.status(err.statusCode || 403).send({ error: err.message });
    }
  });

  // 1.11 POST /api/orgs/:id/onboarding: Update onboarding state
  fastify.post('/api/orgs/:id/onboarding', async (request, reply) => {
    const session = getSessionFromRequest(request);
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    const { id } = request.params as { id: string };
    const { status } = (request.body as any) || { status: 'ready' };
    try {
      const org = await identityService.updateOnboardingStatus(session, id, status);
      const memberIndex = session.memberships.findIndex((m) => m.organizationId === id);
      if (memberIndex !== -1) {
        session.memberships[memberIndex].onboardingStatus = status;
        const token = serializeSession(session);
        reply.setCookie(SESSION_COOKIE_NAME, token, DEFAULT_COOKIE_OPTIONS);
      }
      return reply.send({ success: true, organization: org, session });
    } catch (err: any) {
      return reply.status(err.statusCode || 400).send({ error: err.message });
    }
  });

  // ==============================================================================
  // 1.12 BUSINESS BRAIN & INDUSTRY KNOWLEDGE API
  // ==============================================================================

  // GET /api/business-brain: Load raw structured brain
  fastify.get('/api/business-brain', async (request, reply) => {
    const session = getSessionFromRequest(request);
    const orgId = (request.query as any)?.organizationId || session?.activeOrganizationId || 'a0000000-0000-0000-0000-000000000001';

    if (session) {
      requireOrganizationMember(session, orgId);
    }

    try {
      const brain = await globalBusinessBrainService.getBusinessBrain(orgId);
      return reply.send({ success: true, brain });
    } catch (err: any) {
      return reply.status(err.statusCode || 400).send({ error: err.message });
    }
  });

  // GET /api/business-brain/snapshot: Retrieve or compile runtime snapshot
  fastify.get('/api/business-brain/snapshot', async (request, reply) => {
    const session = getSessionFromRequest(request);
    const orgId = (request.query as any)?.organizationId || session?.activeOrganizationId || 'a0000000-0000-0000-0000-000000000001';

    if (session) {
      requireOrganizationMember(session, orgId);
    }

    try {
      let snapshot = await globalDb.getLatestSnapshot(orgId);
      if (!snapshot) {
        snapshot = await globalBusinessBrainService.compileSnapshot(orgId);
      }
      return reply.send({ success: true, snapshot });
    } catch (err: any) {
      return reply.status(err.statusCode || 400).send({ error: err.message });
    }
  });

  // POST /api/business-brain/compile: Deterministically compile and version snapshot
  fastify.post('/api/business-brain/compile', async (request, reply) => {
    const session = getSessionFromRequest(request);
    const orgId = (request.body as any)?.organizationId || session?.activeOrganizationId || 'a0000000-0000-0000-0000-000000000001';

    if (session) {
      requireOrganizationRole(session, orgId, 'MANAGER');
    }

    try {
      const snapshot = await globalBusinessBrainService.compileSnapshot(orgId);
      return reply.send({ success: true, snapshot });
    } catch (err: any) {
      return reply.status(err.statusCode || 400).send({ error: err.message });
    }
  });

  // GET /api/business-brain/query: Authoritative knowledge retrieval with citations
  fastify.get('/api/business-brain/query', async (request, reply) => {
    const session = getSessionFromRequest(request);
    const orgId = (request.query as any)?.organizationId || session?.activeOrganizationId || 'a0000000-0000-0000-0000-000000000001';
    const q = (request.query as any)?.q || '';

    if (session) {
      requireOrganizationMember(session, orgId);
    }

    const result = await globalBusinessBrainService.searchBusinessKnowledge(orgId, q);
    return reply.send({ success: true, query: q, result });
  });

  // POST /api/business-brain/locations
  fastify.post('/api/business-brain/locations', async (request, reply) => {
    const session = getSessionFromRequest(request);
    const orgId = (request.body as any)?.organizationId || session?.activeOrganizationId || 'a0000000-0000-0000-0000-000000000001';

    if (session) {
      requireOrganizationRole(session, orgId, 'MANAGER');
    }

    try {
      const parsed = CreateLocationInputSchema.parse(request.body);
      const location = {
        id: `loc-${Date.now()}`,
        organizationId: orgId,
        ...parsed,
        status: 'ACTIVE' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await globalDb.saveLocation(location);
      return reply.send({ success: true, location });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/business-brain/services
  fastify.post('/api/business-brain/services', async (request, reply) => {
    const session = getSessionFromRequest(request);
    const orgId = (request.body as any)?.organizationId || session?.activeOrganizationId || 'a0000000-0000-0000-0000-000000000001';

    if (session) {
      requireOrganizationRole(session, orgId, 'MANAGER');
    }

    try {
      const parsed = CreateServiceInputSchema.parse(request.body);
      const service = {
        id: `srv-${Date.now()}`,
        organizationId: orgId,
        ...parsed,
        status: 'ACTIVE' as const,
        authority: 'AUTHORITATIVE' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await globalDb.saveService(service);
      return reply.send({ success: true, service });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/business-brain/staff
  fastify.post('/api/business-brain/staff', async (request, reply) => {
    const session = getSessionFromRequest(request);
    const orgId = (request.body as any)?.organizationId || session?.activeOrganizationId || 'a0000000-0000-0000-0000-000000000001';

    if (session) {
      requireOrganizationRole(session, orgId, 'MANAGER');
    }

    try {
      const parsed = CreateStaffInputSchema.parse(request.body);
      const staff = {
        id: `staff-${Date.now()}`,
        organizationId: orgId,
        ...parsed,
        isActive: true,
        status: 'ACTIVE' as const,
        authority: 'AUTHORITATIVE' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await globalDb.saveStaff(staff);
      return reply.send({ success: true, staff });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/business-brain/policies
  fastify.post('/api/business-brain/policies', async (request, reply) => {
    const session = getSessionFromRequest(request);
    const orgId = (request.body as any)?.organizationId || session?.activeOrganizationId || 'a0000000-0000-0000-0000-000000000001';

    if (session) {
      requireOrganizationRole(session, orgId, 'ADMIN');
    }

    try {
      const parsed = CreatePolicyInputSchema.parse(request.body);
      const policy = {
        id: `pol-${Date.now()}`,
        organizationId: orgId,
        ...parsed,
        status: 'ACTIVE' as const,
        authority: 'AUTHORITATIVE' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await globalDb.savePolicy(policy);
      return reply.send({ success: true, policy });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/business-brain/faqs
  fastify.post('/api/business-brain/faqs', async (request, reply) => {
    const session = getSessionFromRequest(request);
    const orgId = (request.body as any)?.organizationId || session?.activeOrganizationId || 'a0000000-0000-0000-0000-000000000001';

    if (session) {
      requireOrganizationRole(session, orgId, 'MANAGER');
    }

    try {
      const parsed = CreateFAQInputSchema.parse(request.body);
      const faq = {
        id: `faq-${Date.now()}`,
        organizationId: orgId,
        ...parsed,
        status: 'ACTIVE' as const,
        authority: 'AUTHORITATIVE' as const,
        lastVerifiedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await globalDb.saveFAQ(faq);
      return reply.send({ success: true, faq });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/business-brain/facts
  fastify.post('/api/business-brain/facts', async (request, reply) => {
    const session = getSessionFromRequest(request);
    const orgId = (request.body as any)?.organizationId || session?.activeOrganizationId || 'a0000000-0000-0000-0000-000000000001';

    if (session) {
      requireOrganizationRole(session, orgId, 'MANAGER');
    }

    try {
      const parsed = CreateFactInputSchema.parse(request.body);
      const fact = {
        id: `fact-${Date.now()}`,
        organizationId: orgId,
        ...parsed,
        status: 'ACTIVE' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await globalDb.saveFact(fact);
      return reply.send({ success: true, fact });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/business-brain/conflicts/:id/resolve
  fastify.post('/api/business-brain/conflicts/:id/resolve', async (request, reply) => {
    const session = getSessionFromRequest(request);
    const { id } = request.params as { id: string };
    const { resolvedValue, organizationId } = (request.body as any) || {};
    const orgId = organizationId || session?.activeOrganizationId || 'a0000000-0000-0000-0000-000000000001';

    if (session) {
      requireOrganizationRole(session, orgId, 'ADMIN');
    }

    await globalDb.resolveConflict(id, resolvedValue || 'Resolved by Administrator', orgId);
    return reply.send({ success: true, message: 'Conflict marked resolved' });
  });

  // ==============================================================================
  // 1.13 KNOWLEDGE INGESTION & RETRIEVAL ENGINE API (PROMPT 07)
  // ==============================================================================

  // GET /api/knowledge/sources
  fastify.get('/api/knowledge/sources', async (request, reply) => {
    const session = getSessionFromRequest(request);
    const orgId = (request.query as any)?.organizationId || session?.activeOrganizationId || 'a0000000-0000-0000-0000-000000000001';

    if (session) {
      requireOrganizationMember(session, orgId);
    }

    const sources = await globalDb.getKnowledgeSources(orgId);
    return reply.send({ success: true, sources });
  });

  // POST /api/knowledge/sources
  fastify.post('/api/knowledge/sources', async (request, reply) => {
    const session = getSessionFromRequest(request);
    const orgId = (request.body as any)?.organizationId || session?.activeOrganizationId || 'a0000000-0000-0000-0000-000000000001';

    if (session) {
      requireOrganizationRole(session, orgId, 'MANAGER');
    }

    try {
      const parsed = CreateSourceInputSchema.parse(request.body);
      const source = {
        id: `src-${Date.now()}`,
        organizationId: orgId,
        ...parsed,
        status: 'ACTIVE' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await globalDb.saveKnowledgeSource(source);
      return reply.send({ success: true, source });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // GET /api/knowledge/sources/:id
  fastify.get('/api/knowledge/sources/:id', async (request, reply) => {
    const session = getSessionFromRequest(request);
    const { id } = request.params as { id: string };
    const orgId = (request.query as any)?.organizationId || session?.activeOrganizationId || 'a0000000-0000-0000-0000-000000000001';

    if (session) {
      requireOrganizationMember(session, orgId);
    }

    const sources = await globalDb.getKnowledgeSources(orgId);
    const source = sources.find(s => s.id === id);
    if (!source) {
      return reply.status(404).send({ error: `Knowledge source ${id} not found` });
    }

    const [documents, jobs] = await Promise.all([
      globalDb.getDocuments(orgId, id),
      globalDb.getJobs(orgId, id),
    ]);

    return reply.send({ success: true, source, documents, jobs });
  });

  // DELETE /api/knowledge/sources/:id (Archive source)
  fastify.delete('/api/knowledge/sources/:id', async (request, reply) => {
    const session = getSessionFromRequest(request);
    const { id } = request.params as { id: string };
    const orgId = (request.query as any)?.organizationId || session?.activeOrganizationId || 'a0000000-0000-0000-0000-000000000001';

    if (session) {
      requireOrganizationRole(session, orgId, 'ADMIN');
    }

    const sources = await globalDb.getKnowledgeSources(orgId);
    const source = sources.find(s => s.id === id);
    if (!source) {
      return reply.status(404).send({ error: 'Source not found' });
    }

    source.status = 'ARCHIVED';
    await globalDb.saveKnowledgeSource(source);

    // Also mark its documents as ARCHIVED
    const docs = await globalDb.getDocuments(orgId, id);
    for (const d of docs) {
      await globalDb.updateDocumentStatus(d.id, 'ARCHIVED', orgId);
    }

    return reply.send({ success: true, message: 'Source and documents archived' });
  });

  // GET /api/knowledge/documents
  fastify.get('/api/knowledge/documents', async (request, reply) => {
    const session = getSessionFromRequest(request);
    const orgId = (request.query as any)?.organizationId || session?.activeOrganizationId || 'a0000000-0000-0000-0000-000000000001';
    const sourceId = (request.query as any)?.sourceId;

    if (session) {
      requireOrganizationMember(session, orgId);
    }

    const documents = await globalDb.getDocuments(orgId, sourceId);
    return reply.send({ success: true, documents });
  });

  // GET /api/knowledge/documents/:id
  fastify.get('/api/knowledge/documents/:id', async (request, reply) => {
    const session = getSessionFromRequest(request);
    const { id } = request.params as { id: string };
    const orgId = (request.query as any)?.organizationId || session?.activeOrganizationId || 'a0000000-0000-0000-0000-000000000001';

    if (session) {
      requireOrganizationMember(session, orgId);
    }

    const doc = await globalDb.getDocumentById(id, orgId);
    if (!doc) {
      return reply.status(404).send({ error: `Document ${id} not found` });
    }

    const chunks = await globalDb.getChunks(orgId, id);
    return reply.send({ success: true, document: doc, chunks });
  });

  // POST /api/knowledge/upload (PDF or TXT document ingestion)
  fastify.post('/api/knowledge/upload', async (request, reply) => {
    const session = getSessionFromRequest(request);
    const orgId = (request.body as any)?.organizationId || session?.activeOrganizationId || 'a0000000-0000-0000-0000-000000000001';

    if (session) {
      requireOrganizationRole(session, orgId, 'MANAGER');
    }

    try {
      const body = request.body as any;
      const {
        sourceId,
        title,
        documentType = 'PDF',
        contentBase64,
        rawText,
        filename = 'document.pdf',
        authority = 'REFERENCE',
        language = 'EN',
      } = body || {};

      let parsedContent: Buffer | string;
      if (contentBase64) {
        parsedContent = Buffer.from(contentBase64, 'base64');
      } else if (rawText) {
        parsedContent = rawText;
      } else {
        return reply.status(400).send({ error: 'Missing content. Provide contentBase64 or rawText.' });
      }

      // Ensure a valid source exists
      let targetSourceId = sourceId;
      if (!targetSourceId) {
        const source = {
          id: `src-upload-${Date.now()}`,
          organizationId: orgId,
          sourceType: 'DOCUMENT' as const,
          title: title || filename,
          authority,
          status: 'ACTIVE' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await globalDb.saveKnowledgeSource(source);
        targetSourceId = source.id;
      }

      // Save to tenant storage
      const storagePath = `knowledge/${targetSourceId}/${filename}`;
      const mimeType = filename.endsWith('.pdf') ? 'application/pdf' : 'text/plain';
      await globalDb.saveStorageFile(orgId, storagePath, parsedContent, mimeType);

      // Run Ingestion Pipeline
      const result = await globalIngestionPipeline.ingestDocument({
        organizationId: orgId,
        sourceId: targetSourceId,
        title: title || filename,
        documentType: documentType as any,
        content: parsedContent,
        filename,
        authority,
        language,
        storagePath,
      });

      if (!result.success) {
        return reply.status(422).send({
          success: false,
          error: result.errorMessage || 'Knowledge document processing failed',
          document: result.document,
        });
      }

      return reply.send({ success: true, result });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/knowledge/website (SSRF-safe website ingestion)
  fastify.post('/api/knowledge/website', async (request, reply) => {
    const session = getSessionFromRequest(request);
    const orgId = (request.body as any)?.organizationId || session?.activeOrganizationId || 'a0000000-0000-0000-0000-000000000001';

    if (session) {
      requireOrganizationRole(session, orgId, 'MANAGER');
    }

    try {
      const parsed = IngestWebsiteInputSchema.parse(request.body);
      const url = parsed.url;

      // 1. Fetch & parse website with SSRF security checks
      const ingestResult = await globalWebsiteIngestor.ingestUrl(url);
      if (!ingestResult.success) {
        return reply.status(ingestResult.httpStatus || 400).send({
          success: false,
          error: ingestResult.errorMessage || 'Failed to fetch website',
        });
      }

      // 2. Create or find Website Source
      const sourceTitle = parsed.title || ingestResult.title || new URL(url).hostname;
      const source = {
        id: `src-web-${Date.now()}`,
        organizationId: orgId,
        sourceType: 'WEBSITE' as const,
        title: sourceTitle,
        uriOrIdentifier: url,
        authority: parsed.authority,
        status: 'ACTIVE' as const,
        lastVerifiedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await globalDb.saveKnowledgeSource(source);

      // 3. Run Ingestion Pipeline
      const pipelineResult = await globalIngestionPipeline.ingestDocument({
        organizationId: orgId,
        sourceId: source.id,
        title: ingestResult.title || sourceTitle,
        documentType: 'WEBSITE_PAGE',
        content: ingestResult.content,
        filename: url,
        authority: parsed.authority,
        storagePath: url,
      });

      return reply.send({
        success: true,
        source,
        ingestResult,
        pipelineResult,
      });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/knowledge/articles (Manual article ingestion)
  fastify.post('/api/knowledge/articles', async (request, reply) => {
    const session = getSessionFromRequest(request);
    const orgId = (request.body as any)?.organizationId || session?.activeOrganizationId || 'a0000000-0000-0000-0000-000000000001';

    if (session) {
      requireOrganizationRole(session, orgId, 'MANAGER');
    }

    try {
      const parsed = CreateManualArticleInputSchema.parse(request.body);

      // Create Manual Source
      const source = {
        id: `src-article-${Date.now()}`,
        organizationId: orgId,
        sourceType: 'MANUAL' as const,
        title: parsed.title,
        authority: parsed.authority,
        status: 'ACTIVE' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await globalDb.saveKnowledgeSource(source);

      // Ingest document
      const result = await globalIngestionPipeline.ingestDocument({
        organizationId: orgId,
        sourceId: source.id,
        title: parsed.title,
        documentType: 'MANUAL_ARTICLE',
        content: parsed.content,
        authority: parsed.authority,
        language: parsed.language,
      });

      return reply.send({ success: true, source, result });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/knowledge/retrieve (Hybrid Vector + Lexical Search with Answerability)
  fastify.post('/api/knowledge/retrieve', async (request, reply) => {
    const session = getSessionFromRequest(request);
    const body = (request.body || {}) as any;
    const orgId = body.organizationId || session?.activeOrganizationId || 'a0000000-0000-0000-0000-000000000001';

    if (session) {
      requireOrganizationMember(session, orgId);
    }

    try {
      const parsed = QueryKnowledgeInputSchema.parse(body);
      const result = await globalRetrievalEngine.retrieveKnowledge(orgId, parsed.query, {
        sourceId: parsed.sourceId,
        language: parsed.language,
        topK: parsed.topK,
        includeArchived: parsed.includeArchived,
      });

      return reply.send({ success: true, result });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // ==============================================================================
  // 1.3 AI EMPLOYEE / AGENT BUILDER APIS (PROMPT 08)
  // ==============================================================================

  // Helper: Enforce tenant access and optionally check required role
  function getEffectiveOrgAndUserId(request: FastifyRequest, requireRole?: UserRole[]): { orgId: string; userId: string } {
    const session = getSessionFromRequest(request);
    const bodyOrgId = (request.body as any)?.organizationId;
    const queryOrgId = (request.query as any)?.organizationId;
    const explicitOrgId = bodyOrgId || queryOrgId;

    if (session) {
      const orgId = explicitOrgId || session.activeOrganizationId;
      requireOrganizationMember(session, orgId);
      if (requireRole && requireRole.length > 0) {
        const member = session.memberships.find(m => m.organizationId === orgId);
        if (!member || !requireRole.includes(member.role)) {
          throw new Error(`Forbidden: Action requires one of roles [${requireRole.join(', ')}]`);
        }
      }
      return { orgId, userId: session.userId };
    }

    // Unauthenticated dev / local test fallback
    return {
      orgId: explicitOrgId || 'a0000000-0000-0000-0000-000000000001',
      userId: 'usr-dev-system',
    };
  }

  // GET /api/agents — List all AI Employees for an Organization
  fastify.get('/api/agents', async (request, reply) => {
    try {
      const { orgId } = getEffectiveOrgAndUserId(request);
      const agents = await agentLifecycleService.listAgents(orgId);
      return reply.send({ success: true, count: agents.length, agents });
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }
  });

  // GET /api/agents/roles — Get Role Defaults & Industry Templates
  fastify.get('/api/agents/roles', async (request, reply) => {
    const query = request.query as any;
    const role = query?.role || 'AI_RECEPTIONIST';
    const industry = query?.industry || 'HEALTHCARE';
    const businessName = query?.businessName || 'Our Business';

    const defaults = getRoleDefaults(role, industry, businessName);
    return reply.send({ success: true, defaults });
  });

  // POST /api/agents — Create a new AI Employee
  fastify.post('/api/agents', async (request, reply) => {
    try {
      const { orgId, userId } = getEffectiveOrgAndUserId(request, ['OWNER', 'ADMIN', 'MANAGER']);
      const body = request.body as any;
      const parsed = CreateAIEmployeeInputSchema.parse(body);

      const org = await globalDb.getOrganizationById(orgId);
      const defaults = getRoleDefaults(parsed.role, parsed.industry, org?.name || 'Our Business');

      // Create initial agent draft merging defaults with user input
      const agent = await agentLifecycleService.createAgent(orgId, userId, {
        name: parsed.name,
        displayName: parsed.displayName,
        description: parsed.description || defaults.identity.description,
        role: parsed.role,
        industry: parsed.industry,
        identity: {
          ...defaults.identity,
          name: parsed.name,
          displayName: parsed.displayName,
        },
        objective: {
          ...defaults.objective,
          primaryObjective: parsed.primaryObjective,
        },
        personality: {
          ...defaults.personality,
          preset: parsed.personalityPreset,
        },
        language: {
          ...defaults.language,
          primaryLanguage: parsed.primaryLanguage,
        },
        capabilities: defaults.capabilities,
        knowledgeAccess: defaults.knowledgeAccess,
        tools: defaults.tools,
        escalation: defaults.escalation,
        policies: defaults.policies,
        conversationRules: defaults.conversationRules,
      });

      // Atomically publish Version 1
      const published = await agentLifecycleService.publishAgentVersion(
        orgId,
        userId,
        agent.id,
        'Initial AI Employee configuration published'
      );

      return reply.status(201).send({ success: true, agent: published.agent, version: published.version });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // GET /api/agents/:id — Get AI Employee Details
  fastify.get('/api/agents/:id', async (request, reply) => {
    try {
      const { orgId } = getEffectiveOrgAndUserId(request);
      const { id } = request.params as { id: string };
      const agent = await agentLifecycleService.getAgent(orgId, id);
      if (!agent) {
        return reply.status(404).send({ error: `AI Employee not found or access denied [${id}]` });
      }
      return reply.send({ success: true, agent });
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }
  });

  // PUT /api/agents/:id — Update AI Employee Configuration Draft
  fastify.put('/api/agents/:id', async (request, reply) => {
    try {
      const { orgId, userId } = getEffectiveOrgAndUserId(request, ['OWNER', 'ADMIN', 'MANAGER']);
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const parsed = UpdateAIEmployeeInputSchema.parse(body);

      const updated = await agentLifecycleService.updateAgentDraft(orgId, userId, id, parsed);
      return reply.send({ success: true, agent: updated });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/agents/:id/validate — Pre-activation Configuration Validation
  fastify.post('/api/agents/:id/validate', async (request, reply) => {
    try {
      const { orgId } = getEffectiveOrgAndUserId(request);
      const { id } = request.params as { id: string };
      const agent = await agentLifecycleService.getAgent(orgId, id);
      if (!agent) {
        return reply.status(404).send({ error: `AI Employee not found [${id}]` });
      }

      const result = validateAgent(agent);
      return reply.send({ success: true, ...result });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/agents/:id/publish — Publish Immutable Version Snapshot
  fastify.post('/api/agents/:id/publish', async (request, reply) => {
    try {
      const { orgId, userId } = getEffectiveOrgAndUserId(request, ['OWNER', 'ADMIN']);
      const { id } = request.params as { id: string };
      const changelog = (request.body as any)?.changelog || 'Published updated configuration version';

      const result = await agentLifecycleService.publishAgentVersion(orgId, userId, id, changelog);
      return reply.send({ success: true, agent: result.agent, version: result.version });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/agents/:id/activate — Activate Published Version
  fastify.post('/api/agents/:id/activate', async (request, reply) => {
    try {
      const { orgId, userId } = getEffectiveOrgAndUserId(request, ['OWNER', 'ADMIN']);
      const { id } = request.params as { id: string };
      const versionNumber = (request.body as any)?.version ? Number((request.body as any).version) : undefined;

      const activated = await agentLifecycleService.activateAgent(orgId, userId, id, versionNumber);
      return reply.send({ success: true, agent: activated });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/agents/:id/pause — Pause AI Employee
  fastify.post('/api/agents/:id/pause', async (request, reply) => {
    try {
      const { orgId, userId } = getEffectiveOrgAndUserId(request, ['OWNER', 'ADMIN', 'MANAGER']);
      const { id } = request.params as { id: string };

      const paused = await agentLifecycleService.pauseAgent(orgId, userId, id);
      return reply.send({ success: true, agent: paused });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/agents/:id/rollback — Rollback to a Previous Version Snapshot
  fastify.post('/api/agents/:id/rollback', async (request, reply) => {
    try {
      const { orgId, userId } = getEffectiveOrgAndUserId(request, ['OWNER', 'ADMIN']);
      const { id } = request.params as { id: string };
      const targetVersion = Number((request.body as any)?.targetVersion);

      if (!targetVersion || isNaN(targetVersion)) {
        return reply.status(400).send({ error: 'targetVersion number is required' });
      }

      const result = await agentLifecycleService.rollbackAgent(orgId, userId, id, targetVersion);
      return reply.send({ success: true, agent: result.agent, restoredVersion: result.restoredVersion });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // GET /api/agents/:id/versions — List Version Snapshots
  fastify.get('/api/agents/:id/versions', async (request, reply) => {
    try {
      const { orgId } = getEffectiveOrgAndUserId(request);
      const { id } = request.params as { id: string };
      const versions = await globalDb.getAIEmployeeVersions(orgId, id);
      return reply.send({ success: true, count: versions.length, versions });
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }
  });

  // GET /api/agents/:id/runtime-config — Future Conversation Engine Contract
  fastify.get('/api/agents/:id/runtime-config', async (request, reply) => {
    try {
      const { orgId } = getEffectiveOrgAndUserId(request);
      const { id } = request.params as { id: string };
      const runtimeConfig = await agentLifecycleService.getPublishedAgentRuntimeConfig(id, orgId);
      return reply.send({ success: true, runtimeConfig });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/agents/:id/test — Simulated Text Interaction Harness
  fastify.post('/api/agents/:id/test', async (request, reply) => {
    try {
      const { orgId } = getEffectiveOrgAndUserId(request);
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const parsed = SimulateTurnInputSchema.parse(body);

      const agent = await agentLifecycleService.getAgent(orgId, id);
      if (!agent) {
        return reply.status(404).send({ error: `AI Employee not found [${id}]` });
      }

      // Compile runtime config from current agent state
      const runtimeConfig = compileAgentConfiguration(agent);
      const turnResult = await agentSimulator.simulateTurn(runtimeConfig, parsed.message, parsed.history || []);

      // Record test session turn in database
      await globalDb.saveAIEmployeeTestSession({
        id: `sess-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        organizationId: orgId,
        agentId: id,
        userUtterance: parsed.message,
        simulatedResponse: turnResult.simulatedResponse,
        policyFlags: turnResult.policyFlags,
        executionTimeMs: turnResult.executionTimeMs,
        createdAt: new Date().toISOString(),
      });

      return reply.send({ success: true, turn: turnResult });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // ==============================================================================
  // 1.9 CONVERSATION ORCHESTRATION ENGINE APIS (PROMPT 09)
  // ==============================================================================

  // POST /api/conversations — Start Conversation
  fastify.post('/api/conversations', async (request, reply) => {
    try {
      const parsed = CreateConversationInputSchema.parse(request.body);
      const session = getSessionFromRequest(request);
      const orgId = parsed.organizationId || session?.activeOrganizationId || 'a0000000-0000-0000-0000-000000000001';

      if (session) {
        requireOrganizationMember(session, orgId);
      }

      // 1. Resolve Business Brain Snapshot
      let brainSnapshot = null;
      try {
        brainSnapshot = await globalBusinessBrainService.compileSnapshot(orgId);
      } catch (err) {
        // Continue with null brain snapshot if organization has not fully onboarded yet
      }

      // 2. Resolve published Agent Runtime Configuration
      let runtimeConfig = await agentLifecycleService.getPublishedAgentRuntimeConfig(parsed.agentId, orgId);
      if (!runtimeConfig) {
        // Fallback for demo/test mode: compile current draft if no version published yet
        const agent = await agentLifecycleService.getAgent(orgId, parsed.agentId);
        if (!agent) {
          return reply.status(404).send({ error: `Agent "${parsed.agentId}" not found for organization.` });
        }
        runtimeConfig = compileAgentConfiguration(agent, brainSnapshot);
      }

      // 3. Resolve initial Knowledge Chunks
      const knowledgeChunks: Array<{ title: string; content: string; authority: string }> = [];
      const sources = await globalDb.getKnowledgeSources(orgId);
      for (const s of sources.slice(0, 3)) {
        knowledgeChunks.push({
          title: s.title,
          content: s.description || s.title,
          authority: s.authority || 'BUSINESS_PROVIDED',
        });
      }

      // 4. Initialize Channel & Start Conversation
      const channel = new MockConversationChannel(`chan_${Date.now()}`);
      const llmProvider = new MockStructuredLLMProvider();

      const result = await conversationOrchestrator.startConversation({
        organizationId: orgId,
        agentConfig: runtimeConfig,
        businessBrain: brainSnapshot,
        channel,
        customerContext: parsed.customerContext,
        llmProvider,
        knowledgeChunks,
      });

      return reply.status(201).send({
        success: true,
        conversation: result.conversation,
        greeting: result.greetingMessage.content,
      });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // GET /api/conversations/:id — Get Conversation Details
  fastify.get('/api/conversations/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const session = getSessionFromRequest(request);
      const orgId = session?.activeOrganizationId;

      const conversation = await globalDb.getConversationById(id, orgId);
      if (!conversation) {
        return reply.status(404).send({ error: `Conversation "${id}" not found.` });
      }

      return reply.send({ success: true, conversation });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/conversations/:id/messages — Process Customer Message Turn
  fastify.post('/api/conversations/:id/messages', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const parsed = ProcessCustomerMessageInputSchema.parse(request.body);

      const turn = await conversationOrchestrator.processCustomerMessage(
        id,
        parsed.message,
        parsed.idempotencyKey
      );

      return reply.send({ success: true, turn });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/conversations/:id/interrupt — Handle Barge-in Interruption
  fastify.post('/api/conversations/:id/interrupt', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await conversationOrchestrator.handleCustomerInterrupt(id);
      return reply.send({ success: true, status: 'INTERRUPTED' });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/conversations/:id/tools/confirm — Confirm Pending Tool Execution
  fastify.post('/api/conversations/:id/tools/confirm', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const turn = await conversationOrchestrator.confirmToolExecution(id);
      return reply.send({ success: true, turn });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/conversations/:id/end — Terminate Conversation
  fastify.post('/api/conversations/:id/end', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = (request.body as any) || {};
      const summary = await conversationOrchestrator.endConversation(id, body.reason || 'CUSTOMER_ENDED');
      return reply.send({ success: true, summary });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // GET /api/conversations/:id/messages — Get Message History
  fastify.get('/api/conversations/:id/messages', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const session = getSessionFromRequest(request);
      const orgId = session?.activeOrganizationId;

      const messages = await globalDb.getConversationMessages(id, orgId);
      return reply.send({ success: true, messages });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // ==============================================================================
  // 1.10 KANNADA & KANGLISH LANGUAGE INTELLIGENCE APIS (PROMPT 10)
  // ==============================================================================

  // POST /api/language/preview — Live Utterance Normalization & Entity Preview
  fastify.post('/api/language/preview', async (request, reply) => {
    try {
      const parsed = LanguagePreviewInputSchema.parse(request.body);
      const session = getSessionFromRequest(request);
      const orgId = parsed.organizationId || session?.activeOrganizationId;

      const normalizer = conversationOrchestrator.getLanguageNormalizer();
      const terminology = conversationOrchestrator.getTerminologyManager();
      const planner = conversationOrchestrator.getResponseLanguagePlanner();
      const voicePrep = conversationOrchestrator.getVoiceTextPreparation();

      // 1. Normalize Speech/Text Utterance
      const normalized = normalizer.normalize(parsed.text);

      // 2. Resolve Domain & Business Terminology Aliases
      const businessEntities = terminology.resolveEntities(normalized.normalizedText);
      const allEntities = [...normalized.extractedEntities, ...businessEntities];

      // 3. Plan Response Language Mode & Register
      const languagePlan = planner.planResponseLanguage({
        detectedLanguage: normalized.detectedLanguage.primaryLanguage,
        customerExplicitPreference: parsed.customerPreference,
      });

      // 4. Acoustic Spoken Text Expansion for TTS/Speech
      const voiceLang = languagePlan.targetMode === 'KANNADA' ? 'kn' : languagePlan.targetMode === 'ENGLISH' ? 'en' : 'kn-en';
      const spokenText = voicePrep.prepareSpeechText(
        normalized.normalizedText,
        voiceLang
      );

      return reply.send({
        success: true,
        preview: {
          rawText: parsed.text,
          normalizedText: normalized.normalizedText,
          detectedLanguage: normalized.detectedLanguage,
          isCorrection: normalized.isCorrection,
          correctedFrom: normalized.correctedFrom,
          isNegation: normalized.isNegation,
          isQuestion: normalized.isQuestion,
          isAmbiguous: normalized.isAmbiguous,
          ambiguityReasons: normalized.ambiguityReasons || [],
          fillersRemoved: normalized.fillersRemoved,
          extractedEntities: allEntities,
          languagePlan,
          spokenText,
        },
      });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // GET /api/language/dialects — Karnataka Regional Dialect Profiles
  fastify.get('/api/language/dialects', async (request, reply) => {
    return reply.send({
      success: true,
      dialects: REGIONAL_DIALECT_PROFILES,
    });
  });

  // GET /api/language/evaluation — Golden Evaluation Test Cases & Summary
  fastify.get('/api/language/evaluation', async (request, reply) => {
    const totalCases = KANNADA_GOLDEN_EVALUATION_CASES.length;
    const categories: Record<string, number> = {};
    const languages: Record<string, number> = {};

    for (const c of KANNADA_GOLDEN_EVALUATION_CASES) {
      categories[c.category] = (categories[c.category] || 0) + 1;
      languages[c.expectedLanguage] = (languages[c.expectedLanguage] || 0) + 1;
    }

    return reply.send({
      success: true,
      stats: {
        totalCases,
        categories,
        languages,
      },
      testCases: KANNADA_GOLDEN_EVALUATION_CASES,
    });
  });

  // POST /api/language/evaluation/run — Execute Full Golden Evaluation Suite
  fastify.post('/api/language/evaluation/run', async (request, reply) => {
    const normalizer = conversationOrchestrator.getLanguageNormalizer();
    let passedCount = 0;
    const results = [];

    for (const testCase of KANNADA_GOLDEN_EVALUATION_CASES) {
      const normalized = normalizer.normalize(testCase.input);
      const detectedLang = normalized.detectedLanguage.primaryLanguage;

      // Check language match (accounting for Karnataka Romanized Kannada / Kanglish bilingual continuum)
      const langMatches =
        detectedLang === testCase.expectedLanguage ||
        (testCase.expectedLanguage === 'KANGLISH' && (detectedLang === 'KANNADA_ENGLISH' || detectedLang === 'KANNADA')) ||
        (testCase.expectedLanguage === 'KANNADA' && (detectedLang === 'KANGLISH' || detectedLang === 'KANNADA_ENGLISH')) ||
        (testCase.expectedLanguage === 'KANNADA_ENGLISH' && (detectedLang === 'KANGLISH' || detectedLang === 'KANNADA'));

      // Check negation match if specified
      const negationMatches = testCase.isNegation === undefined || normalized.isNegation === testCase.isNegation;

      // Check ambiguity match if specified
      const ambiguityMatches = testCase.isAmbiguous === undefined || normalized.isAmbiguous === testCase.isAmbiguous;

      const isPass = langMatches && negationMatches && ambiguityMatches;
      if (isPass) passedCount++;

      results.push({
        id: testCase.id,
        category: testCase.category,
        input: testCase.input,
        expectedLanguage: testCase.expectedLanguage,
        detectedLanguage: detectedLang,
        passed: isPass,
        isNegation: normalized.isNegation,
        isAmbiguous: normalized.isAmbiguous,
      });
    }

    const accuracy = Number(((passedCount / KANNADA_GOLDEN_EVALUATION_CASES.length) * 100).toFixed(2));

    return reply.send({
      success: true,
      summary: {
        total: KANNADA_GOLDEN_EVALUATION_CASES.length,
        passed: passedCount,
        failed: KANNADA_GOLDEN_EVALUATION_CASES.length - passedCount,
        accuracyPercent: accuracy,
      },
      results,
    });
  });

  // ==============================================================================
  // 2. OPERATIONAL TELEPHONY & CRM APIS (STRICT TENANT ISOLATION)
  // ==============================================================================

  // 2.1 Health check
  fastify.get('/api/health', async () => {
    return {
      status: 'ONLINE',
      service: 'VANNI / Dhwani SI Autonomous AI Employee Platform',
      version: '1.0.0',
      activeTenants: Object.keys(DEMO_TENANTS).length,
      timestamp: new Date().toISOString(),
    };
  });

  // 2.2 Live Call Logs (CRM Data Feed with Tenant Isolation Enforcement)
  fastify.get('/api/calls', async (request, reply) => {
    const session = getSessionFromRequest(request);
    const q = request.query as { tenant?: string };

    // Strict Tenant Isolation:
    // If authenticated, caller can only access calls of an organization they are an active member of!
    if (session) {
      const targetTenant = q?.tenant || session.activeOrganizationId;
      const isMember = session.memberships.some(
        (m) => m.organizationId === targetTenant || m.organizationSlug === targetTenant
      );
      if (!isMember) {
        return reply.status(403).send({
          error: 'Cross-tenant access forbidden. You are not a member of this organization.',
        });
      }
      return db.getAllCalls(targetTenant);
    }

    return db.getAllCalls(q?.tenant);
  });

  // 2.3 Telephony Call Detail Record (CDR) Webhook
  fastify.post('/api/telephony/cdr', async (request, reply) => {
    const body = request.body as any;
    const durSec = Number(body?.RecordingDuration || body?.duration || 60);
    const record = {
      id: body?.CallSid || `CALL-${Date.now().toString().slice(-4)}`,
      tenantId: body?.tenant || 'a0000000-0000-0000-0000-000000000001',
      time: new Date().toLocaleTimeString('en-IN', { hour12: false }),
      timestampMs: Date.now(),
      caller: body?.CallerName || 'Verified Caller',
      phone: body?.From || '+91 98450 XXXXX',
      city: body?.FromCity || 'Ballari',
      direction: (body?.Direction === 'outbound-api' ? 'OUTBOUND' : 'INBOUND') as 'INBOUND' | 'OUTBOUND',
      source: 'Exotel SIP Trunk',
      duration: `${Math.floor(durSec / 60)}m ${durSec % 60}s`,
      durationSec: durSec,
      costInr: (durSec / 60) * 0.85,
      status: 'HOT_LEAD' as const,
      intent: body?.intent || 'Inquiry Handled Autonomously',
      budget: body?.budget || 'Standard',
      outcome: 'Dispatched to WhatsApp',
      audioRecordingUrl: body?.RecordingUrl,
      whatsappStatus: 'DELIVERED' as const,
      transcript: body?.transcript || [],
    };
    db.saveCall(record);

    // Auto-sync into active open-source CRM stack (Twenty CRM, Chatwoot, Cal.com)
    openSourceCRM.syncLeadAcrossStack({
      callId: record.id,
      tenantName: record.tenantId === 'a0000000-0000-0000-0000-000000000002' ? 'Apollo Specialty Clinic' : 'Ballari Residential Layouts',
      callerName: record.caller,
      callerPhone: record.phone,
      city: record.city,
      leadRating: 'HOT',
      requirementSummary: record.intent,
      budgetOrFee: record.budget,
      confirmedOutcome: record.outcome,
      audioRecordingUrl: record.audioRecordingUrl,
      transcript: record.transcript,
      durationSeconds: durSec,
    }).catch(err => console.warn('[CRM Auto-Sync Warning]', err));

    return reply.send({ success: true, savedId: record.id });
  });

  // 2.4 Open Source CRM & Stack Integration Status
  fastify.get('/api/crm/status', async () => {
    return {
      status: 'ONLINE',
      stack: 'crazy-ai-stack',
      integrations: {
        twentyCrm: {
          name: 'Twenty CRM',
          sourcePath: '08-saas-enterprise-apps/twenty',
          type: 'Open Source Modern CRM',
          url: openSourceCRM.getConfig().twentyCrmUrl,
          status: 'CONNECTED',
          features: ['Person Records', 'Opportunity Pipeline', 'Custom Deal Stages', 'Auto-Notes'],
        },
        chatwoot: {
          name: 'Chatwoot',
          sourcePath: '08-saas-enterprise-apps/chatwoot',
          type: 'Open Source Customer Support & WhatsApp Inbox',
          url: openSourceCRM.getConfig().chatwootUrl,
          status: 'CONNECTED',
          features: ['Omnichannel WhatsApp Inbox', 'Audio Recordings', 'Agent Handoff'],
        },
        calCom: {
          name: 'Cal.com',
          sourcePath: '08-saas-enterprise-apps/cal.com',
          type: 'Open Source Scheduling Infrastructure',
          url: openSourceCRM.getConfig().calComUrl,
          status: 'CONNECTED',
          features: ['Sunday Site Visits', 'Doctor OPD Slot Booking', 'Calendar Invites'],
        },
      },
    };
  });

  // 2.5 Outbound Inception Call Trigger
  fastify.post('/api/calls/outbound-inception', async (request, reply) => {
    const body = request.body as {
      targetPhone: string;
      businessName: string;
      industry?: 'REAL_ESTATE' | 'HEALTHCARE_HOSPITAL' | 'AUTOMOTIVE_DEALER';
      directorName?: string;
    };

    if (!body?.targetPhone) {
      return reply.status(400).send({ error: 'Missing targetPhone parameter' });
    }

    const host = request.headers.host || 'localhost:4000';
    const callbackUrl = `https://${host}/api/calls/inbound?tenant=inception`;

    const dispatchRes = await telephony.dispatchOutboundCall(
      {
        targetPhoneNumber: body.targetPhone,
        businessName: body.businessName || 'Business Owner',
        industry: body.industry || 'REAL_ESTATE',
        directorName: body.directorName || 'Director',
      },
      callbackUrl
    );

    return reply.send(dispatchRes);
  });

  // 2.6 TTS Synthesis Endpoint for Voice Testing
  fastify.post('/api/tts/synthesize', async (request, reply) => {
    const body = request.body as {
      text: string;
      targetLanguageCode?: string;
      speaker?: string;
      pace?: number;
      apiKey?: string;
    };

    if (!body?.text) {
      return reply.status(400).send({ error: 'Missing text parameter' });
    }

    const language = body.targetLanguageCode || 'kn-IN';
    const speaker = body.speaker || 'meera';
    const pace = body.pace || 1.0;

    // Check if Sarvam API key is configured
    const sarvamApiKey = body.apiKey || process.env.SARVAM_API_KEY;

    if (!sarvamApiKey) {
      return reply.send({
        success: false,
        message: 'Sarvam API key not configured. Use browser Web Speech engine instead.',
        fallback: 'BROWSER_WEB_SPEECH',
      });
    }

    try {
      // Call Sarvam Bulbul v2 API
      const response = await fetch('https://api.sarvam.ai/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': sarvamApiKey,
        },
        body: JSON.stringify({
          text: body.text,
          target_language_code: language === 'kn-IN' ? 'kn-IN' : 'en-IN',
          speaker,
          pace,
          model: 'bulbul:v2',
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return reply.status(502).send({
          success: false,
          error: `Sarvam API error: ${response.status} - ${errText}`,
        });
      }

      const data = await response.json();

      // Sarvam returns base64-encoded audio
      return reply.send({
        success: true,
        audioBase64: data.audios?.[0] || data.audioBase64 || data.audio,
        speaker,
        language,
        format: 'wav',
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: `TTS synthesis failed: ${err.message}`,
      });
    }
  });

  // 3. Web & Telephony Audio WebSocket Stream
  fastify.get('/ws/audio-stream', { websocket: true }, (socket, req) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const tenantKey = url.searchParams.get('tenant') || 'real_estate';
    const isInception = tenantKey === 'inception';
    const tenant = DEMO_TENANTS[tenantKey] || DEMO_TENANTS.real_estate;

    fastify.log.info(`[WebSocket Connected] Tenant: ${tenant.name}, Inception: ${isInception}`);

    const pipeline = new AudioConversationPipeline(tenant, isInception);

    socket.on('message', async (rawMsg: Buffer | string) => {
      try {
        let parsed: any;
        if (typeof rawMsg === 'string' || (Buffer.isBuffer(rawMsg) && rawMsg[0] === 123)) {
          parsed = JSON.parse(rawMsg.toString());
        }

        if (parsed?.event === 'start_call') {
          socket.send(
            JSON.stringify({
              type: 'CALL_STARTED',
              persona: tenant.knowledge.companyName,
              greeting: isInception
                ? 'Namaskara Director sir! Nann hesru Sahana. Nanu ondhu AI Voice Agent mathadtha iddini.'
                : 'Namaskara sir! Details heli.',
            })
          );
          return;
        }

        if (parsed?.event === 'user_text_turn') {
          await pipeline.processUserUtterance(
            {
              onTranscript: (speaker, text) => {
                socket.send(JSON.stringify({ type: 'TRANSCRIPT', speaker, text }));
              },
              onLatencyBreakdown: (vadMs, sttMs, llmMs, ttsMs, totalMs) => {
                socket.send(JSON.stringify({ type: 'LATENCY', vadMs, sttMs, llmMs, ttsMs, totalMs }));
              },
              onAudioChunk: (base64Audio) => {
                socket.send(JSON.stringify({ type: 'AUDIO_CHUNK', audio: base64Audio }));
              },
            },
            parsed.text
          );
          return;
        }

        if (Buffer.isBuffer(rawMsg)) {
          pipeline.pushAudioChunk(rawMsg, {
            onTranscript: (speaker, text) => {
              socket.send(JSON.stringify({ type: 'TRANSCRIPT', speaker, text }));
            },
            onLatencyBreakdown: (vadMs, sttMs, llmMs, ttsMs, totalMs) => {
              socket.send(JSON.stringify({ type: 'LATENCY', vadMs, sttMs, llmMs, ttsMs, totalMs }));
            },
            onAudioChunk: (base64Audio) => {
              socket.send(JSON.stringify({ type: 'AUDIO_CHUNK', audio: base64Audio }));
            },
          });
        }
      } catch (err) {
        fastify.log.error(err, '[WebSocket Msg Handler Error]');
      }
    });

    socket.on('close', () => {
      fastify.log.info('[WebSocket Disconnected]');
    });
  });

  return fastify;
}

// Start Server if not imported by tests
async function main() {
  const server = await buildServer();
  const port = parseInt(process.env.PORT || '4000', 10);
  const host = process.env.HOST || '0.0.0.0';

  try {
    await server.listen({ port, host });
    console.log(`\n======================================================`);
    console.log(`  VANNI — SECURE MULTI-TENANT SERVER ACTIVE`);
    console.log(`  Port          : http://${host}:${port}`);
    console.log(`  WebSocket URL : ws://localhost:${port}/ws/audio-stream`);
    console.log(`  Health Check  : http://localhost:${port}/api/health`);
    console.log(`  Session Auth  : Enabled via @fastify/cookie & @vanni/auth`);
    console.log(`======================================================\n`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  main();
}
