import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import { globalDb } from '@vanni/database';
import { globalEntitlementEngine } from '@vanni/billing';
import { buildServer } from '../server';
import { FastifyInstance } from 'fastify';
import {
  SubscriptionDTO,
  UsageEventDTO,
  UsageAdjustmentDTO,
  ClientWorkspaceDTO,
} from '@vanni/shared';

describe('Prompt 09: SaaS Usage Metering, Billing & Subscription Enforcement', () => {
  let app: FastifyInstance;
  const testOrgId = 'org_billing_test_' + Date.now();
  const testClientWsId = 'ws_billing_client_' + Date.now();

  beforeEach(async () => {
    app = await buildServer();

    // Setup test organization subscription
    const now = new Date().toISOString();
    const sub: SubscriptionDTO = {
      id: `sub_${testOrgId}`,
      organizationId: testOrgId,
      billingAccountId: `ba_${testOrgId}`,
      planId: 'plan_starter',
      planVersionId: 'v1.0',
      provider: 'RAZORPAY',
      status: 'ACTIVE',
      billingInterval: 'MONTHLY',
      currentPeriodStart: now,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    };
    await globalDb.saveSubscription(sub);

    // Setup client workspace belonging to the test agency organization
    const clientWs: ClientWorkspaceDTO = {
      id: testClientWsId,
      organizationId: testOrgId,
      name: 'Dr. Ramesh Dental Clinic',
      slug: 'ramesh-dental',
      industryCategory: 'HEALTHCARE',
      subcategory: 'DENTAL',
      modelType: 'AGENCY',
      operatingLocation: 'Ballari, Karnataka',
      primaryPhone: '+919845012345',
      primaryEmail: 'info@rameshdental.in',
      timezone: 'Asia/Kolkata',
      languagePreferences: {
        primary: 'kn-IN',
        conversationalStyle: 'POLITE_BUSINESS',
        regionalDialect: 'NORTH_KARNATAKA_COMMERCIAL',
      },
      onboardingCompleted: true,
      onboardingStep: 7,
      createdAt: now,
      updatedAt: now,
    };
    await globalDb.saveClientWorkspace(clientWs);
  });

  afterEach(async () => {
    await app.close();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Voice Usage Metering from Confirmed Call Lifecycle Events
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Confirmed Call Lifecycle & Usage Ledger', () => {
    it('meters usage based on confirmed duration, not initiation time', async () => {
      const callSid = `CALL_CONFIRMED_${Date.now()}`;
      const confirmedDurationSec = 180; // 3 minutes

      // CDR webhook reporting completed call attributed to client workspace
      const res = await app.inject({
        method: 'POST',
        url: '/api/telephony/cdr',
        headers: {
          'content-type': 'application/json',
        },
        payload: {
          CallSid: callSid,
          RecordingDuration: confirmedDurationSec,
          CallStatus: 'completed',
          tenant: testClientWsId, // Attributed to client workspace
          CallerName: 'Suresh Patil',
          From: '+919845011111',
          Direction: 'inbound',
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.callStatus).toBe('COMPLETED');

      // Check persisted usage events for agency organization
      const events = await globalDb.getUsageEvents(testOrgId);
      const callUsage = events.find(e => e.correlationId === callSid);

      expect(callUsage).toBeDefined();
      expect(callUsage?.eventType).toBe('VOICE_DURATION');
      expect(callUsage?.quantity).toBe(180); // seconds
      expect(callUsage?.unit).toBe('seconds');
      expect(callUsage?.clientWorkspaceId).toBe(testClientWsId);
      expect(callUsage?.durationSource).toBe('PROVIDER_CDR');
      expect(callUsage?.confirmedDurationSec).toBe(180);
      expect(callUsage?.estimatedCost).toBeCloseTo((180 / 60) * 0.85, 2);
    });

    it('does NOT charge or meter completed minutes for failed or unanswered calls', async () => {
      const callSid = `CALL_NO_ANSWER_${Date.now()}`;

      const res = await app.inject({
        method: 'POST',
        url: '/api/telephony/cdr',
        headers: { 'content-type': 'application/json' },
        payload: {
          CallSid: callSid,
          CallStatus: 'no-answer',
          RecordingDuration: 0,
          tenant: testOrgId,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().callStatus).toBe('NO_ANSWER');

      // Usage event should not exist for non-completed calls
      const events = await globalDb.getUsageEvents(testOrgId);
      const callUsage = events.find(e => e.correlationId === callSid);
      expect(callUsage).toBeUndefined();
    });

    it('handles duplicate and retried CDR webhooks idempotently without inflating usage', async () => {
      const callSid = `CALL_DEDUP_${Date.now()}`;

      // First webhook
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/telephony/cdr',
        headers: { 'content-type': 'application/json' },
        payload: {
          CallSid: callSid,
          RecordingDuration: 120,
          CallStatus: 'completed',
          tenant: testOrgId,
          EventId: `evt_${callSid}_1`,
        },
      });
      expect(res1.statusCode).toBe(200);

      // Duplicate webhook retry
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/telephony/cdr',
        headers: { 'content-type': 'application/json' },
        payload: {
          CallSid: callSid,
          RecordingDuration: 120,
          CallStatus: 'completed',
          tenant: testOrgId,
          EventId: `evt_${callSid}_1`,
        },
      });
      expect(res2.statusCode).toBe(200);
      expect(res2.json().duplicate).toBe(true);

      // Verify that total usage events for this correlationId is exactly 1
      const events = await globalDb.getUsageEvents(testOrgId);
      const matches = events.filter(e => e.correlationId === callSid);
      expect(matches.length).toBe(1);
    });

    it('safely corrects usage records when verified provider CDR arrives with updated duration', async () => {
      const callSid = `CALL_RECONCILE_${Date.now()}`;

      // Initial duration estimate: 60s
      const initialEvent: UsageEventDTO = {
        id: `usage_${callSid}_voice`,
        organizationId: testOrgId,
        eventType: 'VOICE_DURATION',
        resourceType: 'VOICE_MINUTE',
        provider: 'exotel',
        quantity: 60,
        unit: 'seconds',
        costType: 'ESTIMATED',
        estimatedCost: 0.85,
        currency: 'INR',
        correlationId: callSid,
        occurredAt: new Date().toISOString(),
      };
      await globalDb.saveUsageEvent(initialEvent);

      // Reconciled provider CDR arrives: confirmed duration 90s
      const updatedEvent: UsageEventDTO = {
        ...initialEvent,
        quantity: 90,
        costType: 'ACTUAL',
        actualCost: 1.25,
        confirmedDurationSec: 90,
      };
      await globalDb.saveUsageEvent(updatedEvent);

      const events = await globalDb.getUsageEvents(testOrgId);
      const matches = events.filter(e => e.correlationId === callSid);
      expect(matches.length).toBe(1);
      expect(matches[0].quantity).toBe(90);
      expect(matches[0].costType).toBe('ACTUAL');

      // Record audit adjustment
      const adjustment: UsageAdjustmentDTO = {
        id: `adj_${Date.now()}`,
        organizationId: testOrgId,
        usageEventId: matches[0].id,
        adjustmentType: 'CDR_RECONCILIATION',
        originalQuantity: 60,
        adjustedQuantity: 90,
        deltaQuantity: 30,
        unit: 'seconds',
        reason: 'Provider verified duration update from telecom CDR',
        createdAt: new Date().toISOString(),
      };
      await globalDb.saveUsageAdjustment(adjustment);

      const auditTrail = await globalDb.getUsageAdjustments(testOrgId);
      expect(auditTrail.length).toBeGreaterThanOrEqual(1);
      expect(auditTrail[0].adjustmentType).toBe('CDR_RECONCILIATION');
      expect(auditTrail[0].deltaQuantity).toBe(30);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Server-Side Entitlement Enforcement
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Entitlement Enforcement & Multi-Tenant Limits', () => {
    it('allows voice minutes consumption when within plan allowance', async () => {
      const check = await globalEntitlementEngine.canConsumeVoiceMinutes(testOrgId, 5);
      expect(check.allowed).toBe(true);
      expect(check.limit).toBe(600); // Starter plan
      expect(check.remainingMinutes).toBeGreaterThan(0);
    });

    it('blocks outbound calls server-side when plan limit is exceeded', async () => {
      const exhaustedOrgId = 'org_exhausted_' + Date.now();

      // Setup subscription with Starter plan (600 minutes)
      const now = new Date();
      const periodStart = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const periodEnd = new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000).toISOString();

      await globalDb.saveSubscription({
        id: `sub_${exhaustedOrgId}`,
        organizationId: exhaustedOrgId,
        billingAccountId: `ba_${exhaustedOrgId}`,
        planId: 'plan_starter',
        planVersionId: 'v1.0',
        provider: 'RAZORPAY',
        status: 'ACTIVE',
        billingInterval: 'MONTHLY',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        createdAt: periodStart,
        updatedAt: periodStart,
      });

      // Inject usage exceeding limit: 610 minutes (36,600 seconds)
      await globalDb.saveUsageEvent({
        id: `usage_excess_${Date.now()}`,
        organizationId: exhaustedOrgId,
        eventType: 'VOICE_DURATION',
        resourceType: 'VOICE_MINUTE',
        provider: 'exotel',
        quantity: 36600, // 610 minutes
        unit: 'seconds',
        costType: 'ESTIMATED',
        estimatedCost: 518.5,
        currency: 'INR',
        correlationId: 'corr_excess_1',
        occurredAt: new Date().toISOString(),
      });

      // Attempt outbound call
      const res = await app.inject({
        method: 'POST',
        url: '/api/telephony/outbound',
        payload: {
          targetPhoneNumber: '+919845022222',
          businessContext: 'Test Dial',
          organizationId: exhaustedOrgId,
        },
      });

      expect(res.statusCode).toBe(403);
      const data = res.json();
      expect(data.error).toBe('ENTITLEMENT_LIMIT_EXCEEDED');
      expect(data.message).toContain('allowance exhausted');
    });

    it('blocks client workspace creation when plan allocation limit is reached', async () => {
      // Starter plan allows 1 client workspace. testOrgId already has 1 workspace.
      const check = await globalEntitlementEngine.canCreateClientWorkspace(testOrgId);
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('Maximum client workspaces reached');
    });

    it('allows client workspace creation when upgraded to Growth or Scale tier', async () => {
      const growthOrgId = 'org_growth_' + Date.now();
      const now = new Date().toISOString();

      await globalDb.saveSubscription({
        id: `sub_${growthOrgId}`,
        organizationId: growthOrgId,
        billingAccountId: `ba_${growthOrgId}`,
        planId: 'plan_growth', // 3 client locations/workspaces
        planVersionId: 'v1.0',
        provider: 'RAZORPAY',
        status: 'ACTIVE',
        billingInterval: 'MONTHLY',
        currentPeriodStart: now,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now,
      });

      const check = await globalEntitlementEngine.canCreateClientWorkspace(growthOrgId);
      expect(check.allowed).toBe(true);
      expect(check.maxAllowed).toBe(3);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Razorpay Webhook Security & Subscription Lifecycle
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Razorpay Webhook Security & Subscription Lifecycle', () => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'whsec_vanni_test_secret_123';

    function signPayload(body: string, secret: string): string {
      return crypto.createHmac('sha256', secret).update(body).digest('hex');
    }

    it('rejects forged webhook signatures with HTTP 401', async () => {
      const payload = JSON.stringify({
        event: 'payment.captured',
        entity: 'event',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/billing/webhooks/razorpay',
        headers: {
          'x-razorpay-signature': 'forged_fake_signature_abc123',
          'content-type': 'application/json',
        },
        payload,
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe('INVALID_SIGNATURE');
    });

    it('activates subscription and records payment on verified payment.captured webhook', async () => {
      const paymentId = `pay_${Date.now()}`;
      const eventId = `evt_pay_${Date.now()}`;

      const rawPayload = {
        entity: 'event',
        event: 'payment.captured',
        id: eventId,
        contains: ['payment'],
        payload: {
          payment: {
            entity: {
              id: paymentId,
              order_id: 'order_test_123',
              amount: 499900, // ₹4,999 in paise
              currency: 'INR',
              status: 'captured',
              method: 'upi',
              notes: {
                organization_id: testOrgId,
              },
            },
          },
        },
      };

      const bodyStr = JSON.stringify(rawPayload);
      const signature = signPayload(bodyStr, webhookSecret);

      const res = await app.inject({
        method: 'POST',
        url: '/api/billing/webhooks/razorpay',
        headers: {
          'x-razorpay-signature': signature,
          'content-type': 'application/json',
        },
        payload: bodyStr,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('PROCESSED');

      // Subscription should be ACTIVE
      const sub = await globalDb.getSubscription(testOrgId);
      expect(sub?.status).toBe('ACTIVE');

      // Payment record should be persisted
      const payments = await globalDb.getPaymentRecords(testOrgId);
      const recordedPay = payments.find(p => p.providerPaymentId === paymentId);
      expect(recordedPay).toBeDefined();
      expect(recordedPay?.amount).toBe(4999);
      expect(recordedPay?.status).toBe('CAPTURED');
    });

    it('handles duplicate webhook events idempotently', async () => {
      const eventId = `evt_dup_${Date.now()}`;
      const rawPayload = {
        entity: 'event',
        event: 'payment.captured',
        id: eventId,
        contains: ['payment'],
        payload: {
          payment: {
            entity: {
              id: `pay_dup_${Date.now()}`,
              amount: 499900,
              currency: 'INR',
              notes: { organization_id: testOrgId },
            },
          },
        },
      };

      const bodyStr = JSON.stringify(rawPayload);
      const signature = signPayload(bodyStr, webhookSecret);

      // First webhook
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/billing/webhooks/razorpay',
        headers: {
          'x-razorpay-signature': signature,
          'content-type': 'application/json',
        },
        payload: bodyStr,
      });
      expect(res1.statusCode).toBe(200);
      expect(res1.json().status).toBe('PROCESSED');

      // Replayed webhook with same eventId
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/billing/webhooks/razorpay',
        headers: {
          'x-razorpay-signature': signature,
          'content-type': 'application/json',
        },
        payload: bodyStr,
      });
      expect(res2.statusCode).toBe(200);
      expect(res2.json().status).toBe('IGNORED_DUPLICATE');
    });

    it('transitions subscription to PAST_DUE on payment.failed event', async () => {
      const eventId = `evt_fail_${Date.now()}`;
      const rawPayload = {
        entity: 'event',
        event: 'payment.failed',
        id: eventId,
        contains: ['payment'],
        payload: {
          payment: {
            entity: {
              id: `pay_fail_${Date.now()}`,
              amount: 499900,
              notes: { organization_id: testOrgId },
            },
          },
        },
      };

      const bodyStr = JSON.stringify(rawPayload);
      const signature = signPayload(bodyStr, webhookSecret);

      const res = await app.inject({
        method: 'POST',
        url: '/api/billing/webhooks/razorpay',
        headers: {
          'x-razorpay-signature': signature,
          'content-type': 'application/json',
        },
        payload: bodyStr,
      });

      expect(res.statusCode).toBe(200);

      const sub = await globalDb.getSubscription(testOrgId);
      expect(sub?.status).toBe('PAST_DUE');

      // Verify entitlement blocks calls when PAST_DUE
      const minuteCheck = await globalEntitlementEngine.canConsumeVoiceMinutes(testOrgId, 1);
      expect(minuteCheck.allowed).toBe(false);
      expect(minuteCheck.reason).toContain('PAST_DUE');
    });

    it('extends billing period on subscription.charged renewal event', async () => {
      const eventId = `evt_renew_${Date.now()}`;
      const rawPayload = {
        entity: 'event',
        event: 'subscription.charged',
        id: eventId,
        contains: ['subscription'],
        payload: {
          subscription: {
            entity: {
              id: `sub_rzp_${Date.now()}`,
              plan_id: 'plan_starter',
              notes: { organization_id: testOrgId },
            },
          },
        },
      };

      const bodyStr = JSON.stringify(rawPayload);
      const signature = signPayload(bodyStr, webhookSecret);

      const res = await app.inject({
        method: 'POST',
        url: '/api/billing/webhooks/razorpay',
        headers: {
          'x-razorpay-signature': signature,
          'content-type': 'application/json',
        },
        payload: bodyStr,
      });

      expect(res.statusCode).toBe(200);

      const events = await globalDb.getSubscriptionEvents(testOrgId);
      const renewEvent = events.find(e => e.eventType === 'RENEWED');
      expect(renewEvent).toBeDefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Honest Unconfigured Gateway & Multi-Tenant Snapshot
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Honest Gateway Reporting & Multi-Tenant Snapshot', () => {
    it('honestly distinguishes unconfigured sandbox from live credentials', async () => {
      const snapshot = await globalDb.getBillingSnapshot(testOrgId);
      expect(snapshot).toBeDefined();
      expect(snapshot.organizationId).toBe(testOrgId);
      expect(snapshot.plan.id).toBe('plan_starter');
      expect(snapshot.usageSummary.voiceMinutesState).toBe('AVAILABLE');

      // Multi-tenant client workspace breakdown should list Dr. Ramesh Dental Clinic
      expect(snapshot.clientUsageBreakdown).toBeDefined();
      const clientEntry = snapshot.clientUsageBreakdown?.find(c => c.clientWorkspaceId === testClientWsId);
      expect(clientEntry).toBeDefined();
      expect(clientEntry?.clientName).toBe('Dr. Ramesh Dental Clinic');
    });
  });
});
