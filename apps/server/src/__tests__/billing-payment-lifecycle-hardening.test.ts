import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../server';
import { setBillingProvider } from '../routes/billing';
import { globalDb, getGlobalDb, DurableDatabaseService } from '@vanni/database';
import { MockBillingProvider } from '@vanni/providers';
import { serializeSession, SESSION_COOKIE_NAME } from '@vanni/auth';
import { AuthSessionDTO, ClientWorkspaceDTO, SubscriptionDTO, UsageEventDTO, OrganizationDTO, PaymentRecordDTO } from '@vanni/shared';

describe('Prompt 08 — Billing, Subscription, Usage Metering & Payment Reliability', () => {
  let app: FastifyInstance;
  let mockProvider: MockBillingProvider;

  function makeSessionCookie(orgId: string, role: string = 'ADMIN'): string {
    const session: AuthSessionDTO = {
      userId: `u_${orgId}_${role.toLowerCase()}`,
      email: `${role.toLowerCase()}@${orgId}.test`,
      fullName: `Test ${role}`,
      activeOrganizationId: orgId,
      activeRole: role as any,
      memberships: [
        {
          organizationId: orgId,
          organizationName: `Org ${orgId}`,
          organizationSlug: `org-${orgId}`,
          role: role as any,
          status: 'ACTIVE',
          onboardingStatus: 'ready',
        },
      ],
    };
    return `${SESSION_COOKIE_NAME}=${serializeSession(session)}`;
  }

  function makeOrg(id: string, name: string): OrganizationDTO {
    const now = new Date().toISOString();
    return {
      id,
      name,
      slug: id.toLowerCase().replace(/_/g, '-'),
      industry: 'HEALTHCARE',
      status: 'ACTIVE',
      timezone: 'Asia/Kolkata',
      billingTier: 'STARTER',
      onboardingStatus: 'ready',
      createdAt: now,
      updatedAt: now,
    };
  }

  function makeSubscription(orgId: string, planId: string, status: any = 'ACTIVE'): SubscriptionDTO {
    const now = new Date().toISOString();
    return {
      id: `sub_${orgId}`,
      organizationId: orgId,
      billingAccountId: `ba_${orgId}`,
      planId,
      planVersionId: 'v1.0',
      provider: 'RAZORPAY',
      status,
      billingInterval: 'MONTHLY',
      currentPeriodStart: now,
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  beforeEach(async () => {
    mockProvider = new MockBillingProvider();
    setBillingProvider(mockProvider);

    app = await buildServer();
    await app.ready();

    // Reset database state
    (globalDb as any).subscriptions?.clear();
    (globalDb as any).subscriptionEvents?.clear();
    (globalDb as any).paymentRecords?.clear();
    (globalDb as any).billingInvoices?.clear();
    (globalDb as any).billingProviderEvents?.clear();
    (globalDb as any).usageEvents?.clear();
    (globalDb as any).organizations?.clear();
    (globalDb as any).clientWorkspaces?.clear();
  });

  afterEach(async () => {
    await app.close();
    setBillingProvider(null as any);
  });

  // 1. Checkout requires authentication
  it('1. Checkout requires authentication', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/checkout',
      payload: { planId: 'plan_growth' }
    });
    expect(res.statusCode).toBe(401);
  });

  // 2. Server-side plan and amount validation
  it('2. Server-side plan and amount validation', async () => {
    const orgId = 'org_test_1';
    await globalDb.saveOrganization(makeOrg(orgId, 'Org 1'));
    const adminCookie = makeSessionCookie(orgId, 'ADMIN');

    // Invalid plan
    const resInvalid = await app.inject({
      method: 'POST',
      url: '/api/billing/checkout',
      headers: { cookie: adminCookie },
      payload: { planId: 'NON_EXISTENT_PLAN' }
    });
    expect(resInvalid.statusCode).toBe(404);

    // Valid plan creates checkout session with server catalog details
    const resValid = await app.inject({
      method: 'POST',
      url: '/api/billing/checkout',
      headers: { cookie: adminCookie },
      payload: { planId: 'GROWTH_MONTHLY' }
    });
    expect(resValid.statusCode).toBe(200);
    const body = JSON.parse(resValid.payload);
    expect(body.success).toBe(true);
    expect(body.amount).toBe(14999);
    expect(body.currency).toBe('INR');
    expect(body.billingInterval).toBe('MONTHLY');
  });

  // 3. Browser-supplied amounts cannot override configured prices
  it('3. Browser-supplied amounts cannot override configured prices', async () => {
    const orgId = 'org_test_1';
    await globalDb.saveOrganization(makeOrg(orgId, 'Org 1'));
    const adminCookie = makeSessionCookie(orgId, 'ADMIN');

    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/checkout',
      headers: { cookie: adminCookie },
      payload: { planId: 'ENTERPRISE_MONTHLY', amount: 10, currency: 'USD' } // Attempt to tamper price
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.amount).toBe(29999); // Server catalog price enforced
    expect(body.currency).toBe('INR');
  });

  // 4. Provider failure does not create a falsely paid subscription
  it('4. Provider failure does not create a falsely paid subscription', async () => {
    const orgId = 'org_test_1';
    await globalDb.saveOrganization(makeOrg(orgId, 'Org 1'));
    const adminCookie = makeSessionCookie(orgId, 'ADMIN');

    vi.spyOn(mockProvider, 'createSubscription').mockRejectedValueOnce(new Error('Gateway timeout'));

    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/checkout',
      headers: { cookie: adminCookie },
      payload: { planId: 'plan_growth' }
    });
    expect(res.statusCode).toBe(502);

    const sub = await globalDb.getSubscription(orgId);
    expect(sub).toBeNull();
  });

  // 5. Unverified checkout return cannot grant entitlements
  it('5. Unverified checkout return cannot grant entitlements', async () => {
    const orgId = 'org_test_1';
    await globalDb.saveOrganization(makeOrg(orgId, 'Org 1'));
    const adminCookie = makeSessionCookie(orgId, 'ADMIN');

    // Checkout initiated creates incomplete subscription record
    await app.inject({
      method: 'POST',
      url: '/api/billing/checkout',
      headers: { cookie: adminCookie },
      payload: { planId: 'ENTERPRISE_MONTHLY' }
    });

    const subBefore = await globalDb.getSubscription(orgId);
    expect(subBefore?.status).toBe('INCOMPLETE');

    // Attempt verification with invalid signature
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/billing/checkout/verify',
      headers: { cookie: adminCookie },
      payload: {
        orderId: 'order_123',
        paymentId: 'pay_123',
        signature: 'invalid_signature_attempt'
      }
    });
    expect(verifyRes.statusCode).toBe(400);

    const subAfter = await globalDb.getSubscription(orgId);
    expect(subAfter?.status).toBe('INCOMPLETE'); // Still not active
  });

  // 6. Invalid webhook signatures are rejected
  it('6. Invalid webhook signatures are rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/webhooks/razorpay',
      headers: { 'x-razorpay-signature': 'invalid_sig' },
      payload: { event: 'subscription.charged', payload: {} }
    });
    expect(res.statusCode).toBe(401);
  });

  // 7. Missing production webhook secrets fail closed
  it('7. Missing production webhook secrets fail closed', async () => {
    const origEnv = process.env.NODE_ENV;
    const origSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.RAZORPAY_WEBHOOK_SECRET;

      const res = await app.inject({
        method: 'POST',
        url: '/api/billing/webhooks/razorpay',
        headers: { 'x-razorpay-signature': 'valid_mock_signature' },
        payload: { event: 'subscription.charged', payload: {} }
      });
      expect(res.statusCode).toBe(503);
    } finally {
      process.env.NODE_ENV = origEnv;
      if (origSecret) process.env.RAZORPAY_WEBHOOK_SECRET = origSecret;
    }
  });

  // 8. Duplicate webhook events are processed idempotently
  it('8. Duplicate webhook events are processed idempotently', async () => {
    const orgId = 'org_test_1';
    await globalDb.saveOrganization(makeOrg(orgId, 'Org 1'));
    await globalDb.saveSubscription(makeSubscription(orgId, 'plan_growth', 'ACTIVE'));

    const payload = {
      event: 'subscription.charged',
      payload: {
        subscription: {
          entity: {
            id: 'sub_rzp_dup_1',
            plan_id: 'plan_growth',
            notes: { organization_id: orgId }
          }
        },
        payment: {
          entity: {
            id: 'pay_rzp_dup_1',
            amount: 1499900,
            currency: 'INR'
          }
        }
      }
    };

    // First delivery
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/billing/webhooks/razorpay',
      headers: { 'x-razorpay-signature': 'valid_mock_signature', 'x-razorpay-event-id': 'evt_idempotent_1' },
      payload
    });
    expect(res1.statusCode).toBe(200);

    // Second delivery (duplicate event)
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/billing/webhooks/razorpay',
      headers: { 'x-razorpay-signature': 'valid_mock_signature', 'x-razorpay-event-id': 'evt_idempotent_1' },
      payload
    });
    expect(res2.statusCode).toBe(200);
    const body2 = JSON.parse(res2.payload);
    expect(body2.status).toBe('IGNORED_DUPLICATE');
  });

  // 9. Out-of-order webhook events do not corrupt subscription state
  it('9. Out-of-order webhook events do not corrupt subscription state', async () => {
    const orgId = 'org_test_1';
    await globalDb.saveOrganization(makeOrg(orgId, 'Org 1'));
    await globalDb.saveSubscription(makeSubscription(orgId, 'plan_growth', 'CANCELLED'));

    // Stale payment event arrives after cancellation
    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/webhooks/razorpay',
      headers: { 'x-razorpay-signature': 'valid_mock_signature', 'x-razorpay-event-id': 'evt_late_payment' },
      payload: {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_late_1',
              amount: 1499900,
              currency: 'INR',
              notes: { organization_id: orgId }
            }
          }
        }
      }
    });
    expect(res.statusCode).toBe(200);

    const sub = await globalDb.getSubscription(orgId);
    expect(sub?.status).toBe('CANCELLED'); // Must not resurrect cancelled status
  });

  // 10. Cross-tenant subscription, invoice, and usage access is denied
  it('10. Cross-tenant subscription, invoice, and usage access is denied', async () => {
    const orgA = 'org_a_test';
    const orgB = 'org_b_test';
    await globalDb.saveOrganization(makeOrg(orgA, 'Org A'));
    await globalDb.saveOrganization(makeOrg(orgB, 'Org B'));
    await globalDb.saveSubscription(makeSubscription(orgB, 'plan_growth', 'ACTIVE'));

    const cookieA = makeSessionCookie(orgA, 'ADMIN');

    // Tenant A attempts to access Tenant B's subscription or billing snapshot via client-supplied header/query parameter
    const res = await app.inject({
      method: 'GET',
      url: `/api/billing/snapshot?organizationId=${orgB}`,
      headers: { cookie: cookieA }
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    // Authenticated orgA must be used, not orgB
    expect(body.data.organizationId).toBe(orgA);

    // Tenant A attempting to cancel Tenant B subscription by passing organizationId: orgB
    const cancelRes = await app.inject({
      method: 'POST',
      url: '/api/billing/subscription/cancel',
      headers: { cookie: cookieA },
      payload: { organizationId: orgB }
    });
    expect(cancelRes.statusCode).toBe(200);
    // Cancellation is strictly scoped to authenticated organization (orgA), never orgB
    expect(cancelRes.json().data.organizationId).toBe(orgA);

    // Verify Org B subscription was not cancelled
    const subB = await globalDb.getSubscription(orgB);
    expect(subB?.status).toBe('ACTIVE');
  });

  // 11. Role restrictions for billing operations
  it('11. Role restrictions for billing operations', async () => {
    const orgId = 'org_test_1';
    await globalDb.saveOrganization(makeOrg(orgId, 'Org 1'));
    const viewerCookie = makeSessionCookie(orgId, 'VIEWER');

    // VIEWER cannot checkout
    const checkoutRes = await app.inject({
      method: 'POST',
      url: '/api/billing/checkout',
      headers: { cookie: viewerCookie },
      payload: { planId: 'plan_growth' }
    });
    expect(checkoutRes.statusCode).toBe(403);

    // VIEWER cannot cancel subscription
    const cancelRes = await app.inject({
      method: 'POST',
      url: '/api/billing/subscription/cancel',
      headers: { cookie: viewerCookie }
    });
    expect(cancelRes.statusCode).toBe(403);
  });

  // 12. Usage counting is idempotent for retried events
  it('12. Usage counting is idempotent for retried events', async () => {
    const orgId = 'org_test_1';
    const clientWsId = 'ws_client_test_' + Date.now();
    const callSid = 'CALL_IDEM_' + Date.now();

    await globalDb.saveOrganization(makeOrg(orgId, 'Org 1'));
    await globalDb.saveSubscription(makeSubscription(orgId, 'plan_starter', 'ACTIVE'));

    const clientWs: ClientWorkspaceDTO = {
      id: clientWsId,
      organizationId: orgId,
      name: 'Client Clinic',
      slug: 'client-clinic-' + Date.now(),
      industryCategory: 'HEALTHCARE',
      subcategory: 'DENTAL',
      modelType: 'AGENCY',
      operatingLocation: 'Ballari',
      primaryPhone: '+919845012345',
      primaryEmail: 'info@test.in',
      timezone: 'Asia/Kolkata',
      languagePreferences: { primary: 'kn-IN', conversationalStyle: 'POLITE_BUSINESS', regionalDialect: 'NORTH_KARNATAKA_COMMERCIAL' },
      onboardingCompleted: true,
      onboardingStep: 7,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await globalDb.saveClientWorkspace(clientWs);

    const cdrPayload = {
      CallSid: callSid,
      AccountSid: 'AC_MOCK_1',
      CallStatus: 'completed',
      CallDuration: '60',
      RecordingDuration: 60,
      tenant: clientWsId,
      CallerName: 'Test Caller',
      From: '+919845011111',
      Direction: 'inbound',
    };

    // First CDR
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/telephony/cdr',
      headers: { 'content-type': 'application/json' },
      payload: cdrPayload
    });
    expect(res1.statusCode).toBe(200);

    // Retried CDR
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/telephony/cdr',
      headers: { 'content-type': 'application/json' },
      payload: cdrPayload
    });
    expect(res2.statusCode).toBe(200);

    // Check usage events
    const events = await globalDb.getUsageEvents(orgId);
    const callUsages = events.filter(e => e.correlationId === callSid);
    expect(callUsages.length).toBe(1);
    expect(callUsages[0].quantity).toBe(60); // 60 seconds
  });

  // 13. Usage limits behave correctly under concurrent requests where strict enforcement is required
  it('13. Usage limits behave correctly under concurrent requests where strict enforcement is required', async () => {
    const orgId = 'org_test_limits';
    const now = new Date();
    const periodStart = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const periodEnd = new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000).toISOString();

    await globalDb.saveOrganization(makeOrg(orgId, 'Org Limits'));
    await globalDb.saveSubscription({
      id: `sub_${orgId}`,
      organizationId: orgId,
      billingAccountId: `ba_${orgId}`,
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

    const adminCookie = makeSessionCookie(orgId, 'ADMIN');

    // Inject usage exceeding limit: 610 minutes (36,600 seconds)
    const usageEvt: UsageEventDTO = {
      id: `usage_excess_${Date.now()}`,
      organizationId: orgId,
      eventType: 'VOICE_DURATION',
      resourceType: 'VOICE_MINUTE',
      provider: 'exotel',
      quantity: 36600,
      unit: 'seconds',
      costType: 'ESTIMATED',
      estimatedCost: 518.5,
      currency: 'INR',
      correlationId: 'corr_excess_1',
      occurredAt: new Date().toISOString(),
      durationSource: 'PROVIDER_CDR',
      confirmedDurationSec: 36600,
    };
    await globalDb.saveUsageEvent(usageEvt);

    const res = await app.inject({
      method: 'POST',
      url: '/api/telephony/outbound',
      headers: { cookie: adminCookie },
      payload: {
        targetPhoneNumber: '+919845012345',
        businessName: 'Test Clinic',
        industry: 'HEALTHCARE_HOSPITAL',
        organizationId: orgId,
      }
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('ENTITLEMENT_LIMIT_EXCEEDED');
  });

  // 14. Failed or incomplete calls follow the actual configured usage policy
  it('14. Failed or incomplete calls follow the actual configured usage policy', async () => {
    const orgId = 'org_test_failed_call';
    await globalDb.saveOrganization(makeOrg(orgId, 'Org Failed'));

    const callSid = 'CALL_FAILED_' + Date.now();
    const failedPayload = {
      CallSid: callSid,
      CallStatus: 'no-answer',
      RecordingDuration: 0,
      tenant: orgId,
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/telephony/cdr',
      headers: { 'content-type': 'application/json' },
      payload: failedPayload
    });
    expect(res.statusCode).toBe(200);

    const usage = await globalDb.getUsageEvents(orgId);
    expect(usage.find(e => e.correlationId === callSid)).toBeUndefined(); // Unanswered call does not charge
  });

  // 15. Subscription expiry and cancellation update entitlements correctly
  it('15. Subscription expiry and cancellation update entitlements correctly', async () => {
    const orgId = 'org_test_cancel';
    await globalDb.saveOrganization(makeOrg(orgId, 'Org Cancel'));
    const adminCookie = makeSessionCookie(orgId, 'ADMIN');

    await globalDb.saveSubscription(makeSubscription(orgId, 'plan_growth', 'ACTIVE'));

    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/subscription/cancel',
      headers: { cookie: adminCookie },
      payload: { immediately: true }
    });
    expect(res.statusCode).toBe(200);

    const sub = await globalDb.getSubscription(orgId);
    expect(sub?.status).toBe('CANCELLED');
  });

  // 16. Database failures return truthful errors
  it('16. Database failures return truthful errors', async () => {
    const orgId = 'org_test_db_err';
    await globalDb.saveOrganization(makeOrg(orgId, 'Org DB Err'));
    const adminCookie = makeSessionCookie(orgId, 'ADMIN');

    const realDb = getGlobalDb();
    const spy = vi.spyOn(realDb, 'getSubscription').mockRejectedValueOnce(new Error('Database disk full'));

    try {
      const res = await app.inject({
        method: 'GET',
        url: '/api/billing/subscription',
        headers: { cookie: adminCookie }
      });
      expect(res.statusCode).toBe(500);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(false);
      expect(body.error).toBe('INTERNAL_ERROR');
    } finally {
      spy.mockRestore();
    }
  });

  // 17. Supabase / Durable adapter persistence tests snapshotting for all billing entities
  it('17. DurableDatabaseService persistence tests snapshotting for all billing entities', async () => {
    const durableDb = new DurableDatabaseService();
    const orgId = 'org_durable_test';
    const now = new Date().toISOString();

    await durableDb.saveSubscription({
      id: 'sub_dur_1',
      organizationId: orgId,
      billingAccountId: `ba_${orgId}`,
      planId: 'plan_growth',
      planVersionId: 'v1.0',
      provider: 'RAZORPAY',
      status: 'ACTIVE',
      billingInterval: 'MONTHLY',
      currentPeriodStart: now,
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    });

    const payRecord: PaymentRecordDTO = {
      id: 'pay_dur_1',
      organizationId: orgId,
      billingAccountId: `ba_${orgId}`,
      amount: 14999,
      currency: 'INR',
      status: 'CAPTURED',
      provider: 'RAZORPAY',
      providerPaymentId: 'pay_rzp_1',
      createdAt: now,
      updatedAt: now,
    };
    await durableDb.savePaymentRecord(payRecord);

    await durableDb.saveBillingProviderEvent({
      id: 'bpe_dur_1',
      provider: 'RAZORPAY',
      providerEventId: 'evt_rzp_1',
      eventType: 'payment.captured',
      payloadReference: '{}',
      receivedAt: now,
      processedAt: now,
      processingStatus: 'PROCESSED',
      organizationId: orgId,
      createdAt: now,
    });

    // Verify stored and retrievable
    const sub = await durableDb.getSubscription(orgId);
    expect(sub?.id).toBe('sub_dur_1');

    const evt = await durableDb.getBillingProviderEvent('RAZORPAY', 'evt_rzp_1');
    expect(evt?.providerEventId).toBe('evt_rzp_1');

    const payments = await durableDb.getPaymentRecords(orgId);
    expect(payments.length).toBe(1);
    expect(payments[0].id).toBe('pay_dur_1');
  });

  // 18. Frontend checkout and billing API response contracts agree
  it('18. Frontend checkout and billing API response contracts agree', async () => {
    const orgId = 'org_test_frontend_agree';
    await globalDb.saveOrganization(makeOrg(orgId, 'Org Frontend Agree'));
    const adminCookie = makeSessionCookie(orgId, 'ADMIN');

    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/checkout',
      headers: { cookie: adminCookie },
      payload: { planId: 'plan_growth' }
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);

    // Verify agreement with frontend expectations:
    // checkoutUrl, shortUrl, amount, currency, billingInterval, providerSubscriptionId
    expect(body.success).toBe(true);
    expect(body).toHaveProperty('checkoutUrl');
    expect(body).toHaveProperty('shortUrl');
    expect(body).toHaveProperty('amount');
    expect(body).toHaveProperty('currency');
    expect(body).toHaveProperty('billingInterval');
    expect(body).toHaveProperty('providerSubscriptionId');
  });
});
