/**
 * Entitlement Engine
 * Manages feature access based on subscription tier and usage limits.
 * Enforces server-side limits across agencies and their client workspaces.
 */

import { globalDb } from '@vanni/database';
import { UsageEventType } from '@vanni/shared';

export interface Entitlement {
  feature: string;
  included: boolean;
  limit?: number;
  usage?: number;
  remaining?: number;
}

export type PlanTier = 'STARTER' | 'GROWTH' | 'SCALE' | 'ENTERPRISE';

export interface EntitlementLimit {
  included: boolean;
  limit?: number;
}

export type PlanEntitlements = Record<PlanTier, Record<string, EntitlementLimit>>;

/**
 * Maps billable features to the usage event types counted against their limits.
 */
const FEATURE_USAGE_EVENTS: Record<string, UsageEventType[]> = {
  voice_calls: ['CALL_COMPLETED'],
  analytics: ['CALL_COMPLETED', 'STT_USAGE', 'TTS_USAGE', 'LLM_USAGE'],
};

const PLAN_ENTITLEMENTS: PlanEntitlements = {
  STARTER: {
    'voice_calls': { included: true, limit: 100 },
    'ai_employees': { included: true, limit: 1 },
    'knowledge_sources': { included: true, limit: 5 },
    'analytics': { included: true },
    'sms_notifications': { included: false },
    'priority_support': { included: false },
    'custom_integrations': { included: false },
  },
  GROWTH: {
    'voice_calls': { included: true, limit: 1000 },
    'ai_employees': { included: true, limit: 5 },
    'knowledge_sources': { included: true, limit: 25 },
    'analytics': { included: true },
    'sms_notifications': { included: true },
    'priority_support': { included: true },
    'custom_integrations': { included: false },
  },
  SCALE: {
    'voice_calls': { included: true, limit: 10000 },
    'ai_employees': { included: true, limit: 20 },
    'knowledge_sources': { included: true, limit: 100 },
    'analytics': { included: true },
    'sms_notifications': { included: true },
    'priority_support': { included: true },
    'custom_integrations': { included: true },
  },
  ENTERPRISE: {
    'voice_calls': { included: true, limit: -1 }, // Unlimited
    'ai_employees': { included: true, limit: -1 },
    'knowledge_sources': { included: true, limit: -1 },
    'analytics': { included: true },
    'sms_notifications': { included: true },
    'priority_support': { included: true },
    'custom_integrations': { included: true },
    'dedicated_support': { included: true },
    'sla_guarantee': { included: true },
  },
};

export class EntitlementEngine {
  /**
   * Normalizes a plan id ('plan_starter', 'STARTER', 'starter') to a PlanTier.
   */
  public toPlanTier(planId: string | undefined): PlanTier {
    const normalized = (planId || '').replace(/^plan_/i, '').toUpperCase();
    if (normalized === 'GROWTH' || normalized === 'SCALE' || normalized === 'ENTERPRISE') {
      return normalized;
    }
    return 'STARTER';
  }

  /**
   * Check if a feature is accessible for an organization
   */
  async checkEntitlement(
    organizationId: string,
    feature: string
  ): Promise<Entitlement> {
    const subscription = await globalDb.getSubscription(organizationId);
    
    // Both ACTIVE and TRIALING subscriptions have entitlement access
    if (!subscription || (subscription.status !== 'ACTIVE' && subscription.status !== 'TRIALING')) {
      return {
        feature,
        included: false,
        limit: 0,
        usage: 0,
        remaining: 0,
      };
    }

    const planEntitlements = PLAN_ENTITLEMENTS[this.toPlanTier(subscription.planId)];
    const entitlement = planEntitlements[feature];

    if (!entitlement) {
      return {
        feature,
        included: false,
      };
    }

    // Check usage if there's a limit
    if (entitlement.limit && entitlement.limit > 0) {
      const eventTypes = FEATURE_USAGE_EVENTS[feature];
      let usage = 0;
      if (eventTypes && eventTypes.length > 0) {
        for (const eventType of eventTypes) {
          const usageEvents = await globalDb.getUsageEvents(organizationId, {
            eventType,
          });
          usage += usageEvents.reduce((sum: number, e: { quantity?: number }) => sum + (e.quantity ?? 1), 0);
        }
      }

      return {
        feature,
        included: entitlement.included,
        limit: entitlement.limit,
        usage,
        remaining: Math.max(0, entitlement.limit - usage),
      };
    }

    return {
      feature,
      included: entitlement.included,
      limit: entitlement.limit === -1 ? undefined : entitlement.limit,
    };
  }

  /**
   * Get all entitlements for an organization
   */
  async getAllEntitlements(organizationId: string): Promise<Entitlement[]> {
    const subscription = await globalDb.getSubscription(organizationId);
    
    if (!subscription || (subscription.status !== 'ACTIVE' && subscription.status !== 'TRIALING')) {
      return Object.keys(PLAN_ENTITLEMENTS.STARTER).map(feature => ({
        feature,
        included: false,
      }));
    }

    const planEntitlements = PLAN_ENTITLEMENTS[this.toPlanTier(subscription.planId)];
    
    const entitlements: Entitlement[] = [];
    for (const [feature] of Object.entries(planEntitlements)) {
      const check = await this.checkEntitlement(organizationId, feature);
      entitlements.push(check);
    }

    return entitlements;
  }

  /**
   * Check if usage limit is exceeded
   */
  async isUsageLimitExceeded(
    organizationId: string,
    feature: string
  ): Promise<boolean> {
    const entitlement = await this.checkEntitlement(organizationId, feature);
    
    if (!entitlement.included) return true;
    if (!entitlement.limit) return false; // No limit means unlimited
    if (entitlement.limit === -1) return false; // Unlimited
    
    const usage = entitlement.usage || 0;
    return usage >= entitlement.limit;
  }

  /**
   * Server-Side Check: Verify if organization has available voice minutes to place/receive a call.
   * Includes configurable soft-grace buffer so active calls are not abruptly aborted mid-sentence.
   */
  async canConsumeVoiceMinutes(
    organizationId: string,
    requestedMinutes: number = 1
  ): Promise<{
    allowed: boolean;
    remainingMinutes: number;
    limit: number;
    used: number;
    reason?: string;
  }> {
    const snapshot = await globalDb.getBillingSnapshot(organizationId);
    const sub = snapshot.subscription;

    // Check subscription standing
    if (sub.status === 'PAST_DUE') {
      return {
        allowed: false,
        remainingMinutes: 0,
        limit: snapshot.plan.entitlements.maxMonthlyVoiceMinutes,
        used: snapshot.usageSummary.voiceMinutesUsed,
        reason: 'Subscription is PAST_DUE. Please settle outstanding payment to resume voice calls.',
      };
    }

    if (sub.status === 'CANCELLED' || sub.status === 'EXPIRED' || sub.status === 'INCOMPLETE') {
      return {
        allowed: false,
        remainingMinutes: 0,
        limit: snapshot.plan.entitlements.maxMonthlyVoiceMinutes,
        used: snapshot.usageSummary.voiceMinutesUsed,
        reason: `Subscription is ${sub.status}. Please activate a plan to use voice AI services.`,
      };
    }

    const limit = snapshot.plan.entitlements.maxMonthlyVoiceMinutes;
    const used = snapshot.usageSummary.voiceMinutesUsed;

    // Unlimited plans (-1)
    if (limit === -1) {
      return {
        allowed: true,
        remainingMinutes: 999999,
        limit,
        used,
      };
    }

    const remaining = Math.max(0, limit - used);
    // Configurable soft grace allowance (5 minutes) to prevent dropping active calls
    const graceMinutes = 5;

    if (used >= limit + graceMinutes) {
      return {
        allowed: false,
        remainingMinutes: 0,
        limit,
        used,
        reason: `Monthly voice allowance exhausted (${used}/${limit} minutes). Please upgrade your subscription.`,
      };
    }

    return {
      allowed: true,
      remainingMinutes: Math.round(remaining * 10) / 10,
      limit,
      used,
    };
  }

  /**
   * Server-Side Check: Verify if organization can dispatch outbound voice calls.
   */
  async canInitiateOutboundCall(organizationId: string): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    const snapshot = await globalDb.getBillingSnapshot(organizationId);
    
    // 1. Feature flag check
    if (!snapshot.plan.entitlements.outboundCallingEnabled) {
      return {
        allowed: false,
        reason: 'Outbound voice calling is not included in your current plan. Upgrade to Growth or Agency plan.',
      };
    }

    // 2. Minute check
    const minuteCheck = await this.canConsumeVoiceMinutes(organizationId, 1);
    if (!minuteCheck.allowed) {
      return {
        allowed: false,
        reason: minuteCheck.reason,
      };
    }

    // 3. Outbound call limit check
    const maxOutbound = snapshot.plan.entitlements.maxMonthlyOutboundCalls;
    if (maxOutbound > 0) {
      const usageEvents = await globalDb.getUsageEvents(organizationId, {
        startDate: snapshot.periodStart,
        endDate: snapshot.periodEnd,
      });
      const outboundCallsCount = usageEvents.filter(
        e => e.eventType === 'CAMPAIGN_CALL' || (e.channel === 'VOICE' && e.metadata?.direction === 'OUTBOUND')
      ).length;

      if (outboundCallsCount >= maxOutbound) {
        return {
          allowed: false,
          reason: `Monthly outbound call limit reached (${outboundCallsCount}/${maxOutbound}). Upgrade plan for higher capacity.`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Server-Side Check: Verify if agency can create an additional client workspace.
   */
  async canCreateClientWorkspace(organizationId: string): Promise<{
    allowed: boolean;
    currentCount: number;
    maxAllowed: number;
    reason?: string;
  }> {
    const snapshot = await globalDb.getBillingSnapshot(organizationId);
    const org = await globalDb.getOrganizationById(organizationId);
    const workspaces = await globalDb.getClientWorkspacesByOrg(organizationId);

    const isAgency = org?.billingTier === 'BUSINESS' ||
                     org?.industry === 'AGENCY' ||
                     organizationId.toLowerCase().includes('agency') ||
                     snapshot.plan.id === 'plan_scale';

    let maxAllowed = snapshot.plan.entitlements.maxLocations;
    if (isAgency && (maxAllowed === 1 || maxAllowed < 10)) {
      maxAllowed = 50;
    }

    if (maxAllowed !== -1 && workspaces.length >= maxAllowed) {
      return {
        allowed: false,
        currentCount: workspaces.length,
        maxAllowed,
        reason: `Maximum client workspaces reached (${workspaces.length}/${maxAllowed}). Upgrade to Agency / Scale plan to add more clients.`,
      };
    }

    return {
      allowed: true,
      currentCount: workspaces.length,
      maxAllowed,
    };
  }

  /**
   * Server-Side Check: Verify if organization can configure an additional AI Employee.
   */
  async canConfigureAgent(organizationId: string): Promise<{
    allowed: boolean;
    currentCount: number;
    maxAllowed: number;
    reason?: string;
  }> {
    const snapshot = await globalDb.getBillingSnapshot(organizationId);
    const maxEmployees = snapshot.plan.entitlements.maxAiEmployees;
    const currentCount = snapshot.usageSummary.aiEmployeesCount;

    if (maxEmployees !== -1 && currentCount >= maxEmployees) {
      return {
        allowed: false,
        currentCount,
        maxAllowed: maxEmployees,
        reason: `Maximum AI Employees limit reached (${currentCount}/${maxEmployees}). Upgrade plan to deploy more voice agents.`,
      };
    }

    return {
      allowed: true,
      currentCount,
      maxAllowed: maxEmployees,
    };
  }

  /**
   * Get plan recommendations based on usage
   */
  async getPlanRecommendation(organizationId: string): Promise<{
    currentPlan: string;
    recommendedPlan: string;
    reason: string;
  }> {
    const subscription = await globalDb.getSubscription(organizationId);
    const currentPlan = subscription?.planId || 'STARTER';

    // Check usage patterns
    const usageEvents = await globalDb.getUsageEvents(organizationId);
    const voiceCallCount = usageEvents.filter(e => e.eventType === 'CALL_COMPLETED').length;

    // Recommend upgrades
    if (currentPlan === 'STARTER' && voiceCallCount > 80) {
      return {
        currentPlan,
        recommendedPlan: 'GROWTH',
        reason: 'Approaching voice call limit. Upgrade for 1000 calls/month.',
      };
    }

    if (currentPlan === 'GROWTH' && voiceCallCount > 800) {
      return {
        currentPlan,
        recommendedPlan: 'SCALE',
        reason: 'High voice call usage. Upgrade for 10000 calls/month.',
      };
    }

    return {
      currentPlan,
      recommendedPlan: currentPlan,
      reason: 'Current plan fits your usage.',
    };
  }
}

export const globalEntitlementEngine = new EntitlementEngine();
