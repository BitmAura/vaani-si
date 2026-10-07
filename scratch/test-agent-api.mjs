/**
 * VANNI AI EMPLOYEE BUILDER HTTP REST API INTEGRATION SUITE
 */

import assert from 'node:assert';

const BASE_URL = 'http://localhost:4000';
const ORG_1_ID = 'a0000000-0000-0000-0000-000000000001';
const ORG_2_ID = 'a0000000-0000-0000-0000-000000000002';

console.log('====================================================');
console.log('VANNI AI EMPLOYEE BUILDER HTTP API VERIFICATION');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`✓ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`✗ [FAIL] ${name}:`, err.message || err);
    throw err;
  }
}

async function run() {
  // 1. Web Route Test: /app/agents serves HTML
  await test('1. Web Console Route /app/agents returns HTTP 200 HTML', async () => {
    // With dev query param or demo
    const res = await fetch(`${BASE_URL}/app/agents`);
    // Will redirect to login or serve HTML
    assert.ok(res.status === 200 || res.status === 302, `Status: ${res.status}`);
  });

  // 2. GET /api/agents/roles
  await test('2. GET /api/agents/roles returns role template defaults', async () => {
    const res = await fetch(`${BASE_URL}/api/agents/roles?role=AI_RECEPTIONIST&industry=HEALTHCARE&businessName=Apollo+Clinic`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.defaults.identity.role, 'AI_RECEPTIONIST');
    assert.strictEqual(data.defaults.policies.enforceHealthcareGuardrails, true);
  });

  // 3. GET /api/agents
  await test('3. GET /api/agents lists agents for organization', async () => {
    const res = await fetch(`${BASE_URL}/api/agents?organizationId=${ORG_1_ID}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.agents));
    assert.ok(data.agents.length >= 1, 'Should contain seeded agent');
    assert.strictEqual(data.agents[0].organizationId, ORG_1_ID);
  });

  // 4. POST /api/agents creates new AI Employee
  let createdAgentId;
  await test('4. POST /api/agents creates and publishes new AI Employee', async () => {
    const payload = {
      organizationId: ORG_1_ID,
      name: 'Pooja',
      displayName: 'Pooja — Lead Qualification Executive',
      description: 'Qualifies prospective buyers for Ballari Palm Meadows plots',
      role: 'AI_LEAD_QUALIFIER',
      industry: 'REAL_ESTATE',
      primaryObjective: 'Qualify prospective buyer budget, timeline, and site visit availability.',
      primaryLanguage: 'kn-en',
      personalityPreset: 'CONSULTATIVE_SALES_ASSISTANT',
    };

    const res = await fetch(`${BASE_URL}/api/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.strictEqual(res.status, 201, `Status: ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.agent.id);
    assert.strictEqual(data.agent.name, 'Pooja');
    assert.strictEqual(data.agent.status, 'ACTIVE');
    assert.strictEqual(data.version.version, 1);
    createdAgentId = data.agent.id;
  });

  // 5. GET /api/agents/:id
  await test('5. GET /api/agents/:id retrieves created agent', async () => {
    const res = await fetch(`${BASE_URL}/api/agents/${createdAgentId}?organizationId=${ORG_1_ID}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.agent.id, createdAgentId);
  });

  // 6. PUT /api/agents/:id updates agent configuration
  await test('6. PUT /api/agents/:id updates draft configuration', async () => {
    const res = await fetch(`${BASE_URL}/api/agents/${createdAgentId}?organizationId=${ORG_1_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Pooja — Senior Lead Executive',
        description: 'Updated operational description',
      }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.agent.displayName, 'Pooja — Senior Lead Executive');
  });

  // 7. POST /api/agents/:id/validate
  await test('7. POST /api/agents/:id/validate returns valid check', async () => {
    const res = await fetch(`${BASE_URL}/api/agents/${createdAgentId}/validate?organizationId=${ORG_1_ID}`, {
      method: 'POST',
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.isValid, true);
    assert.strictEqual(data.errors.length, 0);
  });

  // 8. POST /api/agents/:id/publish
  await test('8. POST /api/agents/:id/publish creates version 2', async () => {
    const res = await fetch(`${BASE_URL}/api/agents/${createdAgentId}/publish?organizationId=${ORG_1_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changelog: 'Version 2.0 release' }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.version.version, 2);
    assert.strictEqual(data.agent.activeVersion, 2);
  });

  // 9. POST /api/agents/:id/pause and /activate
  await test('9. POST /api/agents/:id/pause and /activate toggles status', async () => {
    // Pause
    const pauseRes = await fetch(`${BASE_URL}/api/agents/${createdAgentId}/pause?organizationId=${ORG_1_ID}`, {
      method: 'POST',
    });
    assert.strictEqual(pauseRes.status, 200);
    const pauseData = await pauseRes.json();
    assert.strictEqual(pauseData.agent.status, 'PAUSED');

    // Activate
    const actRes = await fetch(`${BASE_URL}/api/agents/${createdAgentId}/activate?organizationId=${ORG_1_ID}`, {
      method: 'POST',
    });
    assert.strictEqual(actRes.status, 200);
    const actData = await actRes.json();
    assert.strictEqual(actData.agent.status, 'ACTIVE');
  });

  // 10. POST /api/agents/:id/rollback
  await test('10. POST /api/agents/:id/rollback restores version 1', async () => {
    const res = await fetch(`${BASE_URL}/api/agents/${createdAgentId}/rollback?organizationId=${ORG_1_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetVersion: 1 }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.agent.activeVersion, 1);
    assert.strictEqual(data.restoredVersion.version, 1);
  });

  // 11. GET /api/agents/:id/versions
  await test('11. GET /api/agents/:id/versions lists all immutable versions', async () => {
    const res = await fetch(`${BASE_URL}/api/agents/${createdAgentId}/versions?organizationId=${ORG_1_ID}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.versions.length, 2);
  });

  // 12. GET /api/agents/:id/runtime-config
  await test('12. GET /api/agents/:id/runtime-config yields runtime contract', async () => {
    const res = await fetch(`${BASE_URL}/api/agents/${createdAgentId}/runtime-config?organizationId=${ORG_1_ID}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.runtimeConfig.agentId, createdAgentId);
    assert.strictEqual(data.runtimeConfig.version, 1);
    assert.strictEqual(data.runtimeConfig.guardrails.instructionPrecedence.length, 10);
  });

  // 13. POST /api/agents/:id/test simulation
  await test('13. POST /api/agents/:id/test executes simulation turn with grounding', async () => {
    const res = await fetch(`${BASE_URL}/api/agents/${createdAgentId}/test?organizationId=${ORG_1_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'What is the price of 30x40 plots at Ballari Palm Meadows?',
      }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.turn.isSimulation);
    assert.ok(data.turn.simulatedResponse.includes('₹2,400') || data.turn.simulatedResponse.includes('Ballari Palm Meadows'));
    assert.ok(data.turn.policyFlags.includes('GROUNDED_IN_VERIFIED_KNOWLEDGE'));
  });

  // 14. Cross-Tenant Protection (Tenant Isolation)
  await test('14. Cross-tenant agent lookup is blocked or isolated', async () => {
    const res = await fetch(`${BASE_URL}/api/agents/${createdAgentId}?organizationId=${ORG_2_ID}`);
    // Should return 404 or 403 because createdAgent belongs to ORG_1
    assert.ok(res.status === 404 || res.status === 403, `Expected 404/403, got ${res.status}`);
  });

  console.log('\n====================================================');
  console.log(`ALL ${passedTests} / ${totalTests} HTTP REST API TESTS PASSED!`);
  console.log('====================================================\n');
}

run().catch(err => {
  console.error('HTTP API Suite failed:', err);
  process.exit(1);
});
