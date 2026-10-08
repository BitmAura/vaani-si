/**
 * Subscription Management Service
 * Handles subscription lifecycle, upgrades, downgrades, and cancellations
 */

import { globalDb } from '@vanni/database';
import { BillingAccountDTO, SubscriptionDTO, SubscriptionEventDTO } from '@vanni/shared';

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
      billingAccountId: `billa_${input.organizationId}`,
      planId: input.planId,
      planVersionId: 'v1',
      provider: 'RAZORPAY',
      status: input.trialDays ? 'TRIALING' : 'ACTIVE',
      billingInterval: input.billingCycle === 'annual' ? 'ANNUAL' : 'MONTHLY',
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      trialEnd: trialEnd.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await globalDb.saveSubscription(subscription);

    // Log event
    const event: SubscriptionEventDTO = {
      id: `evt_${Date.now()}`,
      organizationId: input.organizationId,
      subscriptionId: subscription.id,
      eventType: input.trialDays ? 'TRIAL_STARTED' : 'SUBSCRIPTION_CREATED',
      newPlanId: input.planId,
      occurredAt: now.toISOString(),
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
      subscriptionId: updated.id,
      eventType: 'PLAN_CHANGED',
      previousPlanId: existing.planId,
      newPlanId: request.newPlanId,
      reason: request.prorate === false ? 'no-proration' : 'prorated',
      occurredAt: new Date().toISOString(),
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
      status: 'CANCELLED',
      cancelledAt: now.toISOString(),
      cancelAtPeriodEnd: true,
      updatedAt: now.toISOString(),
    };

    await globalDb.saveSubscription(canceled);

    // Log cancellation
    const event: SubscriptionEventDTO = {
      id: `evt_${Date.now()}`,
      organizationId,
      subscriptionId: canceled.id,
      eventType: 'CANCELLED',
      reason,
      occurredAt: now.toISOString(),
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

    return ['ACTIVE', 'TRIALING'].includes(subscription.status);
  }

  /**
   * Get subscription events for audit trail
   */
  async getSubscriptionHistory(organizationId: string): Promise<SubscriptionEventDTO[]> {
    return await globalDb.getSubscriptionEvents(organizationId);
  }
}

export const globalSubscriptionService = new SubscriptionService();
