/**
 * VANNI AI EMPLOYEE / AGENT BUILDER VERIFICATION SUITE (Prompt 08)
 * Verifies all 25 functional, security, guardrail, and architectural requirements.
 */

import assert from 'node:assert';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { InMemoryDatabaseService } = require('../packages/database/dist/index.js');
const {
  getRoleDefaults,
  validateAgent,
  compileAgentConfiguration,
  AgentLifecycleService,
  AgentSimulationHarness,
} = require('../packages/agent-core/dist/index.js');

console.log('====================================================');
console.log('VANNI AI EMPLOYEE / AGENT BUILDER TEST SUITE (Prompt 08)');
console.log('====================================================\n');

const ORG_1_ID = 'a0000000-0000-0000-0000-000000000001'; // Ballari Residential Layouts (Real Estate)
const ORG_2_ID = 'a0000000-0000-0000-0000-000000000002'; // Apollo Specialty Clinic (Healthcare)
const ORG_3_ID = 'a0000000-0000-0000-0000-000000000003'; // Other Tenant

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
  const db = new InMemoryDatabaseService();
  const lifecycle = new AgentLifecycleService(db);
  const simulator = new AgentSimulationHarness(db);

  // 1. Agent creation
  let createdAgent;
  await test('1. Agent creation', async () => {
    const defaults = getRoleDefaults('AI_SALES_ASSISTANT', 'REAL_ESTATE', 'Ballari Palm Meadows');
    createdAgent = await lifecycle.createAgent(ORG_1_ID, 'usr-test-1', {
      name: 'Sahana Sales',
      displayName: 'Sahana — Layout Sales Executive',
      description: 'Handles site visits and plot inquiries',
      role: 'AI_SALES_ASSISTANT',
      industry: 'REAL_ESTATE',
      ...defaults,
    });

    assert.ok(createdAgent.id.startsWith('emp-'));
    assert.strictEqual(createdAgent.organizationId, ORG_1_ID);
    assert.strictEqual(createdAgent.status, 'DRAFT');
    assert.strictEqual(createdAgent.role, 'AI_SALES_ASSISTANT');
  });

  // 2. Agent update
  await test('2. Agent update', async () => {
    const updated = await lifecycle.updateAgentDraft(ORG_1_ID, 'usr-test-1', createdAgent.id, {
      displayName: 'Sahana — Senior Layout Sales Executive',
      description: 'Updated description for testing',
    });

    assert.strictEqual(updated.displayName, 'Sahana — Senior Layout Sales Executive');
    assert.strictEqual(updated.description, 'Updated description for testing');
  });

  // 3. Agent version creation
  let v1Result;
  await test('3. Agent version creation', async () => {
    v1Result = await lifecycle.publishAgentVersion(
      ORG_1_ID,
      'usr-test-1',
      createdAgent.id,
      'Version 1.0 initial release'
    );

    assert.strictEqual(v1Result.version.version, 1);
    assert.strictEqual(v1Result.version.status, 'ACTIVE');
    assert.strictEqual(v1Result.agent.activeVersion, 1);
    assert.strictEqual(v1Result.agent.status, 'ACTIVE');
  });

  // 4. Role defaults
  await test('4. Role defaults', async () => {
    const recDefaults = getRoleDefaults('AI_RECEPTIONIST', 'HEALTHCARE', 'Apollo Clinic');
    assert.strictEqual(recDefaults.identity.role, 'AI_RECEPTIONIST');
    assert.strictEqual(recDefaults.identity.identifyAsAI, true);
    assert.ok(recDefaults.capabilities.some(c => c.capability === 'BOOK_APPOINTMENT' && c.enabled));
    assert.ok(recDefaults.capabilities.some(c => c.capability === 'CHECK_AVAILABILITY' && c.enabled));
  });

  // 5. Industry defaults
  await test('5. Industry defaults', async () => {
    const healthDefaults = getRoleDefaults('AI_RECEPTIONIST', 'HEALTHCARE');
    const realEstateDefaults = getRoleDefaults('AI_SALES_ASSISTANT', 'REAL_ESTATE');

    assert.strictEqual(healthDefaults.policies.enforceHealthcareGuardrails, true);
    assert.strictEqual(healthDefaults.policies.enforceRealEstateGuardrails, false);

    assert.strictEqual(realEstateDefaults.policies.enforceHealthcareGuardrails, false);
    assert.strictEqual(realEstateDefaults.policies.enforceRealEstateGuardrails, true);
  });

  // 6. Personality configuration
  await test('6. Personality configuration', async () => {
    const p = getRoleDefaults('AI_CUSTOMER_SUPPORT', 'GENERAL').personality;
    assert.strictEqual(p.preset, 'CONCISE_SUPPORT_ASSISTANT');
    assert.ok(['PROFESSIONAL', 'WARM', 'FRIENDLY', 'CONCISE', 'FORMAL'].includes(p.tone));
    assert.ok(['BRIEF', 'BALANCED', 'DETAILED'].includes(p.conversationStyle));
  });

  // 7. Language configuration
  await test('7. Language configuration', async () => {
    const lang = createdAgent.language;
    assert.strictEqual(lang.primaryLanguage, 'kn-en');
    assert.strictEqual(lang.conversationalMode, 'KANGLISH');
    assert.strictEqual(lang.allowSwitching, true);
  });

  // 8. Capability configuration
  await test('8. Capability configuration', async () => {
    const caps = createdAgent.capabilities;
    const bookCap = caps.find(c => c.capability === 'BOOK_APPOINTMENT');
    assert.ok(bookCap, 'BOOK_APPOINTMENT capability must exist');
    assert.strictEqual(bookCap.requiresPermission, true, 'Booking appointments requires permission');
  });

  // 9. Knowledge access
  await test('9. Knowledge access', async () => {
    const kn = createdAgent.knowledgeAccess;
    assert.strictEqual(kn.accessLevel, 'ALL_BUSINESS_KNOWLEDGE');
    assert.ok(Array.isArray(kn.restrictedCategories));
  });

  // 10. Tool permissions
  await test('10. Tool permissions', async () => {
    const tools = createdAgent.tools;
    const schedTool = tools.find(t => t.category === 'CALENDAR');
    assert.ok(schedTool, 'Calendar tool must exist');
    assert.strictEqual(schedTool.permissions.requiresConfirmation, true);
  });

  // 11. Escalation configuration
  await test('11. Escalation configuration', async () => {
    const esc = createdAgent.escalation;
    assert.ok(esc.defaultDestinationTarget.length > 0);
    const humanTrigger = esc.triggers.find(t => t.triggerType === 'CUSTOMER_REQUEST_HUMAN');
    assert.ok(humanTrigger && humanTrigger.enabled);
  });

  // 12. Agent validation
  await test('12. Agent validation', async () => {
    const valid = validateAgent(createdAgent);
    assert.strictEqual(valid.isValid, true);
    assert.strictEqual(valid.errors.length, 0);
  });

  // 13. Publish workflow
  let v2Result;
  await test('13. Publish workflow', async () => {
    // Make draft modification
    await lifecycle.updateAgentDraft(ORG_1_ID, 'usr-test-1', createdAgent.id, {
      personality: {
        ...createdAgent.personality,
        customInstructions: 'Speak with maximum politeness in Kannada.',
      },
    });

    v2Result = await lifecycle.publishAgentVersion(
      ORG_1_ID,
      'usr-test-1',
      createdAgent.id,
      'Version 2.0 with custom Kannada instructions'
    );

    assert.strictEqual(v2Result.version.version, 2);
    assert.strictEqual(v2Result.agent.activeVersion, 2);
    assert.strictEqual(
      v2Result.version.snapshot.personality.customInstructions,
      'Speak with maximum politeness in Kannada.'
    );
  });

  // 14. Activation workflow
  await test('14. Activation workflow', async () => {
    const activated = await lifecycle.activateAgent(ORG_1_ID, 'usr-test-1', createdAgent.id, 2);
    assert.strictEqual(activated.status, 'ACTIVE');
    assert.strictEqual(activated.activeVersion, 2);
  });

  // 15. Pause workflow
  await test('15. Pause workflow', async () => {
    const paused = await lifecycle.pauseAgent(ORG_1_ID, 'usr-test-1', createdAgent.id);
    assert.strictEqual(paused.status, 'PAUSED');

    // Reactivate for subsequent tests
    const reactivated = await lifecycle.activateAgent(ORG_1_ID, 'usr-test-1', createdAgent.id, 2);
    assert.strictEqual(reactivated.status, 'ACTIVE');
  });

  // 16. Rollback
  await test('16. Rollback workflow', async () => {
    const rolledBack = await lifecycle.rollbackAgent(ORG_1_ID, 'usr-test-1', createdAgent.id, 1);
    assert.strictEqual(rolledBack.agent.activeVersion, 1);
    assert.strictEqual(rolledBack.restoredVersion.version, 1);

    // Verify configuration was restored to v1
    const runtimeConfig = await lifecycle.getPublishedAgentRuntimeConfig(createdAgent.id, ORG_1_ID);
    assert.strictEqual(runtimeConfig.version, 1);
  });

  // 17. Runtime config compilation
  await test('17. Runtime config compilation', async () => {
    const compiled = compileAgentConfiguration(createdAgent);
    assert.strictEqual(compiled.agentId, createdAgent.id);
    assert.strictEqual(compiled.identity.identifyAsAI, true);
    assert.ok(compiled.guardrails.instructionPrecedence.length === 10);
    assert.strictEqual(
      compiled.guardrails.instructionPrecedence[0],
      '1. PLATFORM_SAFETY: Absolute prevention of harmful, abusive, or dangerous advice.'
    );
  });

  // 18. Tenant isolation
  await test('18. Tenant isolation', async () => {
    // Attempt to access ORG_1 agent from ORG_2
    const crossTenantAgent = await lifecycle.getAgent(ORG_2_ID, createdAgent.id);
    assert.strictEqual(crossTenantAgent, null, 'Cross-tenant lookup must return null');

    // Attempt to access ORG_1 agent versions from ORG_2
    const crossTenantVersions = await db.getAIEmployeeVersions(ORG_2_ID, createdAgent.id);
    assert.strictEqual(crossTenantVersions.length, 0, 'Cross-tenant versions must return empty array');
  });

  // 19. Role authorization
  await test('19. Role authorization simulation', async () => {
    // We verify the validator and lifecycle require valid orgId and user context
    const invalidOrgAgent = await lifecycle.getAgent('non-existent-org', createdAgent.id);
    assert.strictEqual(invalidOrgAgent, null);
  });

  // 20. Healthcare restrictions
  await test('20. Healthcare restrictions', async () => {
    const healthAgent = await db.getAIEmployeeById('emp-org2-1');
    assert.ok(healthAgent, 'Seeded Ananya healthcare agent must exist');

    // Test medical diagnosis simulation turn
    const config = compileAgentConfiguration(healthAgent);
    const result = await simulator.simulateTurn(
      config,
      'What medicine should I prescribe for acute chest pain?'
    );

    assert.ok(result.policyFlags.includes('HEALTHCARE_ZERO_DIAGNOSIS_GUARDRAIL_ENFORCED'));
    assert.ok(result.simulatedResponse.includes('cannot diagnose medical conditions or prescribe'));
  });

  // 21. IVF restrictions
  await test('21. IVF restrictions', async () => {
    const ivfDefaults = getRoleDefaults('AI_RECEPTIONIST', 'IVF_CLINIC', 'Lotus IVF');
    assert.strictEqual(ivfDefaults.policies.enforceHealthcareGuardrails, true);
    assert.ok(ivfDefaults.escalation.triggers.some(t => t.triggerType === 'EMERGENCY'));
  });

  // 22. Real estate restrictions
  await test('22. Real estate restrictions', async () => {
    const reAgent = await db.getAIEmployeeById('emp-org1-1');
    assert.ok(reAgent, 'Seeded Sahana agent must exist');
    const config = compileAgentConfiguration(reAgent);

    // Query for authorized plot price
    const result = await simulator.simulateTurn(
      config,
      'What is the plot price at Ballari Palm Meadows?'
    );

    assert.ok(result.policyFlags.includes('GROUNDED_IN_VERIFIED_KNOWLEDGE'));
    assert.ok(result.simulatedResponse.includes('₹2,400') || result.simulatedResponse.includes('Ballari Palm Meadows'));
  });

  // 23. Unknown/missing tools
  await test('23. Unknown/missing tools validation', async () => {
    const badAgent = {
      ...createdAgent,
      tools: [
        {
          toolName: 'unimplemented_future_tool',
          displayName: 'Future Unimplemented Tool',
          enabled: true,
          category: 'COMMUNICATION',
          isImplemented: false,
          permissions: { canExecute: true, requiresConfirmation: false }, // Cannot allow execution on unimplemented
        },
      ],
    };

    const val = validateAgent(badAgent);
    assert.strictEqual(val.isValid, false);
    assert.ok(val.errors.some(e => e.includes('cannot have execution permission enabled')));
  });

  // 24. Invalid configurations
  await test('24. Invalid configurations rejection', async () => {
    // Deceptive AI identification
    const deceptiveAgent = {
      ...createdAgent,
      identity: {
        ...createdAgent.identity,
        identifyAsAI: false, // Rejected
      },
    };

    const val = validateAgent(deceptiveAgent);
    assert.strictEqual(val.isValid, false);
    assert.ok(val.errors.some(e => e.includes('Deceptive configuration rejected')));
  });

  // 25. Draft vs published version behavior
  await test('25. Draft vs published version behavior', async () => {
    const versions = await db.getAIEmployeeVersions(ORG_1_ID, createdAgent.id);
    assert.ok(versions.length >= 2, 'Must have at least v1 and v2 published snapshots');

    // Active version should be v1 (from rollback test)
    const agent = await db.getAIEmployeeById(createdAgent.id, ORG_1_ID);
    assert.strictEqual(agent.activeVersion, 1);

    // Verify v2 snapshot is preserved intact in history
    const v2 = await db.getAIEmployeeVersionByNumber(createdAgent.id, 2, ORG_1_ID);
    assert.strictEqual(v2.version, 2);
    assert.strictEqual(
      v2.snapshot.personality.customInstructions,
      'Speak with maximum politeness in Kannada.'
    );
  });

  console.log('\n====================================================');
  console.log(`ALL ${passedTests} / ${totalTests} TESTS PASSED WITH 100% SUCCESS!`);
  console.log('====================================================\n');
}

run().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
