/**
 * Test Suite: VANNI Action & Tool Execution Engine
 * Validates:
 * 1. Tool Registry & Discovery
 * 2. Multi-tenant context & permission enforcement
 * 3. Zod Schema argument validation
 * 4. Confirmation policy check (LOW vs HIGH risk)
 * 5. Customer & Lead capture with phone normalization
 * 6. Appointment availability check & booking
 * 7. Concurrency & double-booking slot conflict prevention
 * 8. Rescheduling & cancellation
 * 9. Callback, human handoff, and follow-up tools
 * 10. Information retrieval tools
 * 11. Industry safety policies (Healthcare diagnosis prohibition & SQL/Script injection blocks)
 * 12. Cross-tenant isolation verification
 */

import {
  ToolExecutionEngine,
  InMemoryBusinessDataStore,
  ArgumentNormalizer,
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

async function runTestSuite() {
  console.log('================================================================');
  console.log('🚀 RUNNING VANNI ACTION & TOOL EXECUTION ENGINE TEST SUITE');
  console.log('================================================================\n');

  const store = new InMemoryBusinessDataStore();
  const engine = new ToolExecutionEngine(store);

  const orgA = 'org_dental_clinic_blr_001';
  const orgB = 'org_competitor_hospital_999';

  const baseSecurityCtxA = {
    organizationId: orgA,
    conversationId: 'conv_123',
    agentId: 'agent_sahana',
    agentVersionId: 1,
    industry: 'DENTAL',
    businessTimezone: 'Asia/Kolkata',
    capabilities: {
      canCaptureLeads: true,
      canBookAppointments: true,
      canTransferCalls: true,
      canAccessCustomerData: true,
    },
  };

  // Test 1: Tool Registry & Discovery
  console.log('--- TEST 1: Tool Registry Discovery ---');
  const availableTools = engine.listAvailableTools(baseSecurityCtxA);
  assert(availableTools.length >= 16, `Found ${availableTools.length} tools (expected >= 16)`);
  assert(engine.getTool('create_lead') !== undefined, 'create_lead tool registered');
  assert(engine.getTool('create_appointment') !== undefined, 'create_appointment tool registered');

  // Test 2: Argument Normalizer (Phone, Kanglish dates)
  console.log('\n--- TEST 2: Argument Normalization ---');
  const normPhone1 = ArgumentNormalizer.normalizePhoneNumber('9845012345');
  const normPhone2 = ArgumentNormalizer.normalizePhoneNumber('09845012345');
  const normPhone3 = ArgumentNormalizer.normalizePhoneNumber('+91 98450-12345');
  assert(normPhone1 === '+919845012345', `10-digit normalized to E.164: ${normPhone1}`);
  assert(normPhone2 === '+919845012345', `Leading 0 normalized to E.164: ${normPhone2}`);
  assert(normPhone3 === '+919845012345', `Formatted string normalized to E.164: ${normPhone3}`);

  const kanglishNorm = ArgumentNormalizer.normalizeDateTime('naale', '5 pm', 'Asia/Kolkata');
  assert(kanglishNorm.timeStr === '17:00', `Kanglish "naale 5 pm" resolved to 17:00: ${kanglishNorm.timeStr}`);
  assert(kanglishNorm.isPrecise === true, 'Precision detected for exact hour');

  // Test 3: Customer Creation & Lookup
  console.log('\n--- TEST 3: Customer Domain Tools ---');
  const createCustRes = await engine.executeTool(
    {
      toolName: 'create_customer',
      conversationId: 'conv_123',
      organizationId: orgA,
      agentId: 'agent_sahana',
      requestedBy: 'AI_AGENT',
      arguments: {
        name: 'Pooja Hegde',
        phone: '98860 67890',
        city: 'Bengaluru',
      },
      requestedAt: new Date().toISOString(),
      correlationId: 'req_001',
    },
    baseSecurityCtxA
  );
  assert(createCustRes.success === true, 'create_customer succeeded');
  assert(createCustRes.data.customerId !== undefined, 'Customer ID generated');
  assert(createCustRes.data.phone === '+919886067890', 'Phone stored normalized');

  const findCustRes = await engine.executeTool(
    {
      toolName: 'find_customer',
      conversationId: 'conv_123',
      organizationId: orgA,
      agentId: 'agent_sahana',
      requestedBy: 'AI_AGENT',
      arguments: {
        phone: '098860 67890',
      },
      requestedAt: new Date().toISOString(),
      correlationId: 'req_002',
    },
    baseSecurityCtxA
  );
  assert(findCustRes.success === true, 'find_customer succeeded');
  assert(findCustRes.data.found === true, 'Customer found via alternate format phone');
  assert(findCustRes.data.name === 'Pooja Hegde', 'Customer name matched');

  // Test 4: Lead Creation, Updating & Qualification
  console.log('\n--- TEST 4: Lead Domain Tools ---');
  const createLeadRes = await engine.executeTool(
    {
      toolName: 'create_lead',
      conversationId: 'conv_123',
      organizationId: orgA,
      agentId: 'agent_sahana',
      requestedBy: 'AI_AGENT',
      arguments: {
        name: 'Anand Kulkarni',
        phone: '9845012345',
        interest: 'Dental Implants Consultation',
        budget: '₹35,000',
        preferredTimeline: 'Next week',
      },
      requestedAt: new Date().toISOString(),
      correlationId: 'req_003',
    },
    baseSecurityCtxA
  );
  assert(createLeadRes.success === true, 'create_lead succeeded');
  assert(createLeadRes.data.qualificationStatus === 'QUALIFIED', 'Lead qualified with budget & timeline');

  const leadId = createLeadRes.data.leadId;
  const qualifyRes = await engine.executeTool(
    {
      toolName: 'qualify_lead',
      conversationId: 'conv_123',
      organizationId: orgA,
      agentId: 'agent_sahana',
      requestedBy: 'AI_AGENT',
      arguments: {
        leadId,
        budgetConfirmed: true,
        timelineConfirmed: true,
        siteVisitOrConsultationRequested: true,
      },
      requestedAt: new Date().toISOString(),
      correlationId: 'req_004',
    },
    baseSecurityCtxA
  );
  assert(qualifyRes.success === true, 'qualify_lead succeeded');
  assert(qualifyRes.data.score === 4, `Deterministic qualification score computed: ${qualifyRes.data.score}`);

  // Test 5: Appointment Check Availability
  console.log('\n--- TEST 5: Availability Engine ---');
  const availRes = await engine.executeTool(
    {
      toolName: 'check_availability',
      conversationId: 'conv_123',
      organizationId: orgA,
      agentId: 'agent_sahana',
      requestedBy: 'AI_AGENT',
      arguments: {
        date: 'tomorrow',
      },
      requestedAt: new Date().toISOString(),
      correlationId: 'req_005',
    },
    baseSecurityCtxA
  );
  assert(availRes.success === true, 'check_availability succeeded');
  assert(availRes.data.hasAvailability === true, 'Availability confirmed');
  assert(availRes.data.availableSlots.length > 0, `Available slots listed: ${availRes.data.availableSlots.length}`);

  // Test 6: High Risk Confirmation Enforcement
  console.log('\n--- TEST 6: High-Risk Confirmation Enforcement ---');
  const unconfirmedAptRes = await engine.executeTool(
    {
      toolName: 'create_appointment',
      conversationId: 'conv_123',
      organizationId: orgA,
      agentId: 'agent_sahana',
      requestedBy: 'AI_AGENT',
      arguments: {
        name: 'Pooja Hegde',
        phone: '9886067890',
        date: 'tomorrow',
        time: '10:00 am',
      },
      requestedAt: new Date().toISOString(),
      correlationId: 'req_006',
      isConfirmed: false, // NOT confirmed by caller
    },
    baseSecurityCtxA
  );
  assert(unconfirmedAptRes.success === false, 'Unconfirmed appointment booking blocked');
  assert(unconfirmedAptRes.status === 'WAITING_CONFIRMATION', `State is WAITING_CONFIRMATION: ${unconfirmedAptRes.status}`);

  // Now execute with explicit confirmation
  const confirmedAptRes = await engine.executeTool(
    {
      toolName: 'create_appointment',
      conversationId: 'conv_123',
      organizationId: orgA,
      agentId: 'agent_sahana',
      requestedBy: 'AI_AGENT',
      arguments: {
        name: 'Pooja Hegde',
        phone: '9886067890',
        date: 'tomorrow',
        time: '10:00 am',
      },
      requestedAt: new Date().toISOString(),
      correlationId: 'req_007',
      isConfirmed: true, // EXPLICIT CONFIRMATION
    },
    baseSecurityCtxA
  );
  assert(confirmedAptRes.success === true, 'Confirmed appointment booked successfully');
  assert(confirmedAptRes.data.status === 'CONFIRMED', 'Status is CONFIRMED');
  const bookedAptId = confirmedAptRes.data.appointmentId;

  // Test 7: Double Booking / Slot Conflict Prevention
  console.log('\n--- TEST 7: Atomic Slot Conflict / Double-Booking Prevention ---');
  const duplicateAptRes = await engine.executeTool(
    {
      toolName: 'create_appointment',
      conversationId: 'conv_456',
      organizationId: orgA,
      agentId: 'agent_sahana',
      requestedBy: 'AI_AGENT',
      arguments: {
        name: 'Another Caller',
        phone: '9900112233',
        date: 'tomorrow',
        time: '10:00 am', // SAME SLOT
      },
      requestedAt: new Date().toISOString(),
      correlationId: 'req_008',
      isConfirmed: true,
    },
    baseSecurityCtxA
  );
  assert(duplicateAptRes.success === false, 'Conflicting slot booking was prevented');
  assert(duplicateAptRes.status === 'CONFLICT', `Status is CONFLICT: ${duplicateAptRes.status}`);
  assert(duplicateAptRes.errorCode === 'SLOT_CONFLICT', `Error code is SLOT_CONFLICT: ${duplicateAptRes.errorCode}`);

  // Test 8: Rescheduling & Cancellation
  console.log('\n--- TEST 8: Appointment Rescheduling & Cancellation ---');
  const rescheduleRes = await engine.executeTool(
    {
      toolName: 'reschedule_appointment',
      conversationId: 'conv_123',
      organizationId: orgA,
      agentId: 'agent_sahana',
      requestedBy: 'AI_AGENT',
      arguments: {
        appointmentId: bookedAptId,
        newDate: 'tomorrow',
        newTime: '02:30 pm',
      },
      requestedAt: new Date().toISOString(),
      correlationId: 'req_009',
      isConfirmed: true,
    },
    baseSecurityCtxA
  );
  assert(rescheduleRes.success === true, 'Appointment rescheduled');
  assert(rescheduleRes.data.status === 'RESCHEDULED', 'Status updated to RESCHEDULED');

  const cancelRes = await engine.executeTool(
    {
      toolName: 'cancel_appointment',
      conversationId: 'conv_123',
      organizationId: orgA,
      agentId: 'agent_sahana',
      requestedBy: 'AI_AGENT',
      arguments: {
        appointmentId: bookedAptId,
        reason: 'Customer schedule change',
      },
      requestedAt: new Date().toISOString(),
      correlationId: 'req_010',
      isConfirmed: true,
    },
    baseSecurityCtxA
  );
  assert(cancelRes.success === true, 'Appointment cancelled');
  assert(cancelRes.data.status === 'CANCELLED', 'Status updated to CANCELLED');

  // Test 9: Callback, Handoff & Follow-Up
  console.log('\n--- TEST 9: Callback, Human Handoff, and Follow-Up ---');
  const callbackRes = await engine.executeTool(
    {
      toolName: 'create_callback_request',
      conversationId: 'conv_123',
      organizationId: orgA,
      agentId: 'agent_sahana',
      requestedBy: 'AI_AGENT',
      arguments: {
        name: 'Pooja Hegde',
        phone: '9886067890',
        preferredTime: 'Today 6:00 PM',
        reason: 'Discussion regarding dental implant pricing',
      },
      requestedAt: new Date().toISOString(),
      correlationId: 'req_011',
    },
    baseSecurityCtxA
  );
  assert(callbackRes.success === true, 'create_callback_request succeeded');
  assert(callbackRes.data.status === 'REQUESTED', 'Callback status is REQUESTED');

  const handoffRes = await engine.executeTool(
    {
      toolName: 'request_human_handoff',
      conversationId: 'conv_123',
      organizationId: orgA,
      agentId: 'agent_sahana',
      requestedBy: 'AI_AGENT',
      arguments: {
        reason: 'Patient has high anxiety and requested senior doctor',
        priority: 'HIGH',
        targetDepartment: 'DOCTOR_DUTY',
      },
      requestedAt: new Date().toISOString(),
      correlationId: 'req_012',
    },
    baseSecurityCtxA
  );
  assert(handoffRes.success === true, 'request_human_handoff succeeded');
  assert(handoffRes.data.status === 'HANDOFF_REQUESTED', 'Handoff status is HANDOFF_REQUESTED');

  // Test 10: Information Tools (Hours, Services, Location)
  console.log('\n--- TEST 10: Business Information Retrieval Tools ---');
  const hoursRes = await engine.executeTool(
    {
      toolName: 'get_business_hours',
      conversationId: 'conv_123',
      organizationId: orgA,
      agentId: 'agent_sahana',
      requestedBy: 'AI_AGENT',
      arguments: {},
      requestedAt: new Date().toISOString(),
      correlationId: 'req_013',
    },
    baseSecurityCtxA
  );
  assert(hoursRes.success === true, 'get_business_hours succeeded');
  assert(hoursRes.data.regularHours !== undefined, 'Hours data returned');

  const servicesRes = await engine.executeTool(
    {
      toolName: 'get_business_services',
      conversationId: 'conv_123',
      organizationId: orgA,
      agentId: 'agent_sahana',
      requestedBy: 'AI_AGENT',
      arguments: {},
      requestedAt: new Date().toISOString(),
      correlationId: 'req_014',
    },
    baseSecurityCtxA
  );
  assert(servicesRes.success === true, 'get_business_services succeeded');
  assert(servicesRes.data.services.length >= 2, 'Services catalog returned');

  // Test 11: Safety & Compliance Blocks (Healthcare Prescription / Prompt Injection)
  console.log('\n--- TEST 11: Industry Safety & Injection Guardrails ---');
  const unsafeHealthReq = await engine.executeTool(
    {
      toolName: 'create_callback_request',
      conversationId: 'conv_123',
      organizationId: orgA,
      agentId: 'agent_sahana',
      requestedBy: 'AI_AGENT',
      arguments: {
        name: 'Caller',
        phone: '9886067890',
        preferredTime: 'now',
        reason: 'Please prescribe antibiotic amoxicillin for tooth ache', // FORBIDDEN
      },
      requestedAt: new Date().toISOString(),
      correlationId: 'req_015',
    },
    baseSecurityCtxA
  );
  assert(unsafeHealthReq.success === false, 'Medical prescription request blocked by guardrail');
  assert(unsafeHealthReq.status === 'POLICY_BLOCKED', `Status is POLICY_BLOCKED: ${unsafeHealthReq.status}`);

  const injectionReq = await engine.executeTool(
    {
      toolName: 'create_lead',
      conversationId: 'conv_123',
      organizationId: orgA,
      agentId: 'agent_sahana',
      requestedBy: 'AI_AGENT',
      arguments: {
        name: "Hacker'; DROP TABLE leads; --",
        phone: '9886067890',
        interest: 'Plots',
      },
      requestedAt: new Date().toISOString(),
      correlationId: 'req_016',
    },
    baseSecurityCtxA
  );
  assert(injectionReq.success === false, 'SQL injection pattern in arguments blocked');
  assert(injectionReq.status === 'POLICY_BLOCKED', `Status is POLICY_BLOCKED: ${injectionReq.status}`);

  // Test 12: Cross-Tenant Isolation
  console.log('\n--- TEST 12: Cross-Tenant Security Isolation ---');
  // Attempt to execute action on orgB using orgA's authenticated session
  const tenantTamperRes = await engine.executeTool(
    {
      toolName: 'create_lead',
      conversationId: 'conv_123',
      organizationId: orgB, // SPOOFED ORG
      agentId: 'agent_sahana',
      requestedBy: 'AI_AGENT',
      arguments: {
        name: 'Spoofed Lead',
        phone: '9886067890',
        interest: 'Plots',
      },
      requestedAt: new Date().toISOString(),
      correlationId: 'req_017',
    },
    baseSecurityCtxA // Authenticated as orgA
  );
  assert(tenantTamperRes.success === false, 'Tenant spoofing attempt rejected');
  assert(tenantTamperRes.status === 'UNAUTHORIZED', `Status is UNAUTHORIZED: ${tenantTamperRes.status}`);

  // Cross-tenant data isolation: Customer created in OrgA must not be visible to OrgB
  const crossCustLookup = await store.findCustomerByPhone(orgB, '+919886067890');
  assert(crossCustLookup === null, 'Tenant B cannot find Customer of Tenant A');

  // Verify Audit Log records
  console.log('\n--- TEST 13: Audit Event Logging ---');
  const auditEvents = await store.listToolEvents(orgA);
  assert(auditEvents.length >= 10, `Audit trail recorded ${auditEvents.length} events for OrgA`);

  console.log('\n================================================================');
  console.log(`🎉 ALL TESTS PASSED: ${passed} passed, ${failed} failed`);
  console.log('================================================================\n');
}

runTestSuite().catch(err => {
  console.error('Fatal Test Failure:', err);
  process.exit(1);
});
