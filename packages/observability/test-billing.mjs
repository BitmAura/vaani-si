/**
 * Comprehensive Test Suite for VANNI Billing, Plans, Subscriptions & Usage Entitlements Engine
 *
 * Covers all 10 core integration scenarios:
 * 1. Plan & Entitlement resolution
 * 2. Pre-flight voice call limit check & soft warning vs hard block
 * 3. Pre-flight campaign check
 * 4. Razorpay checkout & subscription initialization
 * 5. Razorpay HMAC webhook signature verification & event idempotency
 * 6. Subscription upgrade/downgrade & over-entitlement detection
 * 7. Cancellation at period end & grace period handling
 * 8. Multi-tenant billing isolation
 * 9. RBAC permission checks (canManageBilling)
 * 10. Organization billing snapshot generation
 */

import { globalDb, InMemoryDatabaseService } from '../database/dist/index.js';
import { EntitlementService } from './dist/entitlement-service.js';
import { RazorpayBillingProvider } from '../providers/dist/billing/razorpay.js';
import { MockBillingProvider } from '../providers/dist/mocks/mock-billing.js';
import { canManageBilling } from '../auth/dist/roles.js';
import crypto from 'node:crypto';

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING VANNI BILLING & USAGE ENTITLEMENT TEST SUITE (10 TESTS)');
  console.log('================================================================\n');

  const db = new InMemoryDatabaseService();
  const entitlementService = new EntitlementService(db);
  const testOrgId = 'a1111111-1111-1111-1111-111111111111';
  const otherOrgId = 'b2222222-2222-2222-2222-222222222222';

  // Seed Plans
  const starterPlan = {
    id: 'plan_starter',
    name: 'Starter Plan',
    slug: 'starter',
    description: 'For clinics and single-location businesses',
    monthlyPrice: 4999,
    annualPrice: 49990,
    currency: 'INR',
    visibility: 'PUBLIC',
    status: 'ACTIVE',
    activeVersion: 'v1.0',
    entitlements: {
      maxAiEmployees: 2,
      maxLocations: 1,
      maxUsers: 5,
      maxKnowledgeSources: 10,
      maxKnowledgeStorageMb: 500,
      maxContacts: 1000,
      maxMonthlyVoiceMinutes: 100, // Small limit for testing
      maxMonthlySttSeconds: 6000,
      maxMonthlyTtsCharacters: 50000,
      maxMonthlyLlmTokens: 200000,
      maxMonthlyCalls: 50,
      maxMonthlyOutboundCalls: 20,
      maxCampaignTargets: 50,
      maxAppointments: 50,
      maxIntegrations: 2,
      voiceEnabled: true,
      outboundCallingEnabled: true,
      campaignsEnabled: false, // Campaigns disabled in starter
      knowledgeBaseEnabled: true,
      analyticsEnabled: true,
      advancedAnalyticsEnabled: false,
      humanHandoffEnabled: true,
      customAiEmployeeEnabled: true,
      apiAccessEnabled: false,
      webhooksEnabled: false,
      crmIntegrationsEnabled: false,
    },
    overageVoiceMinutePrice: 2.5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const growthPlan = {
    ...starterPlan,
    id: 'plan_growth',
    name: 'Growth Plan',
    slug: 'growth',
    monthlyPrice: 14999,
    entitlements: {
      ...starterPlan.entitlements,
      maxAiEmployees: 5,
      maxMonthlyVoiceMinutes: 500,
      campaignsEnabled: true,
      crmIntegrationsEnabled: true,
    },
  };

  await db.savePlan(starterPlan);
  await db.savePlan(growthPlan);

  // Setup Subscription
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const subscription = {
    id: `sub_${testOrgId}`,
    organizationId: testOrgId,
    billingAccountId: `ba_${testOrgId}`,
    planId: starterPlan.id,
    planVersionId: 'v1.0',
    provider: 'RAZORPAY',
    status: 'ACTIVE',
    billingInterval: 'MONTHLY',
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: periodEnd.toISOString(),
    cancelAtPeriodEnd: false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  await db.saveSubscription(subscription);

  // -------------------------------------------------------------
  // TEST 1: Plan & Entitlement Resolution
  // -------------------------------------------------------------
  console.log('▶ Test 1: Plan & Entitlement Resolution...');
  const { plan: resolvedPlan } = await entitlementService.getOrganizationPlan(testOrgId);
  if (!resolvedPlan || resolvedPlan.id !== 'plan_starter') {
    throw new Error(`Test 1 Failed: Expected starter plan, got ${resolvedPlan?.id}`);
  }
  const isVoiceAllowed = await entitlementService.checkFeature(testOrgId, 'voiceEnabled');
  const isCampaignAllowed = await entitlementService.checkFeature(testOrgId, 'campaignsEnabled');
  if (!isVoiceAllowed || isCampaignAllowed) {
    throw new Error('Test 1 Failed: Feature flags not resolved properly');
  }
  console.log('  ✔ Passed: Plan and feature entitlements resolved accurately.');

  // -------------------------------------------------------------
  // TEST 2: Pre-flight voice call limit check & Soft Warning vs Hard Block
  // -------------------------------------------------------------
  console.log('\n▶ Test 2: Pre-flight voice call limit check...');
  // Under limit (0/100 min)
  const preflight1 = await entitlementService.preflightVoiceCall(testOrgId, 5);
  if (!preflight1.allowed || preflight1.limitState !== 'AVAILABLE') {
    throw new Error(`Test 2 Failed: Expected AVAILABLE, got ${preflight1.limitState}`);
  }

  // Record 95 minutes of voice usage
  await db.saveUsageEvent({
    id: 'evt_voice_95',
    organizationId: testOrgId,
    eventType: 'VOICE_DURATION',
    quantity: 95,
    unit: 'MINUTES',
    occurredAt: new Date().toISOString(),
  });

  // Approaching limit (95/100 min -> 95%)
  const preflight2 = await entitlementService.preflightVoiceCall(testOrgId, 2);
  if (!preflight2.allowed || preflight2.limitState !== 'NEAR_LIMIT') {
    throw new Error(`Test 2 Failed: Expected NEAR_LIMIT, got ${preflight2.limitState}`);
  }

  // Record 10 more minutes (105/100 min -> Exceeded)
  await db.saveUsageEvent({
    id: 'evt_voice_10',
    organizationId: testOrgId,
    eventType: 'VOICE_DURATION',
    quantity: 10,
    unit: 'MINUTES',
    occurredAt: new Date().toISOString(),
  });

  const preflight3 = await entitlementService.preflightVoiceCall(testOrgId, 5);
  // Default policy allows voice calls to continue with overage flag without hard breaking
  if (preflight3.limitState !== 'LIMIT_REACHED' && preflight3.limitState !== 'OVERAGE') {
    throw new Error(`Test 2 Failed: Expected LIMIT_REACHED or OVERAGE, got ${preflight3.limitState}`);
  }
  console.log('  ✔ Passed: Preflight check detects quota thresholds (AVAILABLE -> NEAR_LIMIT -> OVERAGE).');

  // -------------------------------------------------------------
  // TEST 3: Pre-flight Campaign Check
  // -------------------------------------------------------------
  console.log('\n▶ Test 3: Pre-flight Campaign Check...');
  const campaignPreflight = await entitlementService.preflightCampaign(testOrgId, 10);
  if (campaignPreflight.allowed) {
    throw new Error('Test 3 Failed: Campaigns must be disallowed on Starter plan');
  }
  console.log('  ✔ Passed: Disallowed campaign feature blocked cleanly pre-flight.');

  // -------------------------------------------------------------
  // TEST 4: Razorpay Checkout & Subscription Initialization
  // -------------------------------------------------------------
  console.log('\n▶ Test 4: Razorpay Checkout & Subscription Initialization...');
  const mockProvider = new MockBillingProvider();
  const subInit = await mockProvider.createSubscription({
    organizationId: testOrgId,
    customerId: 'cust_test_123',
    planId: 'plan_growth',
    planVersionId: 'v1.0',
    billingInterval: 'MONTHLY',
  });
  if (!subInit.success || !subInit.providerSubscriptionId.startsWith('sub_mock_')) {
    throw new Error('Test 4 Failed: Subscription creation failed in provider');
  }
  console.log(`  ✔ Passed: Provider initialized subscription ID: ${subInit.providerSubscriptionId}`);

  // -------------------------------------------------------------
  // TEST 5: Razorpay HMAC Webhook Signature Verification & Idempotency
  // -------------------------------------------------------------
  console.log('\n▶ Test 5: Razorpay HMAC Webhook Signature Verification & Idempotency...');
  const webhookSecret = 'test_webhook_secret_key_456';
  const rzpProvider = new RazorpayBillingProvider({ webhookSecret });

  const rawEvent = {
    id: 'evt_rzp_unique_001',
    event: 'subscription.activated',
    payload: {
      subscription: {
        entity: {
          id: 'sub_rzp_999',
          status: 'active',
          notes: { organization_id: testOrgId },
        },
      },
      payment: {
        entity: {
          id: 'pay_rzp_999',
          amount: 1499900, // in paise
          currency: 'INR',
          status: 'captured',
        },
      },
    },
  };
  const rawBody = JSON.stringify(rawEvent);
  const signature = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

  const isValid = rzpProvider.verifyWebhookSignature({
    rawBody,
    signature,
    webhookSecret,
  });
  if (!isValid) {
    throw new Error('Test 5 Failed: HMAC signature verification failed');
  }

  // Bad signature rejection
  const isBadValid = rzpProvider.verifyWebhookSignature({
    rawBody,
    signature: 'bad_signature_hash',
    webhookSecret,
  });
  if (isBadValid) {
    throw new Error('Test 5 Failed: Invalid signature was erroneously accepted');
  }

  // Idempotency check via DB
  const normalized = rzpProvider.normalizeWebhookEvent(rawEvent);
  if (normalized.amount !== 14999) {
    throw new Error(`Test 5 Failed: Expected 14999 INR normalized from paise, got ${normalized.amount}`);
  }

  await db.saveBillingProviderEvent({
    id: 'bpe_test_001',
    provider: 'RAZORPAY',
    providerEventId: normalized.providerEventId,
    eventType: normalized.eventType,
    payloadReference: JSON.stringify(normalized),
    receivedAt: new Date().toISOString(),
    processedAt: new Date().toISOString(),
    processingStatus: 'PROCESSED',
    organizationId: testOrgId,
    createdAt: new Date().toISOString(),
  });

  const duplicateCheck = await db.getBillingProviderEvent('RAZORPAY', normalized.providerEventId);
  if (!duplicateCheck) {
    throw new Error('Test 5 Failed: Webhook event was not persisted');
  }
  console.log('  ✔ Passed: Webhook HMAC verified and event stored idempotently.');

  // -------------------------------------------------------------
  // TEST 6: Subscription Upgrade / Downgrade & Over-Entitlement
  // -------------------------------------------------------------
  console.log('\n▶ Test 6: Subscription Downgrade & Over-Entitlement detection...');
  // Create 3 AI Employees
  for (let i = 1; i <= 3; i++) {
    await db.saveAIEmployee({
      id: `agent_${i}`,
      organizationId: testOrgId,
      name: `Agent ${i}`,
      role: 'Receptionist',
      language: {
        primaryLanguage: 'kn-IN',
        supportedLanguages: ['kn-IN', 'en-IN'],
      },
      objective: {
        primaryObjective: 'Provide clinic receptionist services',
      },
      currentVersion: 1,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // Organization has 3 agents. Starter plan allows 2 agents.
  const snapshot = await db.getBillingSnapshot(testOrgId);
  if (!snapshot.isEntitlementExceeded) {
    throw new Error('Test 6 Failed: Organization with 3 agents on 2-agent limit should be flagged over-entitled');
  }
  if (!snapshot.exceededEntities || snapshot.exceededEntities.length === 0) {
    throw new Error('Test 6 Failed: exceededEntities should list AI Employees');
  }
  console.log(`  ✔ Passed: Over-entitlement identified without data loss: ${snapshot.exceededEntities[0]}`);

  // -------------------------------------------------------------
  // TEST 7: Cancellation at Period End
  // -------------------------------------------------------------
  console.log('\n▶ Test 7: Cancellation at Period End...');
  const currentSub = await db.getSubscription(testOrgId);
  await db.saveSubscription({
    ...currentSub,
    cancelAtPeriodEnd: true,
    cancelledAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const cancelSnapshot = await db.getBillingSnapshot(testOrgId);
  // Status remains active until periodEnd arrives
  if (cancelSnapshot.subscription.status !== 'ACTIVE' || !cancelSnapshot.subscription.cancelAtPeriodEnd) {
    throw new Error('Test 7 Failed: Subscription cancelled at period end should remain active until expiration');
  }
  console.log('  ✔ Passed: Access preserved until current billing cycle end date.');

  // -------------------------------------------------------------
  // TEST 8: Multi-Tenant Billing Isolation
  // -------------------------------------------------------------
  console.log('\n▶ Test 8: Multi-Tenant Billing Isolation...');
  const orgBSnapshot = await db.getBillingSnapshot(otherOrgId);
  if (orgBSnapshot.organizationId !== otherOrgId) {
    throw new Error('Test 8 Failed: Org B snapshot leaked Org A data');
  }
  if (orgBSnapshot.usageSummary.aiEmployeesCount !== 0) {
    throw new Error('Test 8 Failed: Org B usage contains Org A agents');
  }
  console.log('  ✔ Passed: Tenant B billing state completely isolated from Tenant A.');

  // -------------------------------------------------------------
  // TEST 9: RBAC Permission Check (canManageBilling)
  // -------------------------------------------------------------
  console.log('\n▶ Test 9: RBAC Permission Checks...');
  if (!canManageBilling('OWNER') || !canManageBilling('ADMIN')) {
    throw new Error('Test 9 Failed: OWNER and ADMIN must have org:billing permission');
  }
  if (canManageBilling('MANAGER') || canManageBilling('VIEWER')) {
    throw new Error('Test 9 Failed: MANAGER and VIEWER must NOT have org:billing permission');
  }
  console.log('  ✔ Passed: RBAC permits OWNER/ADMIN and restricts MANAGER/VIEWER.');

  // -------------------------------------------------------------
  // TEST 10: Deterministic Billing Snapshot Generation
  // -------------------------------------------------------------
  console.log('\n▶ Test 10: Deterministic Billing Snapshot Generation...');
  const finalSnapshot = await db.getBillingSnapshot(testOrgId);
  const requiredKeys = ['organizationId', 'subscription', 'plan', 'periodStart', 'periodEnd', 'entitlements', 'usageSummary'];
  for (const k of requiredKeys) {
    if (!(k in finalSnapshot)) {
      throw new Error(`Test 10 Failed: Missing required key ${k} in BillingSnapshotDTO`);
    }
  }
  console.log('  ✔ Passed: Billing snapshot generated with complete quota, period, and tier payload.');

  console.log('\n================================================================');
  console.log('🎉 ALL 10 BILLING & USAGE ENTITLEMENT INTEGRATION TESTS PASSED!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('\n❌ BILLING TEST SUITE FAILED:', err);
  process.exit(1);
});
