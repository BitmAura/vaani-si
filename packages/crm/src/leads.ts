/**
 * @vanni/crm — Lead Lifecycle, Assignment & Activity Timeline Engine
 */

import {
  CRMLeadDTO,
  CRMLeadStatus,
  CRMLeadStage,
  CRMActivityDTO,
  IndustryType,
  ContactSource,
} from '@vanni/shared';
import { IDatabaseService } from '@vanni/database';
import { ArgumentNormalizer } from '@vanni/tool-engine';
import { LeadQualificationEngine, QualificationInput } from './qualification.js';

export interface CreateLeadParams {
  organizationId: string;
  contactId: string;
  interest: string;
  source?: ContactSource;
  sourceReference?: string;
  campaignId?: string;
  conversationId?: string;
  industry?: IndustryType | 'GENERIC';
  budget?: string;
  location?: string;
  timeline?: string;
  notes?: string;
  appointmentOrVisitRequested?: boolean;
  assignedTo?: string;
  assignedTeam?: string;
  idempotencyKey?: string;
}

export class LeadService {
  constructor(private db: IDatabaseService) {}

  /**
   * Creates or updates a lead, preventing duplicate lead spam from the same active conversation
   */
  async createLead(params: CreateLeadParams): Promise<{ lead: CRMLeadDTO; isNew: boolean }> {
    const {
      organizationId,
      contactId,
      interest,
      source = 'PHONE',
      sourceReference,
      campaignId,
      conversationId,
      industry = 'GENERIC',
      budget,
      location,
      timeline,
      notes,
      appointmentOrVisitRequested,
      assignedTo,
      assignedTeam = 'SALES_TEAM',
      idempotencyKey,
    } = params;

    // Check existing leads for this contact to prevent duplicate active leads
    const contactLeads = await this.db.getCRMLeadsByContactId(contactId, organizationId);
    const activeLead = contactLeads.find((l: CRMLeadDTO) => l.status === 'NEW' || l.status === 'CONTACTED' || l.status === 'QUALIFIED');

    const contact = await this.db.getContactById(contactId, organizationId);
    const hasPhone = !!contact?.phone;
    const hasEmail = !!contact?.email;

    // Deterministic qualification evaluation
    const qual = LeadQualificationEngine.evaluate(industry, {
      requirement: interest,
      location,
      budget,
      timeline,
      appointmentOrVisitRequested,
      contactablePhone: hasPhone,
      emailProvided: hasEmail,
    });

    const now = new Date().toISOString();

    if (activeLead) {
      // Update existing lead with newly captured data
      activeLead.interest = interest;
      if (budget) activeLead.budget = ArgumentNormalizer.normalizeCurrency(budget);
      if (location) activeLead.location = location;
      if (timeline) activeLead.timeline = timeline;
      if (notes) activeLead.notes = `${activeLead.notes ? activeLead.notes + ' | ' : ''}${notes}`;
      activeLead.qualificationStatus = qual.status;
      activeLead.qualificationScore = Math.max(activeLead.qualificationScore, qual.score);
      activeLead.qualificationData = { ...activeLead.qualificationData, ...qual.structuredData };
      activeLead.lastContactedAt = now;
      activeLead.updatedAt = now;

      await this.db.saveCRMLead(activeLead);

      // Record Activity
      await this.db.saveCRMActivity({
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        organizationId,
        contactId,
        leadId: activeLead.id,
        conversationId,
        type: 'LEAD_UPDATED',
        title: 'Lead Requirements Updated',
        description: `Updated interest: ${interest}. Qualification score: ${activeLead.qualificationScore}`,
        metadata: { score: activeLead.qualificationScore, qualBreakdown: qual.breakdown },
        createdByType: 'AI_AGENT',
        createdAt: now,
      });

      return { lead: activeLead, isNew: false };
    }

    // Create New Lead
    const newLead: CRMLeadDTO = {
      id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      organizationId,
      contactId,
      source,
      sourceReference,
      campaignId,
      conversationId,
      status: qual.status === 'QUALIFIED' ? 'QUALIFIED' : 'NEW',
      stage: appointmentOrVisitRequested ? 'APPOINTMENT' : (qual.score >= 30 ? 'QUALIFICATION' : 'NEW'),
      interest,
      industryContext: industry,
      location,
      budget: budget ? ArgumentNormalizer.normalizeCurrency(budget) : undefined,
      timeline,
      qualificationStatus: qual.status,
      qualificationScore: qual.score,
      qualificationData: qual.structuredData,
      assignedTo,
      assignedTeam,
      notes,
      lastContactedAt: now,
      idempotencyKey,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.saveCRMLead(newLead);

    // Record creation activity
    await this.db.saveCRMActivity({
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      organizationId,
      contactId,
      leadId: newLead.id,
      conversationId,
      type: 'LEAD_CREATED',
      title: 'New Lead Captured',
      description: `Requirement: ${interest} (Score: ${qual.score}/100)`,
      metadata: { source, score: qual.score, qualBreakdown: qual.breakdown },
      createdByType: 'AI_AGENT',
      createdAt: now,
    });

    return { lead: newLead, isNew: true };
  }

  /**
   * Advances or updates the pipeline stage of a lead
   */
  async updateStage(
    organizationId: string,
    leadId: string,
    stage: CRMLeadStage,
    notes?: string,
    performedBy?: string
  ): Promise<CRMLeadDTO> {
    const lead = await this.db.getCRMLeadById(leadId, organizationId);
    if (!lead) throw new Error(`Lead ${leadId} not found`);

    const prevStage = lead.stage;
    lead.stage = stage;
    lead.updatedAt = new Date().toISOString();

    if (stage === 'CONVERTED') {
      lead.status = 'CONVERTED';
      lead.convertedAt = new Date().toISOString();
    } else if (stage === 'LOST') {
      lead.status = 'LOST';
      lead.lostAt = new Date().toISOString();
      lead.lostReason = notes;
    }

    await this.db.saveCRMLead(lead);

    await this.db.saveCRMActivity({
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      organizationId,
      contactId: lead.contactId,
      leadId: lead.id,
      type: 'STAGE_CHANGED',
      title: `Lead Moved to ${stage}`,
      description: notes || `Stage advanced from ${prevStage} to ${stage}`,
      metadata: { previousStage: prevStage, newStage: stage },
      createdByType: performedBy ? 'HUMAN' : 'SYSTEM',
      createdById: performedBy,
      createdAt: new Date().toISOString(),
    });

    return lead;
  }

  /**
   * Assigns lead to a user or team
   */
  async assignLead(
    organizationId: string,
    leadId: string,
    assignedTo?: string,
    assignedTeam?: string
  ): Promise<CRMLeadDTO> {
    const lead = await this.db.getCRMLeadById(leadId, organizationId);
    if (!lead) throw new Error(`Lead ${leadId} not found`);

    lead.assignedTo = assignedTo;
    if (assignedTeam) lead.assignedTeam = assignedTeam;
    lead.updatedAt = new Date().toISOString();

    await this.db.saveCRMLead(lead);

    await this.db.saveCRMActivity({
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      organizationId,
      contactId: lead.contactId,
      leadId: lead.id,
      type: 'NOTE',
      title: 'Lead Reassigned',
      description: `Assigned to ${assignedTo || assignedTeam || 'Unassigned'}`,
      metadata: { assignedTo, assignedTeam },
      createdByType: 'HUMAN',
      createdAt: new Date().toISOString(),
    });

    return lead;
  }

  /**
   * Sets scheduled next follow-up
   */
  async scheduleFollowUp(
    organizationId: string,
    leadId: string,
    nextFollowUpAtISO: string,
    note?: string
  ): Promise<CRMLeadDTO> {
    const lead = await this.db.getCRMLeadById(leadId, organizationId);
    if (!lead) throw new Error(`Lead ${leadId} not found`);

    lead.nextFollowUpAt = nextFollowUpAtISO;
    lead.stage = 'FOLLOW_UP';
    lead.updatedAt = new Date().toISOString();

    await this.db.saveCRMLead(lead);

    await this.db.saveCRMActivity({
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      organizationId,
      contactId: lead.contactId,
      leadId: lead.id,
      type: 'FOLLOW_UP_CREATED',
      title: 'Follow-up Scheduled',
      description: note || `Scheduled for ${nextFollowUpAtISO}`,
      metadata: { nextFollowUpAt: nextFollowUpAtISO },
      createdByType: 'AI_AGENT',
      createdAt: new Date().toISOString(),
    });

    return lead;
  }

  /**
   * Fetch leads with filters & pagination
   */
  async listLeads(
    organizationId: string,
    filters?: { status?: string; stage?: string; source?: string },
    page = 1,
    pageSize = 20
  ): Promise<{ leads: CRMLeadDTO[]; total: number; page: number; pageSize: number }> {
    const all = await this.db.getCRMLeads(organizationId, filters);
    const start = (page - 1) * pageSize;
    return {
      leads: all.slice(start, start + pageSize),
      total: all.length,
      page,
      pageSize,
    };
  }

  /**
   * Get single lead by ID
   */
  async getLead(organizationId: string, leadId: string): Promise<CRMLeadDTO | null> {
    return this.db.getCRMLeadById(leadId, organizationId);
  }

  /**
   * Get complete activity timeline for a lead or contact
   */
  async getTimeline(
    organizationId: string,
    opts: { contactId?: string; leadId?: string; conversationId?: string }
  ): Promise<CRMActivityDTO[]> {
    return this.db.getCRMActivities(organizationId, opts);
  }
}
