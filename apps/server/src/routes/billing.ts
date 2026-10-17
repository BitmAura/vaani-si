/**
 * @vanni/server — Billing & Entitlements REST Endpoints
 *
 * Provides:
 * - GET  /api/billing                      - Current tenant billing snapshot & usage
 * - GET  /api/billing/plans                - Public subscription catalog
 * - POST /api/billing/checkout             - Create checkout session (Razorpay order/subscription)
 * - POST /api/billing/subscription/cancel  - Cancel active subscription
 * - POST /api/billing/subscription/change  - Upgrade/downgrade subscription plan
 * - POST /api/billing/webhooks/razorpay    - Ingest Razorpay billing events
 *
 * SECURITY: Tenant context and user role are strictly derived from the authenticated session.
 * Client-supplied x-organization-id and x-user-role headers are rejected.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { globalDb } from '@vanni/database';
import { canManageBilling, requireUser } from '@vanni/auth';
import { getSessionFromRequest, requireTenantContext } from '../http-auth.js';
import { UserRole, SubscriptionDTO, PaymentRecordDTO } from '@vanni/shared';
import { RazorpayBillingProvider, MockBillingProvider } from '@vanni/providers';
import { IBillingProvider } from '@vanni/provider-sdk';

// Initialize Billing Provider (uses Razorpay if credentials exist, else Mock)
const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;
const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'whsec_vanni_test_secret_123';

const billingProvider: IBillingProvider = (razorpayKeyId && razorpaySecret)
  ? new RazorpayBillingProvider({
      keyId: razorpayKeyId,
      keySecret: razorpaySecret,
      webhookSecret: razorpayWebhookSecret,
    })
  : new MockBillingProvider();

export async function registerBillingRoutes(fastify: FastifyInstance) {
  // 1. GET /api/billing — Fetch Organization Billing Snapshot
  fastify.get('/api/billing', async (req: FastifyRequest, reply: FastifyReply) => {
    const { tenantId: orgId } = requireTenantContext(req);
    const snapshot = await globalDb.getBillingSnapshot(orgId);
    return reply.send({ success: true, data: snapshot });
  });

  // 2. GET /api/billing/plans — Public Plan Catalog
  fastify.get('/api/billing/plans', async (_req: FastifyRequest, reply: FastifyReply) => {
    const plans = await globalDb.getPlans('PUBLIC');
    return reply.send({ success: true, data: plans });
  });

  // 3. POST /api/billing/checkout — Initiate Subscription Checkout
  fastify.post('/api/billing/checkout', async (req: FastifyRequest, reply: FastifyReply) => {
    const session = requireUser(getSessionFromRequest(req));
    const orgId = session.activeOrganizationId;
    const role = session.activeRole as UserRole;

    if (!canManageBilling(role)) {
      return reply.status(403).send({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only Organization Admins and Owners can manage subscriptions and billing checkout.',
      });
    }

    const body = req.body as {
      planId: string;
      planVersionId?: string;
      billingPeriod?: 'MONTHLY' | 'ANNUAL';
    };

    if (!body?.planId) {
      return reply.status(400).send({ success: false, error: 'planId is required.' });
    }

    const plan = await globalDb.getPlanById(body.planId);
    if (!plan) {
      return reply.status(404).send({ success: false, error: 'PLAN_NOT_FOUND', message: 'Requested plan does not exist.' });
    }

    const org = await globalDb.getOrganizationById(orgId);
    const orgName = org?.name || 'Vaani-Si Customer';

    // Call Provider to create subscription
    const checkoutResult = await billingProvider.createSubscription({
      organizationId: orgId,
      customerId: `cust_${orgId}`,
      planId: plan.id,
      planVersionId: body.planVersionId || plan.activeVersion,
      billingInterval: (body.billingPeriod as 'MONTHLY' | 'ANNUAL') || 'MONTHLY',
    });

    const now = new Date().toISOString();
    const existingSub = await globalDb.getSubscription(orgId);

    const subscriptionRecord: SubscriptionDTO = {
      id: existingSub?.id || `sub_${Date.now()}`,
      organizationId: orgId,
      billingAccountId: `ba_${orgId}`,
      planId: plan.id,
      planVersionId: body.planVersionId || plan.activeVersion,
      billingInterval: (body.billingPeriod as 'MONTHLY' | 'ANNUAL') || 'MONTHLY',
      status: 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      provider: 'RAZORPAY',
      providerSubscriptionId: checkoutResult.providerSubscriptionId,
      createdAt: existingSub?.createdAt || now,
      updatedAt: now,
    };

    await globalDb.saveSubscription(subscriptionRecord);

    await globalDb.saveSubscriptionEvent({
      id: `se_${Date.now()}`,
      subscriptionId: subscriptionRecord.id,
      organizationId: orgId,
      eventType: 'UPGRADED',
      previousPlanId: existingSub?.planId,
      newPlanId: plan.id,
      reason: 'Checkout completed by administrator',
      occurredAt: now,
    });

    return reply.send({
      success: true,
      data: {
        checkoutUrl: checkoutResult.shortUrl || '',
        providerSubscriptionId: checkoutResult.providerSubscriptionId,
        subscription: subscriptionRecord,
      },
    });
  });

  // 4. POST /api/billing/subscription/cancel — Request cancellation
  fastify.post('/api/billing/subscription/cancel', async (req: FastifyRequest, reply: FastifyReply) => {
    const session = requireUser(getSessionFromRequest(req));
    const orgId = session.activeOrganizationId;
    const role = session.activeRole as UserRole;

    if (!canManageBilling(role)) {
      return reply.status(403).send({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only Organization Admins and Owners can cancel subscriptions.',
      });
    }

    const body = (req.body as { immediately?: boolean }) || {};
    const sub = await globalDb.getSubscription(orgId);
    if (!sub) {
      return reply.status(404).send({ success: false, error: 'NO_ACTIVE_SUBSCRIPTION' });
    }

    if (sub.providerSubscriptionId) {
      await billingProvider.cancelSubscription({
        providerSubscriptionId: sub.providerSubscriptionId,
        cancelAtPeriodEnd: !body.immediately,
      });
    }

    const now = new Date().toISOString();
    const updatedSub: SubscriptionDTO = {
      ...sub,
      status: body.immediately ? 'CANCELLED' : sub.status,
      cancelAtPeriodEnd: !body.immediately,
      cancelledAt: now,
      updatedAt: now,
    };
    await globalDb.saveSubscription(updatedSub);

    await globalDb.saveSubscriptionEvent({
      id: `se_${Date.now()}`,
      subscriptionId: sub.id,
      organizationId: orgId,
      eventType: 'CANCEL_REQUESTED',
      reason: body.immediately ? 'Immediate user cancellation' : 'Cancel at period end requested',
      occurredAt: now,
    });

    return reply.send({
      success: true,
      data: updatedSub,
      message: body.immediately
        ? 'Subscription has been cancelled immediately.'
        : 'Subscription will remain active until current period end.',
    });
  });

  // 5. POST /api/billing/subscription/change — Upgrade or Downgrade Plan
  fastify.post('/api/billing/subscription/change', async (req: FastifyRequest, reply: FastifyReply) => {
    const session = requireUser(getSessionFromRequest(req));
    const orgId = session.activeOrganizationId;
    const role = session.activeRole as UserRole;

    if (!canManageBilling(role)) {
      return reply.status(403).send({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only Organization Admins and Owners can modify subscriptions.',
      });
    }

    const body = req.body as { newPlanId: string; newPlanVersionId?: string };
    if (!body?.newPlanId) {
      return reply.status(400).send({ success: false, error: 'newPlanId is required.' });
    }

    const sub = await globalDb.getSubscription(orgId);
    if (!sub) {
      return reply.status(404).send({ success: false, error: 'NO_ACTIVE_SUBSCRIPTION' });
    }

    const newPlan = await globalDb.getPlanById(body.newPlanId);
    if (!newPlan) {
      return reply.status(404).send({ success: false, error: 'PLAN_NOT_FOUND' });
    }

    const prevPlanId = sub.planId;
    const now = new Date().toISOString();

    const updatedSub: SubscriptionDTO = {
      ...sub,
      planId: newPlan.id,
      planVersionId: body.newPlanVersionId || newPlan.activeVersion,
      status: 'ACTIVE',
      cancelAtPeriodEnd: false,
      updatedAt: now,
    };
    await globalDb.saveSubscription(updatedSub);

    await globalDb.saveSubscriptionEvent({
      id: `se_${Date.now()}`,
      subscriptionId: sub.id,
      organizationId: orgId,
      eventType: 'PLAN_CHANGED',
      previousPlanId: prevPlanId,
      newPlanId: newPlan.id,
      reason: `Plan changed to ${newPlan.name}`,
      occurredAt: now,
    });

    return reply.send({
      success: true,
      data: updatedSub,
      message: `Plan changed successfully to ${newPlan.name}.`,
    });
  });

  // 6. POST /api/billing/webhooks/razorpay — Authoritative Razorpay Webhook Receiver
  fastify.post('/api/billing/webhooks/razorpay', async (req: FastifyRequest, reply: FastifyReply) => {
    const signature = (req.headers['x-razorpay-signature'] as string) || '';
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    const isValid = billingProvider.verifyWebhookSignature({
      rawBody,
      signature,
      webhookSecret: razorpayWebhookSecret,
    });

    if (!isValid) {
      return reply.status(401).send({
        success: false,
        error: 'INVALID_SIGNATURE',
        message: 'Razorpay webhook signature verification failed.',
      });
    }

    const rawPayload = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(rawBody || '{}');
    const normalized = billingProvider.normalizeWebhookEvent(rawPayload);

    // Idempotency check: see if provider event was already ingested
    const existingEvent = await globalDb.getBillingProviderEvent('RAZORPAY', normalized.providerEventId);
    if (existingEvent) {
      return reply.send({
        success: true,
        status: 'IGNORED_DUPLICATE',
        message: 'Webhook event was already processed previously.',
      });
    }

    const orgId = rawPayload?.payload?.subscription?.entity?.notes?.organization_id
      || rawPayload?.payload?.payment?.entity?.notes?.organization_id;

    if (!orgId) {
      return reply.status(400).send({
        success: false,
        error: 'MISSING_ORGANIZATION_ID',
        message: 'Webhook payload notes must contain organization_id.',
      });
    }

    // Persist event in audit store
    await globalDb.saveBillingProviderEvent({
      id: `bpe_${Date.now()}`,
      provider: 'RAZORPAY',
      providerEventId: normalized.providerEventId,
      eventType: normalized.eventType,
      payloadReference: JSON.stringify(normalized),
      receivedAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
      processingStatus: 'PROCESSED',
      organizationId: orgId,
      createdAt: new Date().toISOString(),
    });

    // Handle normalized event lifecycle transitions
    const sub = await globalDb.getSubscription(orgId);
    const now = new Date().toISOString();

    if (normalized.eventType.includes('subscription.activated') || normalized.eventType.includes('payment.captured')) {
      if (sub) {
        await globalDb.saveSubscription({
          ...sub,
          status: 'ACTIVE',
          updatedAt: now,
        });
        await globalDb.saveSubscriptionEvent({
          id: `se_${Date.now()}`,
          subscriptionId: sub.id,
          organizationId: orgId,
          eventType: 'PAYMENT_RECOVERED',
          reason: 'Subscription activated or payment captured',
          occurredAt: now,
        });
      }

      if (normalized.paymentId && normalized.amount) {
        const account = await globalDb.getBillingAccount(orgId);
        const paymentRecord: PaymentRecordDTO = {
          id: `pay_${Date.now()}`,
          organizationId: orgId,
          billingAccountId: account?.id || `ba_${orgId}`,
          subscriptionId: sub?.id,
          provider: 'RAZORPAY',
          providerPaymentId: normalized.paymentId,
          amount: normalized.amount,
          currency: normalized.currency || 'INR',
          status: 'CAPTURED',
          paidAt: now,
          createdAt: now,
          updatedAt: now,
        };
        await globalDb.savePaymentRecord(paymentRecord);
      }
    } else if (normalized.eventType.includes('payment.failed')) {
      if (sub) {
        await globalDb.saveSubscription({
          ...sub,
          status: 'PAST_DUE',
          updatedAt: now,
        });
        await globalDb.saveSubscriptionEvent({
          id: `se_${Date.now()}`,
          subscriptionId: sub.id,
          organizationId: orgId,
          eventType: 'PAYMENT_FAILED',
          reason: 'Payment failed reported by Razorpay',
          occurredAt: now,
        });
      }
    } else if (normalized.eventType.includes('subscription.cancelled')) {
      if (sub) {
        await globalDb.saveSubscription({
          ...sub,
          status: 'CANCELLED',
          updatedAt: now,
        });
        await globalDb.saveSubscriptionEvent({
          id: `se_${Date.now()}`,
          subscriptionId: sub.id,
          organizationId: orgId,
          eventType: 'CANCELLED',
          reason: 'Subscription cancelled reported by Razorpay',
          occurredAt: now,
        });
      }
    }

    return reply.send({
      success: true,
      status: 'PROCESSED',
      eventId: normalized.providerEventId,
      eventType: normalized.eventType,
    });
  });
}
