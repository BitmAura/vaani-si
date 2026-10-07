/**
 * API Test Suite: VANNI Conversation Orchestration Engine
 *
 * Verifies live HTTP endpoints:
 * 1. POST /api/conversations (Start conversation with agent config, brain snapshot, greeting)
 * 2. GET /api/conversations/:id (Verify state)
 * 3. POST /api/conversations/:id/messages (Multi-turn conversation flow, hours inquiry, tool execution)
 * 4. POST /api/conversations/:id/tools/confirm (Confirm high-impact booking action)
 * 5. POST /api/conversations/:id/interrupt (Barge-in speech interruption)
 * 6. GET /api/conversations/:id/messages (Full message audit trail)
 * 7. POST /api/conversations/:id/end (Graceful termination & summary generation)
 * 8. Tenant Isolation check: Org B cannot access Org A conversations
 */

const BASE_URL = 'http://localhost:4000';
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runApiTests() {
  console.log('\n======================================================');
  console.log('  TEST SUITE: CONVERSATION ORCHESTRATION REST APIS');
  console.log('======================================================');

  // Step 1: Create an Agent in Demo Org A
  const orgAId = 'a0000000-0000-0000-0000-000000000001';
  const orgBId = 'b0000000-0000-0000-0000-000000000002';

  const agentRes = await fetch(`${BASE_URL}/api/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Sahana Receptionist',
      displayName: 'Sahana',
      role: 'AI_RECEPTIONIST',
      industry: 'DENTAL',
      primaryObjective: 'Provide patient reception and appointment booking',
      organizationId: orgAId,
    }),
  });

  const agentData = await agentRes.json();
  assert(agentRes.status === 201 && agentData.agent?.id, 'Agent created for organization A');
  const agentId = agentData.agent.id;

  // Step 2: Start Conversation (POST /api/conversations)
  const startRes = await fetch(`${BASE_URL}/api/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organizationId: orgAId,
      agentId,
      channel: 'WEB_CHAT',
      customerContext: {
        name: 'Sunil Rao',
        phone: '9845099887',
      },
    }),
  });

  const startData = await startRes.json();
  if (startRes.status !== 201) {
    console.error('Start Conversation Error:', startRes.status, startData);
  }
  assert(startRes.status === 201 && startData.conversation?.id, 'Conversation successfully initialized');
  assert(startData.greeting && startData.greeting.length > 0, `Greeting delivered: "${startData.greeting}"`);
  const conversationId = startData.conversation.id;

  // Step 3: Get Conversation State (GET /api/conversations/:id)
  const getRes = await fetch(`${BASE_URL}/api/conversations/${conversationId}`);
  const getData = await getRes.json();
  assert(getRes.status === 200 && getData.conversation.id === conversationId, 'Conversation fetched by ID');
  assert(getData.conversation.currentState === 'LISTENING', 'Conversation state is LISTENING');

  // Step 4: Process Customer Message (Turn 1: Inquire timings)
  const turn1Res = await fetch(`${BASE_URL}/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'What time does the clinic open?',
    }),
  });

  const turn1Data = await turn1Res.json();
  assert(turn1Res.status === 200 && turn1Data.turn?.agentResponse, 'Turn 1 processed successfully');
  assert(turn1Data.turn.agentResponse.includes('09:00 AM to 08:00 PM'), 'Turn 1 answered clinic hours from Business Brain');
  assert(turn1Data.turn.stateAfter === 'LISTENING', 'Turn 1 state returned to LISTENING');

  // Step 5: Process Customer Message (Turn 2: Booking action requiring confirmation)
  const turn2Res = await fetch(`${BASE_URL}/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Please book an appointment for tomorrow at 10am',
    }),
  });

  const turn2Data = await turn2Res.json();
  if (turn2Data.turn?.stateAfter !== 'CONFIRMING') {
    console.log('Turn 2 Data:', JSON.stringify(turn2Data, null, 2));
  }
  assert(turn2Res.status === 200 && turn2Data.turn?.stateAfter === 'CONFIRMING', 'Turn 2 transitioned to CONFIRMING for booking action');
  assert(turn2Data.turn.toolInteractions.some(t => t.toolName === 'book_appointment'), 'Tool book_appointment queued for confirmation');

  // Step 6: Confirm Tool Execution (POST /api/conversations/:id/tools/confirm)
  const confirmRes = await fetch(`${BASE_URL}/api/conversations/${conversationId}/tools/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });

  const confirmData = await confirmRes.json();
  if (confirmRes.status !== 200 || !confirmData.turn) {
    console.log('Confirm Tool Error:', confirmRes.status, confirmData);
  }
  assert(confirmRes.status === 200 && confirmData.turn?.agentResponse.includes('successfully confirmed'), 'Tool confirmed and executed successfully');
  assert(confirmData.turn?.stateAfter === 'LISTENING', 'State returned to LISTENING after confirmation');

  // Step 7: Handle Customer Interruption (POST /api/conversations/:id/interrupt)
  const interruptRes = await fetch(`${BASE_URL}/api/conversations/${conversationId}/interrupt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });

  const interruptData = await interruptRes.json();
  assert(interruptRes.status === 200 && interruptData.status === 'INTERRUPTED', 'Caller barge-in interruption processed');

  // Step 8: Get Message History (GET /api/conversations/:id/messages)
  const msgsRes = await fetch(`${BASE_URL}/api/conversations/${conversationId}/messages`);
  const msgsData = await msgsRes.json();
  assert(msgsRes.status === 200 && Array.isArray(msgsData.messages), 'Message history retrieved');
  assert(msgsData.messages.length >= 4, `Message history contains ${msgsData.messages.length} recorded turns`);

  // Step 9: End Conversation (POST /api/conversations/:id/end)
  const endRes = await fetch(`${BASE_URL}/api/conversations/${conversationId}/end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'CUSTOMER_ENDED' }),
  });

  const endData = await endRes.json();
  assert(endRes.status === 200 && endData.summary?.conversationId === conversationId, 'Conversation terminated and audit summary generated');
  assert(endData.summary.customerGoal.length > 0, `Captured summary customer goal: "${endData.summary.customerGoal}"`);

  // Step 10: Multi-Tenant Isolation / RLS Check
  // Start another conversation in Org A
  const orgAConvRes = await fetch(`${BASE_URL}/api/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organizationId: orgAId,
      agentId,
      channel: 'WEB_CHAT',
    }),
  });
  const orgAConv = await orgAConvRes.json();
  const orgAConvId = orgAConv.conversation.id;

  // Simulate user session for Org B trying to access Org A's conversation
  const sessionTokenB = Buffer.from(JSON.stringify({
    userId: 'usr_org_b_user',
    email: 'user@orgb.com',
    role: 'ADMIN',
    activeOrganizationId: orgBId,
    organizations: [{ organizationId: orgBId, role: 'ADMIN' }],
  })).toString('base64');

  const tenantRes = await fetch(`${BASE_URL}/api/conversations/${orgAConvId}`, {
    headers: {
      'Cookie': `vanni_session=${sessionTokenB}`,
    },
  });
  assert(tenantRes.status === 404, 'Cross-tenant access blocked: Org B cannot read Org A conversation (404 Not Found)');

  console.log('\n======================================================');
  console.log(`  API TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runApiTests().catch(err => {
  console.error('API Test Suite encountered fatal error:', err);
  process.exit(1);
});
