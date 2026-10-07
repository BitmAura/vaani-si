/**
 * Subscription Management Service
 * Handles subscription lifecycle, upgrades, downgrades, and cancellations
 */

import { globalDb } from '@vanni/database';
import { BillingAccountDTO, SubscriptionDTO, SubscriptionEventDTO } from '@vanni/shared';

export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'incomplete' | 'trialing';

export interface SubscriptionChangeRequest {
  organizationId: string;
  newPlanId: string;
  billingCycle?: 'monthly' | 'annual';
  prorate?: boolean;
}

export class SubscriptionService {
  /**
   * Create a new subscription for an organization
   */
  async createSubscription(input: {
    organizationId: string;
    planId: string;
    billingCycle: 'monthly' | 'annual';
    trialDays?: number;
  }): Promise<SubscriptionDTO> {
    const now = new Date();
    const trialEnd = input.trialDays 
      ? new Date(now.getTime() + input.trialDays * 24 * 60 * 60 * 1000)
      : now;

    const subscription: SubscriptionDTO = {
      id: `sub_${Date.now()}`,
      organizationId: input.organizationId,
      planId: input.planId,
      status: input.trialDays ? 'trialing' : 'active',
      billingCycle: input.billingCycle,
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      trialEnd: trialEnd.toISOString(),
      canceledAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await globalDb.saveSubscription(subscription);

    // Log event
    const event: SubscriptionEventDTO = {
      id: `evt_${Date.now()}`,
      organizationId: input.organizationId,
      eventType: 'subscription.created',
      eventData: { planId: input.planId },
      createdAt: now.toISOString(),
    };
    await globalDb.saveSubscriptionEvent(event);

    return subscription;
  }

  /**
   * Upgrade or downgrade subscription
   */
  async changePlan(request: SubscriptionChangeRequest): Promise<SubscriptionDTO> {
    const existing = await globalDb.getSubscription(request.organizationId);
    if (!existing) {
      throw new Error('No active subscription found');
    }

    const updated: SubscriptionDTO = {
      ...existing,
      planId: request.newPlanId,
      updatedAt: new Date().toISOString(),
    };

    await globalDb.saveSubscription(updated);

    // Log change event
    const event: SubscriptionEventDTO = {
      id: `evt_${Date.now()}`,
      organizationId: request.organizationId,
      eventType: 'subscription.plan_changed',
      eventData: { 
        previousPlanId: existing.planId, 
        newPlanId: request.newPlanId,
        prorated: request.prorate ?? true 
      },
      createdAt: new Date().toISOString(),
    };
    await globalDb.saveSubscriptionEvent(event);

    return updated;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    organizationId: string,
    reason?: string
  ): Promise<{ success: boolean; cancellationDate: string }> {
    const existing = await globalDb.getSubscription(organizationId);
    if (!existing) {
      throw new Error('No active subscription found');
    }

    const now = new Date();
    const canceled: SubscriptionDTO = {
      ...existing,
      status: 'cancelled',
      canceledAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await globalDb.saveSubscription(canceled);

    // Log cancellation
    const event: SubscriptionEventDTO = {
      id: `evt_${Date.now()}`,
      organizationId,
      eventType: 'subscription.cancelled',
      eventData: { reason },
      createdAt: now.toISOString(),
    };
    await globalDb.saveSubscriptionEvent(event);

    return {
      success: true,
      cancellationDate: now.toISOString(),
    };
  }

  /**
   * Get billing account status
   */
  async getBillingAccount(organizationId: string): Promise<BillingAccountDTO | null> {
    return await globalDb.getBillingAccount(organizationId);
  }

  /**
   * Check if subscription is active
   */
  async isActive(organizationId: string): Promise<boolean> {
    const subscription = await globalDb.getSubscription(organizationId);
    if (!subscription) return false;

    return ['active', 'trialing'].includes(subscription.status);
  }

  /**
   * Get subscription events for audit trail
   */
  async getSubscriptionHistory(organizationId: string): Promise<SubscriptionEventDTO[]> {
    return await globalDb.getSubscriptionEvents(organizationId);
  }
}

export const globalSubscriptionService = new SubscriptionService();
