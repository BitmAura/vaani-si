/**
 * @vanni/shared — Universal Domain Types & DTOs
 */

import { z } from 'zod';

// ==============================================================================
// 1. IDENTITY & MULTI-TENANT ROLES
// ==============================================================================

export type UserRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'VIEWER';

export type MemberStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED';

export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export type OnboardingStatus = 'created' | 'business_setup' | 'agent_setup' | 'ready';

export type BillingTier = 'STARTER' | 'GROWTH' | 'BUSINESS';

// ==============================================================================
// 1.1 CLIENT WORKSPACES & MULTI-TENANT ONBOARDING DOMAIN
// ==============================================================================

export type BusinessModelType = 'AGENCY' | 'DIRECT_BUSINESS';

export type IndustryCategory = 'DIGITAL_AGENCY' | 'HEALTHCARE' | 'REAL_ESTATE';

export type IndustrySubcategory =
  | 'DENTAL'
  | 'ORTHOPAEDICS'
  | 'IVF'
  | 'HOSPITAL'
  | 'DEVELOPER'
  | 'BROKERAGE'
  | 'SALES'
  | 'MARKETING_AGENCY';

export interface ClinicConfigDTO {
  operatingHours?: Array<{
    dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
    opensAt: string; // "09:00"
    closesAt: string; // "20:00"
    isClosed: boolean;
    lunchBreakStart?: string;
    lunchBreakEnd?: string;
  }>;
  temporaryClosures?: Array<{
    startDate: string;
    endDate: string;
    reason: string;
  }>;
  defaultSlotDurationMinutes?: number;
  bufferMinutes?: number;
  emergencyContactPhone?: string;
  emergencyProtocol?: string;
  escalationContactPhone?: string;
  escalationHours?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  webhookEnabled?: boolean;
}

export interface ClientWorkspaceDTO {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  modelType: BusinessModelType;
  industryCategory: IndustryCategory;
  subcategory: IndustrySubcategory;
  operatingLocation: string;
  primaryPhone: string;
  primaryEmail?: string;
  timezone: string;
  languagePreferences: {
    primary: 'kn-IN' | 'kn-en' | 'en-IN';
    conversationalStyle: 'POLITE_BUSINESS' | 'CONVERSATIONAL' | 'FORMAL';
    regionalDialect: RegionalDialect;
  };
  startingTemplateId?: string;
  onboardingStep: number;
  onboardingCompleted: boolean;
  onboardingData?: Record<string, any>;
  clinicConfig?: ClinicConfigDTO;
  realEstateConfig?: RealEstateConfigDTO;
  aiEmployee?: {
    name: string;
    gender: 'FEMALE' | 'MALE';
    speakerId: string;
    engine: string;
    status: 'DRAFT' | 'READY' | 'ACTIVE';
  };
  createdAt: string;
  updatedAt: string;
}

export interface StarterTemplateDTO {
  id: string;
  title: string;
  description: string;
  industryCategory: IndustryCategory;
  subcategory: IndustrySubcategory;
  recommendedDialect: RegionalDialect;
  defaultAgentName: string;
  sampleUseCases: string[];
  capabilities: string[];
}

export const CreateClientWorkspaceInputSchema = z.object({
  name: z.string().min(2, 'Client business name must be at least 2 characters').max(100),
  modelType: z.enum(['AGENCY', 'DIRECT_BUSINESS']).default('DIRECT_BUSINESS'),
  industryCategory: z.enum(['DIGITAL_AGENCY', 'HEALTHCARE', 'REAL_ESTATE']),
  subcategory: z.enum([
    'DENTAL',
    'ORTHOPAEDICS',
    'IVF',
    'HOSPITAL',
    'DEVELOPER',
    'BROKERAGE',
    'SALES',
    'MARKETING_AGENCY',
  ]),
  operatingLocation: z.string().min(2, 'Operating location required').default('Karnataka, India'),
  primaryPhone: z.string().min(8, 'Phone number required').default('+91 80 4719 2000'),
  primaryEmail: z.string().email().optional(),
  timezone: z.string().default('Asia/Kolkata'),
  languagePreferences: z
    .object({
      primary: z.enum(['kn-IN', 'kn-en', 'en-IN']).default('kn-IN'),
      conversationalStyle: z.enum(['POLITE_BUSINESS', 'CONVERSATIONAL', 'FORMAL']).default('POLITE_BUSINESS'),
      regionalDialect: z
        .enum([
          'KANNADA_STANDARD_POLITE',
          'KANGLISH_BUSINESS',
          'NORTH_KARNATAKA_COMMERCIAL',
          'MYSORE_MANDYA_REGIONAL',
          'ENGLISH_INDIAN_CORPORATE',
        ])
        .default('KANGLISH_BUSINESS'),
    })
    .default({
      primary: 'kn-IN',
      conversationalStyle: 'POLITE_BUSINESS',
      regionalDialect: 'KANGLISH_BUSINESS',
    }),
  startingTemplateId: z.string().optional(),
});

export const SaveOnboardingStepInputSchema = z.object({
  workspaceId: z.string().optional(),
  step: z.number().int().min(1).max(7),
  data: z.record(z.string(), z.any()),
  complete: z.boolean().default(false),
});


export interface UserProfileDTO {
  id: string;
  fullName: string;
  avatarUrl?: string;
  phone?: string;
  timezone: string;
  locale: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationDTO {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  industry: string;
  status: OrganizationStatus;
  timezone: string;
  onboardingStatus: OnboardingStatus;
  billingTier: BillingTier;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMemberDTO {
  id: string;
  organizationId: string;
  userId: string;
  role: UserRole;
  status: MemberStatus;
  userEmail?: string;
  userFullName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogDTO {
  id: string;
  organizationId: string;
  actorUserId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuthSessionDTO {
  userId: string;
  email: string;
  fullName: string;
  activeOrganizationId: string;
  activeRole: UserRole;
  memberships: Array<{
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    industry?: string;
    role: UserRole;
    status: MemberStatus;
    onboardingStatus: OnboardingStatus;
  }>;
}

// ==============================================================================
// 2. VALIDATION SCHEMAS (ZOD)
// ==============================================================================

export const EmailSchema = z.string().email('Please enter a valid email address');

export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password is too long');

export const SlugSchema = z
  .string()
  .min(3, 'Slug must be at least 3 characters')
  .max(60, 'Slug must be at most 60 characters')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens');

export const SignupInputSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  email: EmailSchema,
  password: PasswordSchema,
  organizationName: z.string().min(2, 'Organization name must be at least 2 characters').max(100),
  industry: z.string().default('REAL_ESTATE'),
  timezone: z.string().default('Asia/Kolkata'),
});

export const LoginInputSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const CreateOrganizationInputSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').max(100),
  industry: z.string().default('REAL_ESTATE'),
  timezone: z.string().default('Asia/Kolkata'),
});

export const InviteMemberInputSchema = z.object({
  email: EmailSchema,
  role: z.enum(['OWNER', 'ADMIN', 'MANAGER', 'VIEWER']),
});

export const SwitchOrganizationInputSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
});

// ==============================================================================
// 3. VERTICAL INDUSTRY & CONVERSATIONAL TYPES
// ==============================================================================

export type IndustryType =
  | 'DENTAL'
  | 'HEALTHCARE_HOSPITAL'
  | 'IVF_FERTILITY'
  | 'HOSPITALITY_RESORT'
  | 'REAL_ESTATE'
  | 'AUTOMOTIVE_DEALER'
  | 'DIGITAL_AGENCY'
  | 'COMMERCIAL_OTHER';

export type RegionalDialect =
  | 'KANNADA_STANDARD_POLITE'
  | 'KANGLISH_BUSINESS'
  | 'NORTH_KARNATAKA_COMMERCIAL'
  | 'MYSORE_MANDYA_REGIONAL'
  | 'ENGLISH_INDIAN_CORPORATE';

export type CallDirection = 'INBOUND' | 'OUTBOUND';

export type CallStatus =
  | 'RINGING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'BUSY'
  | 'FAILED'
  | 'TRANSFERRED'
  | 'NO_ANSWER';

export type LeadRating = 'HOT' | 'WARM' | 'COLD' | 'UNQUALIFIED';

export interface TenantContext {
  id: string;
  name: string;
  industry: IndustryType;
  virtualPhoneNumber: string;
  ownerWhatsAppNumber: string;
  primaryDialect: RegionalDialect;
  officeTimings: string;
  catalogSummary: string;
}

export interface CallRecordDTO {
  id: string;
  tenantId: string;
  caller: string;
  phone: string;
  direction: CallDirection;
  durationSeconds: number;
  intent: string;
  outcome: string;
  leadRating: LeadRating;
  city?: string;
  budgetOrFee?: string;
  transcript: Array<{
    speaker: 'AI' | 'CUSTOMER' | 'HUMAN_AGENT';
    text: string;
    timestamp: string;
  }>;
  audioRecordingUrl?: string;
  createdAt: string;
}

export interface LeadDossierDTO {
  id: string;
  callId: string;
  tenantId: string;
  callerName: string;
  callerPhone: string;
  city?: string;
  requirementSummary: string;
  budgetOrFee?: string;
  confirmedOutcome: string;
  leadRating: LeadRating;
  createdAt: string;
}

export interface AppointmentAuditEntry {
  action: 'CREATED' | 'CONFIRMED' | 'RESCHEDULED' | 'CANCELLED' | 'COMPLETED';
  timestamp: string;
  performedBy?: string;
  previousTime?: string;
  note?: string;
}

export interface AppointmentSlotDTO {
  id: string;
  tenantId: string;
  workspaceId?: string;
  doctorId?: string;
  propertyId?: string;
  visitorCount?: number;
  transportRequired?: boolean;
  assignedAgent?: string;
  appointmentType?: 'OPD_CONSULTATION' | 'SITE_VISIT' | 'GENERAL';
  leadId?: string;
  customerName: string;
  customerPhone: string;
  serviceType: string;
  scheduledTime: string;
  durationMinutes: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  notes?: string;
  cancellationReason?: string;
  auditHistory?: AppointmentAuditEntry[];
  idempotencyKey?: string;
}

// ==============================================================================
// 4. BUSINESS BRAIN & KNOWLEDGE REPOSITORY TYPES
// ==============================================================================

export type KnowledgeAuthority = 'AUTHORITATIVE' | 'APPROVED' | 'REFERENCE' | 'UNVERIFIED';

export type KnowledgeStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | 'EXPIRED' | 'PENDING_REVIEW';

export type KnowledgeSourceType =
  | 'MANUAL'
  | 'STRUCTURED_BUSINESS_DATA'
  | 'FAQ'
  | 'WEBSITE'
  | 'DOCUMENT'
  | 'POLICY'
  | 'IMPORT'
  | 'SYSTEM';

export type PolicyCategory =
  | 'CANCELLATION'
  | 'APPOINTMENT'
  | 'REFUND'
  | 'EMERGENCY'
  | 'ESCALATION'
  | 'AI_RESTRICTION'
  | 'PRIVACY'
  | 'GENERAL';

export interface BusinessLocationDTO {
  id: string;
  organizationId: string;
  name: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email?: string;
  isPrimary: boolean;
  latitude?: number;
  longitude?: number;
  status: KnowledgeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessServiceDTO {
  id: string;
  organizationId: string;
  locationId?: string;
  name: string;
  kannadaName?: string;
  conversationalAlias?: string;
  category: string;
  description?: string;
  priceMinimum?: number;
  priceMaximum?: number;
  durationMinutes: number;
  isBookableByAI: boolean;
  prerequisites?: string;
  status: KnowledgeStatus;
  authority: KnowledgeAuthority;
  sourceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessStaffDTO {
  id: string;
  organizationId: string;
  locationId?: string;
  fullName: string;
  kannadaName?: string;
  designation: string;
  specialization?: string;
  consultationFee?: number;
  availableDays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  workingHoursDescription?: string;
  shiftStart?: string; // "09:00"
  shiftEnd?: string; // "17:00"
  breakStart?: string; // "13:00"
  breakEnd?: string; // "14:00"
  slotDurationMinutes?: number; // default 15
  bufferMinutes?: number; // default 5
  leaves?: Array<{ date: string; reason: string }>;
  isActive: boolean;
  status: KnowledgeStatus;
  authority: KnowledgeAuthority;
  sourceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessOperatingHoursDTO {
  id: string;
  organizationId: string;
  locationId?: string;
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
  opensAt: string; // "09:00"
  closesAt: string; // "20:00"
  isClosed: boolean;
  lunchBreakStart?: string;
  lunchBreakEnd?: string;
  note?: string;
}

export interface BusinessPolicyDTO {
  id: string;
  organizationId: string;
  category: PolicyCategory;
  title: string;
  policyStatement: string;
  kannadaStatement?: string;
  enforcementLevel: 'STRICT_BLOCK' | 'ESCALATE_TO_STAFF' | 'INFORMATIONAL';
  status: KnowledgeStatus;
  authority: KnowledgeAuthority;
  sourceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessFAQDTO {
  id: string;
  organizationId: string;
  category: string;
  question: string;
  answer: string;
  kannadaQuestion?: string;
  kannadaAnswer?: string;
  language: 'EN' | 'KN' | 'KANGLISH';
  status: KnowledgeStatus;
  authority: KnowledgeAuthority;
  sourceId?: string;
  lastVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessFactDTO {
  id: string;
  organizationId: string;
  category: string;
  key: string;
  value: string;
  kannadaValue?: string;
  authority: KnowledgeAuthority;
  status: KnowledgeStatus;
  sourceId?: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeSourceDTO {
  id: string;
  organizationId: string;
  sourceType: KnowledgeSourceType;
  title: string;
  description?: string;
  uriOrIdentifier?: string;
  status: KnowledgeStatus;
  authority: KnowledgeAuthority;
  lastVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeConflictDTO {
  id: string;
  organizationId: string;
  entityType: 'SERVICE_PRICE' | 'HOURS' | 'STAFF' | 'POLICY' | 'FACT';
  entityId: string;
  field: string;
  sourceA: { sourceId: string; title: string; authority: KnowledgeAuthority; value: string };
  sourceB: { sourceId: string; title: string; authority: KnowledgeAuthority; value: string };
  resolvedValue?: string;
  status: 'OPEN' | 'RESOLVED' | 'IGNORED';
  detectedAt: string;
}

export interface BusinessBrainSnapshotDTO {
  version: number;
  organizationId: string;
  organizationName: string;
  industry: IndustryType;
  primaryDialect: RegionalDialect;
  identity: {
    legalName: string;
    displayName: string;
    phone: string;
    ownerWhatsApp: string;
    supportEmail?: string;
    emergencyContact?: string;
    tagline?: string;
  };
  locations: BusinessLocationDTO[];
  operatingHours: BusinessOperatingHoursDTO[];
  services: BusinessServiceDTO[];
  staff: BusinessStaffDTO[];
  policies: BusinessPolicyDTO[];
  faqs: BusinessFAQDTO[];
  facts: Record<string, string>;
  aiConfiguration: {
    roleTitle: string;
    speechPace: number;
    greetingKannada: string;
    greetingKanglish: string;
    allowedTools: string[];
    guardrails: string[];
    unknownFallbackPolicy: string;
    emergencyEscalationPhone: string;
  };
  conflicts: KnowledgeConflictDTO[];
  compiledAt: string;
}

// Zod Schemas for Business Brain
export const CreateLocationInputSchema = z.object({
  name: z.string().min(2),
  addressLine1: z.string().min(3),
  addressLine2: z.string().optional(),
  landmark: z.string().optional(),
  city: z.string().min(2),
  state: z.string().default('Karnataka'),
  pincode: z.string().min(6).max(6),
  phone: z.string().min(10),
  isPrimary: z.boolean().default(false),
});

export const CreateServiceInputSchema = z.object({
  name: z.string().min(2),
  kannadaName: z.string().optional(),
  conversationalAlias: z.string().optional(),
  category: z.string().min(2),
  description: z.string().optional(),
  priceMinimum: z.number().positive().optional(),
  priceMaximum: z.number().positive().optional(),
  durationMinutes: z.number().int().positive().default(30),
  isBookableByAI: z.boolean().default(true),
});

export const CreateStaffInputSchema = z.object({
  fullName: z.string().min(2),
  kannadaName: z.string().optional(),
  designation: z.string().min(2),
  specialization: z.string().optional(),
  consultationFee: z.number().positive().optional(),
  availableDays: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5, 6]),
});

export const CreatePolicyInputSchema = z.object({
  category: z.enum([
    'CANCELLATION',
    'APPOINTMENT',
    'REFUND',
    'EMERGENCY',
    'ESCALATION',
    'AI_RESTRICTION',
    'PRIVACY',
    'GENERAL',
  ]),
  title: z.string().min(2),
  policyStatement: z.string().min(5),
  kannadaStatement: z.string().optional(),
  enforcementLevel: z.enum(['STRICT_BLOCK', 'ESCALATE_TO_STAFF', 'INFORMATIONAL']).default('STRICT_BLOCK'),
});

export const CreateFAQInputSchema = z.object({
  category: z.string().min(2),
  question: z.string().min(3),
  answer: z.string().min(3),
  kannadaQuestion: z.string().optional(),
  kannadaAnswer: z.string().optional(),
  language: z.enum(['EN', 'KN', 'KANGLISH']).default('KANGLISH'),
});

export const CreateFactInputSchema = z.object({
  category: z.string().min(2),
  key: z.string().min(2),
  value: z.string().min(1),
  kannadaValue: z.string().optional(),
  authority: z.enum(['AUTHORITATIVE', 'APPROVED', 'REFERENCE', 'UNVERIFIED']).default('AUTHORITATIVE'),
});

// ==============================================================================
// 5. KNOWLEDGE INGESTION & RETRIEVAL ENGINE TYPES (PROMPT 07)
// ==============================================================================

export type KnowledgeDocumentType =
  | 'PDF'
  | 'TXT'
  | 'MARKDOWN'
  | 'WEBSITE_PAGE'
  | 'MANUAL_ARTICLE'
  | 'POLICY_DOCUMENT'
  | 'FAQ_COLLECTION';

export type DocumentProcessingStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED'
  | 'ARCHIVED';

export type IngestionJobStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type IngestionJobType =
  | 'PDF_PARSE'
  | 'WEBSITE_FETCH'
  | 'TEXT_INGEST'
  | 'EMBEDDING_GENERATE'
  | 'FULL_SYNC';

export interface KnowledgeDocumentDTO {
  id: string;
  organizationId: string;
  sourceId: string;
  title: string;
  documentType: KnowledgeDocumentType;
  contentStatus: DocumentProcessingStatus;
  storagePath?: string;
  rawContent?: string;
  normalizedContent: string;
  language: 'EN' | 'KN' | 'KANGLISH' | 'ALL';
  checksum: string;
  version: number;
  supersedesId?: string;
  wordCount: number;
  charCount: number;
  metadata: Record<string, any>;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeChunkDTO {
  id: string;
  organizationId: string;
  sourceId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  heading?: string;
  pageNumber?: number;
  language: 'EN' | 'KN' | 'KANGLISH';
  authority: KnowledgeAuthority;
  tokenCount: number;
  charCount: number;
  metadata: Record<string, any>;
  embedding?: number[];
  embeddingModel?: string;
  createdAt: string;
}

export interface KnowledgeIngestionJobDTO {
  id: string;
  organizationId: string;
  sourceId: string;
  documentId?: string;
  jobType: IngestionJobType;
  status: IngestionJobStatus;
  progress: number; // 0 - 100
  errorMessage?: string;
  metadata?: Record<string, any>;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export type KnowledgeAnswerability =
  | 'SUPPORTED'
  | 'PARTIALLY_SUPPORTED'
  | 'UNSUPPORTED'
  | 'CONFLICTED';

export interface KnowledgeRetrievalItemDTO {
  chunkId: string;
  documentId: string;
  sourceId: string;
  sourceTitle: string;
  documentTitle: string;
  content: string;
  score: number; // Final combined score
  semanticScore: number;
  keywordScore: number;
  authority: KnowledgeAuthority;
  authorityBoost: number;
  language: string;
  pageNumber?: number;
  heading?: string;
}

export interface KnowledgeQueryResultDTO {
  query: string;
  organizationId: string;
  answerability: KnowledgeAnswerability;
  topScore: number;
  results: KnowledgeRetrievalItemDTO[];
  citations: Array<{
    sourceName: string;
    documentTitle: string;
    section?: string;
    pageNumber?: number;
    chunkId: string;
    authority: KnowledgeAuthority;
  }>;
  trace?: {
    executionTimeMs: number;
    totalCandidateChunks: number;
    filtersApplied: Record<string, any>;
    modelName: string;
  };
}

export const CreateSourceInputSchema = z.object({
  sourceType: z.enum([
    'MANUAL',
    'STRUCTURED_BUSINESS_DATA',
    'FAQ',
    'WEBSITE',
    'DOCUMENT',
    'POLICY',
    'IMPORT',
    'SYSTEM',
  ]),
  title: z.string().min(2),
  description: z.string().optional(),
  uriOrIdentifier: z.string().optional(),
  authority: z.enum(['AUTHORITATIVE', 'APPROVED', 'REFERENCE', 'UNVERIFIED']).default('REFERENCE'),
});

export const CreateManualArticleInputSchema = z.object({
  title: z.string().min(2),
  content: z.string().min(10),
  category: z.string().default('GENERAL'),
  language: z.enum(['EN', 'KN', 'KANGLISH']).default('EN'),
  authority: z.enum(['AUTHORITATIVE', 'APPROVED', 'REFERENCE', 'UNVERIFIED']).default('APPROVED'),
});

export const IngestWebsiteInputSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  authority: z.enum(['AUTHORITATIVE', 'APPROVED', 'REFERENCE', 'UNVERIFIED']).default('REFERENCE'),
  maxPages: z.number().int().min(1).max(10).default(1),
});

export const QueryKnowledgeInputSchema = z.object({
  query: z.string().min(1),
  organizationId: z.string().uuid().optional(),
  sourceId: z.string().uuid().optional(),
  language: z.enum(['EN', 'KN', 'KANGLISH', 'ALL']).optional(),
  topK: z.number().int().min(1).max(20).default(5),
  includeArchived: z.boolean().default(false),
});

// ==============================================================================
// 7. AI EMPLOYEE / AGENT BUILDER MODELS (PROMPT 08)
// ==============================================================================

export type AIEmployeeStatus =
  | 'DRAFT'
  | 'TESTING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'ARCHIVED';

export type AIEmployeeRole =
  | 'AI_RECEPTIONIST'
  | 'AI_LEAD_QUALIFIER'
  | 'AI_APPOINTMENT_COORDINATOR'
  | 'AI_SALES_ASSISTANT'
  | 'AI_FOLLOW_UP_EXECUTIVE'
  | 'AI_CUSTOMER_SUPPORT'
  | 'AI_FRONT_DESK'
  | 'CUSTOM';

export type AgentPersonalityTone =
  | 'PROFESSIONAL'
  | 'WARM'
  | 'FRIENDLY'
  | 'CONCISE'
  | 'FORMAL';

export type AgentConversationStyle =
  | 'BRIEF'
  | 'BALANCED'
  | 'DETAILED';

export type AgentEnergy =
  | 'CALM'
  | 'NEUTRAL'
  | 'ENTHUSIASTIC';

export type AgentPersonalityPreset =
  | 'PROFESSIONAL_RECEPTIONIST'
  | 'WARM_CUSTOMER_ASSISTANT'
  | 'CONSULTATIVE_SALES_ASSISTANT'
  | 'CONCISE_SUPPORT_ASSISTANT'
  | 'CUSTOM';

export type AgentCapability =
  | 'ANSWER_QUESTIONS'
  | 'QUALIFY_LEAD'
  | 'COLLECT_CONTACT_DETAILS'
  | 'BOOK_APPOINTMENT'
  | 'RESCHEDULE_APPOINTMENT'
  | 'CANCEL_APPOINTMENT'
  | 'CONFIRM_APPOINTMENT'
  | 'FOLLOW_UP'
  | 'TRANSFER_TO_HUMAN'
  | 'SEND_MESSAGE'
  | 'CREATE_LEAD'
  | 'UPDATE_LEAD'
  | 'CHECK_AVAILABILITY'
  | 'CREATE_TASK';

export type AgentEscalationTriggerType =
  | 'CUSTOMER_REQUEST_HUMAN'
  | 'LOW_CONFIDENCE'
  | 'UNSUPPORTED_QUESTION'
  | 'COMPLAINT'
  | 'EMERGENCY'
  | 'SENSITIVE_TOPIC'
  | 'HIGH_VALUE_LEAD'
  | 'REPEATED_MISUNDERSTANDING'
  | 'BUSINESS_RULE_VIOLATION'
  | 'TOOL_FAILURE';

export type AgentEscalationDestinationType =
  | 'BUSINESS_OWNER'
  | 'RECEPTION'
  | 'SALES_TEAM'
  | 'SUPPORT_TEAM'
  | 'SPECIFIC_STAFF'
  | 'PHONE_NUMBER'
  | 'INTEGRATION';

export type AgentEscalationPriority =
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'CRITICAL';

export interface AgentIdentityConfig {
  name: string;
  displayName: string;
  role: AIEmployeeRole;
  customRoleName?: string;
  description: string;
  businessIntroduction: string;
  identifyAsAI: boolean;
}

export interface AgentObjectiveConfig {
  primaryObjective: string;
  secondaryObjectives: string[];
  successCriteria: string[];
}

export interface AgentPersonalityConfig {
  preset: AgentPersonalityPreset;
  tone: AgentPersonalityTone;
  conversationStyle: AgentConversationStyle;
  energy: AgentEnergy;
  customInstructions: string;
}

export interface AgentLanguageConfig {
  primaryLanguage: 'en' | 'kn' | 'kn-en';
  secondaryLanguages: string[];
  conversationalMode: 'KANNADA' | 'ENGLISH' | 'KANGLISH' | 'CUSTOMER_DETECTED';
  allowSwitching: boolean;
}

export interface AgentCapabilityConfig {
  capability: AgentCapability;
  enabled: boolean;
  requiresPermission: boolean;
  notes?: string;
}

export interface AgentKnowledgeAccessConfig {
  accessLevel: 'ALL_BUSINESS_KNOWLEDGE' | 'SELECTED_SOURCES' | 'CATEGORY_FILTERED';
  allowedSourceIds: string[];
  restrictedCategories: string[];
}

export interface AgentToolConfig {
  toolName: string;
  displayName: string;
  enabled: boolean;
  category: 'CALENDAR' | 'CRM' | 'COMMUNICATION' | 'KNOWLEDGE' | 'TELEPHONY';
  isImplemented: boolean;
  permissions: {
    canExecute: boolean;
    requiresConfirmation: boolean;
  };
}

export interface AgentEscalationTriggerConfig {
  triggerType: AgentEscalationTriggerType;
  enabled: boolean;
  destinationType: AgentEscalationDestinationType;
  destinationTarget: string;
  priority: AgentEscalationPriority;
  transferMessage: string;
}

export interface AgentEscalationConfig {
  defaultDestinationType: AgentEscalationDestinationType;
  defaultDestinationTarget: string;
  triggers: AgentEscalationTriggerConfig[];
}

export interface AgentPolicyConfig {
  enforceHealthcareGuardrails: boolean;
  enforceRealEstateGuardrails: boolean;
  enforceSalesGuardrails: boolean;
  noHallucinationEnforced: boolean;
  customPolicyIds: string[];
}

export interface AgentConversationRulesConfig {
  greetingStyle: 'FORMAL' | 'WARM' | 'DIRECT';
  questionStrategy: 'ONE_BY_ONE' | 'NATURAL_FLOW';
  responseLength: 'BRIEF' | 'BALANCED' | 'COMPREHENSIVE';
  uncertaintyBehavior: 'STATE_UNCERTAINTY' | 'ASK_CLARIFICATION' | 'ESCALATE';
  silenceHandling: 'GENTLE_PROMPT' | 'WAIT';
}

export interface AIEmployeeDTO {
  id: string;
  organizationId: string;
  name: string;
  displayName: string;
  description: string;
  role: AIEmployeeRole;
  industry: string;
  status: AIEmployeeStatus;
  activeVersion: number;
  activeVersionId?: string;
  identity: AgentIdentityConfig;
  objective: AgentObjectiveConfig;
  personality: AgentPersonalityConfig;
  language: AgentLanguageConfig;
  capabilities: AgentCapabilityConfig[];
  knowledgeAccess: AgentKnowledgeAccessConfig;
  tools: AgentToolConfig[];
  escalation: AgentEscalationConfig;
  policies: AgentPolicyConfig;
  conversationRules: AgentConversationRulesConfig;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIEmployeeVersionDTO {
  id: string;
  organizationId: string;
  agentId: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ACTIVE' | 'ARCHIVED';
  changelog?: string;
  snapshot: AgentRuntimeConfig;
  publishedAt?: string;
  archivedAt?: string;
  createdBy?: string;
  createdAt: string;
}

export interface AgentRuntimeConfig {
  agentId: string;
  organizationId: string;
  version: number;
  identity: AgentIdentityConfig;
  objective: AgentObjectiveConfig;
  personality: AgentPersonalityConfig;
  language: AgentLanguageConfig;
  capabilities: AgentCapabilityConfig[];
  knowledgeAccess: AgentKnowledgeAccessConfig;
  tools: AgentToolConfig[];
  escalation: AgentEscalationConfig;
  policies: AgentPolicyConfig;
  conversationRules: AgentConversationRulesConfig;
  guardrails: {
    healthcare: boolean;
    realEstate: boolean;
    noHallucination: boolean;
    instructionPrecedence: string[];
  };
  businessBrainReference: {
    organizationId: string;
    industry: string;
  };
  compiledAt: string;
}

// Zod Validation Schemas
export const CreateAIEmployeeInputSchema = z.object({
  name: z.string().min(2).max(100),
  displayName: z.string().min(2).max(120),
  role: z.enum([
    'AI_RECEPTIONIST',
    'AI_LEAD_QUALIFIER',
    'AI_APPOINTMENT_COORDINATOR',
    'AI_SALES_ASSISTANT',
    'AI_FOLLOW_UP_EXECUTIVE',
    'AI_CUSTOMER_SUPPORT',
    'AI_FRONT_DESK',
    'CUSTOM',
  ]),
  industry: z.string().min(2),
  description: z.string().optional(),
  primaryObjective: z.string().min(5),
  primaryLanguage: z.enum(['en', 'kn', 'kn-en']).default('en'),
  personalityPreset: z.enum([
    'PROFESSIONAL_RECEPTIONIST',
    'WARM_CUSTOMER_ASSISTANT',
    'CONSULTATIVE_SALES_ASSISTANT',
    'CONCISE_SUPPORT_ASSISTANT',
    'CUSTOM',
  ]).default('PROFESSIONAL_RECEPTIONIST'),
});

export const UpdateAIEmployeeInputSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  displayName: z.string().min(2).max(120).optional(),
  role: z.enum([
    'AI_RECEPTIONIST',
    'AI_LEAD_QUALIFIER',
    'AI_APPOINTMENT_COORDINATOR',
    'AI_SALES_ASSISTANT',
    'AI_FOLLOW_UP_EXECUTIVE',
    'AI_CUSTOMER_SUPPORT',
    'AI_FRONT_DESK',
    'CUSTOM',
  ]).optional(),
  description: z.string().optional(),
  identity: z.any().optional(),
  objective: z.any().optional(),
  personality: z.any().optional(),
  language: z.any().optional(),
  capabilities: z.array(z.any()).optional(),
  knowledgeAccess: z.any().optional(),
  tools: z.array(z.any()).optional(),
  escalation: z.any().optional(),
  policies: z.any().optional(),
  conversationRules: z.any().optional(),
});

export const SimulateTurnInputSchema = z.object({
  agentId: z.string().min(1).optional(),
  message: z.string().min(1),
  history: z.array(z.any()).default([]),
});

// ==============================================================================
// 8. CONVERSATION ORCHESTRATION ENGINE TYPES (PROMPT 09)
// ==============================================================================

export type ConversationRuntimeState =
  | 'IDLE'
  | 'CONNECTING'
  | 'GREETING'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'INTERRUPTED'
  | 'TOOL_EXECUTION'
  | 'CONFIRMING'
  | 'TRANSFER_PENDING'
  | 'ENDED'
  | 'ERROR';

export type ConversationPersistentStatus =
  | 'ACTIVE'
  | 'PAUSED'
  | 'HANDOFF_COMPLETED'
  | 'ENDED'
  | 'FAILED';

export type ConversationEventType =
  | 'CONVERSATION_STARTED'
  | 'CUSTOMER_MESSAGE_RECEIVED'
  | 'CUSTOMER_INTERRUPTED'
  | 'AGENT_RESPONSE_REQUESTED'
  | 'KNOWLEDGE_RETRIEVAL_REQUESTED'
  | 'TOOL_REQUESTED'
  | 'TOOL_PENDING_CONFIRMATION'
  | 'TOOL_COMPLETED'
  | 'TOOL_FAILED'
  | 'CUSTOMER_REQUESTED_HUMAN'
  | 'ESCALATION_TRIGGERED'
  | 'AGENT_RESPONSE_READY'
  | 'CONVERSATION_ENDED';

export type ConversationMessageType =
  | 'TEXT'
  | 'SYSTEM'
  | 'CUSTOMER'
  | 'AGENT'
  | 'TOOL'
  | 'HANDOFF'
  | 'EVENT';

export type ConversationEndReason =
  | 'CUSTOMER_ENDED'
  | 'AGENT_ENDED'
  | 'HANDOFF_COMPLETED'
  | 'TIMEOUT'
  | 'ERROR'
  | 'POLICY_TERMINATION'
  | 'CHANNEL_ENDED';

export type StructuredLLMDecisionType =
  | 'RESPOND'
  | 'ASK_CLARIFICATION'
  | 'CALL_TOOL'
  | 'HANDOFF'
  | 'END_CONVERSATION';

export interface CustomerContextDTO {
  customerId?: string;
  name?: string;
  phone?: string;
  email?: string;
  location?: string;
  preferredLanguage?: 'en' | 'kn' | 'kn-en';
  budgetPreference?: string;
  timelinePreference?: string;
  metadata?: Record<string, any>;
}

export interface ConversationDTO {
  id: string;
  organizationId: string;
  agentId: string;
  agentVersion: number;
  channel: 'VOICE' | 'WEB_CHAT' | 'WHATSAPP' | 'SMS' | 'SIMULATION';
  status: ConversationPersistentStatus;
  currentState: ConversationRuntimeState;
  detectedLanguage: 'en' | 'kn' | 'kn-en' | 'unknown';
  customerContext: CustomerContextDTO;
  activeToolName?: string;
  pendingConfirmationTool?: {
    toolName: string;
    args: Record<string, any>;
  };
  summaryId?: string;
  handoffId?: string;
  endReason?: ConversationEndReason;
  startedAt: string;
  endedAt?: string;
  updatedAt: string;
}

export interface ConversationMessageDTO {
  id: string;
  conversationId: string;
  organizationId: string;
  speaker: 'CUSTOMER' | 'AGENT' | 'SYSTEM' | 'TOOL';
  messageType: ConversationMessageType;
  content: string;
  language?: string;
  sequenceNumber: number;
  metadata?: {
    confidence?: number;
    intent?: string;
    groundedSources?: string[];
    toolCallId?: string;
    latencyMs?: number;
    tokensUsed?: number;
  };
  createdAt: string;
}

export interface ConversationEventDTO {
  id: string;
  conversationId: string;
  organizationId: string;
  eventType: ConversationEventType;
  idempotencyKey?: string;
  previousState: ConversationRuntimeState;
  newState: ConversationRuntimeState;
  payload: Record<string, any>;
  createdAt: string;
}

export interface ConversationToolCallDTO {
  id: string;
  conversationId: string;
  organizationId: string;
  toolName: string;
  arguments: Record<string, any>;
  status: 'PENDING_PERMISSION' | 'PENDING_CONFIRMATION' | 'EXECUTING' | 'SUCCESS' | 'FAILED' | 'REJECTED';
  requiresConfirmation: boolean;
  isConfirmed: boolean;
  result?: Record<string, any>;
  errorMessage?: string;
  executionDurationMs?: number;
  createdAt: string;
  completedAt?: string;
}

export interface ConversationHandoffDTO {
  id: string;
  conversationId: string;
  organizationId: string;
  reason: 'CUSTOMER_REQUEST' | 'EMERGENCY' | 'COMPLAINT' | 'LOW_CONFIDENCE' | 'TOOL_FAILURE' | 'POLICY_VIOLATION' | 'HIGH_VALUE_LEAD';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  destinationType: 'RECEPTION' | 'SALES_TEAM' | 'SUPPORT_TEAM' | 'SPECIFIC_STAFF' | 'PHONE_NUMBER';
  destinationTarget: string;
  handoffSummary: string;
  customerContext: CustomerContextDTO;
  isEmergencyCasualty: boolean;
  createdAt: string;
}

export interface ConversationSummaryDTO {
  id: string;
  conversationId: string;
  organizationId: string;
  customerGoal: string;
  importantDetails: string[];
  preferences: Record<string, string>;
  openQuestions: string[];
  actionsCompleted: string[];
  actionsPending: string[];
  escalationStatus: string;
  turnCount: number;
  createdAt: string;
}

export interface StructuredLLMDecisionDTO {
  type: StructuredLLMDecisionType;
  response: string;
  toolRequest?: {
    toolName: string;
    args: Record<string, any>;
  };
  handoffReason?: string;
  reason: string;
  confidence: number; // Raw model confidence signal (0-1)
  knowledgeReferences: string[];
}

export interface ConversationTurnDTO {
  turnId: string;
  conversationId: string;
  speaker: 'CUSTOMER' | 'AGENT';
  userUtterance?: string;
  agentResponse?: string;
  stateBefore: ConversationRuntimeState;
  stateAfter: ConversationRuntimeState;
  decision?: StructuredLLMDecisionDTO;
  groundedSources: Array<{
    sourceTitle: string;
    content: string;
    score: number;
  }>;
  policyFlags: string[];
  toolInteractions: Array<{
    toolName: string;
    status: string;
  }>;
  handoffRequested?: boolean;
  languagePlan?: ResponseLanguagePlanDTO;
  normalizedUtterance?: NormalizedUtteranceDTO;
  executionDurationMs: number;
  createdAt: string;
}

// Zod Schemas for Validation
export const CreateConversationInputSchema = z.object({
  organizationId: z.string().min(1).optional(),
  agentId: z.string().min(1),
  channel: z.enum(['VOICE', 'WEB_CHAT', 'WHATSAPP', 'SMS', 'SIMULATION']).default('WEB_CHAT'),
  customerContext: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    preferredLanguage: z.enum(['en', 'kn', 'kn-en']).optional(),
  }).optional(),
});

export const ProcessCustomerMessageInputSchema = z.object({
  message: z.string().min(1),
  idempotencyKey: z.string().optional(),
  language: z.enum(['en', 'kn', 'kn-en']).optional(),
});

// ==============================================================================
// 10. KANNADA + KANGLISH CONVERSATION INTELLIGENCE TYPES (PROMPT 10)
// ==============================================================================

export type LanguageMode = 'ENGLISH' | 'KANNADA' | 'KANNADA_ENGLISH' | 'KANGLISH' | 'UNKNOWN';

export type KannadaRegister = 'FORMAL' | 'PROFESSIONAL' | 'NEUTRAL' | 'FRIENDLY' | 'CASUAL';

export type DialectProfile =
  | 'KARNATAKA_GENERAL'
  | 'BENGALURU'
  | 'MYSURU'
  | 'NORTH_KARNATAKA'
  | 'COASTAL_KARNATAKA'
  | 'HYDERABAD_KARNATAKA';

export interface LanguageDetectionResult {
  primaryLanguage: LanguageMode;
  secondaryLanguage?: LanguageMode;
  confidence: number;
  script: 'KANNADA' | 'LATIN' | 'MIXED';
  isRomanizedKannada: boolean;
  codeSwitchRatio: number;
  tokens?: Array<{ word: string; script: string; language: string }>;
}

export interface ExtractedEntityDTO {
  type:
    | 'PERSON'
    | 'DOCTOR'
    | 'SERVICE'
    | 'LOCATION'
    | 'DATE'
    | 'TIME'
    | 'AMOUNT'
    | 'PHONE'
    | 'EMAIL'
    | 'PROPERTY'
    | 'PROJECT'
    | 'ROOM'
    | 'APPOINTMENT'
    | 'POLICY'
    | 'LANGUAGE';
  rawExpression: string;
  canonicalValue: any;
  confidence: number;
  resolvedEntityId?: string;
  pronunciationHint?: string;
}

export interface NormalizedUtteranceDTO {
  rawText: string;
  normalizedText: string;
  detectedLanguage: LanguageDetectionResult;
  isCorrection: boolean;
  correctedFrom?: string;
  isNegation: boolean;
  isQuestion: boolean;
  isAmbiguous: boolean;
  ambiguityReasons?: string[];
  fillersRemoved: string[];
  extractedEntities: ExtractedEntityDTO[];
}

export interface PronunciationMetadataDTO {
  displayText: string;
  spokenTextKannada: string;
  spokenTextEnglish: string;
  phoneticHint?: string;
}

export interface ResponseLanguagePlanDTO {
  targetMode: LanguageMode;
  register: KannadaRegister;
  honorificStyle: 'AVARU' | 'NIMMA' | 'SIR_MADAM' | 'NONE';
  allowEnglishLoanwords: boolean;
  reasoning: string;
}

export interface LanguageQualityValidationResult {
  isValid: boolean;
  qualityScore: number;
  scriptConsistency: boolean;
  loanwordAppropriateness: boolean;
  violations: string[];
  remediatedResponse?: string;
}

export interface LanguageEvaluationCase {
  id: string;
  category: string;
  industry?: string;
  input: string;
  expectedLanguage: LanguageMode;
  expectedEntities?: Partial<Record<string, any>>;
  isNegation?: boolean;
  isAmbiguous?: boolean;
  notes?: string;
}

export const LanguagePreviewInputSchema = z.object({
  text: z.string().min(1),
  organizationId: z.string().min(1).optional(),
  customerPreference: z.enum(['ENGLISH', 'KANNADA', 'KANGLISH', 'AUTO']).optional(),
});

// ==============================================================================
// 12. CRM, CONTACTS & LEAD MANAGEMENT DOMAIN (PROMPT 15)
// ==============================================================================

export type ContactStatus = 'ACTIVE' | 'INACTIVE' | 'DO_NOT_CONTACT' | 'ARCHIVED';

export type ContactSource =
  | 'PHONE'
  | 'WEBSITE'
  | 'META'
  | 'GOOGLE'
  | 'WHATSAPP'
  | 'MANUAL'
  | 'IMPORT'
  | 'REFERRAL'
  | 'OTHER';

export interface ContactDTO {
  id: string;
  organizationId: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  phone: string; // E.164 normalized
  email?: string;
  preferredLanguage?: string;
  timezone?: string;
  city?: string;
  location?: string;
  source: ContactSource;
  status: ContactStatus;
  doNotContactReason?: string;
  doNotContactSetAt?: string;
  notes?: string;
  lastContactedAt?: string;
  lastActivityAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type CRMLeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'UNQUALIFIED'
  | 'CONVERTED'
  | 'LOST'
  | 'DO_NOT_CONTACT';

export type CRMLeadStage =
  | 'NEW'
  | 'QUALIFICATION'
  | 'FOLLOW_UP'
  | 'APPOINTMENT'
  | 'PROPOSAL'
  | 'CONVERTED'
  | 'LOST';

export type LeadQualificationStatus =
  | 'NOT_STARTED'
  | 'PARTIALLY_QUALIFIED'
  | 'QUALIFIED'
  | 'DISQUALIFIED';

export interface CRMLeadDTO {
  id: string;
  organizationId: string;
  contactId: string;
  source: ContactSource;
  sourceReference?: string;
  campaignId?: string;
  conversationId?: string;
  status: CRMLeadStatus;
  stage: CRMLeadStage;
  interest: string;
  industryContext?: string;
  location?: string;
  budget?: string;
  timeline?: string;
  qualificationStatus: LeadQualificationStatus;
  qualificationScore: number;
  qualificationData: Record<string, any>;
  assignedTo?: string;
  assignedTeam?: string;
  notes?: string;
  lastContactedAt?: string;
  nextFollowUpAt?: string;
  convertedAt?: string;
  lostAt?: string;
  lostReason?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export type ActivityType =
  | 'CALL'
  | 'MESSAGE'
  | 'EMAIL'
  | 'NOTE'
  | 'LEAD_CREATED'
  | 'LEAD_UPDATED'
  | 'APPOINTMENT_CREATED'
  | 'APPOINTMENT_CANCELLED'
  | 'FOLLOW_UP_CREATED'
  | 'HANDOFF'
  | 'STATUS_CHANGED'
  | 'STAGE_CHANGED';

export type ActivityCreatorType = 'AI_AGENT' | 'HUMAN' | 'SYSTEM' | 'INTEGRATION';

export interface CRMActivityDTO {
  id: string;
  organizationId: string;
  contactId: string;
  leadId?: string;
  conversationId?: string;
  type: ActivityType;
  title: string;
  description?: string;
  metadata: Record<string, any>;
  createdByType: ActivityCreatorType;
  createdById?: string;
  createdAt: string;
}

export interface CRMOpportunityDTO {
  id: string;
  organizationId: string;
  leadId?: string;
  contactId: string;
  title: string;
  estimatedValue?: number;
  currency: string;
  stage: string;
  probabilityPercentage: number;
  expectedCloseDate?: string;
  status: 'OPEN' | 'WON' | 'LOST' | 'ABANDONED';
  createdAt: string;
  updatedAt: string;
}

export interface CRMAnalyticsDTO {
  totalLeads: number;
  newLeads: number;
  qualifiedLeads: number;
  convertedLeads: number;
  lostLeads: number;
  totalContacts: number;
  activeAppointments: number;
  leadSourcesBreakdown: Record<string, number>;
}

// ==============================================================================
// 13. OUTBOUND CALLING & CAMPAIGN ENGINE DOMAIN (PROMPT 16)
// ==============================================================================

export type CampaignType =
  | 'LEAD_FOLLOW_UP'
  | 'APPOINTMENT_CONFIRMATION'
  | 'APPOINTMENT_REMINDER'
  | 'CALLBACK'
  | 'SITE_VISIT_CONFIRMATION'
  | 'MISSED_CALL_FOLLOW_UP'
  | 'INQUIRY_FOLLOW_UP';

export type CampaignStatus =
  | 'DRAFT'
  | 'READY'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ARCHIVED';

export type CampaignTargetStatus =
  | 'PENDING'
  | 'ELIGIBLE'
  | 'BLOCKED'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED'
  | 'OPTED_OUT';

export type IneligibilityReason =
  | 'NO_PHONE'
  | 'INVALID_PHONE'
  | 'DO_NOT_CONTACT'
  | 'CONSENT_REQUIRED'
  | 'CONSENT_MISSING'
  | 'OUTSIDE_CALLING_WINDOW'
  | 'CAMPAIGN_PAUSED'
  | 'AGENT_UNAVAILABLE'
  | 'RETRY_LIMIT_REACHED'
  | 'ALREADY_COMPLETED'
  | 'ACTIVE_CALL_EXISTS'
  | 'POLICY_BLOCKED'
  | 'RATE_LIMITED';

export interface CampaignDTO {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  type: CampaignType;
  status: CampaignStatus;
  agentId: string;
  agentVersion: number;
  callerPhoneNumber: string;
  callingPurpose: string;
  identityDisclosure: string;
  timezone: string;
  startDate: string;
  endDate?: string;
  callingWindowStart: string; // HH:mm:ss
  callingWindowEnd: string;   // HH:mm:ss
  allowedDaysOfWeek: number[]; // 1-7
  blackoutDates: string[];    // YYYY-MM-DD
  maxConcurrentCalls: number;
  maxCallsPerDay: number;
  maxAttemptsPerTarget: number;
  retryDelayMinutes: number;
  requireConsent: boolean;
  createdBy?: string;
  activatedAt?: string;
  pausedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignTargetDTO {
  id: string;
  organizationId: string;
  campaignId: string;
  contactId: string;
  leadId?: string;
  appointmentId?: string;
  callbackId?: string;
  status: CampaignTargetStatus;
  eligibilityStatus: 'ELIGIBLE' | 'BLOCKED' | 'NOT_EVALUATED';
  ineligibilityReason?: IneligibilityReason;
  attemptCount: number;
  nextAttemptAt?: string;
  lastAttemptAt?: string;
  lastOutcome?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignJobDTO {
  id: string;
  organizationId: string;
  campaignId: string;
  targetId: string;
  scheduledAt: string;
  status: 'QUEUED' | 'LOCKED' | 'STARTING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'SKIPPED';
  attempt: number;
  lockedAt?: string;
  lockedBy?: string;
  startedAt?: string;
  completedAt?: string;
  failureReason?: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignCallAttemptDTO {
  id: string;
  organizationId: string;
  campaignId: string;
  campaignTargetId: string;
  campaignJobId?: string;
  telephonySessionId?: string;
  providerCallSid?: string;
  conversationId?: string;
  attemptNumber: number;
  status: 'QUEUED' | 'DISPATCHED' | 'RINGING' | 'ANSWERED' | 'NO_ANSWER' | 'BUSY' | 'FAILED' | 'COMPLETED' | 'CANCELLED';
  telephonyOutcome?: string;
  businessOutcome?: string;
  failureReason?: string;
  durationSeconds: number;
  startedAt: string;
  answeredAt?: string;
  endedAt?: string;
  createdAt: string;
}

export interface CampaignAnalyticsDTO {
  totalTargets: number;
  eligibleTargets: number;
  blockedTargets: number;
  callsAttempted: number;
  callsAnswered: number;
  answerRatePercentage: number;
  completedOutcomes: number;
  optOutCount: number;
  failedCount: number;
  avgDurationSeconds: number;
}

// ============================================================================
// 17. HUMAN HANDOFF, ESCALATION, NOTIFICATIONS & TEAMS
// ============================================================================

export type HandoffType =
  | 'LIVE_TRANSFER'
  | 'CALLBACK_REQUEST'
  | 'HUMAN_REVIEW'
  | 'TEAM_ESCALATION'
  | 'URGENT_ESCALATION';

export type HandoffStatus =
  | 'REQUESTED'
  | 'VALIDATING'
  | 'PENDING'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'TRANSFER_PENDING'
  | 'TRANSFERRED'
  | 'CALLBACK_SCHEDULED'
  | 'RESOLVED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'FAILED'
  | 'CANCELLED';

export type HandoffReason =
  | 'USER_REQUEST'
  | 'AI_UNABLE_TO_ANSWER'
  | 'LOW_CONFIDENCE'
  | 'KNOWLEDGE_GAP'
  | 'TOOL_FAILURE'
  | 'COMPLEX_REQUEST'
  | 'MEDICAL_SAFETY'
  | 'EMERGENCY'
  | 'COMPLAINT'
  | 'CUSTOMER_REQUEST'
  | 'PAYMENT_ISSUE'
  | 'LEGAL_QUESTION'
  | 'PRIVACY_REQUEST'
  | 'NEGOTIATION_REQUIRED'
  | 'HIGH_VALUE_LEAD'
  | 'BUSINESS_POLICY'
  | 'TECHNICAL_FAILURE'
  | 'OTHER';

export type HandoffPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type HumanAvailabilityStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE' | 'DO_NOT_DISTURB';

export type DestinationType = 'USER' | 'TEAM' | 'PHONE_NUMBER' | 'QUEUE';

export type HandoffResolutionOutcome =
  | 'RESOLVED'
  | 'NO_ACTION_REQUIRED'
  | 'CALLBACK_COMPLETED'
  | 'TRANSFER_COMPLETED'
  | 'CUSTOMER_CONTACTED'
  | 'CUSTOMER_UNREACHABLE'
  | 'ESCALATED_FURTHER'
  | 'OTHER';

export interface StructuredHandoffSummaryDTO {
  customerSummary: string;
  reason: HandoffReason;
  request: string;
  relevantEntities: Record<string, any>;
  recentActions: string[];
  pendingAction?: string;
  preferredLanguage: string;
  urgency: HandoffPriority;
  appointmentContext?: Record<string, any>;
  leadContext?: Record<string, any>;
  generatedByAI: boolean;
}

export interface ConversationHandoffRecordDTO {
  id: string;
  organizationId: string;
  conversationId: string;
  voiceSessionId?: string;
  telephonySessionId?: string;
  agentId?: string;
  agentVersionId?: string;
  type: HandoffType;
  reason: HandoffReason;
  priority: HandoffPriority;
  status: HandoffStatus;
  assignedUserId?: string;
  assignedTeamId?: string;
  destinationType?: DestinationType;
  destination: string; // phone number, user id, or team id
  summary?: StructuredHandoffSummaryDTO;
  notes?: string;
  callbackTaskId?: string;
  failureReason?: string;
  resolution?: HandoffResolutionOutcome;
  resolutionNotes?: string;
  resolutionNextAction?: 'NONE' | 'CALLBACK' | 'APPOINTMENT' | 'FOLLOW_UP';
  requestedAt: string;
  acceptedAt?: string;
  startedAt?: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  slaBreached?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeamDTO {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description?: string;
  industry?: string;
  contactPhone?: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMemberDTO {
  id: string;
  organizationId: string;
  teamId: string;
  userId: string;
  role: 'LEAD' | 'MEMBER';
  availability: HumanAvailabilityStatus;
  lastSeenAt?: string;
  createdAt: string;
}

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH';
export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type NotificationStatus = 'UNREAD' | 'READ' | 'ARCHIVED';

export type NotificationEventType =
  | 'HANDOFF_CREATED'
  | 'HANDOFF_ASSIGNED'
  | 'HANDOFF_HIGH_PRIORITY'
  | 'HANDOFF_URGENT'
  | 'HANDOFF_SLA_BREACHED'
  | 'CALLBACK_REQUESTED'
  | 'APPOINTMENT_REQUESTED'
  | 'APPOINTMENT_CONFLICT'
  | 'CAMPAIGN_FAILURE'
  | 'PROVIDER_FAILURE';

export interface NotificationDTO {
  id: string;
  organizationId: string;
  recipientUserId: string;
  type: NotificationEventType;
  priority: NotificationPriority;
  title: string;
  body: string;
  entityType: 'HANDOFF' | 'LEAD' | 'CALL' | 'APPOINTMENT' | 'CAMPAIGN';
  entityId: string;
  status: NotificationStatus;
  readAt?: string;
  channel: NotificationChannel;
  idempotencyKey?: string;
  createdAt: string;
}

export interface NotificationPreferencesDTO {
  id: string;
  organizationId: string;
  userId: string;
  emailNotificationsEnabled: boolean;
  inAppNotificationsEnabled: boolean;
  urgentOnlyEmail: boolean;
  handoffAlerts: boolean;
  campaignAlerts: boolean;
  systemAlerts: boolean;
  updatedAt: string;
}

export interface HandoffSLADTO {
  organizationId: string;
  priority: HandoffPriority;
  targetResponseMinutes: number; // e.g. URGENT: 0 (immediate), HIGH: 10, NORMAL: 30, LOW: 120
  targetResolutionMinutes: number;
}

export interface EscalationPolicyDTO {
  id: string;
  organizationId: string;
  agentId?: string;
  industry?: string;
  maxFailedAnswerAttempts: number;
  unsupportedKnowledgePolicy: 'ASK_CLARIFICATION' | 'ESCALATE_HUMAN' | 'OFFER_CALLBACK';
  defaultLiveTransferDestinationPhone?: string;
  defaultLiveTransferTeamId?: string;
  operatingHoursOnlyTransfer: boolean;
  fallbackToCallback: boolean;
  highValueLeadThresholdBudget?: number;
  emergencyCasualtyDirectPhone: string;
  medicalSafetyMandatoryEscalate: boolean;
}

// ============================================================================
// 18. ANALYTICS, USAGE METERING & COST INTELLIGENCE ENGINE
// ============================================================================

export type UsageEventType =
  | 'CALL_STARTED'
  | 'CALL_COMPLETED'
  | 'VOICE_DURATION'
  | 'STT_USAGE'
  | 'TTS_USAGE'
  | 'LLM_USAGE'
  | 'EMBEDDING_USAGE'
  | 'TOOL_EXECUTION'
  | 'HANDOFF'
  | 'APPOINTMENT'
  | 'LEAD_CREATED'
  | 'CAMPAIGN_CALL'
  | 'KNOWLEDGE_INGESTION'
  | 'ADJUSTMENT';

export type UsageResourceType =
  | 'VOICE_MINUTE'
  | 'STT_SECOND'
  | 'TTS_CHARACTER'
  | 'TTS_SECOND'
  | 'LLM_INPUT_TOKEN'
  | 'LLM_OUTPUT_TOKEN'
  | 'EMBEDDING_TOKEN'
  | 'CALL'
  | 'CONVERSATION'
  | 'TOOL_EXECUTION'
  | 'MESSAGE';

export type CostCalculationType = 'ACTUAL' | 'ESTIMATED' | 'UNKNOWN';

export type UsageLedgerStatus = 'UNBILLED' | 'BILLED' | 'WAIVED' | 'ADJUSTED';

export type MeterName =
  | 'VOICE_MINUTES'
  | 'STT_SECONDS'
  | 'TTS_CHARACTERS'
  | 'LLM_INPUT_TOKENS'
  | 'LLM_OUTPUT_TOKENS'
  | 'CALLS'
  | 'MESSAGES'
  | 'TOOL_EXECUTIONS';

export interface UsageEventDTO {
  id: string;
  organizationId: string;
  eventType: UsageEventType;
  resourceType: UsageResourceType;
  resourceId?: string;
  provider: string; // 'sarvam-ai', 'deepgram', 'openai', 'exotel', 'twilio', etc.
  model?: string;
  quantity: number;
  unit: string; // 'seconds', 'characters', 'tokens', 'calls', 'executions'
  costType: CostCalculationType;
  estimatedCost: number;
  actualCost?: number;
  currency: string; // Default: 'INR'
  pricingVersionId?: string;
  agentId?: string;
  agentVersionId?: string;
  conversationId?: string;
  voiceSessionId?: string;
  telephonySessionId?: string;
  campaignId?: string;
  knowledgeSourceId?: string;
  channel?: 'VOICE' | 'WEB' | 'WHATSAPP' | 'SMS';
  language?: string; // 'kn-IN', 'en-IN', 'hi-IN', 'mixed'
  occurredAt: string; // ISO string in UTC
  metadata?: Record<string, any>;
  correlationId: string;
}

export interface ProviderPricingDefinitionDTO {
  id: string;
  provider: string;
  service: 'TELEPHONY' | 'STT' | 'TTS' | 'LLM' | 'EMBEDDING' | 'STORAGE' | 'MESSAGING';
  model?: string;
  unit: string; // e.g. 'per_minute', 'per_second', 'per_1k_tokens', 'per_1k_chars'
  price: number; // In currency
  currency: string; // 'INR'
  effectiveFrom: string;
  effectiveTo?: string;
  version: string;
}

export interface UsageLedgerRecordDTO {
  id: string;
  organizationId: string;
  usageEventId: string;
  billingPeriod: string; // e.g. '2026-10'
  meter: MeterName;
  quantity: number;
  unit: string;
  costBasis: number;
  currency: string;
  status: UsageLedgerStatus;
  createdAt: string;
}

export interface DailyUsageAggregationDTO {
  id: string;
  organizationId: string;
  date: string; // 'YYYY-MM-DD'
  agentId?: string;
  channel?: string;
  industry?: string;
  totalCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  connectedCalls: number;
  failedCalls: number;
  voiceMinutes: number;
  sttSeconds: number;
  ttsCharacters: number;
  llmInputTokens: number;
  llmOutputTokens: number;
  toolCalls: number;
  leadsCreated: number;
  leadsQualified: number;
  appointmentsCreated: number;
  handoffsCount: number;
  estimatedCostInr: number;
  actualCostInr: number;
  updatedAt: string;
}

export interface UsageAlertThresholdDTO {
  id: string;
  organizationId: string;
  meter: MeterName;
  monthlyLimit: number;
  thresholdPercentages: number[]; // e.g. [75, 90, 100]
  triggeredPercentages: number[];
  recipientEmails: string[];
  lastTriggeredAt?: string;
}

export interface AnalyticsOverviewDTO {
  organizationId: string;
  period: 'TODAY' | '7_DAYS' | '30_DAYS' | 'CUSTOM';
  startDate: string;
  endDate: string;
  summary: {
    totalCalls: number;
    inboundCalls: number;
    outboundCalls: number;
    connectedCalls: number;
    failedCalls: number;
    totalConversations: number;
    voiceMinutes: number;
    totalLeads: number;
    qualifiedLeads: number;
    appointmentsCreated: number;
    handoffs: number;
    estimatedCostInr: number;
    actualCostInr: number;
  };
  funnel: {
    calls: number;
    conversations: number;
    qualifiedLeads: number;
    appointments: number;
    conversions: number;
  };
  latencyMetrics: {
    sttP50Ms?: number;
    sttP95Ms?: number;
    llmP50Ms?: number;
    llmP95Ms?: number;
    ttsP50Ms?: number;
    ttsP95Ms?: number;
    firstResponseP50Ms?: number;
    firstResponseP95Ms?: number;
  };
  languageDistribution: Record<string, number>;
  topAgents: Array<{
    agentId: string;
    agentName: string;
    calls: number;
    voiceMinutes: number;
    appointments: number;
    leads: number;
    handoffs: number;
    costInr: number;
  }>;
}

export interface CostAnomalyAlertDTO {
  id: string;
  organizationId: string;
  meter: MeterName;
  expectedDailyAverage: number;
  actualQuantity: number;
  variancePercentage: number;
  detectedAt: string;
  acknowledged: boolean;
}

// ============================================================================
// 19. BILLING, PLANS, SUBSCRIPTIONS & USAGE ENTITLEMENTS
// ============================================================================

export type SubscriptionStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'PAUSED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'INCOMPLETE'
  | 'PENDING';

export type BillingInterval = 'MONTHLY' | 'ANNUAL';

export type PaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'CANCELLED';

export type EntitlementType = 'BOOLEAN' | 'INTEGER_LIMIT' | 'DECIMAL_LIMIT' | 'UNLIMITED';

export type UsageLimitState = 'AVAILABLE' | 'NEAR_LIMIT' | 'LIMIT_REACHED' | 'OVERAGE' | 'BLOCKED';

export interface BillingAccountDTO {
  id: string;
  organizationId: string;
  billingEmail: string;
  billingName: string;
  companyName?: string;
  taxIdentifier?: string; // GSTIN in India
  billingAddress?: {
    line1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  currency: string; // 'INR'
  timezone: string; // 'Asia/Kolkata'
  status: 'ACTIVE' | 'DELINQUENT' | 'SUSPENDED';
  provider: 'RAZORPAY' | 'STRIPE' | 'MANUAL';
  providerCustomerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanFeatureEntitlementsDTO {
  // Quantitative Limits
  maxAiEmployees: number; // or -1 for UNLIMITED
  maxLocations: number;
  maxUsers: number;
  maxKnowledgeSources: number;
  maxKnowledgeStorageMb: number;
  maxContacts: number;
  maxMonthlyVoiceMinutes: number;
  maxMonthlySttSeconds: number;
  maxMonthlyTtsCharacters: number;
  maxMonthlyLlmTokens: number;
  maxMonthlyCalls: number;
  maxMonthlyOutboundCalls: number;
  maxCampaignTargets: number;
  maxAppointments: number;

  // Feature Flags
  voiceEnabled: boolean;
  outboundCallingEnabled: boolean;
  campaignsEnabled: boolean;
  knowledgeBaseEnabled: boolean;
  analyticsEnabled: boolean;
  advancedAnalyticsEnabled: boolean;
  humanHandoffEnabled: boolean;
  customAiEmployeeEnabled: boolean;
  apiAccessEnabled: boolean;
  webhooksEnabled: boolean;
  crmIntegrationsEnabled: boolean;
}

export interface PlanDTO {
  id: string; // 'plan_free', 'plan_starter', 'plan_growth', 'plan_business', 'plan_enterprise'
  name: string; // 'Trial', 'Starter', 'Growth', 'Business', 'Enterprise'
  slug: string;
  description: string;
  monthlyPrice: number; // In INR
  annualPrice: number; // In INR
  currency: string; // 'INR'
  visibility: 'PUBLIC' | 'PRIVATE' | 'CUSTOM';
  status: 'ACTIVE' | 'ARCHIVED';
  entitlements: PlanFeatureEntitlementsDTO;
  overageVoiceMinutePrice?: number; // In INR, e.g. ₹2.50/min
  activeVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanVersionDTO {
  id: string;
  planId: string;
  version: string;
  effectiveFrom: string;
  effectiveTo?: string;
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
  entitlements: PlanFeatureEntitlementsDTO;
  status: 'ACTIVE' | 'ARCHIVED';
}

export interface SubscriptionDTO {
  id: string;
  organizationId: string;
  billingAccountId: string;
  planId: string;
  planVersionId: string;
  provider: 'RAZORPAY' | 'STRIPE' | 'MANUAL';
  providerSubscriptionId?: string;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: string;
  trialStart?: string;
  trialEnd?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionEventDTO {
  id: string;
  organizationId: string;
  subscriptionId: string;
  eventType:
    | 'SUBSCRIPTION_CREATED'
    | 'PLAN_CHANGED'
    | 'UPGRADED'
    | 'DOWNGRADED'
    | 'RENEWED'
    | 'CANCEL_REQUESTED'
    | 'CANCELLED'
    | 'PAYMENT_FAILED'
    | 'PAYMENT_RECOVERED'
    | 'TRIAL_STARTED'
    | 'TRIAL_ENDED'
    | 'PAUSED'
    | 'RESUMED';
  previousPlanId?: string;
  newPlanId?: string;
  reason?: string;
  occurredAt: string;
}

export interface PaymentRecordDTO {
  id: string;
  organizationId: string;
  billingAccountId: string;
  subscriptionId?: string;
  provider: 'RAZORPAY' | 'STRIPE' | 'MANUAL';
  providerPaymentId: string;
  providerOrderId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethodType?: 'UPI' | 'CARD' | 'NETBANKING' | 'WALLET' | 'BANK_TRANSFER';
  paidAt?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillingInvoiceDTO {
  id: string;
  organizationId: string;
  billingAccountId: string;
  subscriptionId?: string;
  paymentId?: string;
  invoiceNumber: string; // e.g. 'INV-2026-0001'
  subtotal: number;
  taxAmount: number;
  taxIdentifier?: string; // GSTIN
  totalAmount: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  status: 'PAID' | 'PENDING' | 'VOID';
  issuedAt: string;
  pdfUrl?: string;
}

export interface BillingProviderEventDTO {
  id: string;
  provider: string; // 'RAZORPAY'
  providerEventId: string;
  eventType: string; // e.g. 'subscription.charged', 'payment.failed'
  payloadReference?: string;
  organizationId?: string;
  receivedAt: string;
  processedAt?: string;
  processingStatus: 'PENDING' | 'PROCESSED' | 'FAILED' | 'IGNORED';
  error?: string;
  createdAt: string;
}

export interface BillingSnapshotDTO {
  organizationId: string;
  billingAccount?: BillingAccountDTO;
  subscription: SubscriptionDTO;
  plan: PlanDTO;
  isTrial: boolean;
  daysRemainingInTrial?: number;
  periodStart: string;
  periodEnd: string;
  entitlements: PlanFeatureEntitlementsDTO;
  usageSummary: {
    aiEmployeesCount: number;
    locationsCount: number;
    contactsCount: number;
    voiceMinutesUsed: number;
    voiceMinutesRemaining: number;
    voiceMinutesUsagePercent: number;
    voiceMinutesState: UsageLimitState;
    campaignCallsUsed: number;
    appointmentsCount: number;
  };
  isEntitlementExceeded: boolean;
  exceededEntities?: string[];
  recentPayments: PaymentRecordDTO[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Runtime Safety Policy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Central policy for provider mock/simulation fallbacks (SMS/telephony,
 * WhatsApp, TTS/STT, embeddings, payments).
 *
 * SAFETY CONTRACT:
 * A provider must NEVER silently fabricate a successful result. Mocks are an
 * explicit opt-in for local development and demos, and are forbidden in
 * production regardless of configuration.
 *
 * Enable locally with:  ALLOW_MOCK_PROVIDERS=true
 */
export function areMockProvidersAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.ALLOW_MOCK_PROVIDERS === 'true';
}

/**
 * Thrown when a provider is invoked without real credentials and mock
 * fallbacks have not been explicitly enabled. Fail loudly, never fake success.
 */
export class ProviderNotConfiguredError extends Error {
  public readonly provider: string;
  constructor(provider: string, requiredEnvVars: string[]) {
    super(
      `[${provider}] Provider is not configured. Missing: ${requiredEnvVars.join(', ')}. ` +
        `Set these credentials, or enable simulated providers for local development with ALLOW_MOCK_PROVIDERS=true.`
    );
    this.name = 'ProviderNotConfiguredError';
    this.provider = provider;
  }
}

// ==============================================================================
// REAL ESTATE VERTICAL MODELS (PROMPT 06)
// ==============================================================================

export type PropertyType = 'PLOT' | 'VILLA' | 'APARTMENT' | 'HOUSE' | 'COMMERCIAL';
export type PropertyAvailabilityStatus = 'AVAILABLE' | 'ON_HOLD' | 'RESERVED' | 'SOLD' | 'INACTIVE';
export type ReraVerificationStatus = 'VERIFIED' | 'PENDING_VERIFICATION' | 'UNVERIFIED' | 'EXPIRED';

export interface PropertyDimensions {
  lengthFeet?: number;
  widthFeet?: number;
  dimensionText?: string; // e.g. "30x40 ft", "40x60 ft", "50x80 ft"
  totalArea: number; // in explicit unit
  unit: 'SQFT' | 'SQYARDS' | 'CENTS' | 'ACRES';
  areaSqft: number; // normalized sqft
}

export interface PropertyPricing {
  basePrice: number; // in INR
  pricePerSqft?: number;
  priceNegotiable?: boolean;
  currency: string; // 'INR'
  additionalCharges?: {
    cornerCharge?: number;
    clubhouseMaintenance?: number;
    registrationEstimate?: number;
    notes?: string;
  };
}

export interface ReraComplianceDetails {
  registrationNumber?: string;
  jurisdiction?: string; // e.g. "K-RERA (Karnataka)"
  verificationStatus: ReraVerificationStatus;
  verificationSource?: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface PropertyDTO {
  id: string;
  workspaceId: string;
  organizationId: string;
  name: string;
  referenceCode: string;
  propertyType: PropertyType;
  subType?: string;
  locality: string;
  address?: string;
  mapUrl?: string;
  dimensions: PropertyDimensions;
  pricing: PropertyPricing;
  status: PropertyAvailabilityStatus;
  amenities: string[];
  description: string;
  developerContact: {
    name: string;
    phone: string;
    email?: string;
  };
  reraDetails?: ReraComplianceDetails;
  documents?: Array<{
    title: string;
    url: string;
    type: string;
  }>;
  verifiedBy?: string;
  lastVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RealEstateConfigDTO {
  siteVisitDays?: number[]; // e.g. [0, 1, 2, 3, 4, 5, 6]
  siteVisitStart?: string; // e.g. '09:30'
  siteVisitEnd?: string; // e.g. '18:00'
  defaultVisitDurationMinutes?: number; // e.g. 60
  bufferMinutes?: number; // e.g. 15
  maxVisitorsPerSlot?: number; // e.g. 4
  transportAvailable?: boolean; // false
  transportNotes?: string;
  blockedDates?: string[];
  salesContactPhone?: string;
  escalationPhone?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  webhookEnabled?: boolean;
}

export interface RealEstateLeadQualificationDTO {
  propertyInterest?: string;
  purchasePurpose?: 'INVESTMENT' | 'SELF_USE' | 'COMMERCIAL';
  budgetMin?: number;
  budgetMax?: number;
  preferredLocation?: string;
  preferredDimensions?: string;
  purchaseTimeline?: 'IMMEDIATE' | 'WITHIN_3_MONTHS' | 'EXPLORING';
  preferredCallbackTime?: string;
  siteVisitInterest?: 'YES' | 'NO' | 'UNDECIDED';
}
