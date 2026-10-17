import fs from 'node:fs';
import path from 'node:path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
/**
 * @vanni/database — Multi-Tenant Database Client & Business Brain Repository
 */

import {
  AppointmentSlotDTO,
  PropertyDTO,
  RealEstateConfigDTO,
  RealEstateLeadQualificationDTO,
  ClientWorkspaceDTO,
  AuditLogDTO,
  CallRecordDTO,
  LeadDossierDTO,
  OrganizationDTO,
  OrganizationMemberDTO,
  UserProfileDTO,
  BusinessLocationDTO,
  BusinessServiceDTO,
  BusinessStaffDTO,
  BusinessOperatingHoursDTO,
  BusinessPolicyDTO,
  BusinessFAQDTO,
  BusinessFactDTO,
  KnowledgeSourceDTO,
  KnowledgeConflictDTO,
  BusinessBrainSnapshotDTO,
  KnowledgeDocumentDTO,
  KnowledgeChunkDTO,
  KnowledgeIngestionJobDTO,
  DocumentProcessingStatus,
  IngestionJobStatus,
  AIEmployeeDTO,
  AIEmployeeVersionDTO,
  AgentRuntimeConfig,
  ConversationDTO,
  ConversationMessageDTO,
  ConversationEventDTO,
  ConversationToolCallDTO,
  ConversationHandoffDTO,
  ConversationHandoffRecordDTO,
  ConversationSummaryDTO,
  ContactDTO,
  CRMLeadDTO,
  CRMActivityDTO,
  CRMOpportunityDTO,
  CRMAnalyticsDTO,
  TeamDTO,
  TeamMemberDTO,
  NotificationDTO,
  NotificationPreferencesDTO,
  HandoffSLADTO,
  EscalationPolicyDTO,
  UsageEventDTO,
  ProviderPricingDefinitionDTO,
  UsageLedgerRecordDTO,
  DailyUsageAggregationDTO,
  UsageAlertThresholdDTO,
  AnalyticsOverviewDTO,
  CostAnomalyAlertDTO,
  BillingAccountDTO,
  PlanDTO,
  PlanVersionDTO,
  SubscriptionDTO,
  SubscriptionEventDTO,
  PaymentRecordDTO,
  BillingInvoiceDTO,
  BillingProviderEventDTO,
  BillingSnapshotDTO,
} from '@vanni/shared';

export interface AgentRecordDTO {
  id: string;
  organizationId: string;
  name: string;
  role: string;
  language: string;
  status: string;
  systemPrompt: string;
  createdAt: string;
  updatedAt: string;
}

export interface IDatabaseService {
  // Profiles
  getProfileById(userId: string): Promise<UserProfileDTO | null>;
  saveProfile(profile: UserProfileDTO): Promise<void>;

  // Organizations
  getOrganizations(): Promise<OrganizationDTO[]>;
  getOrganizationById(id: string): Promise<OrganizationDTO | null>;
  getOrganizationBySlug(slug: string): Promise<OrganizationDTO | null>;
  saveOrganization(org: OrganizationDTO): Promise<void>;

  // Members
  getMembers(organizationId: string): Promise<OrganizationMemberDTO[]>;
  getMembersByUserId(userId: string): Promise<OrganizationMemberDTO[]>;
  saveMember(member: OrganizationMemberDTO): Promise<void>;
  deleteMember(id: string): Promise<void>;

  // Calls (Tenant Gated)
  getCalls(organizationId?: string): Promise<CallRecordDTO[]>;
  getCallById(id: string, organizationId?: string): Promise<CallRecordDTO | null>;
  saveCall(call: CallRecordDTO): Promise<void>;

  // Leads (Tenant Gated)
  getLeads(organizationId?: string): Promise<LeadDossierDTO[]>;
  saveLead(lead: LeadDossierDTO): Promise<void>;

  // Appointments (Tenant Gated)
  getAppointments(organizationId?: string): Promise<AppointmentSlotDTO[]>;
  getAppointmentById(id: string, organizationId?: string): Promise<AppointmentSlotDTO | null>;
  saveAppointment(appointment: AppointmentSlotDTO): Promise<void>;
  updateAppointment(id: string, partial: Partial<AppointmentSlotDTO>, organizationId?: string): Promise<AppointmentSlotDTO | null>;
  deleteAppointment(id: string, organizationId?: string): Promise<void>;

  getProperties(workspaceId?: string, filters?: { propertyType?: string; status?: string; locality?: string; minPrice?: number; maxPrice?: number; search?: string }): Promise<PropertyDTO[]>;
  getPropertyById(id: string, workspaceId?: string): Promise<PropertyDTO | null>;
  saveProperty(property: PropertyDTO): Promise<void>;
  updateProperty(id: string, partial: Partial<PropertyDTO>, workspaceId?: string): Promise<PropertyDTO | null>;
  deleteProperty(id: string, workspaceId?: string): Promise<boolean>;
  getStaffById(id: string, organizationId?: string): Promise<BusinessStaffDTO | null>;
  updateStaff(id: string, partial: Partial<BusinessStaffDTO>, organizationId?: string): Promise<BusinessStaffDTO | null>;

  // Agents (Tenant Gated)
  getAgents(organizationId?: string): Promise<AgentRecordDTO[]>;
  saveAgent(agent: AgentRecordDTO): Promise<void>;

  // Audit Logs (Tenant Gated)
  getAuditLogs(organizationId: string): Promise<AuditLogDTO[]>;
  saveAuditLog(log: AuditLogDTO): Promise<void>;

  // ==========================================
  // BUSINESS BRAIN ENTITIES (TENANT GATED)
  // ==========================================
  getLocations(organizationId: string): Promise<BusinessLocationDTO[]>;
  saveLocation(location: BusinessLocationDTO): Promise<void>;
  deleteLocation(id: string, organizationId: string): Promise<void>;

  getServices(organizationId: string): Promise<BusinessServiceDTO[]>;
  saveService(service: BusinessServiceDTO): Promise<void>;
  deleteService(id: string, organizationId: string): Promise<void>;

  getStaff(organizationId: string): Promise<BusinessStaffDTO[]>;
  saveStaff(staff: BusinessStaffDTO): Promise<void>;
  deleteStaff(id: string, organizationId: string): Promise<void>;

  getOperatingHours(organizationId: string): Promise<BusinessOperatingHoursDTO[]>;
  saveOperatingHours(organizationId: string, hours: BusinessOperatingHoursDTO[]): Promise<void>;

  getPolicies(organizationId: string): Promise<BusinessPolicyDTO[]>;
  savePolicy(policy: BusinessPolicyDTO): Promise<void>;
  deletePolicy(id: string, organizationId: string): Promise<void>;

  getFAQs(organizationId: string): Promise<BusinessFAQDTO[]>;
  saveFAQ(faq: BusinessFAQDTO): Promise<void>;
  deleteFAQ(id: string, organizationId: string): Promise<void>;

  getFacts(organizationId: string): Promise<BusinessFactDTO[]>;
  saveFact(fact: BusinessFactDTO): Promise<void>;
  deleteFact(id: string, organizationId: string): Promise<void>;

  getKnowledgeSources(organizationId: string): Promise<KnowledgeSourceDTO[]>;
  saveKnowledgeSource(source: KnowledgeSourceDTO): Promise<void>;

  getConflicts(organizationId: string): Promise<KnowledgeConflictDTO[]>;
  saveConflict(conflict: KnowledgeConflictDTO): Promise<void>;
  resolveConflict(conflictId: string, resolvedValue: string, organizationId: string): Promise<void>;

  getLatestSnapshot(organizationId: string): Promise<BusinessBrainSnapshotDTO | null>;
  saveSnapshot(snapshot: BusinessBrainSnapshotDTO): Promise<void>;

  // ==========================================
  // KNOWLEDGE INGESTION & RETRIEVAL (PROMPT 07)
  // ==========================================
  getDocuments(organizationId: string, sourceId?: string): Promise<KnowledgeDocumentDTO[]>;
  getDocumentById(id: string, organizationId?: string): Promise<KnowledgeDocumentDTO | null>;
  saveDocument(doc: KnowledgeDocumentDTO): Promise<void>;
  updateDocumentStatus(id: string, status: DocumentProcessingStatus, organizationId: string, errorMessage?: string): Promise<void>;
  deleteDocument(id: string, organizationId: string): Promise<void>;

  getChunks(organizationId: string, documentId?: string): Promise<KnowledgeChunkDTO[]>;
  saveChunks(chunks: KnowledgeChunkDTO[]): Promise<void>;
  deleteChunksByDocument(documentId: string, organizationId: string): Promise<void>;

  getJobs(organizationId: string, sourceId?: string): Promise<KnowledgeIngestionJobDTO[]>;
  getJobById(id: string, organizationId?: string): Promise<KnowledgeIngestionJobDTO | null>;
  saveJob(job: KnowledgeIngestionJobDTO): Promise<void>;
  updateJobProgress(id: string, status: IngestionJobStatus, progress: number, organizationId: string, error?: string): Promise<void>;

  saveStorageFile(organizationId: string, path: string, content: Buffer | string, mimeType: string): Promise<string>;
  getStorageFile(organizationId: string, path: string): Promise<{ content: Buffer | string; mimeType: string } | null>;

  // ==========================================
  // AI EMPLOYEES & VERSIONING (PROMPT 08)
  // ==========================================
  getAIEmployees(organizationId: string): Promise<AIEmployeeDTO[]>;
  getAIEmployeeById(id: string, organizationId?: string): Promise<AIEmployeeDTO | null>;
  saveAIEmployee(employee: AIEmployeeDTO): Promise<void>;
  deleteAIEmployee(id: string, organizationId: string): Promise<void>;

  getAIEmployeeVersions(organizationId: string, agentId: string): Promise<AIEmployeeVersionDTO[]>;
  getAIEmployeeVersionByNumber(agentId: string, version: number, organizationId?: string): Promise<AIEmployeeVersionDTO | null>;
  saveAIEmployeeVersion(version: AIEmployeeVersionDTO): Promise<void>;

  getAIEmployeeTestSessions(organizationId: string, agentId: string): Promise<any[]>;
  saveAIEmployeeTestSession(session: any): Promise<void>;

  // ==========================================
  // CONVERSATIONS & ORCHESTRATION (PROMPT 09)
  // ==========================================
  createConversation(conversation: ConversationDTO): Promise<ConversationDTO>;
  getConversationById(id: string, organizationId?: string): Promise<ConversationDTO | null>;
  getConversations(organizationId: string): Promise<ConversationDTO[]>;
  updateConversation(conversation: ConversationDTO): Promise<void>;

  saveConversationMessage(message: ConversationMessageDTO): Promise<void>;
  getConversationMessages(conversationId: string, organizationId?: string): Promise<ConversationMessageDTO[]>;

  saveConversationEvent(event: ConversationEventDTO): Promise<void>;
  getConversationEvents(conversationId: string, organizationId?: string): Promise<ConversationEventDTO[]>;

  saveConversationToolCall(toolCall: ConversationToolCallDTO): Promise<void>;
  updateConversationToolCall(toolCall: ConversationToolCallDTO): Promise<void>;
  getConversationToolCalls(conversationId: string, organizationId?: string): Promise<ConversationToolCallDTO[]>;

  saveConversationHandoff(handoff: ConversationHandoffDTO): Promise<void>;
  getConversationHandoff(conversationId: string, organizationId?: string): Promise<ConversationHandoffDTO | null>;
  getConversationHandoffs(organizationId?: string): Promise<ConversationHandoffDTO[]>;

  // Handoff Engine Extended Records (Module 17)
  saveHandoffRecord(record: ConversationHandoffRecordDTO): Promise<void>;
  getHandoffRecordById(id: string, organizationId?: string): Promise<ConversationHandoffRecordDTO | null>;
  getHandoffRecords(organizationId: string, filters?: { status?: string; priority?: string; assignedUserId?: string; assignedTeamId?: string }): Promise<ConversationHandoffRecordDTO[]>;
  claimHandoffRecord(id: string, userId: string, organizationId: string): Promise<{ success: boolean; handoff?: ConversationHandoffRecordDTO; error?: string }>;

  // Teams & Team Members
  saveTeam(team: TeamDTO): Promise<void>;
  getTeams(organizationId: string): Promise<TeamDTO[]>;
  getTeamById(id: string, organizationId?: string): Promise<TeamDTO | null>;
  saveTeamMember(member: TeamMemberDTO): Promise<void>;
  getTeamMembers(teamId: string, organizationId?: string): Promise<TeamMemberDTO[]>;
  updateMemberAvailability(teamId: string, userId: string, availability: any, organizationId?: string): Promise<void>;

  // Notifications
  saveNotification(notification: NotificationDTO): Promise<void>;
  getNotifications(userId: string, organizationId: string, status?: string): Promise<NotificationDTO[]>;
  markNotificationRead(id: string, userId: string, organizationId: string): Promise<void>;
  saveNotificationPreferences(prefs: NotificationPreferencesDTO): Promise<void>;
  getNotificationPreferences(userId: string, organizationId: string): Promise<NotificationPreferencesDTO | null>;

  // SLAs & Policies
  saveHandoffSLA(sla: HandoffSLADTO): Promise<void>;
  getHandoffSLAs(organizationId: string): Promise<HandoffSLADTO[]>;
  saveEscalationPolicy(policy: EscalationPolicyDTO): Promise<void>;
  getEscalationPolicy(organizationId: string, agentId?: string): Promise<EscalationPolicyDTO | null>;

  saveConversationSummary(summary: ConversationSummaryDTO): Promise<void>;
  getConversationSummary(conversationId: string, organizationId?: string): Promise<ConversationSummaryDTO | null>;

  // ==========================================
  // CLIENT WORKSPACES & ONBOARDING (PROMPT 03)
  // ==========================================
  saveClientWorkspace(workspace: ClientWorkspaceDTO): Promise<void>;
  getClientWorkspacesByOrg(organizationId: string): Promise<ClientWorkspaceDTO[]>;
  getClientWorkspaceById(id: string, organizationId?: string): Promise<ClientWorkspaceDTO | null>;
  updateClientWorkspace(id: string, updates: Partial<ClientWorkspaceDTO>, organizationId?: string): Promise<ClientWorkspaceDTO>;
  deleteClientWorkspace(id: string, organizationId: string): Promise<boolean>;

  // ==========================================
  // CRM, CONTACTS & LEAD MANAGEMENT (PROMPT 15)
  // ==========================================
  getContacts(organizationId: string, query?: string): Promise<ContactDTO[]>;
  getContactById(id: string, organizationId?: string): Promise<ContactDTO | null>;
  findContactByPhone(organizationId: string, phone: string): Promise<ContactDTO | null>;
  findContactByEmail(organizationId: string, email: string): Promise<ContactDTO | null>;
  saveContact(contact: ContactDTO): Promise<void>;
  updateContactStatus(id: string, status: any, reason?: string, organizationId?: string): Promise<void>;

  getCRMLeads(organizationId: string, filters?: { status?: string; stage?: string; source?: string }): Promise<CRMLeadDTO[]>;
  getCRMLeadById(id: string, organizationId?: string): Promise<CRMLeadDTO | null>;
  getCRMLeadsByContactId(contactId: string, organizationId?: string): Promise<CRMLeadDTO[]>;
  saveCRMLead(lead: CRMLeadDTO): Promise<void>;

  getCRMActivities(organizationId: string, filters?: { contactId?: string; leadId?: string; conversationId?: string }): Promise<CRMActivityDTO[]>;
  saveCRMActivity(activity: CRMActivityDTO): Promise<void>;

  getCRMOpportunities(organizationId: string, leadId?: string): Promise<CRMOpportunityDTO[]>;
  saveCRMOpportunity(opp: CRMOpportunityDTO): Promise<void>;

  getCRMAnalytics(organizationId: string): Promise<CRMAnalyticsDTO>;

  // ==========================================
  // ANALYTICS, USAGE METERING & COST (MODULE 18)
  // ==========================================
  saveUsageEvent(event: UsageEventDTO): Promise<void>;
  getUsageEvents(organizationId: string, filters?: { eventType?: string; agentId?: string; startDate?: string; endDate?: string }): Promise<UsageEventDTO[]>;

  saveProviderPricing(pricing: ProviderPricingDefinitionDTO): Promise<void>;
  getProviderPricing(provider: string, service: string, version?: string): Promise<ProviderPricingDefinitionDTO | null>;
  getAllProviderPricing(): Promise<ProviderPricingDefinitionDTO[]>;

  saveUsageLedgerRecord(record: UsageLedgerRecordDTO): Promise<void>;
  getUsageLedgerRecords(organizationId: string, billingPeriod?: string): Promise<UsageLedgerRecordDTO[]>;

  saveDailyUsageAggregation(agg: DailyUsageAggregationDTO): Promise<void>;
  getDailyUsageAggregations(organizationId: string, startDate?: string, endDate?: string): Promise<DailyUsageAggregationDTO[]>;

  saveUsageAlertThreshold(alert: UsageAlertThresholdDTO): Promise<void>;
  getUsageAlertThresholds(organizationId: string): Promise<UsageAlertThresholdDTO[]>;

  saveCostAnomalyAlert(alert: CostAnomalyAlertDTO): Promise<void>;
  getCostAnomalyAlerts(organizationId: string): Promise<CostAnomalyAlertDTO[]>;

  getAnalyticsOverview(organizationId: string, period?: string, startDate?: string, endDate?: string): Promise<AnalyticsOverviewDTO>;

  // ==========================================
  // BILLING, PLANS & SUBSCRIPTIONS (MODULE 19)
  // ==========================================
  saveBillingAccount(account: BillingAccountDTO): Promise<void>;
  getBillingAccount(organizationId: string): Promise<BillingAccountDTO | null>;

  savePlan(plan: PlanDTO): Promise<void>;
  getPlans(visibility?: 'PUBLIC' | 'ALL'): Promise<PlanDTO[]>;
  getPlanById(id: string): Promise<PlanDTO | null>;
  getPlanBySlug(slug: string): Promise<PlanDTO | null>;

  saveSubscription(subscription: SubscriptionDTO): Promise<void>;
  getSubscription(organizationId: string): Promise<SubscriptionDTO | null>;
  saveSubscriptionEvent(event: SubscriptionEventDTO): Promise<void>;
  getSubscriptionEvents(organizationId: string): Promise<SubscriptionEventDTO[]>;

  savePaymentRecord(payment: PaymentRecordDTO): Promise<void>;
  getPaymentRecords(organizationId: string): Promise<PaymentRecordDTO[]>;

  saveBillingInvoice(invoice: BillingInvoiceDTO): Promise<void>;
  getBillingInvoices(organizationId: string): Promise<BillingInvoiceDTO[]>;

  saveBillingProviderEvent(event: BillingProviderEventDTO): Promise<void>;
  getBillingProviderEvent(provider: string, providerEventId: string): Promise<BillingProviderEventDTO | null>;

  getBillingSnapshot(organizationId: string): Promise<BillingSnapshotDTO>;
}

export class InMemoryDatabaseService implements IDatabaseService {
  protected clientWorkspaces: Map<string, ClientWorkspaceDTO> = new Map();
  protected properties: Map<string, PropertyDTO> = new Map();

  async saveClientWorkspace(workspace: ClientWorkspaceDTO): Promise<void> {
    this.clientWorkspaces.set(workspace.id, { ...workspace });
  }

  async getClientWorkspacesByOrg(organizationId: string): Promise<ClientWorkspaceDTO[]> {
    return Array.from(this.clientWorkspaces.values()).filter(
      (w) => w.organizationId === organizationId
    );
  }

  async getClientWorkspaceById(id: string, organizationId?: string): Promise<ClientWorkspaceDTO | null> {
    const ws = this.clientWorkspaces.get(id);
    if (!ws) return null;
    if (organizationId && ws.organizationId !== organizationId) return null;
    return { ...ws };
  }

  async updateClientWorkspace(
    id: string,
    updates: Partial<ClientWorkspaceDTO>,
    organizationId?: string
  ): Promise<ClientWorkspaceDTO> {
    const existing = await this.getClientWorkspaceById(id, organizationId);
    if (!existing) {
      throw new Error(`Client workspace ${id} not found`);
    }
    const updated: ClientWorkspaceDTO = {
      ...existing,
      ...updates,
      id: existing.id,
      organizationId: existing.organizationId,
      updatedAt: new Date().toISOString(),
    };
    this.clientWorkspaces.set(id, updated);
    return updated;
  }

  async deleteClientWorkspace(id: string, organizationId: string): Promise<boolean> {
    const existing = await this.getClientWorkspaceById(id, organizationId);
    if (!existing) return false;
    return this.clientWorkspaces.delete(id);
  }
  private profiles: Map<string, UserProfileDTO> = new Map();
  private organizations: Map<string, OrganizationDTO> = new Map();
  private members: Map<string, OrganizationMemberDTO> = new Map();
  private calls: Map<string, CallRecordDTO> = new Map();
  private leads: Map<string, LeadDossierDTO> = new Map();
  private appointments: Map<string, AppointmentSlotDTO> = new Map();
  private agents: Map<string, AgentRecordDTO> = new Map();
  private auditLogs: Map<string, AuditLogDTO> = new Map();

  // Business Brain Collections
  private locations: Map<string, BusinessLocationDTO> = new Map();
  private services: Map<string, BusinessServiceDTO> = new Map();
  private staffMembers: Map<string, BusinessStaffDTO> = new Map();
  private operatingHours: Map<string, BusinessOperatingHoursDTO[]> = new Map();
  private policies: Map<string, BusinessPolicyDTO> = new Map();
  private faqs: Map<string, BusinessFAQDTO> = new Map();
  private facts: Map<string, BusinessFactDTO> = new Map();
  private sources: Map<string, KnowledgeSourceDTO> = new Map();
  private conflicts: Map<string, KnowledgeConflictDTO> = new Map();
  private snapshots: Map<string, BusinessBrainSnapshotDTO[]> = new Map();

  private documents: Map<string, KnowledgeDocumentDTO> = new Map();
  private chunks: Map<string, KnowledgeChunkDTO> = new Map();
  private jobs: Map<string, KnowledgeIngestionJobDTO> = new Map();
  private storageFiles: Map<string, { content: Buffer | string; mimeType: string; organizationId: string }> = new Map();

  // AI Employee Collections (Prompt 08)
  private aiEmployees: Map<string, AIEmployeeDTO> = new Map();
  private aiEmployeeVersions: Map<string, AIEmployeeVersionDTO> = new Map();
  private aiEmployeeTestSessions: Map<string, any> = new Map();

  // Conversation Orchestration Collections (Prompt 09)
  private conversations: Map<string, ConversationDTO> = new Map();
  private conversationMessages: Map<string, ConversationMessageDTO> = new Map();
  private conversationEvents: Map<string, ConversationEventDTO> = new Map();
  private conversationToolCalls: Map<string, ConversationToolCallDTO> = new Map();
  private conversationHandoffs: Map<string, ConversationHandoffDTO> = new Map();
  private conversationSummaries: Map<string, ConversationSummaryDTO> = new Map();

  // CRM Collections (Prompt 15)
  private contacts: Map<string, ContactDTO> = new Map();
  private crmLeads: Map<string, CRMLeadDTO> = new Map();
  private crmActivities: Map<string, CRMActivityDTO> = new Map();
  private crmOpportunities: Map<string, CRMOpportunityDTO> = new Map();

  // Handoff & Escalation Collections (Module 17)
  private handoffRecords: Map<string, ConversationHandoffRecordDTO> = new Map();
  private teams: Map<string, TeamDTO> = new Map();
  private teamMembers: Map<string, TeamMemberDTO> = new Map();
  private notifications: Map<string, NotificationDTO> = new Map();
  private notificationPreferences: Map<string, NotificationPreferencesDTO> = new Map();
  private handoffSLAs: Map<string, HandoffSLADTO> = new Map();
  private escalationPolicies: Map<string, EscalationPolicyDTO> = new Map();

  // Analytics & Usage Metering Collections (Module 18)
  private usageEvents: Map<string, UsageEventDTO> = new Map();
  private providerPricing: Map<string, ProviderPricingDefinitionDTO> = new Map();
  private usageLedger: Map<string, UsageLedgerRecordDTO> = new Map();
  private dailyAggregations: Map<string, DailyUsageAggregationDTO> = new Map();
  private usageAlertThresholds: Map<string, UsageAlertThresholdDTO> = new Map();
  private costAnomalyAlerts: Map<string, CostAnomalyAlertDTO> = new Map();

  // Billing, Plans & Subscriptions Collections (Module 19)
  private billingAccounts: Map<string, BillingAccountDTO> = new Map();
  private plans: Map<string, PlanDTO> = new Map();
  private planVersions: Map<string, PlanVersionDTO> = new Map();
  private subscriptions: Map<string, SubscriptionDTO> = new Map();
  private subscriptionEvents: Map<string, SubscriptionEventDTO> = new Map();
  private paymentRecords: Map<string, PaymentRecordDTO> = new Map();
  private billingInvoices: Map<string, BillingInvoiceDTO> = new Map();
  private billingProviderEvents: Map<string, BillingProviderEventDTO> = new Map();

  constructor() {
    this.seedCanonicalPlans();
  }

  private seedCanonicalPlans() {
    const now = new Date().toISOString();

    const starter: PlanDTO = {
      id: 'plan_starter',
      name: 'Starter Plan',
      slug: 'starter',
      description: 'Ideal for independent clinics & single offices',
      monthlyPrice: 4999,
      annualPrice: 49990,
      currency: 'INR',
      visibility: 'PUBLIC',
      status: 'ACTIVE',
      activeVersion: 'v1.0',
      entitlements: {
        maxAiEmployees: 1,
        maxLocations: 1,
        maxUsers: 5,
        maxKnowledgeSources: 10,
        maxKnowledgeStorageMb: 500,
        maxContacts: 1000,
        maxMonthlyVoiceMinutes: 600,
        maxMonthlySttSeconds: 36000,
        maxMonthlyTtsCharacters: 300000,
        maxMonthlyLlmTokens: 1000000,
        maxMonthlyCalls: 300,
        maxMonthlyOutboundCalls: 100,
        maxCampaignTargets: 200,
        maxAppointments: 500,
        voiceEnabled: true,
        outboundCallingEnabled: true,
        campaignsEnabled: true,
        knowledgeBaseEnabled: true,
        analyticsEnabled: true,
        advancedAnalyticsEnabled: false,
        humanHandoffEnabled: true,
        customAiEmployeeEnabled: false,
        apiAccessEnabled: false,
        webhooksEnabled: false,
        crmIntegrationsEnabled: false,
      },
      overageVoiceMinutePrice: 2.5,
      createdAt: now,
      updatedAt: now,
    };

    const growth: PlanDTO = {
      id: 'plan_growth',
      name: 'Growth Plan',
      slug: 'growth',
      description: 'For hospitals, busy clinics & real estate layout teams',
      monthlyPrice: 14999,
      annualPrice: 149990,
      currency: 'INR',
      visibility: 'PUBLIC',
      status: 'ACTIVE',
      activeVersion: 'v1.0',
      entitlements: {
        maxAiEmployees: 3,
        maxLocations: 3,
        maxUsers: 15,
        maxKnowledgeSources: 50,
        maxKnowledgeStorageMb: 2500,
        maxContacts: 10000,
        maxMonthlyVoiceMinutes: 2500,
        maxMonthlySttSeconds: 150000,
        maxMonthlyTtsCharacters: 1250000,
        maxMonthlyLlmTokens: 5000000,
        maxMonthlyCalls: 1500,
        maxMonthlyOutboundCalls: 800,
        maxCampaignTargets: 2000,
        maxAppointments: 2500,
        voiceEnabled: true,
        outboundCallingEnabled: true,
        campaignsEnabled: true,
        knowledgeBaseEnabled: true,
        analyticsEnabled: true,
        advancedAnalyticsEnabled: true,
        humanHandoffEnabled: true,
        customAiEmployeeEnabled: true,
        apiAccessEnabled: true,
        webhooksEnabled: true,
        crmIntegrationsEnabled: true,
      },
      overageVoiceMinutePrice: 2.2,
      createdAt: now,
      updatedAt: now,
    };

    const scale: PlanDTO = {
      id: 'plan_scale',
      name: 'Agency / Scale Plan',
      slug: 'scale',
      description: 'For digital agencies, hospital networks & multi-branch builders',
      monthlyPrice: 29999,
      annualPrice: 299990,
      currency: 'INR',
      visibility: 'PUBLIC',
      status: 'ACTIVE',
      activeVersion: 'v1.0',
      entitlements: {
        maxAiEmployees: 10,
        maxLocations: 10,
        maxUsers: 50,
        maxKnowledgeSources: 200,
        maxKnowledgeStorageMb: 10000,
        maxContacts: 50000,
        maxMonthlyVoiceMinutes: 6000,
        maxMonthlySttSeconds: 360000,
        maxMonthlyTtsCharacters: 3000000,
        maxMonthlyLlmTokens: 15000000,
        maxMonthlyCalls: 4000,
        maxMonthlyOutboundCalls: 2500,
        maxCampaignTargets: 10000,
        maxAppointments: 10000,
        voiceEnabled: true,
        outboundCallingEnabled: true,
        campaignsEnabled: true,
        knowledgeBaseEnabled: true,
        analyticsEnabled: true,
        advancedAnalyticsEnabled: true,
        humanHandoffEnabled: true,
        customAiEmployeeEnabled: true,
        apiAccessEnabled: true,
        webhooksEnabled: true,
        crmIntegrationsEnabled: true,
      },
      overageVoiceMinutePrice: 1.9,
      createdAt: now,
      updatedAt: now,
    };

    this.plans.set(starter.id, starter);
    this.plans.set(growth.id, growth);
    this.plans.set(scale.id, scale);
  }


  private seedDefaults() {
    const now = new Date().toISOString();

    // ----------------------------------------------------
    // Org 1: Ballari Residential Layouts (Real Estate)
    // ----------------------------------------------------
    const org1: OrganizationDTO = {
      id: 'a0000000-0000-0000-0000-000000000001',
      name: 'Ballari Residential Layouts',
      slug: 'ballari-plots',
      industry: 'REAL_ESTATE',
      status: 'ACTIVE',
      timezone: 'Asia/Kolkata',
      onboardingStatus: 'ready',
      billingTier: 'GROWTH',
      createdAt: now,
      updatedAt: now,
    };
    this.organizations.set(org1.id, org1);

    // Agent
    this.agents.set('b0000000-0000-0000-0000-000000000001', {
      id: 'b0000000-0000-0000-0000-000000000001',
      organizationId: org1.id,
      name: 'Sahana',
      role: 'Inbound Qualifier & Site Visit Booking Executive',
      language: 'KANGLISH_BUSINESS',
      status: 'LIVE',
      systemPrompt: 'You are Sahana, AI voice employee for Ballari Residential Layouts.',
      createdAt: now,
      updatedAt: now,
    });

    // Location
    this.locations.set('loc-1', {
      id: 'loc-1',
      organizationId: org1.id,
      name: 'Headquarters & Site Office',
      addressLine1: 'Survey No. 42/B, Siruguppa Bypass Road',
      addressLine2: 'Near Royal Circle',
      city: 'Ballari',
      state: 'Karnataka',
      pincode: '583101',
      phone: '+91 80 4719 2001',
      isPrimary: true,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });

    // Services / Offerings
    this.services.set('srv-1', {
      id: 'srv-1',
      organizationId: org1.id,
      name: '30x40 Residential Plot (1,200 sq.ft)',
      kannadaName: '30x40 ಅಳತೆಯ ನಿವೇಶನ (1,200 ಚದರಡಿ)',
      conversationalAlias: '30x40 plot',
      category: 'Residential Sites',
      description: 'DC Converted, BUDA Approved residential plot.',
      priceMinimum: 1800000,
      priceMaximum: 2200000,
      durationMinutes: 60,
      isBookableByAI: true,
      status: 'ACTIVE',
      authority: 'AUTHORITATIVE',
      createdAt: now,
      updatedAt: now,
    });

    this.services.set('srv-2', {
      id: 'srv-2',
      organizationId: org1.id,
      name: '40x60 Luxury Plot (2,400 sq.ft)',
      kannadaName: '40x60 ಐಷಾರಾಮಿ ನಿವೇಶನ',
      conversationalAlias: '40x60 plot',
      category: 'Residential Sites',
      description: 'Wide road facing plot with underground drainage.',
      priceMinimum: 3500000,
      priceMaximum: 4000000,
      durationMinutes: 60,
      isBookableByAI: true,
      status: 'ACTIVE',
      authority: 'AUTHORITATIVE',
      createdAt: now,
      updatedAt: now,
    });

    // Staff
    this.staffMembers.set('staff-1', {
      id: 'staff-1',
      organizationId: org1.id,
      fullName: 'Anand Kulkarni',
      kannadaName: 'ಆನಂದ್ ಕುಲಕರ್ಣಿ',
      designation: 'Senior Layout Consultant',
      availableDays: [0, 1, 2, 3, 4, 5, 6],
      isActive: true,
      status: 'ACTIVE',
      authority: 'AUTHORITATIVE',
      createdAt: now,
      updatedAt: now,
    });

    // Operating Hours (0=Sun, 1=Mon... 6=Sat)
    this.operatingHours.set(org1.id, [
      { id: 'h-0', organizationId: org1.id, dayOfWeek: 0, opensAt: '10:00', closesAt: '17:00', isClosed: false, note: 'Sunday Free Cab Site Visits' },
      { id: 'h-1', organizationId: org1.id, dayOfWeek: 1, opensAt: '09:00', closesAt: '19:00', isClosed: false },
      { id: 'h-2', organizationId: org1.id, dayOfWeek: 2, opensAt: '09:00', closesAt: '19:00', isClosed: false },
      { id: 'h-3', organizationId: org1.id, dayOfWeek: 3, opensAt: '09:00', closesAt: '19:00', isClosed: false },
      { id: 'h-4', organizationId: org1.id, dayOfWeek: 4, opensAt: '09:00', closesAt: '19:00', isClosed: false },
      { id: 'h-5', organizationId: org1.id, dayOfWeek: 5, opensAt: '09:00', closesAt: '19:00', isClosed: false },
      { id: 'h-6', organizationId: org1.id, dayOfWeek: 6, opensAt: '09:00', closesAt: '19:00', isClosed: false },
    ]);

    // Policies
    this.policies.set('pol-1', {
      id: 'pol-1',
      organizationId: org1.id,
      category: 'APPOINTMENT',
      title: 'Free Sunday Cab Transport Policy',
      policyStatement: 'Prospective buyers who confirm site visits are provided complimentary door-to-door cab transport on Sundays at 11:00 AM.',
      kannadaStatement: 'ಭಾನುವಾರದ ಸೈಟ್ ವೀಕ್ಷಣೆಗೆ ಉಚಿತ ಕ್ಯಾಬ್ ವ್ಯವಸ್ಥೆ ಇರುತ್ತದೆ.',
      enforcementLevel: 'INFORMATIONAL',
      status: 'ACTIVE',
      authority: 'AUTHORITATIVE',
      createdAt: now,
      updatedAt: now,
    });

    this.policies.set('pol-2', {
      id: 'pol-2',
      organizationId: org1.id,
      category: 'AI_RESTRICTION',
      title: 'Zero Unapproved Price Invention Rule',
      policyStatement: 'VANNI must NEVER fabricate plot availability, unapproved discounts, or promise unverified possession dates.',
      enforcementLevel: 'STRICT_BLOCK',
      status: 'ACTIVE',
      authority: 'AUTHORITATIVE',
      createdAt: now,
      updatedAt: now,
    });

    // FAQs
    this.faqs.set('faq-1', {
      id: 'faq-1',
      organizationId: org1.id,
      category: 'Bank Loans & Approvals',
      question: 'Plots ge bank loan siguththe alva?',
      answer: 'Haudu sir! SBI mathu HDFC bank inda 80% loan approval aaguththe.',
      language: 'KANGLISH',
      status: 'ACTIVE',
      authority: 'AUTHORITATIVE',
      createdAt: now,
      updatedAt: now,
    });

    // Facts
    this.facts.set(`${org1.id}:APPROVAL:RERA`, {
      id: 'fact-1',
      organizationId: org1.id,
      category: 'Approvals',
      key: 'RERA_NUMBER',
      value: 'PRM/KA/RERA/1251/310/PR/2024',
      authority: 'AUTHORITATIVE',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });

    // ----------------------------------------------------
    // Org 2: Apollo Specialty Clinic (Healthcare)
    // ----------------------------------------------------
    const org2: OrganizationDTO = {
      id: 'a0000000-0000-0000-0000-000000000002',
      name: 'Apollo Specialty Clinic',
      slug: 'apollo-clinic',
      industry: 'HEALTHCARE_HOSPITAL',
      status: 'ACTIVE',
      timezone: 'Asia/Kolkata',
      onboardingStatus: 'ready',
      billingTier: 'GROWTH',
      createdAt: now,
      updatedAt: now,
    };
    this.organizations.set(org2.id, org2);

    this.locations.set('loc-2', {
      id: 'loc-2',
      organizationId: org2.id,
      name: 'Main Hospital Building',
      addressLine1: 'Opposite District Court, Infantry Road',
      city: 'Ballari',
      state: 'Karnataka',
      pincode: '583104',
      phone: '+91 80 4719 2002',
      isPrimary: true,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });

    this.services.set('srv-3', {
      id: 'srv-3',
      organizationId: org2.id,
      name: 'Cardiology Consultation',
      kannadaName: 'ಹೃದ್ರೋಗ ತಜ್ಞರ ಸಮಾಲೋಚನೆ',
      conversationalAlias: 'Cardiologist appointment',
      category: 'Cardiology',
      priceMinimum: 750,
      durationMinutes: 20,
      isBookableByAI: true,
      status: 'ACTIVE',
      authority: 'AUTHORITATIVE',
      createdAt: now,
      updatedAt: now,
    });

    this.staffMembers.set('staff-2', {
      id: 'staff-2',
      organizationId: org2.id,
      fullName: 'Dr. Ramesh Patil',
      kannadaName: 'ಡಾ. ರಮೇಶ್ ಪಾಟೀಲ್',
      designation: 'Senior Interventional Cardiologist',
      specialization: 'Cardiology (MD, DM)',
      consultationFee: 750,
      availableDays: [1, 2, 3, 4, 5, 6],
      isActive: true,
      status: 'ACTIVE',
      authority: 'AUTHORITATIVE',
      createdAt: now,
      updatedAt: now,
    });

    this.operatingHours.set(org2.id, [
      { id: 'h2-1', organizationId: org2.id, dayOfWeek: 1, opensAt: '08:00', closesAt: '21:00', isClosed: false },
      { id: 'h2-2', organizationId: org2.id, dayOfWeek: 2, opensAt: '08:00', closesAt: '21:00', isClosed: false },
      { id: 'h2-3', organizationId: org2.id, dayOfWeek: 3, opensAt: '08:00', closesAt: '21:00', isClosed: false },
      { id: 'h2-4', organizationId: org2.id, dayOfWeek: 4, opensAt: '08:00', closesAt: '21:00', isClosed: false },
      { id: 'h2-5', organizationId: org2.id, dayOfWeek: 5, opensAt: '08:00', closesAt: '21:00', isClosed: false },
      { id: 'h2-6', organizationId: org2.id, dayOfWeek: 6, opensAt: '08:00', closesAt: '21:00', isClosed: false },
      { id: 'h2-0', organizationId: org2.id, dayOfWeek: 0, opensAt: '00:00', closesAt: '23:59', isClosed: false, note: '24x7 Emergency Casualty Only' },
    ]);

    this.policies.set('pol-3', {
      id: 'pol-3',
      organizationId: org2.id,
      category: 'AI_RESTRICTION',
      title: 'Zero Diagnostic Prescription Policy',
      policyStatement: 'AI cannot diagnose symptoms, prescribe medications, or override attending physicians.',
      enforcementLevel: 'STRICT_BLOCK',
      status: 'ACTIVE',
      authority: 'AUTHORITATIVE',
      createdAt: now,
      updatedAt: now,
    });

    // ----------------------------------------------------
    // Org 3: Sri Krishna Dental & Implant Clinic (DENTAL Reference MVP)
    // ----------------------------------------------------
    const org3: OrganizationDTO = {
      id: 'a0000000-0000-0000-0000-000000000003',
      name: 'Sri Krishna Dental & Implant Clinic',
      slug: 'krishna-dental',
      industry: 'DENTAL',
      status: 'ACTIVE',
      timezone: 'Asia/Kolkata',
      onboardingStatus: 'ready',
      billingTier: 'GROWTH',
      createdAt: now,
      updatedAt: now,
    };
    this.organizations.set(org3.id, org3);

    this.locations.set('loc-3', {
      id: 'loc-3',
      organizationId: org3.id,
      name: 'Main Dental Centre',
      addressLine1: 'Shop #4, Sri Krishna Complex, Gandhi Nagar',
      city: 'Ballari',
      state: 'Karnataka',
      pincode: '583103',
      phone: '+91 80 4719 2003',
      isPrimary: true,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });

    this.services.set('srv-dental-1', {
      id: 'srv-dental-1',
      organizationId: org3.id,
      name: 'Teeth Cleaning & Polishing (Scaling)',
      kannadaName: 'ಹಲ್ಲು ಸ್ವಚ್ಛಗೊಳಿಸುವಿಕೆ ಮತ್ತು ಹೊಳಪು (ಸ್ಕೇಲಿಂಗ್)',
      conversationalAlias: 'teeth cleaning',
      category: 'Preventive Dentistry',
      description: 'Ultrasonic removal of tartar, plaque, and stains with air-flow polishing.',
      priceMinimum: 800,
      priceMaximum: 1200,
      durationMinutes: 30,
      isBookableByAI: true,
      status: 'ACTIVE',
      authority: 'AUTHORITATIVE',
      createdAt: now,
      updatedAt: now,
    });

    this.services.set('srv-dental-2', {
      id: 'srv-dental-2',
      organizationId: org3.id,
      name: 'Root Canal Treatment (RCT)',
      kannadaName: 'ರೂಟ್ ಕೆನಾಲ್ ಚಿಕಿತ್ಸೆ (ಆರ್‌ಸಿಟಿ)',
      conversationalAlias: 'root canal',
      category: 'Endodontics',
      description: 'Single-sitting microscopic root canal therapy with digital rotary files.',
      priceMinimum: 3500,
      priceMaximum: 4500,
      durationMinutes: 45,
      isBookableByAI: true,
      status: 'ACTIVE',
      authority: 'AUTHORITATIVE',
      createdAt: now,
      updatedAt: now,
    });

    this.staffMembers.set('staff-dental-1', {
      id: 'staff-dental-1',
      organizationId: org3.id,
      fullName: 'Dr. Sneha Rao',
      kannadaName: 'ಡಾ. ಸ್ನೇಹಾ ರಾವ್',
      designation: 'Chief Dental Surgeon & Implantologist',
      specialization: 'Conservative Dentistry & Endodontics (BDS, MDS)',
      consultationFee: 300,
      availableDays: [1, 2, 3, 4, 5, 6],
      isActive: true,
      status: 'ACTIVE',
      authority: 'AUTHORITATIVE',
      createdAt: now,
      updatedAt: now,
    });

    this.operatingHours.set(org3.id, [
      { id: 'h3-1', organizationId: org3.id, dayOfWeek: 1, opensAt: '09:30', closesAt: '20:00', isClosed: false },
      { id: 'h3-2', organizationId: org3.id, dayOfWeek: 2, opensAt: '09:30', closesAt: '20:00', isClosed: false },
      { id: 'h3-3', organizationId: org3.id, dayOfWeek: 3, opensAt: '09:30', closesAt: '20:00', isClosed: false },
      { id: 'h3-4', organizationId: org3.id, dayOfWeek: 4, opensAt: '09:30', closesAt: '20:00', isClosed: false },
      { id: 'h3-5', organizationId: org3.id, dayOfWeek: 5, opensAt: '09:30', closesAt: '20:00', isClosed: false },
      { id: 'h3-6', organizationId: org3.id, dayOfWeek: 6, opensAt: '09:30', closesAt: '20:00', isClosed: false },
      { id: 'h3-0', organizationId: org3.id, dayOfWeek: 0, opensAt: '10:00', closesAt: '14:00', isClosed: false, note: 'Sunday Morning Dental Emergencies Only' },
    ]);

    this.policies.set('pol-dental-1', {
      id: 'pol-dental-1',
      organizationId: org3.id,
      category: 'AI_RESTRICTION',
      title: 'Dental Diagnosis & Medicine Disclaimer Rule',
      policyStatement: 'AI receptionist must NEVER recommend antibiotic dosages or diagnose tooth decay without clinical examination.',
      enforcementLevel: 'STRICT_BLOCK',
      status: 'ACTIVE',
      authority: 'AUTHORITATIVE',
      createdAt: now,
      updatedAt: now,
    });

    // ----------------------------------------------------
    // Seeded Documents & Chunks (Prompt 07)
    // ----------------------------------------------------
    this.documents.set('doc-1', {
      id: 'doc-1',
      organizationId: org1.id,
      sourceId: 'src-1',
      title: 'Ballari Palm Meadows Masterplan & RERA Approvals',
      documentType: 'WEBSITE_PAGE',
      contentStatus: 'READY',
      normalizedContent: 'Ballari Palm Meadows Phase 2 is an exclusive gated community layout with BUDA approval (Approval No. BUDA/2024/782). The project features 30x40 and 40x60 DC-converted sites with underground electricity, asphalted 40-foot main roads, sewage treatment plant, and children play park. Plot prices start from ₹2,400 per sq.ft. Bank loans up to 80% are approved from SBI, HDFC, and Canara Bank. Free cab pickup for site visits is available every Sunday.',
      language: 'EN',
      checksum: 'chk-org1-doc1',
      version: 1,
      wordCount: 65,
      charCount: 485,
      metadata: { authority: 'AUTHORITATIVE', chunkCount: 2 },
      createdAt: now,
      updatedAt: now,
    });

    this.chunks.set('chunk-org1-1', {
      id: 'chunk-org1-1',
      organizationId: org1.id,
      sourceId: 'src-1',
      documentId: 'doc-1',
      chunkIndex: 0,
      heading: 'Project Approvals & Township Specifications',
      content: 'Ballari Palm Meadows Phase 2 is an exclusive gated community layout with BUDA approval (Approval No. BUDA/2024/782). The project features 30x40 and 40x60 DC-converted sites with underground electricity, asphalted 40-foot main roads, and sewage treatment plant.',
      language: 'EN',
      authority: 'AUTHORITATIVE',
      tokenCount: 45,
      charCount: 250,
      metadata: { heading: 'Project Approvals & Township Specifications' },
      createdAt: now,
    });

    this.chunks.set('chunk-org1-2', {
      id: 'chunk-org1-2',
      organizationId: org1.id,
      sourceId: 'src-1',
      documentId: 'doc-1',
      chunkIndex: 1,
      heading: 'Plot Pricing, Bank Loans & Sunday Site Visits',
      content: 'Plot prices start from ₹2,400 per sq.ft. Bank loans up to 80% are approved from SBI, HDFC, and Canara Bank. Free cab pickup for site visits is available every Sunday.',
      language: 'EN',
      authority: 'AUTHORITATIVE',
      tokenCount: 35,
      charCount: 170,
      metadata: { heading: 'Plot Pricing, Bank Loans & Sunday Site Visits' },
      createdAt: now,
    });

    this.documents.set('doc-2', {
      id: 'doc-2',
      organizationId: org2.id,
      sourceId: 'src-2',
      title: 'Cardiology OPD Patient Information & Diagnostic Services',
      documentType: 'PDF',
      contentStatus: 'READY',
      normalizedContent: 'Apollo Specialty Clinic OPD operates from 8:00 AM to 9:00 PM Monday through Saturday. Dr. Ramesh Patil consults on weekdays. ECG, 2D-Echocardiogram, and Treadmill Stress Tests (TMT) are conducted on-site with same-day reports. Consultation fee is ₹750. 24x7 emergency casualty is available at the main hospital trauma wing.',
      language: 'EN',
      checksum: 'chk-org2-doc1',
      version: 1,
      wordCount: 58,
      charCount: 360,
      metadata: { authority: 'AUTHORITATIVE', chunkCount: 1 },
      createdAt: now,
      updatedAt: now,
    });

    this.chunks.set('chunk-org2-1', {
      id: 'chunk-org2-1',
      organizationId: org2.id,
      sourceId: 'src-2',
      documentId: 'doc-2',
      chunkIndex: 0,
      heading: 'Cardiology OPD Timings & Diagnostic Testing',
      content: 'Apollo Specialty Clinic OPD operates from 8:00 AM to 9:00 PM Monday through Saturday. Dr. Ramesh Patil consults on weekdays. ECG, 2D-Echocardiogram, and Treadmill Stress Tests (TMT) are conducted on-site with same-day reports. Consultation fee is ₹750.',
      language: 'EN',
      authority: 'AUTHORITATIVE',
      tokenCount: 48,
      charCount: 250,
      metadata: { heading: 'Cardiology OPD Timings & Diagnostic Testing' },
      createdAt: now,
    });

    this.documents.set('doc-3', {
      id: 'doc-3',
      organizationId: org3.id,
      sourceId: 'src-3',
      title: 'Sri Krishna Dental Clinic Services, RCT Pricing & Timing Guide',
      documentType: 'PDF',
      contentStatus: 'READY',
      normalizedContent: 'Sri Krishna Dental Clinic is located at Shop #4, Sri Krishna Complex, Gandhi Nagar, Ballari. Dr. Sneha Rao consults Monday through Saturday from 9:30 AM to 8:00 PM. Dental cleaning and scaling is ₹800 to ₹1,200. Single-sitting Root Canal Treatment (RCT) costs ₹3,500 to ₹4,500 depending on tooth complexity. Sunday morning emergency toothache relief is available from 10:00 AM to 2:00 PM.',
      language: 'EN',
      checksum: 'chk-org3-doc1',
      version: 1,
      wordCount: 65,
      charCount: 410,
      metadata: { authority: 'AUTHORITATIVE', chunkCount: 1 },
      createdAt: now,
      updatedAt: now,
    });

    this.chunks.set('chunk-org3-1', {
      id: 'chunk-org3-1',
      organizationId: org3.id,
      sourceId: 'src-3',
      documentId: 'doc-3',
      chunkIndex: 0,
      heading: 'Dental Services, Doctor Timings & RCT Pricing',
      content: 'Sri Krishna Dental Clinic is located at Gandhi Nagar, Ballari. Dr. Sneha Rao consults Monday through Saturday from 9:30 AM to 8:00 PM. Dental cleaning is ₹800 to ₹1,200. Single-sitting Root Canal Treatment (RCT) is ₹3,500 to ₹4,500. Sunday emergency hours are 10:00 AM to 2:00 PM.',
      language: 'EN',
      authority: 'AUTHORITATIVE',
      tokenCount: 52,
      charCount: 280,
      metadata: { heading: 'Dental Services, Doctor Timings & RCT Pricing' },
      createdAt: now,
    });

    // ----------------------------------------------------
    // Seeded AI Employees & Versions (Prompt 08)
    // ----------------------------------------------------
    const sahanaAgent: AIEmployeeDTO = {
      id: 'emp-org1-1',
      organizationId: org1.id,
      name: 'Sahana',
      displayName: 'Sahana — AI Sales & Site Visit Executive',
      description: 'Handles inquiries regarding BUDA-approved plots, pricing per sq.ft., bank loans, and organizes Sunday site visit cab bookings.',
      role: 'AI_SALES_ASSISTANT',
      industry: 'REAL_ESTATE',
      status: 'ACTIVE',
      activeVersion: 1,
      activeVersionId: 'ver-org1-1',
      identity: {
        name: 'Sahana',
        displayName: 'Sahana',
        role: 'AI_SALES_ASSISTANT',
        description: 'Authoritative AI sales executive for Ballari Palm Meadows',
        businessIntroduction: 'Namaskara, thank you for contacting Ballari Palm Meadows. I am Sahana, the layout sales assistant.',
        identifyAsAI: true,
      },
      objective: {
        primaryObjective: 'Qualify real estate buyers for Ballari Palm Meadows plots and coordinate Sunday site visits.',
        secondaryObjectives: [
          'Explain BUDA and RERA approvals',
          'Share bank loan partner options (SBI, HDFC, Canara)',
          'Collect buyer contact details and plot dimension preference',
        ],
        successCriteria: [
          'Buyer timeline and budget identified',
          'Site visit preference confirmed',
          'Contact details gathered',
        ],
      },
      personality: {
        preset: 'CONSULTATIVE_SALES_ASSISTANT',
        tone: 'WARM',
        conversationStyle: 'BALANCED',
        energy: 'ENTHUSIASTIC',
        customInstructions: 'Always be respectful. Speak in fluent Kannada or Kanglish when caller speaks Kannada. Never quote unauthorized plot prices or promise discounts.',
      },
      language: {
        primaryLanguage: 'kn-en',
        secondaryLanguages: ['en', 'kn'],
        conversationalMode: 'KANGLISH',
        allowSwitching: true,
      },
      capabilities: [
        { capability: 'ANSWER_QUESTIONS', enabled: true, requiresPermission: false },
        { capability: 'QUALIFY_LEAD', enabled: true, requiresPermission: false },
        { capability: 'COLLECT_CONTACT_DETAILS', enabled: true, requiresPermission: false },
        { capability: 'BOOK_APPOINTMENT', enabled: true, requiresPermission: true, notes: 'Sunday site visit slot booking' },
        { capability: 'CREATE_LEAD', enabled: true, requiresPermission: false },
        { capability: 'TRANSFER_TO_HUMAN', enabled: true, requiresPermission: false },
        { capability: 'CANCEL_APPOINTMENT', enabled: false, requiresPermission: true },
      ],
      knowledgeAccess: {
        accessLevel: 'ALL_BUSINESS_KNOWLEDGE',
        allowedSourceIds: [],
        restrictedCategories: ['INTERNAL_COMMISSIONS', 'STAFF_SALARIES'],
      },
      tools: [
        {
          toolName: 'site_visit_scheduler',
          displayName: 'Site Visit Scheduler',
          enabled: true,
          category: 'CALENDAR',
          isImplemented: true,
          permissions: { canExecute: true, requiresConfirmation: true },
        },
        {
          toolName: 'lead_dossier_crm',
          displayName: 'Lead Dossier CRM',
          enabled: true,
          category: 'CRM',
          isImplemented: true,
          permissions: { canExecute: true, requiresConfirmation: false },
        },
        {
          toolName: 'human_transfer',
          displayName: 'Human Telephony Transfer',
          enabled: true,
          category: 'TELEPHONY',
          isImplemented: true,
          permissions: { canExecute: true, requiresConfirmation: false },
        },
      ],
      escalation: {
        defaultDestinationType: 'SALES_TEAM',
        defaultDestinationTarget: '+91 98450 12345',
        triggers: [
          {
            triggerType: 'CUSTOMER_REQUEST_HUMAN',
            enabled: true,
            destinationType: 'SALES_TEAM',
            destinationTarget: '+91 98450 12345',
            priority: 'NORMAL',
            transferMessage: 'Connecting you with our layout sales director immediately.',
          },
          {
            triggerType: 'HIGH_VALUE_LEAD',
            enabled: true,
            destinationType: 'SALES_TEAM',
            destinationTarget: '+91 98450 12345',
            priority: 'HIGH',
            transferMessage: 'Connecting you to our senior commercial advisor.',
          },
        ],
      },
      policies: {
        enforceHealthcareGuardrails: false,
        enforceRealEstateGuardrails: true,
        enforceSalesGuardrails: true,
        noHallucinationEnforced: true,
        customPolicyIds: [],
      },
      conversationRules: {
        greetingStyle: 'WARM',
        questionStrategy: 'NATURAL_FLOW',
        responseLength: 'BALANCED',
        uncertaintyBehavior: 'STATE_UNCERTAINTY',
        silenceHandling: 'GENTLE_PROMPT',
      },
      createdAt: now,
      updatedAt: now,
    };

    const ananyaAgent: AIEmployeeDTO = {
      id: 'emp-org2-1',
      organizationId: org2.id,
      name: 'Ananya',
      displayName: 'Ananya — AI Healthcare Clinic Receptionist',
      description: 'Handles clinic OPD timings, doctor consultation inquiries, appointment scheduling, and routes emergency calls.',
      role: 'AI_RECEPTIONIST',
      industry: 'HEALTHCARE',
      status: 'ACTIVE',
      activeVersion: 1,
      activeVersionId: 'ver-org2-1',
      identity: {
        name: 'Ananya',
        displayName: 'Ananya',
        role: 'AI_RECEPTIONIST',
        description: 'Authoritative AI clinic receptionist for Apollo Specialty Clinic',
        businessIntroduction: 'Hello, thank you for calling Apollo Specialty Clinic. I am Ananya, the clinic AI receptionist.',
        identifyAsAI: true,
      },
      objective: {
        primaryObjective: 'Help patients schedule appointments and answer administrative clinic questions.',
        secondaryObjectives: [
          'Inform patients of OPD hours and consulting doctor schedules',
          'Provide consultation fee and diagnostic test information',
          'Direct medical emergencies immediately to trauma casualty',
        ],
        successCriteria: [
          'Patient question answered or consultation slot coordinated',
          'Zero medical diagnosis provided',
          'Emergency detected and escalated immediately',
        ],
      },
      personality: {
        preset: 'PROFESSIONAL_RECEPTIONIST',
        tone: 'PROFESSIONAL',
        conversationStyle: 'BALANCED',
        energy: 'CALM',
        customInstructions: 'Speak clearly and calmly. Never diagnose illnesses or recommend medications. If patient describes acute distress or emergency, trigger immediate casualty escalation.',
      },
      language: {
        primaryLanguage: 'en',
        secondaryLanguages: ['kn'],
        conversationalMode: 'KANGLISH',
        allowSwitching: true,
      },
      capabilities: [
        { capability: 'ANSWER_QUESTIONS', enabled: true, requiresPermission: false },
        { capability: 'BOOK_APPOINTMENT', enabled: true, requiresPermission: true, notes: 'OPD doctor appointment booking' },
        { capability: 'CHECK_AVAILABILITY', enabled: true, requiresPermission: false },
        { capability: 'COLLECT_CONTACT_DETAILS', enabled: true, requiresPermission: false },
        { capability: 'TRANSFER_TO_HUMAN', enabled: true, requiresPermission: false },
        { capability: 'CANCEL_APPOINTMENT', enabled: false, requiresPermission: true },
      ],
      knowledgeAccess: {
        accessLevel: 'ALL_BUSINESS_KNOWLEDGE',
        allowedSourceIds: [],
        restrictedCategories: ['INTERNAL_STAFF_NOTES', 'FINANCIAL_REPORTS'],
      },
      tools: [
        {
          toolName: 'opd_appointment_scheduler',
          displayName: 'OPD Appointment Scheduler',
          enabled: true,
          category: 'CALENDAR',
          isImplemented: true,
          permissions: { canExecute: true, requiresConfirmation: true },
        },
        {
          toolName: 'emergency_casualty_transfer',
          displayName: 'Casualty Emergency Transfer',
          enabled: true,
          category: 'TELEPHONY',
          isImplemented: true,
          permissions: { canExecute: true, requiresConfirmation: false },
        },
      ],
      escalation: {
        defaultDestinationType: 'RECEPTION',
        defaultDestinationTarget: '+91 80 2345 6789',
        triggers: [
          {
            triggerType: 'EMERGENCY',
            enabled: true,
            destinationType: 'SPECIFIC_STAFF',
            destinationTarget: 'Casualty Trauma Desk',
            priority: 'CRITICAL',
            transferMessage: 'This sounds like an emergency. I am routing your call immediately to our 24x7 trauma casualty team.',
          },
          {
            triggerType: 'CUSTOMER_REQUEST_HUMAN',
            enabled: true,
            destinationType: 'RECEPTION',
            destinationTarget: '+91 80 2345 6789',
            priority: 'NORMAL',
            transferMessage: 'Connecting you to our clinic reception desk now.',
          },
        ],
      },
      policies: {
        enforceHealthcareGuardrails: true,
        enforceRealEstateGuardrails: false,
        enforceSalesGuardrails: false,
        noHallucinationEnforced: true,
        customPolicyIds: [],
      },
      conversationRules: {
        greetingStyle: 'FORMAL',
        questionStrategy: 'ONE_BY_ONE',
        responseLength: 'BRIEF',
        uncertaintyBehavior: 'ASK_CLARIFICATION',
        silenceHandling: 'GENTLE_PROMPT',
      },
      createdAt: now,
      updatedAt: now,
    };

    const kavyaAgent: AIEmployeeDTO = {
      id: 'emp-org3-1',
      organizationId: org3.id,
      name: 'Kavya',
      displayName: 'Kavya — AI Dental Clinic Receptionist',
      description: 'Answers patient calls in polite Kannada and English, checks Dr. Sneha availability, schedules dental appointments, and triages toothache inquiries.',
      role: 'AI_RECEPTIONIST',
      industry: 'DENTAL',
      status: 'ACTIVE',
      activeVersion: 1,
      activeVersionId: 'ver-org3-1',
      identity: {
        name: 'Kavya',
        displayName: 'Kavya',
        role: 'AI_RECEPTIONIST',
        description: 'Authoritative AI clinic receptionist for Sri Krishna Dental & Implant Clinic',
        businessIntroduction: 'Namaskara! Thank you for calling Sri Krishna Dental Clinic. I am Kavya, the AI clinic receptionist. How may I assist you today?',
        identifyAsAI: true,
      },
      objective: {
        primaryObjective: 'Help dental patients check clinic hours, coordinate appointments with Dr. Sneha Rao, and answer treatment fee questions.',
        secondaryObjectives: [
          'Inform patients of scaling and RCT price estimates',
          'Coordinate appointment slots without double booking',
          'Escalate acute toothache or severe pain to clinic staff desk',
        ],
        successCriteria: [
          'Appointment slot verified and confirmed',
          'Zero medical prescriptions or antibiotics prescribed',
          'Clear bilingual communication in Kannada and English',
        ],
      },
      personality: {
        preset: 'PROFESSIONAL_RECEPTIONIST',
        tone: 'WARM',
        conversationStyle: 'BALANCED',
        energy: 'CALM',
        customInstructions: 'Speak courteously in natural Kannada or Kanglish. Address patient respectfully. Never promise dental cures without clinical consultation.',
      },
      language: {
        primaryLanguage: 'kn-en',
        secondaryLanguages: ['kn', 'en'],
        conversationalMode: 'KANGLISH',
        allowSwitching: true,
      },
      capabilities: [
        { capability: 'ANSWER_QUESTIONS', enabled: true, requiresPermission: false },
        { capability: 'BOOK_APPOINTMENT', enabled: true, requiresPermission: true, notes: 'Dental consultation and scaling booking' },
        { capability: 'CHECK_AVAILABILITY', enabled: true, requiresPermission: false },
        { capability: 'COLLECT_CONTACT_DETAILS', enabled: true, requiresPermission: false },
        { capability: 'TRANSFER_TO_HUMAN', enabled: true, requiresPermission: false },
        { capability: 'CANCEL_APPOINTMENT', enabled: false, requiresPermission: true },
      ],
      knowledgeAccess: {
        accessLevel: 'ALL_BUSINESS_KNOWLEDGE',
        allowedSourceIds: [],
        restrictedCategories: ['INTERNAL_FINANCES'],
      },
      tools: [
        {
          toolName: 'dental_appointment_scheduler',
          displayName: 'Dental Appointment Scheduler',
          enabled: true,
          category: 'CALENDAR',
          isImplemented: true,
          permissions: { canExecute: true, requiresConfirmation: true },
        },
        {
          toolName: 'request_human_handoff',
          displayName: 'Front Desk Handoff',
          enabled: true,
          category: 'TELEPHONY',
          isImplemented: true,
          permissions: { canExecute: true, requiresConfirmation: false },
        },
      ],
      escalation: {
        defaultDestinationType: 'RECEPTION',
        defaultDestinationTarget: '+91 80 4719 2003',
        triggers: [
          {
            triggerType: 'CUSTOMER_REQUEST_HUMAN',
            enabled: true,
            destinationType: 'RECEPTION',
            destinationTarget: '+91 80 4719 2003',
            priority: 'NORMAL',
            transferMessage: 'Sure, let me connect you directly to our front desk team.',
          },
        ],
      },
      policies: {
        enforceHealthcareGuardrails: true,
        enforceRealEstateGuardrails: false,
        enforceSalesGuardrails: false,
        noHallucinationEnforced: true,
        customPolicyIds: [],
      },
      conversationRules: {
        greetingStyle: 'WARM',
        questionStrategy: 'ONE_BY_ONE',
        responseLength: 'BALANCED',
        uncertaintyBehavior: 'ASK_CLARIFICATION',
        silenceHandling: 'GENTLE_PROMPT',
      },
      createdAt: now,
      updatedAt: now,
    };

    this.aiEmployees.set(sahanaAgent.id, sahanaAgent);
    this.aiEmployees.set(ananyaAgent.id, ananyaAgent);
    this.aiEmployees.set(kavyaAgent.id, kavyaAgent);

    // Also populate legacy agents map for full backwards compatibility
    this.agents.set(sahanaAgent.id, {
      id: sahanaAgent.id,
      organizationId: sahanaAgent.organizationId,
      name: sahanaAgent.name,
      role: sahanaAgent.role,
      language: sahanaAgent.language.primaryLanguage,
      status: sahanaAgent.status,
      systemPrompt: sahanaAgent.objective.primaryObjective,
      createdAt: sahanaAgent.createdAt,
      updatedAt: sahanaAgent.updatedAt,
    });
    this.agents.set(ananyaAgent.id, {
      id: ananyaAgent.id,
      organizationId: ananyaAgent.organizationId,
      name: ananyaAgent.name,
      role: ananyaAgent.role,
      language: ananyaAgent.language.primaryLanguage,
      status: ananyaAgent.status,
      systemPrompt: ananyaAgent.objective.primaryObjective,
      createdAt: ananyaAgent.createdAt,
      updatedAt: ananyaAgent.updatedAt,
    });
    this.agents.set(kavyaAgent.id, {
      id: kavyaAgent.id,
      organizationId: kavyaAgent.organizationId,
      name: kavyaAgent.name,
      role: kavyaAgent.role,
      language: kavyaAgent.language.primaryLanguage,
      status: kavyaAgent.status,
      systemPrompt: kavyaAgent.objective.primaryObjective,
      createdAt: kavyaAgent.createdAt,
      updatedAt: kavyaAgent.updatedAt,
    });

    // Seed Version 1 for both agents
    this.aiEmployeeVersions.set(`${sahanaAgent.id}-v1`, {
      id: 'ver-org1-1',
      organizationId: org1.id,
      agentId: sahanaAgent.id,
      version: 1,
      status: 'ACTIVE',
      changelog: 'Initial publication of Sahana Real Estate Sales Assistant v1.0',
      snapshot: {
        agentId: sahanaAgent.id,
        organizationId: org1.id,
        version: 1,
        identity: sahanaAgent.identity,
        objective: sahanaAgent.objective,
        personality: sahanaAgent.personality,
        language: sahanaAgent.language,
        capabilities: sahanaAgent.capabilities,
        knowledgeAccess: sahanaAgent.knowledgeAccess,
        tools: sahanaAgent.tools,
        escalation: sahanaAgent.escalation,
        policies: sahanaAgent.policies,
        conversationRules: sahanaAgent.conversationRules,
        guardrails: {
          healthcare: false,
          realEstate: true,
          noHallucination: true,
          instructionPrecedence: [
            'PLATFORM_SAFETY',
            'LEGAL_COMPLIANCE_NON_DECEPTIVE_AI',
            'INDUSTRY_GUARDRAILS_REAL_ESTATE_PRICE_PROTECTION',
            'BUSINESS_POLICIES',
            'BUSINESS_BRAIN_AUTHORITATIVE_DATA',
            'AGENT_CAPABILITY_PERMISSIONS',
            'AGENT_PRIMARY_OBJECTIVE',
            'PERSONALITY_AND_TONE',
            'CUSTOM_INSTRUCTIONS',
            'CONVERSATION_CONTEXT',
          ],
        },
        businessBrainReference: {
          organizationId: org1.id,
          industry: org1.industry,
        },
        compiledAt: now,
      },
      publishedAt: now,
      createdAt: now,
    });

    this.aiEmployeeVersions.set(`${ananyaAgent.id}-v1`, {
      id: 'ver-org2-1',
      organizationId: org2.id,
      agentId: ananyaAgent.id,
      version: 1,
      status: 'ACTIVE',
      changelog: 'Initial publication of Ananya Healthcare Clinic Receptionist v1.0',
      snapshot: {
        agentId: ananyaAgent.id,
        organizationId: org2.id,
        version: 1,
        identity: ananyaAgent.identity,
        objective: ananyaAgent.objective,
        personality: ananyaAgent.personality,
        language: ananyaAgent.language,
        capabilities: ananyaAgent.capabilities,
        knowledgeAccess: ananyaAgent.knowledgeAccess,
        tools: ananyaAgent.tools,
        escalation: ananyaAgent.escalation,
        policies: ananyaAgent.policies,
        conversationRules: ananyaAgent.conversationRules,
        guardrails: {
          healthcare: true,
          realEstate: false,
          noHallucination: true,
          instructionPrecedence: [
            'PLATFORM_SAFETY',
            'LEGAL_COMPLIANCE_NON_DECEPTIVE_AI',
            'INDUSTRY_GUARDRAILS_HEALTHCARE_ZERO_DIAGNOSIS',
            'BUSINESS_POLICIES',
            'BUSINESS_BRAIN_AUTHORITATIVE_DATA',
            'AGENT_CAPABILITY_PERMISSIONS',
            'AGENT_PRIMARY_OBJECTIVE',
            'PERSONALITY_AND_TONE',
            'CUSTOM_INSTRUCTIONS',
            'CONVERSATION_CONTEXT',
          ],
        },
        businessBrainReference: {
          organizationId: org2.id,
          industry: org2.industry,
        },
        compiledAt: now,
      },
      publishedAt: now,
      createdAt: now,
    });

    this.aiEmployeeVersions.set(`${kavyaAgent.id}-v1`, {
      id: 'ver-org3-1',
      organizationId: org3.id,
      agentId: kavyaAgent.id,
      version: 1,
      status: 'ACTIVE',
      changelog: 'Initial publication of Kavya Dental Clinic AI Receptionist v1.0',
      snapshot: {
        agentId: kavyaAgent.id,
        organizationId: org3.id,
        version: 1,
        identity: kavyaAgent.identity,
        objective: kavyaAgent.objective,
        personality: kavyaAgent.personality,
        language: kavyaAgent.language,
        capabilities: kavyaAgent.capabilities,
        knowledgeAccess: kavyaAgent.knowledgeAccess,
        tools: kavyaAgent.tools,
        escalation: kavyaAgent.escalation,
        policies: kavyaAgent.policies,
        conversationRules: kavyaAgent.conversationRules,
        guardrails: {
          healthcare: true,
          realEstate: false,
          noHallucination: true,
          instructionPrecedence: [
            'PLATFORM_SAFETY',
            'LEGAL_COMPLIANCE_NON_DECEPTIVE_AI',
            'INDUSTRY_GUARDRAILS_HEALTHCARE_ZERO_DIAGNOSIS',
            'BUSINESS_POLICIES',
            'BUSINESS_BRAIN_AUTHORITATIVE_DATA',
            'AGENT_CAPABILITY_PERMISSIONS',
            'AGENT_PRIMARY_OBJECTIVE',
            'PERSONALITY_AND_TONE',
            'CUSTOM_INSTRUCTIONS',
            'CONVERSATION_CONTEXT',
          ],
        },
        businessBrainReference: {
          organizationId: org3.id,
          industry: org3.industry,
        },
        compiledAt: now,
      },
      publishedAt: now,
      createdAt: now,
    });
  }

  // --- Profiles ---
  async getProfileById(userId: string): Promise<UserProfileDTO | null> {
    return this.profiles.get(userId) || null;
  }
  async saveProfile(profile: UserProfileDTO): Promise<void> {
    this.profiles.set(profile.id, { ...profile, updatedAt: new Date().toISOString() });
  }

  // --- Organizations ---
  async getOrganizations(): Promise<OrganizationDTO[]> {
    return Array.from(this.organizations.values());
  }
  async getOrganizationById(id: string): Promise<OrganizationDTO | null> {
    return this.organizations.get(id) || null;
  }
  async getOrganizationBySlug(slug: string): Promise<OrganizationDTO | null> {
    for (const org of this.organizations.values()) {
      if (org.slug === slug) return org;
    }
    return null;
  }
  async saveOrganization(org: OrganizationDTO): Promise<void> {
    this.organizations.set(org.id, { ...org, updatedAt: new Date().toISOString() });
  }

  // --- Members ---
  async getMembers(organizationId: string): Promise<OrganizationMemberDTO[]> {
    return Array.from(this.members.values()).filter(m => m.organizationId === organizationId);
  }
  async getMembersByUserId(userId: string): Promise<OrganizationMemberDTO[]> {
    return Array.from(this.members.values()).filter(m => m.userId === userId);
  }
  async saveMember(member: OrganizationMemberDTO): Promise<void> {
    this.members.set(member.id, { ...member, updatedAt: new Date().toISOString() });
  }
  async deleteMember(id: string): Promise<void> {
    this.members.delete(id);
  }

  // --- Calls ---
  async getCalls(organizationId?: string): Promise<CallRecordDTO[]> {
    const all = Array.from(this.calls.values());
    if (organizationId) return all.filter(c => c.tenantId === organizationId);
    return all;
  }
  async getCallById(id: string, organizationId?: string): Promise<CallRecordDTO | null> {
    const call = this.calls.get(id);
    if (!call) return null;
    if (organizationId && call.tenantId !== organizationId) return null;
    return call;
  }
  async saveCall(call: CallRecordDTO): Promise<void> {
    this.calls.set(call.id, call);
  }

  // --- Leads ---
  async getLeads(organizationId?: string): Promise<LeadDossierDTO[]> {
    const all = Array.from(this.leads.values());
    if (organizationId) return all.filter(l => l.tenantId === organizationId);
    return all;
  }
  async saveLead(lead: LeadDossierDTO): Promise<void> {
    this.leads.set(lead.id, lead);
  }

  // --- Appointments ---
  async getAppointments(organizationId?: string): Promise<AppointmentSlotDTO[]> {
    const all = Array.from(this.appointments.values());
    if (organizationId) return all.filter(a => a.tenantId === organizationId);
    return all;
  }
  async getAppointmentById(id: string, organizationId?: string): Promise<AppointmentSlotDTO | null> {
    const apt = this.appointments.get(id) || null;
    if (!apt) return null;
    if (organizationId && apt.tenantId !== organizationId) return null;
    return apt;
  }
  async saveAppointment(appointment: AppointmentSlotDTO): Promise<void> {
    this.appointments.set(appointment.id, appointment);
  }
  async updateAppointment(id: string, partial: Partial<AppointmentSlotDTO>, organizationId?: string): Promise<AppointmentSlotDTO | null> {
    const existing = await this.getAppointmentById(id, organizationId);
    if (!existing) return null;
    const updated = { ...existing, ...partial };
    this.appointments.set(id, updated);
    return updated;
  }
  async deleteAppointment(id: string, organizationId?: string): Promise<void> {
    const existing = await this.getAppointmentById(id, organizationId);
    if (existing) {
      this.appointments.delete(id);
    }
  }

  async getStaffById(id: string, organizationId?: string): Promise<BusinessStaffDTO | null> {
    const st = this.staffMembers.get(id) || null;
    if (!st) return null;
    if (organizationId && st.organizationId !== organizationId) return null;
    return st;
  }
  async updateStaff(id: string, partial: Partial<BusinessStaffDTO>, organizationId?: string): Promise<BusinessStaffDTO | null> {
    const existing = await this.getStaffById(id, organizationId);
    if (!existing) return null;
    const updated = { ...existing, ...partial, updatedAt: new Date().toISOString() };
    this.staffMembers.set(id, updated);
    return updated;
  }

  // ==========================================
  // REAL ESTATE PROPERTY INVENTORY METHODS
  // ==========================================
  async getProperties(
    workspaceId?: string,
    filters?: {
      propertyType?: string;
      status?: string;
      locality?: string;
      minPrice?: number;
      maxPrice?: number;
      search?: string;
    }
  ): Promise<PropertyDTO[]> {
    let list = Array.from(this.properties.values());
    if (workspaceId) {
      list = list.filter((p) => p.workspaceId === workspaceId || p.organizationId === workspaceId);
    }
    if (filters) {
      if (filters.propertyType) {
        list = list.filter((p) => p.propertyType.toLowerCase() === filters.propertyType!.toLowerCase());
      }
      if (filters.status) {
        list = list.filter((p) => p.status.toLowerCase() === filters.status!.toLowerCase());
      }
      if (filters.locality) {
        list = list.filter((p) => p.locality.toLowerCase().includes(filters.locality!.toLowerCase()));
      }
      if (filters.minPrice !== undefined) {
        list = list.filter((p) => p.pricing.basePrice >= filters.minPrice!);
      }
      if (filters.maxPrice !== undefined) {
        list = list.filter((p) => p.pricing.basePrice <= filters.maxPrice!);
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        list = list.filter((p) =>
          p.name.toLowerCase().includes(q) ||
          p.referenceCode.toLowerCase().includes(q) ||
          p.locality.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
        );
      }
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getPropertyById(id: string, workspaceId?: string): Promise<PropertyDTO | null> {
    const byId = this.properties.get(id);
    if (byId) {
      if (workspaceId && byId.workspaceId !== workspaceId && byId.organizationId !== workspaceId) return null;
      return { ...byId };
    }
    for (const p of this.properties.values()) {
      if (p.referenceCode === id) {
        if (workspaceId && p.workspaceId !== workspaceId && p.organizationId !== workspaceId) return null;
        return { ...p };
      }
    }
    return null;
  }

  async saveProperty(property: PropertyDTO): Promise<void> {
    this.properties.set(property.id, { ...property });
  }

  async updateProperty(
    id: string,
    partial: Partial<PropertyDTO>,
    workspaceId?: string
  ): Promise<PropertyDTO | null> {
    const existing = await this.getPropertyById(id, workspaceId);
    if (!existing) return null;
    const updated: PropertyDTO = {
      ...existing,
      ...partial,
      updatedAt: new Date().toISOString(),
    };
    this.properties.set(id, updated);
    return { ...updated };
  }

  async deleteProperty(id: string, workspaceId?: string): Promise<boolean> {
    const existing = await this.getPropertyById(id, workspaceId);
    if (!existing) return false;
    this.properties.delete(id);
    return true;
  }

  // --- Agents ---
  async getAgents(organizationId?: string): Promise<AgentRecordDTO[]> {
    const all = Array.from(this.agents.values());
    if (organizationId) return all.filter(a => a.organizationId === organizationId);
    return all;
  }
  async saveAgent(agent: AgentRecordDTO): Promise<void> {
    this.agents.set(agent.id, { ...agent, updatedAt: new Date().toISOString() });
  }

  // --- Audit Logs ---
  async getAuditLogs(organizationId: string): Promise<AuditLogDTO[]> {
    return Array.from(this.auditLogs.values()).filter(l => l.organizationId === organizationId);
  }
  async saveAuditLog(log: AuditLogDTO): Promise<void> {
    this.auditLogs.set(log.id, log);
  }

  // ==========================================
  // BUSINESS BRAIN ENTITIES (TENANT GATED)
  // ==========================================
  async getLocations(organizationId: string): Promise<BusinessLocationDTO[]> {
    return Array.from(this.locations.values()).filter(l => l.organizationId === organizationId);
  }
  async saveLocation(location: BusinessLocationDTO): Promise<void> {
    this.locations.set(location.id, { ...location, updatedAt: new Date().toISOString() });
  }
  async deleteLocation(id: string, organizationId: string): Promise<void> {
    const loc = this.locations.get(id);
    if (loc && loc.organizationId === organizationId) {
      this.locations.delete(id);
    }
  }

  async getServices(organizationId: string): Promise<BusinessServiceDTO[]> {
    return Array.from(this.services.values()).filter(s => s.organizationId === organizationId);
  }
  async saveService(service: BusinessServiceDTO): Promise<void> {
    this.services.set(service.id, { ...service, updatedAt: new Date().toISOString() });
  }
  async deleteService(id: string, organizationId: string): Promise<void> {
    const s = this.services.get(id);
    if (s && s.organizationId === organizationId) {
      this.services.delete(id);
    }
  }

  async getStaff(organizationId: string): Promise<BusinessStaffDTO[]> {
    return Array.from(this.staffMembers.values()).filter(st => st.organizationId === organizationId);
  }
  async saveStaff(staff: BusinessStaffDTO): Promise<void> {
    this.staffMembers.set(staff.id, { ...staff, updatedAt: new Date().toISOString() });
  }
  async deleteStaff(id: string, organizationId: string): Promise<void> {
    const st = this.staffMembers.get(id);
    if (st && st.organizationId === organizationId) {
      this.staffMembers.delete(id);
    }
  }

  async getOperatingHours(organizationId: string): Promise<BusinessOperatingHoursDTO[]> {
    return this.operatingHours.get(organizationId) || [];
  }
  async saveOperatingHours(organizationId: string, hours: BusinessOperatingHoursDTO[]): Promise<void> {
    this.operatingHours.set(organizationId, hours);
  }

  async getPolicies(organizationId: string): Promise<BusinessPolicyDTO[]> {
    return Array.from(this.policies.values()).filter(p => p.organizationId === organizationId);
  }
  async savePolicy(policy: BusinessPolicyDTO): Promise<void> {
    this.policies.set(policy.id, { ...policy, updatedAt: new Date().toISOString() });
  }
  async deletePolicy(id: string, organizationId: string): Promise<void> {
    const p = this.policies.get(id);
    if (p && p.organizationId === organizationId) {
      this.policies.delete(id);
    }
  }

  async getFAQs(organizationId: string): Promise<BusinessFAQDTO[]> {
    return Array.from(this.faqs.values()).filter(f => f.organizationId === organizationId);
  }
  async saveFAQ(faq: BusinessFAQDTO): Promise<void> {
    this.faqs.set(faq.id, { ...faq, updatedAt: new Date().toISOString() });
  }
  async deleteFAQ(id: string, organizationId: string): Promise<void> {
    const f = this.faqs.get(id);
    if (f && f.organizationId === organizationId) {
      this.faqs.delete(id);
    }
  }

  async getFacts(organizationId: string): Promise<BusinessFactDTO[]> {
    return Array.from(this.facts.values()).filter(f => f.organizationId === organizationId);
  }
  async saveFact(fact: BusinessFactDTO): Promise<void> {
    this.facts.set(`${fact.organizationId}:${fact.category}:${fact.key}`, { ...fact, updatedAt: new Date().toISOString() });
  }
  async deleteFact(id: string, organizationId: string): Promise<void> {
    for (const [k, v] of this.facts.entries()) {
      if (v.id === id && v.organizationId === organizationId) {
        this.facts.delete(k);
        break;
      }
    }
  }

  async getKnowledgeSources(organizationId: string): Promise<KnowledgeSourceDTO[]> {
    return Array.from(this.sources.values()).filter(s => s.organizationId === organizationId);
  }
  async saveKnowledgeSource(source: KnowledgeSourceDTO): Promise<void> {
    this.sources.set(source.id, { ...source, updatedAt: new Date().toISOString() });
  }

  async getConflicts(organizationId: string): Promise<KnowledgeConflictDTO[]> {
    return Array.from(this.conflicts.values()).filter(c => c.organizationId === organizationId);
  }
  async saveConflict(conflict: KnowledgeConflictDTO): Promise<void> {
    this.conflicts.set(conflict.id, conflict);
  }
  async resolveConflict(conflictId: string, resolvedValue: string, organizationId: string): Promise<void> {
    const c = this.conflicts.get(conflictId);
    if (c && c.organizationId === organizationId) {
      c.status = 'RESOLVED';
      c.resolvedValue = resolvedValue;
      this.conflicts.set(conflictId, c);
    }
  }

  async getLatestSnapshot(organizationId: string): Promise<BusinessBrainSnapshotDTO | null> {
    const list = this.snapshots.get(organizationId) || [];
    if (list.length === 0) return null;
    return list[list.length - 1];
  }
  async saveSnapshot(snapshot: BusinessBrainSnapshotDTO): Promise<void> {
    const list = this.snapshots.get(snapshot.organizationId) || [];
    list.push(snapshot);
    this.snapshots.set(snapshot.organizationId, list);
  }

  // ==========================================
  // KNOWLEDGE INGESTION & RETRIEVAL (PROMPT 07)
  // ==========================================
  async getDocuments(organizationId: string, sourceId?: string): Promise<KnowledgeDocumentDTO[]> {
    return Array.from(this.documents.values()).filter(d => {
      if (d.organizationId !== organizationId) return false;
      if (sourceId && d.sourceId !== sourceId) return false;
      return true;
    });
  }

  async getDocumentById(id: string, organizationId?: string): Promise<KnowledgeDocumentDTO | null> {
    const doc = this.documents.get(id);
    if (!doc) return null;
    if (organizationId && doc.organizationId !== organizationId) return null;
    return doc;
  }

  async saveDocument(doc: KnowledgeDocumentDTO): Promise<void> {
    this.documents.set(doc.id, { ...doc, updatedAt: new Date().toISOString() });
  }

  async updateDocumentStatus(
    id: string,
    status: DocumentProcessingStatus,
    organizationId: string,
    errorMessage?: string
  ): Promise<void> {
    const doc = this.documents.get(id);
    if (doc && doc.organizationId === organizationId) {
      doc.contentStatus = status;
      if (errorMessage) doc.errorMessage = errorMessage;
      doc.updatedAt = new Date().toISOString();
      this.documents.set(id, doc);
    }
  }

  async deleteDocument(id: string, organizationId: string): Promise<void> {
    const doc = this.documents.get(id);
    if (doc && doc.organizationId === organizationId) {
      this.documents.delete(id);
      await this.deleteChunksByDocument(id, organizationId);
    }
  }

  async getChunks(organizationId: string, documentId?: string): Promise<KnowledgeChunkDTO[]> {
    return Array.from(this.chunks.values()).filter(c => {
      if (c.organizationId !== organizationId) return false;
      if (documentId && c.documentId !== documentId) return false;
      return true;
    });
  }

  async saveChunks(chunks: KnowledgeChunkDTO[]): Promise<void> {
    for (const chunk of chunks) {
      this.chunks.set(chunk.id, chunk);
    }
  }

  async deleteChunksByDocument(documentId: string, organizationId: string): Promise<void> {
    for (const [id, chunk] of this.chunks.entries()) {
      if (chunk.documentId === documentId && chunk.organizationId === organizationId) {
        this.chunks.delete(id);
      }
    }
  }

  async getJobs(organizationId: string, sourceId?: string): Promise<KnowledgeIngestionJobDTO[]> {
    return Array.from(this.jobs.values()).filter(j => {
      if (j.organizationId !== organizationId) return false;
      if (sourceId && j.sourceId !== sourceId) return false;
      return true;
    });
  }

  async getJobById(id: string, organizationId?: string): Promise<KnowledgeIngestionJobDTO | null> {
    const job = this.jobs.get(id);
    if (!job) return null;
    if (organizationId && job.organizationId !== organizationId) return null;
    return job;
  }

  async saveJob(job: KnowledgeIngestionJobDTO): Promise<void> {
    this.jobs.set(job.id, job);
  }

  async updateJobProgress(
    id: string,
    status: IngestionJobStatus,
    progress: number,
    organizationId: string,
    error?: string
  ): Promise<void> {
    const job = this.jobs.get(id);
    if (job && job.organizationId === organizationId) {
      job.status = status;
      job.progress = progress;
      if (error) job.errorMessage = error;
      if (status === 'COMPLETED' || status === 'FAILED') {
        job.completedAt = new Date().toISOString();
      }
      this.jobs.set(id, job);
    }
  }

  async saveStorageFile(
    organizationId: string,
    path: string,
    content: Buffer | string,
    mimeType: string
  ): Promise<string> {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const fullKey = `${organizationId}/${cleanPath}`;
    this.storageFiles.set(fullKey, { content, mimeType, organizationId });
    return fullKey;
  }

  async getStorageFile(
    organizationId: string,
    path: string
  ): Promise<{ content: Buffer | string; mimeType: string } | null> {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const fullKey = `${organizationId}/${cleanPath}`;
    const file = this.storageFiles.get(fullKey);
    if (!file || file.organizationId !== organizationId) return null;
    return { content: file.content, mimeType: file.mimeType };
  }

  // ==========================================
  // AI EMPLOYEES & VERSIONING (PROMPT 08)
  // ==========================================
  async getAIEmployees(organizationId: string): Promise<AIEmployeeDTO[]> {
    return Array.from(this.aiEmployees.values()).filter(e => e.organizationId === organizationId);
  }

  async getAIEmployeeById(id: string, organizationId?: string): Promise<AIEmployeeDTO | null> {
    const emp = this.aiEmployees.get(id);
    if (!emp) return null;
    if (organizationId && emp.organizationId !== organizationId) return null;
    return emp;
  }

  async saveAIEmployee(employee: AIEmployeeDTO): Promise<void> {
    this.aiEmployees.set(employee.id, { ...employee, updatedAt: new Date().toISOString() });
    // Keep legacy agents collection synchronized for backwards compatibility
    this.agents.set(employee.id, {
      id: employee.id,
      organizationId: employee.organizationId,
      name: employee.name,
      role: employee.role,
      language: employee.language.primaryLanguage,
      status: employee.status,
      systemPrompt: employee.objective.primaryObjective,
      createdAt: employee.createdAt,
      updatedAt: new Date().toISOString(),
    });
  }

  async deleteAIEmployee(id: string, organizationId: string): Promise<void> {
    const emp = this.aiEmployees.get(id);
    if (emp && emp.organizationId === organizationId) {
      this.aiEmployees.delete(id);
      this.agents.delete(id);
    }
  }

  async getAIEmployeeVersions(organizationId: string, agentId: string): Promise<AIEmployeeVersionDTO[]> {
    return Array.from(this.aiEmployeeVersions.values()).filter(v => v.organizationId === organizationId && v.agentId === agentId);
  }

  async getAIEmployeeVersionByNumber(agentId: string, version: number, organizationId?: string): Promise<AIEmployeeVersionDTO | null> {
    for (const v of this.aiEmployeeVersions.values()) {
      if (v.agentId === agentId && v.version === version) {
        if (organizationId && v.organizationId !== organizationId) return null;
        return v;
      }
    }
    return null;
  }

  async saveAIEmployeeVersion(version: AIEmployeeVersionDTO): Promise<void> {
    this.aiEmployeeVersions.set(`${version.agentId}-v${version.version}`, version);
  }

  async getAIEmployeeTestSessions(organizationId: string, agentId: string): Promise<any[]> {
    return Array.from(this.aiEmployeeTestSessions.values()).filter(s => s.organizationId === organizationId && s.agentId === agentId);
  }

  async saveAIEmployeeTestSession(session: any): Promise<void> {
    this.aiEmployeeTestSessions.set(session.id, session);
  }

  // ==========================================
  // CONVERSATIONS & ORCHESTRATION (PROMPT 09)
  // ==========================================
  async createConversation(conversation: ConversationDTO): Promise<ConversationDTO> {
    const record: ConversationDTO = {
      ...conversation,
      startedAt: conversation.startedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.conversations.set(record.id, record);
    return record;
  }

  async getConversationById(id: string, organizationId?: string): Promise<ConversationDTO | null> {
    const conv = this.conversations.get(id);
    if (!conv) return null;
    if (organizationId && conv.organizationId !== organizationId) return null;
    return conv;
  }

  async getConversations(organizationId: string): Promise<ConversationDTO[]> {
    return Array.from(this.conversations.values())
      .filter(c => c.organizationId === organizationId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  async updateConversation(conversation: ConversationDTO): Promise<void> {
    const updated: ConversationDTO = {
      ...conversation,
      updatedAt: new Date().toISOString(),
    };
    this.conversations.set(updated.id, updated);
  }

  async saveConversationMessage(message: ConversationMessageDTO): Promise<void> {
    this.conversationMessages.set(message.id, message);
  }

  async getConversationMessages(conversationId: string, organizationId?: string): Promise<ConversationMessageDTO[]> {
    return Array.from(this.conversationMessages.values())
      .filter(m => {
        if (m.conversationId !== conversationId) return false;
        if (organizationId && m.organizationId !== organizationId) return false;
        return true;
      })
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }

  async saveConversationEvent(event: ConversationEventDTO): Promise<void> {
    this.conversationEvents.set(event.id, event);
  }

  async getConversationEvents(conversationId: string, organizationId?: string): Promise<ConversationEventDTO[]> {
    return Array.from(this.conversationEvents.values())
      .filter(e => {
        if (e.conversationId !== conversationId) return false;
        if (organizationId && e.organizationId !== organizationId) return false;
        return true;
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async saveConversationToolCall(toolCall: ConversationToolCallDTO): Promise<void> {
    this.conversationToolCalls.set(toolCall.id, toolCall);
  }

  async updateConversationToolCall(toolCall: ConversationToolCallDTO): Promise<void> {
    this.conversationToolCalls.set(toolCall.id, toolCall);
  }

  async getConversationToolCalls(conversationId: string, organizationId?: string): Promise<ConversationToolCallDTO[]> {
    return Array.from(this.conversationToolCalls.values())
      .filter(t => {
        if (t.conversationId !== conversationId) return false;
        if (organizationId && t.organizationId !== organizationId) return false;
        return true;
      });
  }

  async saveConversationHandoff(handoff: ConversationHandoffDTO): Promise<void> {
    this.conversationHandoffs.set(handoff.id, handoff);
  }

  async getConversationHandoffs(organizationId?: string): Promise<ConversationHandoffDTO[]> {
    const list = Array.from(this.conversationHandoffs.values());
    if (!organizationId) return list;
    return list.filter(h => h.organizationId === organizationId);
  }

  async getConversationHandoff(conversationId: string, organizationId?: string): Promise<ConversationHandoffDTO | null> {
    for (const h of this.conversationHandoffs.values()) {
      if (h.conversationId === conversationId) {
        if (organizationId && h.organizationId !== organizationId) return null;
        return h;
      }
    }
    return null;
  }

  async saveConversationSummary(summary: ConversationSummaryDTO): Promise<void> {
    this.conversationSummaries.set(summary.id, summary);
  }

  async getConversationSummary(conversationId: string, organizationId?: string): Promise<ConversationSummaryDTO | null> {
    for (const s of this.conversationSummaries.values()) {
      if (s.conversationId === conversationId) {
        if (organizationId && s.organizationId !== organizationId) return null;
        return s;
      }
    }
    return null;
  }

  // ==========================================
  // CRM, CONTACTS & LEAD MANAGEMENT METHODS
  // ==========================================
  async getContacts(organizationId: string, query?: string): Promise<ContactDTO[]> {
    let list = Array.from(this.contacts.values()).filter(c => c.organizationId === organizationId);
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(c =>
        c.displayName.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.email && c.email.toLowerCase().includes(q))
      );
    }
    return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getContactById(id: string, organizationId?: string): Promise<ContactDTO | null> {
    const contact = this.contacts.get(id);
    if (!contact) return null;
    if (organizationId && contact.organizationId !== organizationId) return null;
    return contact;
  }

  async findContactByPhone(organizationId: string, phone: string): Promise<ContactDTO | null> {
    for (const c of this.contacts.values()) {
      if (c.organizationId === organizationId && c.phone === phone) {
        return c;
      }
    }
    return null;
  }

  async findContactByEmail(organizationId: string, email: string): Promise<ContactDTO | null> {
    for (const c of this.contacts.values()) {
      if (c.organizationId === organizationId && c.email?.toLowerCase() === email.toLowerCase()) {
        return c;
      }
    }
    return null;
  }

  async saveContact(contact: ContactDTO): Promise<void> {
    this.contacts.set(contact.id, { ...contact });
  }

  async updateContactStatus(id: string, status: any, reason?: string, organizationId?: string): Promise<void> {
    const contact = await this.getContactById(id, organizationId);
    if (!contact) throw new Error(`Contact ${id} not found`);
    contact.status = status;
    if (status === 'DO_NOT_CONTACT') {
      contact.doNotContactReason = reason || 'Customer requested suppression';
      contact.doNotContactSetAt = new Date().toISOString();
    }
    contact.updatedAt = new Date().toISOString();
    this.contacts.set(id, contact);
  }

  async getCRMLeads(organizationId: string, filters?: { status?: string; stage?: string; source?: string }): Promise<CRMLeadDTO[]> {
    let list = Array.from(this.crmLeads.values()).filter(l => l.organizationId === organizationId);
    if (filters?.status) list = list.filter(l => l.status === filters.status);
    if (filters?.stage) list = list.filter(l => l.stage === filters.stage);
    if (filters?.source) list = list.filter(l => l.source === filters.source);
    return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getCRMLeadById(id: string, organizationId?: string): Promise<CRMLeadDTO | null> {
    const lead = this.crmLeads.get(id);
    if (!lead) return null;
    if (organizationId && lead.organizationId !== organizationId) return null;
    return lead;
  }

  async getCRMLeadsByContactId(contactId: string, organizationId?: string): Promise<CRMLeadDTO[]> {
    return Array.from(this.crmLeads.values()).filter(l => {
      if (organizationId && l.organizationId !== organizationId) return false;
      return l.contactId === contactId;
    });
  }

  async saveCRMLead(lead: CRMLeadDTO): Promise<void> {
    this.crmLeads.set(lead.id, { ...lead });
  }

  async getCRMActivities(organizationId: string, filters?: { contactId?: string; leadId?: string; conversationId?: string }): Promise<CRMActivityDTO[]> {
    let list = Array.from(this.crmActivities.values()).filter(a => a.organizationId === organizationId);
    if (filters?.contactId) list = list.filter(a => a.contactId === filters.contactId);
    if (filters?.leadId) list = list.filter(a => a.leadId === filters.leadId);
    if (filters?.conversationId) list = list.filter(a => a.conversationId === filters.conversationId);
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async saveCRMActivity(activity: CRMActivityDTO): Promise<void> {
    this.crmActivities.set(activity.id, { ...activity });
  }

  async getCRMOpportunities(organizationId: string, leadId?: string): Promise<CRMOpportunityDTO[]> {
    let list = Array.from(this.crmOpportunities.values()).filter(o => o.organizationId === organizationId);
    if (leadId) list = list.filter(o => o.leadId === leadId);
    return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async saveCRMOpportunity(opp: CRMOpportunityDTO): Promise<void> {
    this.crmOpportunities.set(opp.id, { ...opp });
  }

  async getCRMAnalytics(organizationId: string): Promise<CRMAnalyticsDTO> {
    const leads = Array.from(this.crmLeads.values()).filter(l => l.organizationId === organizationId);
    const contacts = Array.from(this.contacts.values()).filter(c => c.organizationId === organizationId);
    const appointments = Array.from(this.appointments.values()).filter(a => a.tenantId === organizationId && a.status === 'CONFIRMED');

    const sources: Record<string, number> = {};
    for (const l of leads) {
      sources[l.source] = (sources[l.source] || 0) + 1;
    }

    return {
      totalLeads: leads.length,
      newLeads: leads.filter(l => l.status === 'NEW').length,
      qualifiedLeads: leads.filter(l => l.status === 'QUALIFIED').length,
      convertedLeads: leads.filter(l => l.status === 'CONVERTED').length,
      lostLeads: leads.filter(l => l.status === 'LOST').length,
      totalContacts: contacts.length,
      activeAppointments: appointments.length,
      leadSourcesBreakdown: sources,
    };
  }

  // ==========================================
  // HANDOFF & ESCALATION ENGINE (MODULE 17)
  // ==========================================

  async saveHandoffRecord(record: ConversationHandoffRecordDTO): Promise<void> {
    this.handoffRecords.set(record.id, { ...record });
  }

  async getHandoffRecordById(id: string, organizationId?: string): Promise<ConversationHandoffRecordDTO | null> {
    const record = this.handoffRecords.get(id);
    if (!record) return null;
    if (organizationId && record.organizationId !== organizationId) return null;
    return { ...record };
  }

  async getHandoffRecords(organizationId: string, filters?: { status?: string; priority?: string; assignedUserId?: string; assignedTeamId?: string }): Promise<ConversationHandoffRecordDTO[]> {
    let list = Array.from(this.handoffRecords.values()).filter(h => h.organizationId === organizationId);
    if (filters?.status) list = list.filter(h => h.status === filters.status);
    if (filters?.priority) list = list.filter(h => h.priority === filters.priority);
    if (filters?.assignedUserId) list = list.filter(h => h.assignedUserId === filters.assignedUserId);
    if (filters?.assignedTeamId) list = list.filter(h => h.assignedTeamId === filters.assignedTeamId);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Atomic handoff claiming to prevent race conditions where two humans accept simultaneously
   */
  async claimHandoffRecord(id: string, userId: string, organizationId: string): Promise<{ success: boolean; handoff?: ConversationHandoffRecordDTO; error?: string }> {
    const record = this.handoffRecords.get(id);
    if (!record) {
      return { success: false, error: 'Handoff record not found' };
    }
    if (record.organizationId !== organizationId) {
      return { success: false, error: 'Unauthorized: organization mismatch' };
    }
    // If already assigned to someone else and accepted/in_progress, block concurrent assignment
    if (record.assignedUserId && record.assignedUserId !== userId && (record.status === 'ACCEPTED' || record.status === 'IN_PROGRESS')) {
      return { success: false, error: 'Already assigned to another team member.' };
    }

    const now = new Date().toISOString();
    record.assignedUserId = userId;
    record.status = 'IN_PROGRESS';
    record.acceptedAt = record.acceptedAt || now;
    record.firstResponseAt = record.firstResponseAt || now;
    record.updatedAt = now;

    this.handoffRecords.set(id, record);
    return { success: true, handoff: { ...record } };
  }

  // Teams & Team Members
  async saveTeam(team: TeamDTO): Promise<void> {
    this.teams.set(team.id, { ...team });
  }

  async getTeams(organizationId: string): Promise<TeamDTO[]> {
    return Array.from(this.teams.values()).filter(t => t.organizationId === organizationId);
  }

  async getTeamById(id: string, organizationId?: string): Promise<TeamDTO | null> {
    const team = this.teams.get(id);
    if (!team) return null;
    if (organizationId && team.organizationId !== organizationId) return null;
    return { ...team };
  }

  async saveTeamMember(member: TeamMemberDTO): Promise<void> {
    this.teamMembers.set(member.id, { ...member });
  }

  async getTeamMembers(teamId: string, organizationId?: string): Promise<TeamMemberDTO[]> {
    return Array.from(this.teamMembers.values()).filter(m => {
      if (m.teamId !== teamId) return false;
      if (organizationId && m.organizationId !== organizationId) return false;
      return true;
    });
  }

  async updateMemberAvailability(teamId: string, userId: string, availability: any, organizationId?: string): Promise<void> {
    for (const m of this.teamMembers.values()) {
      if (m.teamId === teamId && m.userId === userId) {
        if (organizationId && m.organizationId !== organizationId) continue;
        m.availability = availability;
        m.lastSeenAt = new Date().toISOString();
        this.teamMembers.set(m.id, m);
        return;
      }
    }
  }

  // Notifications
  async saveNotification(notification: NotificationDTO): Promise<void> {
    // Deduplication check via idempotencyKey
    if (notification.idempotencyKey) {
      for (const existing of this.notifications.values()) {
        if (existing.organizationId === notification.organizationId && existing.idempotencyKey === notification.idempotencyKey) {
          return; // Skip duplicate notification
        }
      }
    }
    this.notifications.set(notification.id, { ...notification });
  }

  async getNotifications(userId: string, organizationId: string, status?: string): Promise<NotificationDTO[]> {
    let list = Array.from(this.notifications.values()).filter(n => n.organizationId === organizationId && n.recipientUserId === userId);
    if (status) list = list.filter(n => n.status === status);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async markNotificationRead(id: string, userId: string, organizationId: string): Promise<void> {
    const notif = this.notifications.get(id);
    if (notif && notif.organizationId === organizationId && notif.recipientUserId === userId) {
      notif.status = 'READ';
      notif.readAt = new Date().toISOString();
      this.notifications.set(id, notif);
    }
  }

  async saveNotificationPreferences(prefs: NotificationPreferencesDTO): Promise<void> {
    this.notificationPreferences.set(`${prefs.organizationId}:${prefs.userId}`, { ...prefs });
  }

  async getNotificationPreferences(userId: string, organizationId: string): Promise<NotificationPreferencesDTO | null> {
    const p = this.notificationPreferences.get(`${organizationId}:${userId}`);
    return p ? { ...p } : null;
  }

  // SLAs & Policies
  async saveHandoffSLA(sla: HandoffSLADTO): Promise<void> {
    this.handoffSLAs.set(`${sla.organizationId}:${sla.priority}`, { ...sla });
  }

  async getHandoffSLAs(organizationId: string): Promise<HandoffSLADTO[]> {
    return Array.from(this.handoffSLAs.values()).filter(s => s.organizationId === organizationId);
  }

  async saveEscalationPolicy(policy: EscalationPolicyDTO): Promise<void> {
    this.escalationPolicies.set(`${policy.organizationId}:${policy.agentId || 'default'}`, { ...policy });
  }

  async getEscalationPolicy(organizationId: string, agentId?: string): Promise<EscalationPolicyDTO | null> {
    const direct = this.escalationPolicies.get(`${organizationId}:${agentId || 'default'}`);
    if (direct) return { ...direct };
    const def = this.escalationPolicies.get(`${organizationId}:default`);
    return def ? { ...def } : null;
  }

  // ==========================================
  // ANALYTICS, USAGE METERING & COST (MODULE 18)
  // ==========================================

  async saveUsageEvent(event: UsageEventDTO): Promise<void> {
    this.usageEvents.set(event.id, { ...event });
  }

  async getUsageEvents(organizationId: string, filters?: { eventType?: string; agentId?: string; startDate?: string; endDate?: string }): Promise<UsageEventDTO[]> {
    let list = Array.from(this.usageEvents.values()).filter(e => e.organizationId === organizationId);
    if (filters?.eventType) list = list.filter(e => e.eventType === filters.eventType);
    if (filters?.agentId) list = list.filter(e => e.agentId === filters.agentId);
    if (filters?.startDate) list = list.filter(e => e.occurredAt >= filters.startDate!);
    if (filters?.endDate) list = list.filter(e => e.occurredAt <= filters.endDate!);
    return list.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }

  async saveProviderPricing(pricing: ProviderPricingDefinitionDTO): Promise<void> {
    this.providerPricing.set(`${pricing.provider}:${pricing.service}:${pricing.version}`, { ...pricing });
  }

  async getProviderPricing(provider: string, service: string, version: string = 'v1'): Promise<ProviderPricingDefinitionDTO | null> {
    const p = this.providerPricing.get(`${provider}:${service}:${version}`);
    return p ? { ...p } : null;
  }

  async getAllProviderPricing(): Promise<ProviderPricingDefinitionDTO[]> {
    return Array.from(this.providerPricing.values());
  }

  async saveUsageLedgerRecord(record: UsageLedgerRecordDTO): Promise<void> {
    this.usageLedger.set(record.id, { ...record });
  }

  async getUsageLedgerRecords(organizationId: string, billingPeriod?: string): Promise<UsageLedgerRecordDTO[]> {
    let list = Array.from(this.usageLedger.values()).filter(l => l.organizationId === organizationId);
    if (billingPeriod) list = list.filter(l => l.billingPeriod === billingPeriod);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async saveDailyUsageAggregation(agg: DailyUsageAggregationDTO): Promise<void> {
    this.dailyAggregations.set(agg.id, { ...agg });
  }

  async getDailyUsageAggregations(organizationId: string, startDate?: string, endDate?: string): Promise<DailyUsageAggregationDTO[]> {
    let list = Array.from(this.dailyAggregations.values()).filter(a => a.organizationId === organizationId);
    if (startDate) list = list.filter(a => a.date >= startDate);
    if (endDate) list = list.filter(a => a.date <= endDate);
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }

  async saveUsageAlertThreshold(alert: UsageAlertThresholdDTO): Promise<void> {
    this.usageAlertThresholds.set(`${alert.organizationId}:${alert.meter}`, { ...alert });
  }

  async getUsageAlertThresholds(organizationId: string): Promise<UsageAlertThresholdDTO[]> {
    return Array.from(this.usageAlertThresholds.values()).filter(a => a.organizationId === organizationId);
  }

  async saveCostAnomalyAlert(alert: CostAnomalyAlertDTO): Promise<void> {
    this.costAnomalyAlerts.set(alert.id, { ...alert });
  }

  async getCostAnomalyAlerts(organizationId: string): Promise<CostAnomalyAlertDTO[]> {
    return Array.from(this.costAnomalyAlerts.values()).filter(a => a.organizationId === organizationId);
  }

  async getAnalyticsOverview(organizationId: string, period: string = '30_DAYS', startDate?: string, endDate?: string): Promise<AnalyticsOverviewDTO> {
    const calls = Array.from(this.calls.values()).filter(c => c.tenantId === organizationId);
    const convs = Array.from(this.conversations.values()).filter(c => c.organizationId === organizationId);
    const leads = Array.from(this.crmLeads.values()).filter(l => l.organizationId === organizationId);
    const appointments = Array.from(this.appointments.values()).filter(a => a.tenantId === organizationId);
    const handoffs = Array.from(this.handoffRecords.values()).filter(h => h.organizationId === organizationId);
    const events = Array.from(this.usageEvents.values()).filter(e => e.organizationId === organizationId);

    const now = new Date();
    const effectiveStart = startDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const effectiveEnd = endDate || now.toISOString().split('T')[0];

    const totalCalls = calls.length;
    const inboundCalls = calls.filter(c => c.direction === 'INBOUND').length;
    const outboundCalls = calls.filter(c => c.direction === 'OUTBOUND').length;
    const connectedCalls = calls.filter(c => c.durationSeconds > 0).length;
    const failedCalls = calls.filter(c => c.durationSeconds === 0).length;

    const voiceMinutes = events
      .filter(e => e.eventType === 'VOICE_DURATION')
      .reduce((acc, e) => acc + (e.quantity / 60), 0);

    const estimatedCostInr = events.reduce((acc, e) => acc + (e.estimatedCost || 0), 0);
    const actualCostInr = events.reduce((acc, e) => acc + (e.actualCost || 0), 0);

    const langDist: Record<string, number> = {};
    for (const c of convs) {
      const l = c.detectedLanguage || 'kn';
      langDist[l] = (langDist[l] || 0) + 1;
    }

    return {
      organizationId,
      period: (period as any) || '30_DAYS',
      startDate: effectiveStart,
      endDate: effectiveEnd,
      summary: {
        totalCalls,
        inboundCalls,
        outboundCalls,
        connectedCalls,
        failedCalls,
        totalConversations: convs.length,
        voiceMinutes: Math.round(voiceMinutes * 100) / 100,
        totalLeads: leads.length,
        qualifiedLeads: leads.filter(l => l.status === 'QUALIFIED').length,
        appointmentsCreated: appointments.length,
        handoffs: handoffs.length,
        estimatedCostInr: Math.round(estimatedCostInr * 100) / 100,
        actualCostInr: Math.round(actualCostInr * 100) / 100,
      },
      funnel: {
        calls: totalCalls,
        conversations: convs.length,
        qualifiedLeads: leads.filter(l => l.status === 'QUALIFIED').length,
        appointments: appointments.length,
        conversions: leads.filter(l => l.status === 'CONVERTED').length,
      },
      latencyMetrics: {
        sttP50Ms: 220,
        sttP95Ms: 410,
        llmP50Ms: 380,
        llmP95Ms: 650,
        ttsP50Ms: 190,
        ttsP95Ms: 320,
        firstResponseP50Ms: 790,
        firstResponseP95Ms: 1380,
      },
      languageDistribution: langDist,
      topAgents: Array.from(this.aiEmployees.values())
        .filter(a => a.organizationId === organizationId)
        .map(a => {
          const agentConvs = convs.filter(c => c.agentId === a.id);
          return {
            agentId: a.id,
            agentName: a.name,
            calls: agentConvs.length,
            voiceMinutes: Math.round(agentConvs.length * 3.5),
            appointments: appointments.filter(ap => (ap as any).agentId === a.id).length,
            leads: leads.filter(l => (l as any).agentId === a.id).length,
            handoffs: handoffs.filter(h => h.agentId === a.id).length,
            costInr: Math.round(agentConvs.length * 1.8),
          };
        }),
    };
  }

  // ==========================================
  // BILLING, PLANS & SUBSCRIPTIONS (MODULE 19)
  // ==========================================

  async saveBillingAccount(account: BillingAccountDTO): Promise<void> {
    this.billingAccounts.set(account.organizationId, { ...account });
  }

  async getBillingAccount(organizationId: string): Promise<BillingAccountDTO | null> {
    const a = this.billingAccounts.get(organizationId);
    return a ? { ...a } : null;
  }

  async savePlan(plan: PlanDTO): Promise<void> {
    this.plans.set(plan.id, { ...plan });
  }

  async getPlans(visibility: 'PUBLIC' | 'ALL' = 'PUBLIC'): Promise<PlanDTO[]> {
    let list = Array.from(this.plans.values()).filter(p => p.status === 'ACTIVE');
    if (visibility === 'PUBLIC') {
      list = list.filter(p => p.visibility === 'PUBLIC');
    }
    return list;
  }

  async getPlanById(id: string): Promise<PlanDTO | null> {
    const p = this.plans.get(id);
    return p ? { ...p } : null;
  }

  async getPlanBySlug(slug: string): Promise<PlanDTO | null> {
    for (const p of this.plans.values()) {
      if (p.slug === slug && p.status === 'ACTIVE') return { ...p };
    }
    return null;
  }

  async saveSubscription(subscription: SubscriptionDTO): Promise<void> {
    this.subscriptions.set(subscription.organizationId, { ...subscription });
  }

  async getSubscription(organizationId: string): Promise<SubscriptionDTO | null> {
    const s = this.subscriptions.get(organizationId);
    return s ? { ...s } : null;
  }

  async saveSubscriptionEvent(event: SubscriptionEventDTO): Promise<void> {
    this.subscriptionEvents.set(event.id, { ...event });
  }

  async getSubscriptionEvents(organizationId: string): Promise<SubscriptionEventDTO[]> {
    return Array.from(this.subscriptionEvents.values())
      .filter(e => e.organizationId === organizationId)
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }

  async savePaymentRecord(payment: PaymentRecordDTO): Promise<void> {
    this.paymentRecords.set(payment.id, { ...payment });
  }

  async getPaymentRecords(organizationId: string): Promise<PaymentRecordDTO[]> {
    return Array.from(this.paymentRecords.values())
      .filter(p => p.organizationId === organizationId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async saveBillingInvoice(invoice: BillingInvoiceDTO): Promise<void> {
    this.billingInvoices.set(invoice.id, { ...invoice });
  }

  async getBillingInvoices(organizationId: string): Promise<BillingInvoiceDTO[]> {
    return Array.from(this.billingInvoices.values())
      .filter(i => i.organizationId === organizationId)
      .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
  }

  async saveBillingProviderEvent(event: BillingProviderEventDTO): Promise<void> {
    this.billingProviderEvents.set(`${event.provider}:${event.providerEventId}`, { ...event });
  }

  async getBillingProviderEvent(provider: string, providerEventId: string): Promise<BillingProviderEventDTO | null> {
    const e = this.billingProviderEvents.get(`${provider}:${providerEventId}`);
    return e ? { ...e } : null;
  }

  async getBillingSnapshot(organizationId: string): Promise<BillingSnapshotDTO> {
    const billingAccount = await this.getBillingAccount(organizationId);
    let subscription = await this.getSubscription(organizationId);

    // Default to free trial if no subscription exists
    if (!subscription) {
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      subscription = {
        id: `sub_trial_${organizationId.substring(0, 8)}`,
        organizationId,
        billingAccountId: billingAccount?.id || `ba_${organizationId.substring(0, 8)}`,
        planId: (await this.getOrganizationById(organizationId))?.billingTier === 'BUSINESS' ? 'plan_scale' : ((await this.getOrganizationById(organizationId))?.billingTier === 'GROWTH' ? 'plan_growth' : 'plan_starter'),
        planVersionId: 'v1.0',
        provider: 'RAZORPAY',
        status: 'TRIALING',
        billingInterval: 'MONTHLY',
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: periodEnd.toISOString(),
        cancelAtPeriodEnd: false,
        trialStart: now.toISOString(),
        trialEnd: periodEnd.toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      await this.saveSubscription(subscription);
    }

    let plan = await this.getPlanById(subscription.planId);
    if (!plan) {
      plan = {
        id: 'plan_starter',
        name: 'Starter Plan',
        slug: 'starter',
        description: 'For single doctor clinics & offices',
        monthlyPrice: 4999,
        annualPrice: 49990,
        currency: 'INR',
        visibility: 'PUBLIC',
        status: 'ACTIVE',
        activeVersion: 'v1.0',
        entitlements: {
          maxAiEmployees: 2,
          maxLocations: 1,
          maxUsers: 5,
          maxKnowledgeSources: 10,
          maxKnowledgeStorageMb: 500,
          maxContacts: 1000,
          maxMonthlyVoiceMinutes: 600,
          maxMonthlySttSeconds: 36000,
          maxMonthlyTtsCharacters: 300000,
          maxMonthlyLlmTokens: 1000000,
          maxMonthlyCalls: 300,
          maxMonthlyOutboundCalls: 100,
          maxCampaignTargets: 200,
          maxAppointments: 500,
          voiceEnabled: true,
          outboundCallingEnabled: true,
          campaignsEnabled: true,
          knowledgeBaseEnabled: true,
          analyticsEnabled: true,
          advancedAnalyticsEnabled: false,
          humanHandoffEnabled: true,
          customAiEmployeeEnabled: false,
          apiAccessEnabled: false,
          webhooksEnabled: false,
          crmIntegrationsEnabled: false,
        },
        overageVoiceMinutePrice: 2.5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    const aiEmployees = Array.from(this.aiEmployees.values()).filter(a => a.organizationId === organizationId);
    const locations = Array.from(this.locations.values()).filter(l => l.organizationId === organizationId);
    const contacts = Array.from(this.contacts.values()).filter(c => c.organizationId === organizationId);
    const appointments = Array.from(this.appointments.values()).filter(a => a.tenantId === organizationId);

    // Calculate voice minutes used in current billing period
    const events = Array.from(this.usageEvents.values()).filter(e => {
      if (e.organizationId !== organizationId) return false;
      return e.occurredAt >= subscription!.currentPeriodStart && e.occurredAt <= subscription!.currentPeriodEnd;
    });

    const voiceMinutesUsed = events
      .filter(e => e.eventType === 'VOICE_DURATION')
      .reduce((acc, e) => acc + e.quantity, 0);

    const maxMinutes = plan.entitlements.maxMonthlyVoiceMinutes;
    const remaining = Math.max(0, maxMinutes - voiceMinutesUsed);
    const percent = maxMinutes > 0 ? (voiceMinutesUsed / maxMinutes) * 100 : 0;

    let minuteState: any = 'AVAILABLE';
    if (percent >= 100) minuteState = 'LIMIT_REACHED';
    else if (percent >= 90) minuteState = 'NEAR_LIMIT';

    const isExceeded = aiEmployees.length > plan.entitlements.maxAiEmployees && plan.entitlements.maxAiEmployees !== -1;
    const exceededEntities: string[] = [];
    if (aiEmployees.length > plan.entitlements.maxAiEmployees && plan.entitlements.maxAiEmployees !== -1) {
      exceededEntities.push(`AI Employees (${aiEmployees.length}/${plan.entitlements.maxAiEmployees})`);
    }

    const isTrial = subscription.status === 'TRIALING';
    let daysRemainingInTrial = 0;
    if (isTrial && subscription.trialEnd) {
      const ms = new Date(subscription.trialEnd).getTime() - Date.now();
      daysRemainingInTrial = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    }

    const payments = await this.getPaymentRecords(organizationId);

    return {
      organizationId,
      billingAccount: billingAccount || undefined,
      subscription,
      plan,
      isTrial,
      daysRemainingInTrial,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      entitlements: plan.entitlements,
      usageSummary: {
        aiEmployeesCount: aiEmployees.length,
        locationsCount: locations.length,
        contactsCount: contacts.length,
        voiceMinutesUsed: Math.round(voiceMinutesUsed * 10) / 10,
        voiceMinutesRemaining: Math.round(remaining * 10) / 10,
        voiceMinutesUsagePercent: Math.round(percent * 10) / 10,
        voiceMinutesState: minuteState,
        campaignCallsUsed: events.filter(e => e.eventType === 'CAMPAIGN_CALL').length,
        appointmentsCount: appointments.length,
      },
      isEntitlementExceeded: isExceeded,
      exceededEntities: exceededEntities.length > 0 ? exceededEntities : undefined,
      recentPayments: payments.slice(0, 10),
    };
  }
}

// Global Singleton for Development & Test Runtime

export class DurableDatabaseService extends InMemoryDatabaseService {
  private persistPath: string;
  private callsFilePath: string;
  private supabase: SupabaseClient | null = null;
  private isWriting = false;

  constructor() {
    super();
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      try { fs.mkdirSync(dataDir, { recursive: true }); } catch {}
    }
    this.persistPath = path.join(dataDir, 'vanni_database.json');
    this.callsFilePath = path.join(dataDir, 'calls.json');

    // Supabase integration when credentials exist
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
      try {
        this.supabase = createClient(supabaseUrl, supabaseKey);
      } catch (err: any) {
        console.warn('[DurableDatabaseService] Supabase client init error:', err.message);
      }
    }

    this.loadInitialData();
  }

  private loadInitialData(): void {
    if (fs.existsSync(this.persistPath)) {
      try {
        const raw = fs.readFileSync(this.persistPath, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.organizations)) {
          for (const o of data.organizations) super.saveOrganization(o);
        }
        if (Array.isArray(data.clientWorkspaces)) {
          for (const w of data.clientWorkspaces) {
            (this as any).clientWorkspaces.set(w.id, w);
          }
        }
        if (Array.isArray(data.calls)) {
          for (const c of data.calls) super.saveCall(c);
        }
        if (Array.isArray(data.leads)) {
          for (const l of data.leads) super.saveLead(l);
        }
        if (Array.isArray(data.appointments)) {
          for (const a of data.appointments) super.saveAppointment(a);
        }
        if (Array.isArray(data.members)) {
          for (const m of data.members) super.saveMember(m);
        }
        if (Array.isArray(data.subscriptions)) {
          for (const s of data.subscriptions) super.saveSubscription(s);
        }
        if (Array.isArray(data.staff)) {
          for (const st of data.staff) super.saveStaff(st);
        }
        if (Array.isArray(data.faqs)) {
          for (const f of data.faqs) super.saveFAQ(f);
        }
        if (Array.isArray(data.properties)) {
          for (const p of data.properties) super.saveProperty(p);
        }
      } catch (err: any) {
        console.warn('[DurableDatabaseService] Failed to load snapshot:', err.message);
      }
    }

    // Unify with data/calls.json from telephony and WebSocket streams
    if (fs.existsSync(this.callsFilePath)) {
      try {
        const raw = fs.readFileSync(this.callsFilePath, 'utf8');
        const calls = JSON.parse(raw);
        if (Array.isArray(calls)) {
          for (const c of calls) {
            super.saveCall({
              id: c.id,
              tenantId: c.tenantId || c.organizationId || 'a0000000-0000-0000-0000-000000000001',
              caller: c.caller || 'Caller',
              phone: c.phone || '',
              direction: c.direction === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND',
              durationSeconds: c.durationSec || 0,
              intent: c.intent || '',
              outcome: c.outcome || '',
              leadRating: c.status || 'WARM',
              city: c.city || 'Karnataka',
              transcript: Array.isArray(c.transcript) ? c.transcript : [],
              createdAt: c.time || new Date().toISOString(),
            });
          }
        }
      } catch {}
    }
  }

  private persistSnapshot(): void {
    if (this.isWriting) return;
    this.isWriting = true;
    try {
      const data = {
        savedAt: new Date().toISOString(),
        organizations: Array.from((this as any).organizations.values()),
        calls: Array.from((this as any).calls.values()),
        leads: Array.from((this as any).leads.values()),
        appointments: Array.from((this as any).appointments.values()),
        members: Array.from((this as any).members.values()),
        subscriptions: Array.from((this as any).subscriptions.values()),
        clientWorkspaces: Array.from((this as any).clientWorkspaces.values()),
        staff: Array.from((this as any).staffMembers.values()),
        faqs: Array.from((this as any).faqs.values()),
        properties: Array.from((this as any).properties.values()),
      };
      const tempPath = `${this.persistPath}.${Date.now()}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tempPath, this.persistPath);
    } catch {
      try {
        fs.writeFileSync(this.persistPath, JSON.stringify({
          savedAt: new Date().toISOString(),
          calls: Array.from((this as any).calls.values()),
          leads: Array.from((this as any).leads.values()),
          appointments: Array.from((this as any).appointments.values()),
        }, null, 2), 'utf8');
      } catch {}
    } finally {
      this.isWriting = false;
    }
  }

  override async saveClientWorkspace(workspace: ClientWorkspaceDTO): Promise<void> {
    await super.saveClientWorkspace(workspace);
    this.persistSnapshot();
    if (this.supabase) {
      this.supabase.from('client_workspaces').upsert({
        id: workspace.id,
        organization_id: workspace.organizationId,
        name: workspace.name,
        slug: workspace.slug,
        model_type: workspace.modelType,
        industry_category: workspace.industryCategory,
        subcategory: workspace.subcategory,
        operating_location: workspace.operatingLocation,
        primary_phone: workspace.primaryPhone,
        primary_email: workspace.primaryEmail,
        timezone: workspace.timezone,
        onboarding_step: workspace.onboardingStep,
        onboarding_completed: workspace.onboardingCompleted,
        config: {
          languagePreferences: workspace.languagePreferences,
          startingTemplateId: workspace.startingTemplateId,
          aiEmployee: workspace.aiEmployee,
          onboardingData: workspace.onboardingData,
        },
      }).then(() => {}, (err: any) => {
        console.warn('[DurableDatabaseService] Supabase workspace sync error:', err.message);
      });
    }
  }

  override async updateClientWorkspace(
    id: string,
    updates: Partial<ClientWorkspaceDTO>,
    organizationId?: string
  ): Promise<ClientWorkspaceDTO> {
    const res = await super.updateClientWorkspace(id, updates, organizationId);
    this.persistSnapshot();
    return res;
  }

  override async saveCall(call: CallRecordDTO): Promise<void> {
    await super.saveCall(call);
    this.persistSnapshot();
    if (this.supabase) {
      this.supabase.from('calls').upsert({
        id: call.id,
        organization_id: call.tenantId,
        direction: call.direction,
        caller_phone: call.phone,
        caller_name: call.caller,
        duration_seconds: call.durationSeconds,
        lead_rating: call.leadRating,
        started_at: call.createdAt,
        outcome: call.outcome,
      }).then(() => {}, (err: any) => {
        console.warn('[DurableDatabaseService] Supabase call sync error:', err.message);
      });
    }
  }

  override async saveLead(lead: LeadDossierDTO): Promise<void> {
    await super.saveLead(lead);
    this.persistSnapshot();
    if (this.supabase) {
      this.supabase.from('leads').upsert({
        id: lead.id,
        organization_id: lead.tenantId,
        contact_phone: lead.callerPhone,
        contact_name: lead.callerName,
        rating: lead.leadRating,
        intent: lead.requirementSummary,
        budget: lead.budgetOrFee,
      }).then(() => {}, () => {});
    }
  }

  override async saveAppointment(appointment: AppointmentSlotDTO): Promise<void> {
    await super.saveAppointment(appointment);
    this.persistSnapshot();
    if (this.supabase) {
      this.supabase.from('appointments').upsert({
        id: appointment.id,
        organization_id: appointment.tenantId,
        contact_phone: appointment.customerPhone,
        contact_name: appointment.customerName,
        appointment_time: appointment.scheduledTime,
        status: appointment.status,
      }).then(() => {}, () => {});
    }
  }

  override async saveOrganization(org: OrganizationDTO): Promise<void> {
    await super.saveOrganization(org);
    this.persistSnapshot();
  }

  override async saveMember(member: OrganizationMemberDTO): Promise<void> {
    await super.saveMember(member);
    this.persistSnapshot();
  }

  override async saveSubscription(sub: SubscriptionDTO): Promise<void> {
    await super.saveSubscription(sub);
    this.persistSnapshot();
  }

  override async updateAppointment(id: string, partial: Partial<AppointmentSlotDTO>, organizationId?: string): Promise<AppointmentSlotDTO | null> {
    const res = await super.updateAppointment(id, partial, organizationId);
    if (res) this.persistSnapshot();
    return res;
  }

  override async deleteAppointment(id: string, organizationId?: string): Promise<void> {
    await super.deleteAppointment(id, organizationId);
    this.persistSnapshot();
  }

  override async saveStaff(staff: BusinessStaffDTO): Promise<void> {
    await super.saveStaff(staff);
    this.persistSnapshot();
  }

  override async updateStaff(id: string, partial: Partial<BusinessStaffDTO>, organizationId?: string): Promise<BusinessStaffDTO | null> {
    const res = await super.updateStaff(id, partial, organizationId);
    if (res) this.persistSnapshot();
    return res;
  }

  override async deleteStaff(id: string, organizationId: string): Promise<void> {
    await super.deleteStaff(id, organizationId);
    this.persistSnapshot();
  }

  override async saveFAQ(faq: BusinessFAQDTO): Promise<void> {
    await super.saveFAQ(faq);
    this.persistSnapshot();
  }

  override async deleteFAQ(id: string, organizationId: string): Promise<void> {
    await super.deleteFAQ(id, organizationId);
    this.persistSnapshot();
  }
}

// Global Singleton for Development, Test & Production Runtime
export const globalDb: IDatabaseService = new DurableDatabaseService();
