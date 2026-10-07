/**
 * Layer 1: Domain Entities & Mathematical Invariants
 * Vaani SI — Sovereign Voice OS
 */

export type IndustryType =
  | 'REAL_ESTATE'
  | 'HEALTHCARE_HOSPITAL'
  | 'AUTOMOTIVE_DEALER'
  | 'EDUCATION_COLLEGE'
  | 'BANKING_NBFC'
  | 'HOSPITALITY_CAFE'
  | 'ECOMMERCE_D2C';

export type RegionalDialect =
  | 'KANNADA_STANDARD_POLITE' // Universal clean conversational Karnataka
  | 'KANNADA_NORTH'           // Hubli, Dharwad, Belgaum, Raichur, Ballari
  | 'KANNADA_COASTAL'         // Mangalore, Udupi
  | 'TELUGU_STANDARD'         // Andhra & Telangana border
  | 'KANGLISH_BUSINESS';      // Mixed Kannada + English loanwords

export type CallDirection = 'INBOUND' | 'OUTBOUND';

export type CallStatus =
  | 'QUEUED'
  | 'RINGING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'BUSY'
  | 'NO_ANSWER';

export type LeadQualityRating = 'HOT' | 'WARM' | 'COLD' | 'DISQUALIFIED';

export interface TenantKnowledge {
  companyName: string;
  industry: IndustryType;
  primaryDialect: RegionalDialect;
  officeTimings: string;
  emergencyContact?: string;
  catalogSummary: string; // Key items, e.g. "30x40 plots at 18L, 40x60 plots at 35L"
  faqs: Array<{ question: string; answer: string }>;
  appointmentRules?: {
    slotDurationMinutes: number;
    availableDays: string[];
    freeCabOffered?: boolean;
  };
}

export interface Tenant {
  id: string;
  name: string;
  industry: IndustryType;
  virtualPhoneNumber: string;
  ownerWhatsAppNumber: string;
  dialect: RegionalDialect;
  knowledge: TenantKnowledge;
  webhookUrl?: string;
  monthlyMinuteLimit: number;
  minutesUsedCurrentMonth: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationTurn {
  id: string;
  speaker: 'USER' | 'AGENT';
  text: string;
  timestampMs: number;
  latencyMs?: number; // Time from user silence to first synthesized audio byte
  interrupted?: boolean;
}

export interface CallSession {
  id: string;
  tenantId: string;
  direction: CallDirection;
  callerNumber: string;
  status: CallStatus;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  audioRecordingUrl?: string;
  turns: ConversationTurn[];
  summary?: string;
  leadRating?: LeadQualityRating;
  intentDetected?: string;
  scheduledVisitTime?: string;
  error?: string;
}

export interface LeadDossier {
  id: string;
  tenantId: string;
  callSessionId: string;
  customerName: string;
  customerPhone: string;
  rating: LeadQualityRating;
  requirementSummary: string;
  budget?: string;
  preferredTiming?: string;
  whatsappDispatched: boolean;
  whatsappMessageId?: string;
  createdAt: string;
}
