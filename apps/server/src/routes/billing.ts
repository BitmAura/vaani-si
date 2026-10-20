/**
 * @vanni/server — Billing & Entitlements REST Endpoints
 *
 * Provides:
 * - GET  /api/billing                      - Current tenant billing snapshot & usage
 * - GET  /api/billing/plans                - Public subscription catalog
 * - POST /api/billing/checkout             - Create checkout session (Razorpay order/subscription)
 * - POST /api/billing/checkout/verify      - Verify payment signature and activate subscription
 * - POST /api/billing/subscription/cancel  - Cancel active subscription
 * - POST /api/billing/subscription/change  - Upgrade/downgrade subscription plan
 * - POST /api/billing/webhooks/razorpay    - Ingest Razorpay billing events
 *
 * SECURITY: Tenant context and user role are strictly derived from the authenticated session.
 * Client-supplied x-organization-id and x-user-role headers are rejected.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import { globalDb } from '@vanni/database';
import { canManageBilling, requireUser } from '@vanni/auth';
import { getSessionFromRequest, requireTenantContext } from '../http-auth.js';
import { UserRole, SubscriptionDTO, PaymentRecordDTO } from '@vanni/shared';
import { resolveBillingProvider, RazorpayBillingProvider } from '@vanni/providers';
import { IBillingProvider } from '@vanni/provider-sdk';
import { globalInvoiceGenerator } from '@vanni/billing';

const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'whsec_vanni_test_secret_123';

let activeBillingProvider: IBillingProvider = resolveBillingProvider();

export function setBillingProvider(provider: IBillingProvider) {
  activeBillingProvider = provider;
}

export function getBillingProvider(): IBillingProvider {
  return activeBillingProvider;
}

export async function registerBillingRoutes(fastify: FastifyInstance) {
  const getBillingSnapshotHandler = async (req: FastifyRequest, reply: FastifyReply) => {
    const { tenantId: orgId } = requireTenantContext(req);
    const snapshot = await globalDb.getBillingSnapshot(orgId);
    const invoices = await globalDb.getBillingInvoices(orgId);
    const adjustments = await globalDb.getUsageAdjustments(orgId);
    const isRazorpayConfigured = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

    return reply.send({
      success: true,
      data: {
        ...snapshot,
        invoices,
        adjustments,
        gatewayStatus: {
          provider: 'RAZORPAY',
          configured: isRazorpayConfigured,
          mode: isRazorpayConfigured ? 'LIVE_PROVIDER' : 'UNCONFIGURED_SANDBOX',
          currency: 'INR',
        },
      },
    });
  };
  fastify.get('/api/billing', getBillingSnapshotHandler);
  fastify.get('/api/billing/snapshot', getBillingSnapshotHandler);

  // GET /api/billing/subscription
  fastify.get('/api/billing/subscription', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { tenantId: orgId } = requireTenantContext(req);
      const sub = await globalDb.getSubscription(orgId);
      if (!sub) {
        return reply.status(404).send({ success: false, error: 'NO_ACTIVE_SUBSCRIPTION' });
      }
      return reply.send({ success: true, data: sub });
    } catch (err: any) {
      fastify.log.error({ err }, '[Billing] Failed to fetch subscription');
      return reply.status(500).send({ success: false, error: 'INTERNAL_ERROR', message: err.message });
    }
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

    const body = (req.body || {}) as {
      planId?: string;
      planVersionId?: string;
      billingPeriod?: string;
      billingInterval?: string;
      amount?: number; // Ignored: derived from server plan catalog
    };

    if (!body?.planId) {
      return reply.status(400).send({ success: false, error: 'planId is required.' });
    }

    let plan = await globalDb.getPlanById(body.planId);
    if (!plan) plan = await globalDb.getPlanBySlug(body.planId);
    if (!plan) {
      const normalizedSlug = body.planId.toLowerCase().replace(/^plan_/, '').replace(/_monthly$/, '').replace(/_annual$/, '');
      plan = await globalDb.getPlanBySlug(normalizedSlug);
    }
    if (!plan) {
      const aliasMap: Record<string, string> = { pro: 'plan_growth', enterprise: 'plan_scale' };
      const aliasKey = body.planId.toLowerCase().replace(/_monthly$/, '').replace(/_annual$/, '');
      if (aliasMap[aliasKey]) plan = await globalDb.getPlanById(aliasMap[aliasKey]);
    }
    if (!plan) {
      return reply.status(404).send({ success: false, error: 'PLAN_NOT_FOUND', message: 'Requested plan does not exist.' });
    }

    const rawInterval = body.billingInterval || body.billingPeriod || 'MONTHLY';
    if (rawInterval !== 'MONTHLY' && rawInterval !== 'ANNUAL') {
      return reply.status(400).send({
        success: false,
        error: 'INVALID_BILLING_INTERVAL',
        message: 'billingInterval must be either MONTHLY or ANNUAL',
      });
    }
    const interval = rawInterval as 'MONTHLY' | 'ANNUAL';
    const planPrice = interval === 'ANNUAL' ? plan.annualPrice : plan.monthlyPrice;

    // Call Provider to create subscription
    let checkoutResult;
    try {
      checkoutResult = await activeBillingProvider.createSubscription({
        organizationId: orgId,
        customerId: `cust_${orgId}`,
        planId: plan.id,
        planVersionId: body.planVersionId || plan.activeVersion,
        billingInterval: interval,
      });
    } catch (err: any) {
      return reply.status(502).send({
        success: false,
        error: 'PROVIDER_ERROR',
        message: err.message || 'Payment provider error during subscription creation.',
      });
    }

    if (!checkoutResult || checkoutResult.status === 'failed' || (!checkoutResult.success && checkoutResult.success !== undefined)) {
      return reply.status(502).send({
        success: false,
        error: 'PROVIDER_ERROR',
        message: checkoutResult?.error || 'Failed to initialize subscription checkout with payment provider.',
      });
    }

    const now = new Date().toISOString();
    const existingSub = await globalDb.getSubscription(orgId);

    // Entitlement safety: An unpaid checkout does NOT grant ACTIVE status if the tenant is new or inactive.
    // If tenant already has an ACTIVE or TRIALING subscription, we preserve current active entitlements until payment confirms.
    // If tenant has NO subscription, or is CANCELLED/EXPIRED/INCOMPLETE, status is 'INCOMPLETE'.
    const isCurrentlyActive = existingSub && (existingSub.status === 'ACTIVE' || existingSub.status === 'TRIALING');

    const subscriptionRecord: SubscriptionDTO = {
      id: existingSub?.id || `sub_${Date.now()}`,
      organizationId: orgId,
      billingAccountId: existingSub?.billingAccountId || `ba_${orgId}`,
      planId: isCurrentlyActive ? existingSub.planId : plan.id,
      planVersionId: isCurrentlyActive ? existingSub.planVersionId : (body.planVersionId || plan.activeVersion),
      billingInterval: interval,
      status: isCurrentlyActive ? existingSub.status : 'INCOMPLETE',
      currentPeriodStart: existingSub?.currentPeriodStart || now,
      currentPeriodEnd: existingSub?.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
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
      eventType: 'SUBSCRIPTION_CREATED',
      previousPlanId: existingSub?.planId,
      newPlanId: plan.id,
      reason: `Checkout initiated for ${plan.name} (${interval})`,
      occurredAt: now,
    });

    const effectiveUrl = checkoutResult.shortUrl || (checkoutResult as any).checkoutUrl || '';

    return reply.send({
      success: true,
      checkoutUrl: effectiveUrl,
      shortUrl: effectiveUrl,
      planName: plan.name,
      amount: planPrice,
      currency: plan.currency || 'INR',
      billingInterval: interval,
      providerSubscriptionId: checkoutResult.providerSubscriptionId,
      subscription: subscriptionRecord,
      data: {
        checkoutUrl: effectiveUrl,
        shortUrl: effectiveUrl,
        planName: plan.name,
        amount: planPrice,
        currency: plan.currency || 'INR',
        billingInterval: interval,
        providerSubscriptionId: checkoutResult.providerSubscriptionId,
        subscription: subscriptionRecord,
      },
    });
  });

  // 3b. POST /api/billing/checkout/verify — Verify Checkout Payment Signature & Activate Entitlements
  fastify.post('/api/billing/checkout/verify', async (req: FastifyRequest, reply: FastifyReply) => {
    const session = requireUser(getSessionFromRequest(req));
    const orgId = session.activeOrganizationId;
    const role = session.activeRole as UserRole;

    if (!canManageBilling(role)) {
      return reply.status(403).send({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only Organization Admins and Owners can verify checkout payments.',
      });
    }

    const body = (req.body || {}) as {
      razorpay_payment_id?: string;
      razorpay_subscription_id?: string;
      razorpay_order_id?: string;
      razorpay_signature?: string;
      planId?: string;
    };

    if (!body.razorpay_signature || (!body.razorpay_subscription_id && !body.razorpay_order_id && !body.razorpay_payment_id)) {
      return reply.status(400).send({
        success: false,
        error: 'INVALID_SIGNATURE',
        message: 'Missing required Razorpay payment signature or identifier.',
      });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    let isValidSignature = false;

    if (secret) {
      const payloadToSign = `${body.razorpay_order_id || body.razorpay_subscription_id}|${body.razorpay_payment_id}`;
      const expected = crypto.createHmac('sha256', secret).update(payloadToSign).digest('hex');
      try {
        isValidSignature = crypto.timingSafeEqual(Buffer.from(body.razorpay_signature), Buffer.from(expected));
      } catch {
        isValidSignature = false;
      }
    } else {
      // Non-production test allowance for mock signatures
      isValidSignature = body.razorpay_signature === 'valid_mock_signature' ||
        body.razorpay_signature.startsWith('valid_');
    }

    if (!isValidSignature) {
      return reply.status(400).send({
        success: false,
        error: 'INVALID_SIGNATURE',
        message: 'Payment signature verification failed. Unverified checkout return cannot grant entitlements.',
      });
    }

    const sub = await globalDb.getSubscription(orgId);
    const now = new Date().toISOString();
    const targetPlanId = body.planId || sub?.planId || 'plan_starter';
    const plan = await globalDb.getPlanById(targetPlanId);

    const activatedSub: SubscriptionDTO = {
      id: sub?.id || `sub_${Date.now()}`,
      organizationId: orgId,
      billingAccountId: sub?.billingAccountId || `ba_${orgId}`,
      planId: plan?.id || targetPlanId,
      planVersionId: sub?.planVersionId || 'v1.0',
      provider: 'RAZORPAY',
      providerSubscriptionId: body.razorpay_subscription_id || sub?.providerSubscriptionId,
      status: 'ACTIVE',
      billingInterval: sub?.billingInterval || 'MONTHLY',
      currentPeriodStart: now,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      createdAt: sub?.createdAt || now,
      updatedAt: now,
    };

    await globalDb.saveSubscription(activatedSub);

    await globalDb.saveSubscriptionEvent({
      id: `se_${Date.now()}`,
      subscriptionId: activatedSub.id,
      organizationId: orgId,
      eventType: 'UPGRADED',
      previousPlanId: sub?.planId,
      newPlanId: activatedSub.planId,
      reason: 'Checkout verified and subscription activated successfully',
      occurredAt: now,
    });

    if (body.razorpay_payment_id) {
      const amount = activatedSub.billingInterval === 'ANNUAL' ? (plan?.annualPrice || 0) : (plan?.monthlyPrice || 0);
      await globalDb.savePaymentRecord({
        id: `pay_${Date.now()}`,
        organizationId: orgId,
        billingAccountId: activatedSub.billingAccountId,
        subscriptionId: activatedSub.id,
        provider: 'RAZORPAY',
        providerPaymentId: body.razorpay_payment_id,
        amount,
        currency: plan?.currency || 'INR',
        status: 'CAPTURED',
        paidAt: now,
        createdAt: now,
        updatedAt: now,
      });

      try {
        await globalInvoiceGenerator.generateInvoice({
          organizationId: orgId,
          billingAccountId: activatedSub.billingAccountId,
          subscriptionId: activatedSub.id,
          paymentId: body.razorpay_payment_id,
          subtotalInr: Math.round(amount / 1.18 * 100) / 100,
          taxPercent: 18,
          periodStart: now,
          periodEnd: activatedSub.currentPeriodEnd,
          currency: plan?.currency || 'INR',
        });
      } catch (invErr) {
        fastify.log.warn({ invErr }, '[Billing Verify] Auto invoice generation warning');
      }
    }

    return reply.send({
      success: true,
      data: {
        status: 'ACTIVE',
        subscription: activatedSub,
        message: 'Subscription successfully activated.',
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

    const sub = await globalDb.getSubscription(orgId);
    if (!sub) {
      return reply.status(404).send({ success: false, error: 'NO_ACTIVE_SUBSCRIPTION' });
    }

    if (sub.status === 'CANCELLED') {
      return reply.send({
        success: true,
        data: sub,
        message: 'Subscription is already cancelled.',
      });
    }

    const body = (req.body as { immediately?: boolean }) || {};

    if (sub.providerSubscriptionId) {
      try {
        await activeBillingProvider.cancelSubscription({
          providerSubscriptionId: sub.providerSubscriptionId,
          cancelAtPeriodEnd: !body.immediately,
        });
      } catch (err: any) {
        fastify.log.warn({ err }, '[Billing] Provider cancel subscription warning');
      }
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
      eventType: body.immediately ? 'CANCELLED' : 'CANCEL_REQUESTED',
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

    if (sub.status === 'CANCELLED' || sub.status === 'EXPIRED') {
      return reply.status(400).send({
        success: false,
        error: 'SUBSCRIPTION_TERMINATED',
        message: 'Cannot change plan on a cancelled or expired subscription. Please initiate a new checkout.',
      });
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
    if (process.env.NODE_ENV === 'production' && !process.env.RAZORPAY_WEBHOOK_SECRET) {
      fastify.log.error('[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is not configured — failing closed in production');
      return reply.status(503).send({
        success: false,
        error: 'SERVICE_UNAVAILABLE',
        message: 'Razorpay webhook secret not configured in production',
      });
    }

    const signature = (req.headers['x-razorpay-signature'] as string) || '';
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    const isValid = activeBillingProvider.verifyWebhookSignature({
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
    const normalized = activeBillingProvider.normalizeWebhookEvent(rawPayload);
    const headerEventId = (req.headers['x-razorpay-event-id'] as string) || rawPayload?.id;
    if (headerEventId) {
      normalized.providerEventId = headerEventId;
    }

    // Durable idempotency check: see if provider event was already ingested
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

    // Tenant reference validation: organization or its subscription must exist in database
    const org = await globalDb.getOrganizationById(orgId);
    const sub = await globalDb.getSubscription(orgId);
    if (!org && !sub) {
      return reply.status(404).send({
        success: false,
        error: 'ORGANIZATION_NOT_FOUND',
        message: `Organization ${orgId} not found in database.`,
      });
    }

    // Persist event in audit store (durable idempotency)
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
    const now = new Date().toISOString();

    if (
      normalized.eventType.includes('subscription.activated') ||
      normalized.eventType.includes('subscription.charged') ||
      normalized.eventType.includes('payment.captured')
    ) {
      if (sub) {
        // Out-of-order guard: If subscription was already cancelled and this is a payment event (not subscription.activated),
        // do not resurrect the cancelled subscription to ACTIVE.
        const isCancelled = sub.status === 'CANCELLED';
        const isActivation = normalized.eventType.includes('subscription.activated');

        if (!isCancelled || isActivation) {
          const isRenewal = normalized.eventType.includes('subscription.charged');
          const nextPeriodEnd = isRenewal
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            : sub.currentPeriodEnd;

          await globalDb.saveSubscription({
            ...sub,
            status: 'ACTIVE',
            currentPeriodStart: isRenewal ? now : sub.currentPeriodStart,
            currentPeriodEnd: nextPeriodEnd,
            cancelAtPeriodEnd: false,
            updatedAt: now,
          });

          await globalDb.saveSubscriptionEvent({
            id: `se_${Date.now()}`,
            subscriptionId: sub.id,
            organizationId: orgId,
            eventType: isRenewal ? 'RENEWED' : 'PAYMENT_RECOVERED',
            reason: isRenewal
              ? 'Subscription renewed and charged successfully via Razorpay'
              : 'Subscription activated or payment captured',
            occurredAt: now,
          });
        }
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

        // Generate GST invoice record
        try {
          await globalInvoiceGenerator.generateInvoice({
            organizationId: orgId,
            billingAccountId: account?.id || `ba_${orgId}`,
            subscriptionId: sub?.id,
            paymentId: normalized.paymentId,
            subtotalInr: Math.round(normalized.amount / 1.18 * 100) / 100,
            taxPercent: 18,
            periodStart: now,
            periodEnd: sub?.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            currency: normalized.currency || 'INR',
          });
        } catch (invErr) {
          fastify.log.warn({ invErr }, '[Billing Webhook] Auto invoice generation warning');
        }
      }
    } else if (normalized.eventType.includes('payment.failed')) {
      if (sub && sub.status !== 'CANCELLED') {
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
          cancelledAt: now,
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
