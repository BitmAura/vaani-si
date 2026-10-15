/**
 * Digital Agency Client Management Schema
 * Dhwani SI — Layer 1 Domain Entity
 * White-label multi-client management for agencies
 */

import { z } from 'zod';

export const AgencyClientIndustry = z.enum([
  'REAL_ESTATE',
  'HEALTHCARE_HOSPITAL',
  'HEALTHCARE_DENTAL',
  'AUTOMOTIVE_DEALER',
  'EDUCATION_COLLEGE',
  'HOSPITALITY_RESORT',
  'E_COMMERCE',
  'FINTECH',
  'OTHER',
]);

export const AgencyClientStatus = z.enum(['ACTIVE', 'TRIAL', 'SUSPENDED', 'CHURNED']);

export const CRMProvider = z.enum(['HUBSPOT', 'SALESFORCE', 'ZOHO', 'FRESHSALES', 'PIPEDRIVE', 'CUSTOM']);

export const AgencyClientSchema = z.object({
  id: z.string().uuid(),
  agencyId: z.string().uuid(), // Agency tenant ID
  tenantId: z.string().uuid(), // Client's own tenant ID (sub-tenant)
  
  // Client business info
  businessName: z.string().min(1).max(200),
  industry: AgencyClientIndustry,
  website: z.string().url().optional(),
  phone: z.string().min(10).max(15),
  email: z.string().email(),
  
  // Client admin
  adminName: z.string(),
  adminEmail: z.string().email(),
  adminPhone: z.string(),
  
  // White-label branding
  branding: z.object({
    logo: z.string().url().optional(),
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#3b82f6'),
    secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#1e293b'),
    customDomain: z.string().optional(), // e.g., client.youragency.com
    brandName: z.string(), // Display name in voice agent
    senderId: z.string().max(6).optional(), // SMS sender ID
  }),
  
  // Voice agent configuration
  voiceConfig: z.object({
    greeting: z.string(), // Custom greeting message
    language: z.enum(['KANNADA', 'ENGLISH', 'KANGLISH']).default('KANGLISH'),
    voiceId: z.string().optional(), // TTS voice selection
    persona: z.string().optional(), // Agent personality
  }),
  
  // CRM integration
  crmIntegration: z.object({
    provider: CRMProvider.optional(),
    apiKey: z.string().optional(),
    apiEndpoint: z.string().url().optional(),
    syncEnabled: z.boolean().default(false),
    syncFrequency: z.enum(['REAL_TIME', 'HOURLY', 'DAILY']).default('REAL_TIME'),
    fieldMapping: z.record(z.string(), z.string()).optional(), // Map VANNI fields to CRM fields
  }),
  
  // Usage and billing
  usage: z.object({
    callsThisMonth: z.number().int().min(0).default(0),
    callsLimit: z.number().int().min(0).default(1000),
    minutesThisMonth: z.number().min(0).default(0),
    minutesLimit: z.number().min(0).default(5000),
    leadsThisMonth: z.number().int().min(0).default(0),
    overageCharges: z.number().min(0).default(0),
  }),
  
  // Subscription
  subscription: z.object({
    plan: z.enum(['STARTER', 'GROWTH', 'SCALE', 'ENTERPRISE']),
    status: AgencyClientStatus,
    startedAt: z.date(),
    currentPeriodStart: z.date(),
    currentPeriodEnd: z.date(),
    monthlyFee: z.number().positive(),
    setupFee: z.number().min(0).default(0),
    agencyMargin: z.number().min(0).max(100).default(20), // % margin for agency
  }),
  
  // Knowledge base
  knowledgeBase: z.object({
    inventoryUploaded: z.boolean().default(false),
    faqsUploaded: z.boolean().default(false),
    pricingUploaded: z.boolean().default(false),
    lastUpdated: z.date().optional(),
  }),
  
  // Team members (client users)
  teamMembers: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
    role: z.enum(['ADMIN', 'MANAGER', 'VIEWER']),
    invitedAt: z.date(),
    acceptedAt: z.date().optional(),
  })),
  
  // Stats
  stats: z.object({
    totalCalls: z.number().int().default(0),
    totalLeads: z.number().int().default(0),
    avgLeadQuality: z.number().min(0).max(100).default(0),
    conversionRate: z.number().min(0).max(100).default(0),
    responseTime: z.number().default(0), // Average response time in ms
  }),
  
  // Metadata
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
  createdBy: z.string(), // Agency admin user ID
});

export type AgencyClient = z.infer<typeof AgencyClientSchema>;
export type AgencyClientIndustryType = z.infer<typeof AgencyClientIndustry>;
export type AgencyClientStatusType = z.infer<typeof AgencyClientStatus>;
export type CRMProviderType = z.infer<typeof CRMProvider>;

/**
 * Agency Revenue Tracking
 */
export const AgencyRevenueSchema = z.object({
  id: z.string().uuid(),
  agencyId: z.string().uuid(),
  
  period: z.object({
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2024),
  }),
  
  revenue: z.object({
    totalRevenue: z.number().min(0), // Total billed to clients
    platformFees: z.number().min(0), // Fees paid to VANNI
    agencyMargin: z.number().min(0), // Agency's profit
    overageRevenue: z.number().min(0).default(0),
  }),
  
  clients: z.object({
    total: z.number().int(),
    active: z.number().int(),
    newThisMonth: z.number().int(),
    churned: z.number().int(),
  }),
  
  usage: z.object({
    totalCalls: z.number().int(),
    totalMinutes: z.number(),
    totalLeads: z.number().int(),
  }),
  
  createdAt: z.date().default(() => new Date()),
});

export type AgencyRevenue = z.infer<typeof AgencyRevenueSchema>;
