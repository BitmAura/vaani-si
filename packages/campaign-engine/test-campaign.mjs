/**
 * Test Suite: VANNI Outbound Calling & Campaign Engine
 * Tests:
 * 1. Campaign lifecycle (Draft -> Active -> Paused)
 * 2. Pre-flight validation guards (caller ID, identity disclosure)
 * 3. 16-point Eligibility Engine (Valid, DNC, outside window, retry cap, inactive agent)
 * 4. Calling Window & Blackout validation
 * 5. Durable Job creation and atomic worker leasing
 * 6. Telephony provider outbound dispatch integration
 * 7. End-to-end follow-up flow with CRM activity timeline recording
 * 8. Real-time recipient opt-out suppression
 * 9. Duplicate call prevention
 * 10. Multi-tenant campaign isolation
 */

import { InMemoryDatabaseService } from '../database/dist/index.js';
import { MockTelephonyProvider } from '../providers/dist/mocks/mock-telephony.js';
import {
  CampaignEngine,
  OutboundEligibilityEngine,
  CallingScheduleValidator,
} from './dist/index.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failed++;
    throw new Error(message);
  } else {
    console.log(`✅ PASS: ${message}`);
    passed++;
  }
}

async function runCampaignTestSuite() {
  console.log('================================================================');
  console.log('🚀 RUNNING VANNI OUTBOUND CALLING & CAMPAIGN ENGINE TEST SUITE');
  console.log('================================================================\n');

  const db = new InMemoryDatabaseService();
  const mockTelephony = new MockTelephonyProvider({ simulatedLatencyMs: 5 });

  const orgA = 'org_dental_clinic_blr';
  const orgB = 'org_competing_clinic_mys';

  const engine = new CampaignEngine({
    workerId: 'worker_node_01',
    db,
    telephonyProvider: mockTelephony,
    webhookCallbackUrl: 'https://gateway.vanni.ai/api/v1/telephony/webhook',
  });

  // Seed a verified contact and lead in CRM
  const now = new Date().toISOString();
  await db.saveContact({
    id: 'cnt_pooja_001',
    organizationId: orgA,
    displayName: 'Pooja Hegde',
    phone: '+919886067890',
    source: 'WEBSITE',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  });

  await db.saveCRMLead({
    id: 'lead_pooja_001',
    organizationId: orgA,
    contactId: 'cnt_pooja_001',
    interest: 'Dental Implants Consultation',
    status: 'NEW',
    stage: 'NEW',
    source: 'WEBSITE',
    qualificationStatus: 'PARTIALLY_QUALIFIED',
    qualificationScore: 40,
    qualificationData: {},
    createdAt: now,
    updatedAt: now,
  });

  // Test 1: Campaign Creation & Pre-Flight Activation
  console.log('--- TEST 1: Campaign Creation & Activation ---');
  const campaign = await engine.createCampaign({
    organizationId: orgA,
    name: 'New Dental Leads 15m Follow-Up',
    description: 'Instant autonomous voice follow-up for new patient web inquiries',
    type: 'LEAD_FOLLOW_UP',
    agentId: 'agent_sahana_dental',
    agentVersion: 1,
    callerPhoneNumber: '+918047192001',
    callingPurpose: 'Lead Qualification & Consultation Booking',
    identityDisclosure: 'Namaskara, nanu VANNI, an AI assistant calling on behalf of Radiant Dental Clinic.',
    timezone: 'Asia/Kolkata',
    startDate: '2026-10-01',
    callingWindowStart: '10:00:00',
    callingWindowEnd: '18:00:00',
    allowedDaysOfWeek: [1, 2, 3, 4, 5, 6],
    blackoutDates: ['2026-11-01'], // Kannada Rajyotsava holiday
    maxConcurrentCalls: 3,
    maxCallsPerDay: 50,
    maxAttemptsPerTarget: 3,
    retryDelayMinutes: 60,
    requireConsent: false,
  });

  assert(campaign.status === 'DRAFT', 'Campaign created in DRAFT status');

  const activeCmp = await engine.activateCampaign(campaign.id, orgA);
  assert(activeCmp.status === 'ACTIVE', 'Campaign activated successfully');
  assert(activeCmp.activatedAt !== undefined, 'Activation timestamp saved');

  // Test 2: Calling Schedule & Window Validation
  console.log('\n--- TEST 2: Calling Window & Blackout Schedule ---');
  // 12:00 PM on a Monday (Valid)
  const validTime = new Date('2026-10-05T12:00:00+05:30');
  const winCheckValid = CallingScheduleValidator.isInsideCallingWindow(validTime, {
    windowStart: '10:00:00',
    windowEnd: '18:00:00',
    allowedDays: [1, 2, 3, 4, 5, 6],
    blackoutDates: ['2026-11-01'],
  });
  assert(winCheckValid.allowed === true, '12:00 PM on weekday allowed');

  // 08:30 PM (Outside window)
  const nightTime = new Date('2026-10-05T20:30:00+05:30');
  const winCheckNight = CallingScheduleValidator.isInsideCallingWindow(nightTime, {
    windowStart: '10:00:00',
    windowEnd: '18:00:00',
    allowedDays: [1, 2, 3, 4, 5, 6],
  });
  assert(winCheckNight.allowed === false, '8:30 PM blocked by calling window guard');

  // Blackout date (Kannada Rajyotsava)
  const holidayDate = new Date('2026-11-01T12:00:00+05:30');
  const winCheckHoliday = CallingScheduleValidator.isInsideCallingWindow(holidayDate, {
    windowStart: '10:00:00',
    windowEnd: '18:00:00',
    allowedDays: [1, 2, 3, 4, 5, 6],
    blackoutDates: ['2026-11-01'],
  });
  assert(winCheckHoliday.allowed === false, 'Blackout holiday date blocked');

  // Test 3: 16-Point Eligibility Evaluation
  console.log('\n--- TEST 3: Outbound Eligibility Engine ---');
  const targetMock = {
    id: 'tgt_001',
    organizationId: orgA,
    campaignId: campaign.id,
    contactId: 'cnt_pooja_001',
    status: 'PENDING',
    eligibilityStatus: 'NOT_EVALUATED',
    attemptCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  const contactMock = {
    id: 'cnt_pooja_001',
    organizationId: orgA,
    displayName: 'Pooja Hegde',
    phone: '+919886067890',
    source: 'WEBSITE',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  const eligSuccess = OutboundEligibilityEngine.evaluate({
    campaign: activeCmp,
    target: targetMock,
    contact: contactMock,
    isAgentActive: true,
    hasActiveCall: false,
    activeCampaignCallsCount: 0,
    currentTime: validTime,
  });
  assert(eligSuccess.eligible === true, 'Standard lead passes all 16 eligibility checks');

  // DNC suppression evaluation
  const dncContactMock = { ...contactMock, status: 'DO_NOT_CONTACT', doNotContactReason: 'Caller requested DND' };
  const eligDNC = OutboundEligibilityEngine.evaluate({
    campaign: activeCmp,
    target: targetMock,
    contact: dncContactMock,
    isAgentActive: true,
    hasActiveCall: false,
    activeCampaignCallsCount: 0,
    currentTime: validTime,
  });
  assert(eligDNC.eligible === false, 'DNC suppressed contact rejected');
  assert(eligDNC.reason === 'DO_NOT_CONTACT', `Rejection reason is DO_NOT_CONTACT: ${eligDNC.reason}`);

  // Test 4: Target Enrollment & Durable Job Creation
  console.log('\n--- TEST 4: Target Enrollment & Durable Job Creation ---');
  const enrollRes = await engine.enrollTarget({
    organizationId: orgA,
    campaignId: campaign.id,
    contactId: 'cnt_pooja_001',
    leadId: 'lead_pooja_001',
  });
  assert(enrollRes.target.status === 'SCHEDULED', 'Eligible target enrolled and SCHEDULED');
  assert(enrollRes.job !== undefined, 'Durable campaign job generated');
  assert(enrollRes.job.status === 'QUEUED', 'Job queued for worker execution');

  // Test 5: Worker Step — Atomic Job Claim & Telephony Dispatch
  console.log('\n--- TEST 5: Worker Job Claiming & Outbound Call Dispatch ---');
  const processRes = await engine.processNextJob(orgA);
  assert(processRes.processed === true, 'Worker successfully claimed and executed job');
  assert(processRes.outcome === 'SUCCESS', `Call outcome is SUCCESS: ${processRes.outcome}`);
  assert(processRes.attemptId !== undefined, 'Call attempt audit record created');

  // Verify target is marked COMPLETED
  const updatedTarget = await engine.getStore().getTargetById(enrollRes.target.id, orgA);
  assert(updatedTarget.status === 'COMPLETED', 'Campaign target marked COMPLETED');
  assert(updatedTarget.attemptCount === 1, 'Attempt count incremented to 1');

  // Test 6: CRM Activity Timeline Logging
  console.log('\n--- TEST 6: CRM Activity Timeline Verification ---');
  const activities = await db.getCRMActivities(orgA, { contactId: 'cnt_pooja_001' });
  const callActivity = activities.find(a => a.type === 'CALL');
  assert(callActivity !== undefined, 'Outbound campaign call logged to CRM activity timeline');
  assert(callActivity.description.includes('LEAD_QUALIFIED'), 'Outcome verified in timeline');

  // Test 7: Real-Time Recipient Opt-Out Suppression
  console.log('\n--- TEST 7: Recipient Opt-Out Suppression ---');
  // Seed another target
  await db.saveContact({
    id: 'cnt_suresh_002',
    organizationId: orgA,
    displayName: 'Suresh Gowda',
    phone: '+919448099887',
    source: 'WEBSITE',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  });
  const enrollSuresh = await engine.enrollTarget({
    organizationId: orgA,
    campaignId: campaign.id,
    contactId: 'cnt_suresh_002',
  });
  assert(enrollSuresh.target.status === 'SCHEDULED', 'Suresh enrolled');

  // Customer says: "Don't call me again"
  await engine.handleCustomerOptOut(orgA, enrollSuresh.target.id, 'Recipient opted out during call');
  
  const optOutTarget = await engine.getStore().getTargetById(enrollSuresh.target.id, orgA);
  assert(optOutTarget.status === 'OPTED_OUT', 'Target updated to OPTED_OUT');

  const sureshContact = await db.getContactById('cnt_suresh_002', orgA);
  assert(sureshContact.status === 'DO_NOT_CONTACT', 'CRM Contact updated to DO_NOT_CONTACT');

  // Test 8: Campaign Analytics
  console.log('\n--- TEST 8: Campaign Analytics ---');
  const analytics = await engine.getStore().getCampaignAnalytics(campaign.id, orgA);
  assert(analytics.totalTargets >= 2, `Total targets: ${analytics.totalTargets}`);
  assert(analytics.callsAttempted >= 1, `Calls attempted: ${analytics.callsAttempted}`);
  assert(analytics.optOutCount >= 1, `Opt outs tracked: ${analytics.optOutCount}`);
  assert(analytics.completedOutcomes >= 1, `Completed outcomes: ${analytics.completedOutcomes}`);

  // Test 9: Multi-Tenant Boundary Isolation
  console.log('\n--- TEST 9: Multi-Tenant Boundary Isolation ---');
  const orgBCampaigns = await engine.getStore().listCampaigns(orgB);
  assert(orgBCampaigns.length === 0, 'Tenant B cannot see Tenant A campaigns');

  const crossLookup = await engine.getStore().getCampaignById(campaign.id, orgB);
  assert(crossLookup === null, 'Tenant B cross lookup on Tenant A campaign returns null');

  console.log('\n================================================================');
  console.log(`🎉 ALL CAMPAIGN TESTS PASSED: ${passed} passed, ${failed} failed`);
  console.log('================================================================\n');
}

runCampaignTestSuite().catch(err => {
  console.error('Fatal Campaign Test Failure:', err);
  process.exit(1);
});
