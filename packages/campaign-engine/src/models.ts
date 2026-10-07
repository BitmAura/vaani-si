/**
 * @vanni/campaign-engine — Domain Models & Memory Stores
 */

import {
  CampaignDTO,
  CampaignTargetDTO,
  CampaignJobDTO,
  CampaignCallAttemptDTO,
  IneligibilityReason,
  CampaignAnalyticsDTO,
} from '@vanni/shared';

export interface OutboundEligibilityResult {
  eligible: boolean;
  reason?: IneligibilityReason;
  checks: {
    checkName: string;
    passed: boolean;
    details?: string;
  }[];
}

export interface ICampaignStore {
  // Campaigns
  getCampaignById(id: string, orgId?: string): Promise<CampaignDTO | null>;
  listCampaigns(orgId: string): Promise<CampaignDTO[]>;
  saveCampaign(campaign: CampaignDTO): Promise<void>;

  // Targets
  getTargetById(id: string, orgId?: string): Promise<CampaignTargetDTO | null>;
  listTargets(campaignId: string, orgId?: string): Promise<CampaignTargetDTO[]>;
  saveTarget(target: CampaignTargetDTO): Promise<void>;

  // Durable Jobs
  createJob(job: CampaignJobDTO): Promise<CampaignJobDTO>;
  claimNextJob(workerId: string, orgId?: string): Promise<CampaignJobDTO | null>;
  updateJob(job: CampaignJobDTO): Promise<void>;
  getActiveJobForTarget(targetId: string): Promise<CampaignJobDTO | null>;

  // Attempts
  saveAttempt(attempt: CampaignCallAttemptDTO): Promise<void>;
  listAttempts(targetId: string): Promise<CampaignCallAttemptDTO[]>;

  // Analytics
  getCampaignAnalytics(campaignId: string, orgId: string): Promise<CampaignAnalyticsDTO>;
}

export class InMemoryCampaignStore implements ICampaignStore {
  private campaigns = new Map<string, CampaignDTO>();
  private targets = new Map<string, CampaignTargetDTO>();
  private jobs = new Map<string, CampaignJobDTO>();
  private attempts = new Map<string, CampaignCallAttemptDTO>();

  async getCampaignById(id: string, orgId?: string): Promise<CampaignDTO | null> {
    const c = this.campaigns.get(id);
    if (!c) return null;
    if (orgId && c.organizationId !== orgId) return null;
    return { ...c };
  }

  async listCampaigns(orgId: string): Promise<CampaignDTO[]> {
    return Array.from(this.campaigns.values())
      .filter(c => c.organizationId === orgId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async saveCampaign(campaign: CampaignDTO): Promise<void> {
    this.campaigns.set(campaign.id, { ...campaign });
  }

  async getTargetById(id: string, orgId?: string): Promise<CampaignTargetDTO | null> {
    const t = this.targets.get(id);
    if (!t) return null;
    if (orgId && t.organizationId !== orgId) return null;
    return { ...t };
  }

  async listTargets(campaignId: string, orgId?: string): Promise<CampaignTargetDTO[]> {
    return Array.from(this.targets.values()).filter(t => {
      if (t.campaignId !== campaignId) return false;
      if (orgId && t.organizationId !== orgId) return false;
      return true;
    });
  }

  async saveTarget(target: CampaignTargetDTO): Promise<void> {
    this.targets.set(target.id, { ...target });
  }

  async createJob(job: CampaignJobDTO): Promise<CampaignJobDTO> {
    this.jobs.set(job.id, { ...job });
    return { ...job };
  }

  /**
   * Atomic Job Claiming to prevent two workers from calling the same target
   */
  async claimNextJob(workerId: string, orgId?: string): Promise<CampaignJobDTO | null> {
    const now = new Date().toISOString();
    for (const job of this.jobs.values()) {
      if (orgId && job.organizationId !== orgId) continue;
      if (job.status === 'QUEUED' && job.scheduledAt <= now) {
        // Lease job
        job.status = 'LOCKED';
        job.lockedAt = now;
        job.lockedBy = workerId;
        job.updatedAt = now;
        this.jobs.set(job.id, job);
        return { ...job };
      }
    }
    return null;
  }

  async updateJob(job: CampaignJobDTO): Promise<void> {
    this.jobs.set(job.id, { ...job });
  }

  async getActiveJobForTarget(targetId: string): Promise<CampaignJobDTO | null> {
    for (const job of this.jobs.values()) {
      if (job.targetId === targetId && (job.status === 'QUEUED' || job.status === 'LOCKED' || job.status === 'IN_PROGRESS')) {
        return { ...job };
      }
    }
    return null;
  }

  async saveAttempt(attempt: CampaignCallAttemptDTO): Promise<void> {
    this.attempts.set(attempt.id, { ...attempt });
  }

  async listAttempts(targetId: string): Promise<CampaignCallAttemptDTO[]> {
    return Array.from(this.attempts.values())
      .filter(a => a.campaignTargetId === targetId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async getCampaignAnalytics(campaignId: string, orgId: string): Promise<CampaignAnalyticsDTO> {
    const targets = Array.from(this.targets.values()).filter(t => t.campaignId === campaignId && t.organizationId === orgId);
    const attempts = Array.from(this.attempts.values()).filter(a => a.campaignId === campaignId && a.organizationId === orgId);

    const eligible = targets.filter(t => t.eligibilityStatus === 'ELIGIBLE').length;
    const blocked = targets.filter(t => t.eligibilityStatus === 'BLOCKED').length;
    const answered = attempts.filter(a => a.telephonyOutcome === 'ANSWERED').length;
    const optOuts = targets.filter(t => t.status === 'OPTED_OUT').length;
    const completed = targets.filter(t => t.status === 'COMPLETED').length;
    const failed = targets.filter(t => t.status === 'FAILED').length;

    let totalDuration = 0;
    for (const a of attempts) {
      totalDuration += a.durationSeconds || 0;
    }
    const avgDuration = attempts.length > 0 ? Math.round(totalDuration / attempts.length) : 0;
    const answerRate = attempts.length > 0 ? Math.round((answered / attempts.length) * 100) : 0;

    return {
      totalTargets: targets.length,
      eligibleTargets: eligible,
      blockedTargets: blocked,
      callsAttempted: attempts.length,
      callsAnswered: answered,
      answerRatePercentage: answerRate,
      completedOutcomes: completed,
      optOutCount: optOuts,
      failedCount: failed,
      avgDurationSeconds: avgDuration,
    };
  }
}
