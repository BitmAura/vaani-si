/**
 * @vanni/observability — Central Entitlement & Plan Verification Service
 *
 * Implements deterministic limit and feature entitlement checks:
 * - Pre-flight verification before outbound campaigns or AI Employee creation
 * - Soft limits vs hard blocks (without corrupting realtime voice runtime)
 * - Real-time calculation of voice minutes used vs plan quota
 * - Over-entitlement detection on plan downgrades
 */

import {
  PlanDTO,
  SubscriptionDTO,
  PlanFeatureEntitlementsDTO,
  UsageLimitState,
  BillingSnapshotDTO,
} from '@vanni/shared';
import { IDatabaseService } from '@vanni/database';

export interface EntitlementCheckResult {
  allowed: boolean;
  limitState: UsageLimitState;
  currentUsage: number;
  maxLimit: number;
  remaining: number;
  reason?: string;
}

export class EntitlementService {
  constructor(private db: IDatabaseService) {}

  /**
   * Retrieves active plan for an organization, defaulting to Free/Trial Starter if none assigned
   */
  async getOrganizationPlan(organizationId: string): Promise<{ plan: PlanDTO; subscription: SubscriptionDTO }> {
    const snapshot = await this.db.getBillingSnapshot(organizationId);
    return { plan: snapshot.plan, subscription: snapshot.subscription };
  }

  /**
   * Checks boolean feature flag entitlement
   */
  async checkFeature(organizationId: string, feature: keyof PlanFeatureEntitlementsDTO): Promise<boolean> {
    const { plan, subscription } = await this.getOrganizationPlan(organizationId);

    // If subscription is expired or cancelled past end date, restrict premium features
    if (subscription.status === 'EXPIRED' || subscription.status === 'CANCELLED') {
      return false;
    }

    const val = plan.entitlements[feature];
    return typeof val === 'boolean' ? val : false;
  }

  /**
   * Checks numeric quota entitlement before starting an operation
   */
  async checkLimit(
    organizationId: string,
    limitKey: keyof PlanFeatureEntitlementsDTO,
    requestedAmount: number = 1
  ): Promise<EntitlementCheckResult> {
    const snapshot = await this.db.getBillingSnapshot(organizationId);
    const plan = snapshot.plan;
    const maxLimit = (plan.entitlements[limitKey] as number) ?? 0;

    // -1 denotes UNLIMITED
    if (maxLimit === -1) {
      return {
        allowed: true,
        limitState: 'AVAILABLE',
        currentUsage: 0,
        maxLimit: -1,
        remaining: Infinity,
      };
    }

    let currentUsage = 0;
    if (limitKey === 'maxMonthlyVoiceMinutes') {
      currentUsage = snapshot.usageSummary.voiceMinutesUsed;
    } else if (limitKey === 'maxAiEmployees') {
      currentUsage = snapshot.usageSummary.aiEmployeesCount;
    } else if (limitKey === 'maxLocations') {
      currentUsage = snapshot.usageSummary.locationsCount;
    } else if (limitKey === 'maxContacts') {
      currentUsage = snapshot.usageSummary.contactsCount;
    } else if (limitKey === 'maxAppointments') {
      currentUsage = snapshot.usageSummary.appointmentsCount;
    } else if (limitKey === 'maxCampaignTargets') {
      currentUsage = snapshot.usageSummary.campaignCallsUsed;
    }

    const projected = currentUsage + requestedAmount;
    const remaining = Math.max(0, maxLimit - currentUsage);

    if (projected > maxLimit) {
      // Check if plan allows overage (e.g. voice minutes overage price)
      if (limitKey === 'maxMonthlyVoiceMinutes' && plan.overageVoiceMinutePrice && plan.overageVoiceMinutePrice > 0) {
        return {
          allowed: true, // Allow with overage billing
          limitState: 'OVERAGE',
          currentUsage,
          maxLimit,
          remaining: 0,
          reason: `Quota reached. Additional minutes will be charged at ₹${plan.overageVoiceMinutePrice}/min`,
        };
      }

      return {
        allowed: false,
        limitState: 'LIMIT_REACHED',
        currentUsage,
        maxLimit,
        remaining: 0,
        reason: `Organization has reached its plan limit of ${maxLimit} for ${String(limitKey)}`,
      };
    }

    const usagePercent = (projected / maxLimit) * 100;
    const limitState: UsageLimitState = usagePercent >= 90 ? 'NEAR_LIMIT' : 'AVAILABLE';

    return {
      allowed: true,
      limitState,
      currentUsage,
      maxLimit,
      remaining,
    };
  }

  /**
   * Pre-flight check for realtime voice sessions:
   * Non-blocking verification before answering or initiating call
   */
  async preflightVoiceCall(
    organizationId: string,
    requestedMinutes: number = 1
  ): Promise<{ allowed: boolean; limitState: UsageLimitState; reason?: string; remaining?: number }> {
    const featureAllowed = await this.checkFeature(organizationId, 'voiceEnabled');
    if (!featureAllowed) {
      return { allowed: false, limitState: 'BLOCKED', reason: 'Voice calling is disabled on current subscription tier.' };
    }

    const limitCheck = await this.checkLimit(organizationId, 'maxMonthlyVoiceMinutes', requestedMinutes);
    return {
      allowed: limitCheck.allowed,
      limitState: limitCheck.limitState,
      remaining: limitCheck.remaining,
      reason: limitCheck.reason,
    };
  }

  /**
   * Pre-flight check for outbound campaigns
   */
  async preflightCampaign(organizationId: string, targetCount: number): Promise<{ allowed: boolean; reason?: string }> {
    const featureAllowed = await this.checkFeature(organizationId, 'campaignsEnabled');
    if (!featureAllowed) {
      return { allowed: false, reason: 'Outbound campaigns are disabled on current subscription plan.' };
    }

    const limitCheck = await this.checkLimit(organizationId, 'maxCampaignTargets', targetCount);
    if (!limitCheck.allowed) {
      return { allowed: false, reason: limitCheck.reason };
    }

    return { allowed: true };
  }
}
