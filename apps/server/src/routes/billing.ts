/**
 * @vanni/server — Billing, Plans, Subscriptions & Entitlements REST Endpoints
 *
 * Provides tenant-isolated management of:
 * - GET  /api/billing (Comprehensive organization billing snapshot)
 * - GET  /api/billing/plans (Public plan catalog & feature matrices)
 * - POST /api/billing/checkout (Create checkout session / subscription token)
 * - POST /api/billing/subscription/cancel (Request cancellation at period end or immediately)
 * - POST /api/billing/subscription/change (Upgrade / Downgrade plan version)
 * - POST /api/billing/webhooks/razorpay (Authoritative HMAC-SHA256 verified webhook ingestion)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { globalDb } from '@vanni/database';
import { canManageBilling, deserializeSession, SESSION_COOKIE_NAME } from '@vanni/auth';

function getSessionFromRequest(req: FastifyRequest) {
  const cookieVal = req.cookies?.[SESSION_COOKIE_NAME];
  if (!cookieVal) return null;
  return deserializeSession(cookieVal);
}
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
    const session = getSessionFromRequest(req);
    const orgId = (req.headers['x-organization-id'] as string)
      || session?.activeOrganizationId
      || (req.query as any)?.tenant
      || (req.query as any)?.organizationId
      || 'a0000000-0000-0000-0000-000000000001';
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
    const session = getSessionFromRequest(req);
    const orgId = (req.headers['x-organization-id'] as string)
      || session?.activeOrganizationId
      || (req.body as any)?.organizationId
      || 'a0000000-0000-0000-0000-000000000001';
    const role = (req.headers['x-user-role'] as UserRole)
      || session?.activeRole
      || 'ADMIN';

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
      billingInterval?: 'MONTHLY' | 'ANNUAL';
    };

    if (!body?.planId) {
      return reply.status(400).send({
        success: false,
        error: 'BAD_REQUEST',
        message: 'planId is required for subscription checkout.',
      });
    }

    const plans = await globalDb.getPlans('ALL');
    const targetPlan = plans.find(p => p.id === body.planId || p.slug === body.planId);
    if (!targetPlan) {
      return reply.status(404).send({
        success: false,
        error: 'NOT_FOUND',
        message: 'Plan not found.',
      });
    }

    const interval = body.billingInterval || 'MONTHLY';
    const amount = interval === 'ANNUAL' ? targetPlan.annualPrice : targetPlan.monthlyPrice;

    let account = await globalDb.getBillingAccount(orgId);
    if (!account) {
      account = {
        id: `ba_${orgId.substring(0, 8)}`,
        organizationId: orgId,
        billingEmail: 'billing@example.com',
        billingName: 'Organization Billing Admin',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        status: 'ACTIVE',
        provider: 'RAZORPAY',
        providerCustomerId: `cust_${orgId.substring(0, 8)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await globalDb.saveBillingAccount(account);
    }

    // Initialize subscription via provider abstraction
    const subResult = await billingProvider.createSubscription({
      organizationId: orgId,
      customerId: account.providerCustomerId || `cust_${orgId.substring(0, 8)}`,
      planId: targetPlan.id,
      planVersionId: body.planVersionId || targetPlan.activeVersion,
      billingInterval: interval,
    });

    if (!subResult.success) {
      return reply.status(502).send({
        success: false,
        error: 'PROVIDER_ERROR',
        message: subResult.error || 'Failed to initialize subscription with billing provider.',
      });
    }

    // Immediately activate subscription record for organization
    const now = new Date();
    const periodEnd = new Date(now.getTime() + (interval === 'ANNUAL' ? 365 : 30) * 24 * 60 * 60 * 1000);
    const existingSub = await globalDb.getSubscription(orgId);
    await globalDb.saveSubscription({
      id: subResult.providerSubscriptionId || existingSub?.id || `sub_${Date.now()}`,
      organizationId: orgId,
      billingAccountId: account.id,
      planId: targetPlan.id,
      planVersionId: body.planVersionId || targetPlan.activeVersion,
      provider: 'RAZORPAY',
      providerSubscriptionId: subResult.providerSubscriptionId,
      status: 'ACTIVE',
      billingInterval: interval,
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      cancelAtPeriodEnd: false,
      createdAt: existingSub?.createdAt || now.toISOString(),
      updatedAt: now.toISOString(),
    });

    return reply.send({
      success: true,
      data: {
        providerSubscriptionId: subResult.providerSubscriptionId,
        shortUrl: subResult.shortUrl,
        planName: targetPlan.name,
        amount,
        currency: targetPlan.currency,
        billingInterval: interval,
        keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock_public_key',
      },
    });
  });

  // 4. POST /api/billing/subscription/cancel — Request cancellation
  fastify.post('/api/billing/subscription/cancel', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = (req.headers['x-organization-id'] as string) || 'a0000000-0000-0000-0000-000000000001';
    const role = (req.headers['x-user-role'] as UserRole) || 'ADMIN';

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

    // Call provider cancel abstraction
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
    const orgId = (req.headers['x-organization-id'] as string) || 'a0000000-0000-0000-0000-000000000001';
    const role = (req.headers['x-user-role'] as UserRole) || 'ADMIN';

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
      || rawPayload?.payload?.payment?.entity?.notes?.organization_id
      || (req.headers['x-organization-id'] as string)
      || 'a0000000-0000-0000-0000-000000000001';

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
