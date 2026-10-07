/**
 * VANNI Provider SDK — CRM Provider Abstraction Contract
 * Decouples business logic from specific CRM vendors (Twenty CRM, HubSpot, Salesforce, etc.)
 */

export type LeadRating = 'HOT' | 'WARM' | 'COLD' | 'UNKNOWN';
export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'LOST';
export type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface CRMLead {
  id?: string;
  organizationId: string;
  callerName: string;
  callerPhone: string;
  city?: string;
  email?: string;
  requirementSummary?: string;
  budgetOrFee?: string;
  rating: LeadRating;
  status: LeadStatus;
  sourceCallId?: string;
  audioRecordingUrl?: string;
  tags?: string[];
  metadata?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CRMLeadResult {
  success: boolean;
  leadId: string;
  externalId?: string;  // Provider-specific ID
  provider: string;
  errorMessage?: string;
}

export interface CRMTask {
  leadId: string;
  organizationId: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority: TaskPriority;
  assignedTo?: string;
}

export interface CRMNote {
  leadId: string;
  organizationId: string;
  content: string;
  isAIGenerated: boolean;
  sourceCallId?: string;
  createdAt?: string;
}

export interface CRMSearchResult {
  leads: CRMLead[];
  total: number;
}

export interface ICRMProvider {
  readonly providerName: string;

  /**
   * Create a new lead record from an inbound or outbound call interaction.
   */
  createLead(lead: CRMLead): Promise<CRMLeadResult>;

  /**
   * Update an existing lead with new qualification data.
   */
  updateLead(leadId: string, updates: Partial<CRMLead>): Promise<CRMLeadResult>;

  /**
   * Fetch a lead by its VANNI-internal ID.
   */
  getLead(leadId: string, organizationId: string): Promise<CRMLead | null>;

  /**
   * Search leads by phone number, name, or other criteria.
   */
  searchLeads(organizationId: string, query: string, limit?: number): Promise<CRMSearchResult>;

  /**
   * Create a follow-up task for a lead.
   */
  createTask(task: CRMTask): Promise<{ success: boolean; taskId: string; errorMessage?: string }>;

  /**
   * Append a note to a lead record (e.g. AI-generated call summary).
   */
  addNote(note: CRMNote): Promise<{ success: boolean; noteId: string; errorMessage?: string }>;

  /**
   * Health probe.
   */
  healthCheck(): Promise<boolean>;
}
