/**
 * Entitlement Engine
 * Manages feature access based on subscription tier and usage limits
 */

import { globalDb } from '@vanni/database';

export interface Entitlement {
  feature: string;
  included: boolean;
  limit?: number;
  usage?: number;
  remaining?: number;
}

export interface PlanEntitlements {
  [feature: string]: {
    included: boolean;
    limit?: number;
  };
}

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
   * Check if a feature is accessible for an organization
   */
  async checkEntitlement(
    organizationId: string,
    feature: string
  ): Promise<Entitlement> {
    const subscription = await globalDb.getSubscription(organizationId);
    
    if (!subscription || subscription.status !== 'active') {
      return {
        feature,
        included: false,
        limit: 0,
        usage: 0,
        remaining: 0,
      };
    }

    const planEntitlements = PLAN_ENTITLEMENTS[subscription.planId as keyof typeof PLAN_ENTITLEMENTS] || PLAN_ENTITLEMENTS.STARTER;
    const entitlement = planEntitlements[feature];

    if (!entitlement) {
      return {
        feature,
        included: false,
      };
    }

    // Check usage if there's a limit
    if (entitlement.limit && entitlement.limit > 0) {
      const usageEvents = await globalDb.getUsageEvents(organizationId, {
        eventType: feature,
      });
      const usage = usageEvents.length;

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
    
    if (!subscription || subscription.status !== 'active') {
      return Object.keys(PLAN_ENTITLEMENTS.STARTER).map(feature => ({
        feature,
        included: false,
      }));
    }

    const planEntitlements = PLAN_ENTITLEMENTS[subscription.planId as keyof typeof PLAN_ENTITLEMENTS] || PLAN_ENTITLEMENTS.STARTER;
    
    const entitlements: Entitlement[] = [];
    for (const [feature, entitlement] of Object.entries(planEntitlements)) {
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
    const voiceCallCount = usageEvents.filter(e => e.eventType === 'voice_call').length;
    const aiEmployeeCount = usageEvents.filter(e => e.eventType === 'ai_employee').length;

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
