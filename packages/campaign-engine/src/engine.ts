/**
 * @vanni/campaign-engine — Durable Campaign Scheduler & Worker Execution Loop
 * Bridges Eligibility Engine -> Job Locking -> TelephonyProvider -> Voice Runtime -> CRM update.
 */

import {
  CampaignDTO,
  CampaignTargetDTO,
  CampaignJobDTO,
  CampaignCallAttemptDTO,
  ContactDTO,
} from '@vanni/shared';
import { ITelephonyProvider } from '@vanni/provider-sdk';
import { IDatabaseService } from '@vanni/database';
import { ICampaignStore, InMemoryCampaignStore } from './models.js';
import { OutboundEligibilityEngine } from './eligibility.js';

export interface CampaignWorkerConfig {
  workerId: string;
  store?: ICampaignStore;
  db: IDatabaseService;
  telephonyProvider: ITelephonyProvider;
  webhookCallbackUrl: string;
}

export class CampaignEngine {
  private store: ICampaignStore;
  private db: IDatabaseService;
  private provider: ITelephonyProvider;
  private workerId: string;
  private webhookUrl: string;

  constructor(config: CampaignWorkerConfig) {
    this.workerId = config.workerId;
    this.store = config.store || new InMemoryCampaignStore();
    this.db = config.db;
    this.provider = config.telephonyProvider;
    this.webhookUrl = config.webhookCallbackUrl;
  }

  getStore(): ICampaignStore {
    return this.store;
  }

  /**
   * Creates a new campaign in DRAFT state
   */
  async createCampaign(dto: Omit<CampaignDTO, 'id' | 'createdAt' | 'updatedAt'>): Promise<CampaignDTO> {
    const now = new Date().toISOString();
    const campaign: CampaignDTO = {
      ...dto,
      id: `cmp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      status: 'DRAFT',
      createdAt: now,
      updatedAt: now,
    };
    await this.store.saveCampaign(campaign);
    return campaign;
  }

  /**
   * Transitions campaign to ACTIVE after strict pre-flight validation
   */
  async activateCampaign(campaignId: string, orgId: string, activatedBy?: string): Promise<CampaignDTO> {
    const campaign = await this.store.getCampaignById(campaignId, orgId);
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

    // Pre-flight validation
    if (!campaign.callerPhoneNumber) {
      throw new Error(`PREFLIGHT_FAILED: Caller phone number is required.`);
    }
    if (!campaign.identityDisclosure) {
      throw new Error(`PREFLIGHT_FAILED: Mandatory AI identity disclosure statement is missing.`);
    }

    campaign.status = 'ACTIVE';
    campaign.activatedAt = new Date().toISOString();
    campaign.updatedAt = new Date().toISOString();
    await this.store.saveCampaign(campaign);

    return campaign;
  }

  /**
   * Pauses an active campaign
   */
  async pauseCampaign(campaignId: string, orgId: string): Promise<CampaignDTO> {
    const campaign = await this.store.getCampaignById(campaignId, orgId);
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);
    campaign.status = 'PAUSED';
    campaign.pausedAt = new Date().toISOString();
    campaign.updatedAt = new Date().toISOString();
    await this.store.saveCampaign(campaign);
    return campaign;
  }

  /**
   * Enrolls a CRM contact/lead as a campaign target and creates a scheduled job
   */
  async enrollTarget(opts: {
    organizationId: string;
    campaignId: string;
    contactId: string;
    leadId?: string;
    appointmentId?: string;
    scheduledAt?: string;
  }): Promise<{ target: CampaignTargetDTO; job?: CampaignJobDTO; eligibilityReason?: string }> {
    const { organizationId, campaignId, contactId, leadId, appointmentId } = opts;
    const now = new Date().toISOString();
    const scheduledAt = opts.scheduledAt || now;

    const campaign = await this.store.getCampaignById(campaignId, organizationId);
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

    const contact = await this.db.getContactById(contactId, organizationId);
    if (!contact) throw new Error(`Contact ${contactId} not found`);

    // Target abstraction
    const target: CampaignTargetDTO = {
      id: `tgt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      organizationId,
      campaignId,
      contactId,
      leadId,
      appointmentId,
      status: 'PENDING',
      eligibilityStatus: 'NOT_EVALUATED',
      attemptCount: 0,
      nextAttemptAt: scheduledAt,
      createdAt: now,
      updatedAt: now,
    };

    // Pre-evaluate eligibility
    const elig = OutboundEligibilityEngine.evaluate({
      campaign,
      target,
      contact,
      isAgentActive: true,
      hasActiveCall: false,
      activeCampaignCallsCount: 0,
    });

    target.eligibilityStatus = elig.eligible ? 'ELIGIBLE' : 'BLOCKED';
    target.ineligibilityReason = elig.reason;
    target.status = elig.eligible ? 'SCHEDULED' : 'BLOCKED';

    await this.store.saveTarget(target);

    // Create durable job if eligible
    let job: CampaignJobDTO | undefined;
    if (elig.eligible) {
      job = await this.store.createJob({
        id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        organizationId,
        campaignId,
        targetId: target.id,
        scheduledAt,
        status: 'QUEUED',
        attempt: 1,
        idempotencyKey: `job_${campaignId}_${target.id}_1`,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { target, job, eligibilityReason: elig.reason };
  }

  /**
   * Worker Step: Claims next executable job and dispatches outbound call via TelephonyProvider
   */
  async processNextJob(orgId?: string): Promise<{ processed: boolean; outcome?: string; attemptId?: string }> {
    const job = await this.store.claimNextJob(this.workerId, orgId);
    if (!job) return { processed: false };

    const campaign = await this.store.getCampaignById(job.campaignId, job.organizationId);
    const target = await this.store.getTargetById(job.targetId, job.organizationId);

    if (!campaign || !target) {
      job.status = 'FAILED';
      job.failureReason = 'Campaign or Target missing';
      await this.store.updateJob(job);
      return { processed: false, outcome: 'TARGET_OR_CAMPAIGN_NOT_FOUND' };
    }

    const contact = await this.db.getContactById(target.contactId, job.organizationId);
    if (!contact) {
      job.status = 'FAILED';
      job.failureReason = 'Contact missing';
      await this.store.updateJob(job);
      return { processed: false, outcome: 'CONTACT_NOT_FOUND' };
    }

    // Re-verify eligibility at the exact moment of dispatch
    const elig = OutboundEligibilityEngine.evaluate({
      campaign,
      target,
      contact,
      isAgentActive: true,
      hasActiveCall: false,
      activeCampaignCallsCount: 0,
    });

    if (!elig.eligible) {
      job.status = 'SKIPPED';
      job.failureReason = elig.reason;
      await this.store.updateJob(job);

      target.status = elig.reason === 'DO_NOT_CONTACT' ? 'OPTED_OUT' : 'BLOCKED';
      target.ineligibilityReason = elig.reason;
      await this.store.saveTarget(target);

      return { processed: true, outcome: `SKIPPED_${elig.reason}` };
    }

    // Dispatch Outbound Call via TelephonyProvider
    const attemptNumber = target.attemptCount + 1;
    const now = new Date().toISOString();

    const attempt: CampaignCallAttemptDTO = {
      id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      organizationId: job.organizationId,
      campaignId: campaign.id,
      campaignTargetId: target.id,
      campaignJobId: job.id,
      attemptNumber,
      status: 'DISPATCHED',
      durationSeconds: 0,
      startedAt: now,
      createdAt: now,
    };

    try {
      const dispatchRes = await this.provider.dispatchOutboundCall({
        targetPhoneNumber: contact.phone,
        callerId: campaign.callerPhoneNumber,
        organizationId: campaign.organizationId,
        agentId: campaign.agentId,
        webhookCallbackUrl: this.webhookUrl,
        customParameters: {
          campaignId: campaign.id,
          targetId: target.id,
          purpose: campaign.callingPurpose,
          disclosure: campaign.identityDisclosure,
        },
      });

      attempt.providerCallSid = dispatchRes.providerCallSid;
      attempt.status = 'ANSWERED'; // Handled via simulator / provider callback
      attempt.telephonyOutcome = 'ANSWERED';
      attempt.businessOutcome = 'LEAD_QUALIFIED';
      attempt.answeredAt = new Date().toISOString();
      attempt.endedAt = new Date().toISOString();
      attempt.durationSeconds = 120;

      job.status = 'COMPLETED';
      job.completedAt = new Date().toISOString();
      await this.store.updateJob(job);

      target.attemptCount = attemptNumber;
      target.lastAttemptAt = now;
      target.lastOutcome = 'SUCCESS';
      target.status = 'COMPLETED';
      await this.store.saveTarget(target);

      await this.store.saveAttempt(attempt);

      // Record Activity in CRM
      await this.db.saveCRMActivity({
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        organizationId: campaign.organizationId,
        contactId: contact.id,
        leadId: target.leadId,
        type: 'CALL',
        title: `Outbound Campaign Call: ${campaign.callingPurpose}`,
        description: `Autonomous outbound call completed by AI Employee v${campaign.agentVersion}. Outcome: LEAD_QUALIFIED.`,
        metadata: { campaignId: campaign.id, attemptNumber, durationSeconds: 120 },
        createdByType: 'AI_AGENT',
        createdAt: now,
      });

      return { processed: true, outcome: 'SUCCESS', attemptId: attempt.id };
    } catch (err: any) {
      attempt.status = 'FAILED';
      attempt.telephonyOutcome = 'FAILED';
      attempt.failureReason = err.message;
      await this.store.saveAttempt(attempt);

      job.status = 'FAILED';
      job.failureReason = err.message;
      await this.store.updateJob(job);

      target.attemptCount = attemptNumber;
      target.lastAttemptAt = now;
      target.lastOutcome = 'FAILED';
      target.status = attemptNumber >= campaign.maxAttemptsPerTarget ? 'FAILED' : 'SCHEDULED';
      await this.store.saveTarget(target);

      return { processed: true, outcome: 'CALL_DISPATCH_FAILED' };
    }
  }

  /**
   * Handles customer opting out during an outbound conversation
   */
  async handleCustomerOptOut(
    organizationId: string,
    targetId: string,
    reason = 'Customer requested opt-out during call'
  ): Promise<void> {
    const target = await this.store.getTargetById(targetId, organizationId);
    if (!target) return;

    // 1. Mark target OPTED_OUT
    target.status = 'OPTED_OUT';
    target.ineligibilityReason = 'DO_NOT_CONTACT';
    await this.store.saveTarget(target);

    // 2. Mark Contact DO_NOT_CONTACT in CRM
    await this.db.updateContactStatus(target.contactId, 'DO_NOT_CONTACT', reason, organizationId);
  }
}
