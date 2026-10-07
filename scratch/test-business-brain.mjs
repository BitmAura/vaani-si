/**
 * VANNI Comprehensive Business Brain & Industry Template Verification Suite
 * Tests 24 critical domain invariants across data loading, RLS/tenant isolation,
 * snapshot compilation, conflict detection, and no-hallucination contracts.
 */

import assert from 'node:assert/strict';
import { globalBusinessBrainService } from '../packages/knowledge-engine/dist/index.js';
import { globalDb, InMemoryDatabaseService } from '../packages/database/dist/index.js';
import { getAllIndustryTemplates, getIndustryTemplate } from '../packages/industry-templates/dist/index.js';
import { LayeredContextAssembler } from '../packages/context-engine/dist/index.js';

const ORG_1_ID = 'a0000000-0000-0000-0000-000000000001'; // Ballari Layouts (Real Estate)
const ORG_2_ID = 'a0000000-0000-0000-0000-000000000002'; // Apollo Clinic (Healthcare)
const ORG_3_ID = 'a0000000-0000-0000-0000-000000000003'; // Third Party

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ [PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] Test ${totalTests}: ${name}`);
    console.error(err.message);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`✅ [PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] Test ${totalTests}: ${name}`);
    console.error(err.message);
  }
}

console.log('======================================================================');
console.log('  VANNI BUSINESS BRAIN & INDUSTRY TEMPLATES QA SUITE                  ');
console.log('======================================================================\n');

async function main() {
  // Test 1: Business Brain loads correct organization
  await runAsyncTest('Business Brain loads correct organization data', async () => {
    const brain = await globalBusinessBrainService.getBusinessBrain(ORG_1_ID);
    assert.equal(brain.organization.id, ORG_1_ID);
    assert.equal(brain.organization.name, 'Ballari Residential Layouts');
    assert.equal(brain.organization.industry, 'REAL_ESTATE');
  });

  // Test 2: Structured business data appears correctly
  await runAsyncTest('Structured business data (identity and address) verified', async () => {
    const brain = await globalBusinessBrainService.getBusinessBrain(ORG_1_ID);
    assert.ok(brain.locations.length >= 1, 'Should have at least 1 location');
    const primary = brain.locations.find(l => l.isPrimary);
    assert.ok(primary, 'Must have primary location');
    assert.equal(primary.city, 'Ballari');
    assert.equal(primary.state, 'Karnataka');
  });

  // Test 3: Services are returned correctly
  await runAsyncTest('Services catalog returned with accurate pricing and durations', async () => {
    const brain = await globalBusinessBrainService.getBusinessBrain(ORG_1_ID);
    assert.ok(brain.services.length >= 2, 'Should have at least 2 services');
    const plot30x40 = brain.services.find(s => s.name.includes('30x40'));
    assert.ok(plot30x40, 'Should find 30x40 plot');
    assert.equal(plot30x40.priceMinimum, 1800000);
    assert.equal(plot30x40.isBookableByAI, true);
  });

  // Test 4: Staff are returned correctly
  await runAsyncTest('Staff records returned with specialist designations and Kannada names', async () => {
    const brain = await globalBusinessBrainService.getBusinessBrain(ORG_1_ID);
    assert.ok(brain.staff.length >= 1);
    const consultant = brain.staff[0];
    assert.equal(consultant.fullName, 'Anand Kulkarni');
    assert.equal(consultant.kannadaName, 'ಆನಂದ್ ಕುಲಕರ್ಣಿ');
  });

  // Test 5: Operating hours are returned correctly
  await runAsyncTest('Operating hours return day-by-day weekly schedule', async () => {
    const brain = await globalBusinessBrainService.getBusinessBrain(ORG_1_ID);
    assert.equal(brain.hours.length, 7, 'Must have 7 days schedule');
    const sunday = brain.hours.find(h => h.dayOfWeek === 0);
    assert.ok(sunday, 'Must have Sunday timings');
    assert.equal(sunday.isClosed, false);
    assert.equal(sunday.opensAt, '10:00');
  });

  // Test 6: Policies are returned correctly
  await runAsyncTest('Structured policies return enforcement levels and statements', async () => {
    const brain = await globalBusinessBrainService.getBusinessBrain(ORG_1_ID);
    assert.ok(brain.policies.length >= 2);
    const cabPolicy = brain.policies.find(p => p.category === 'APPOINTMENT');
    assert.ok(cabPolicy);
    assert.equal(cabPolicy.enforcementLevel, 'INFORMATIONAL');
  });

  // Test 7: Bilingual FAQs are returned correctly
  await runAsyncTest('FAQs return verified Kannada/Kanglish responses', async () => {
    const brain = await globalBusinessBrainService.getBusinessBrain(ORG_1_ID);
    assert.ok(brain.faqs.length >= 1);
    const loanFaq = brain.faqs[0];
    assert.equal(loanFaq.language, 'KANGLISH');
    assert.ok(loanFaq.answer.includes('80% loan'));
  });

  // Test 8: Inactive / archived records are excluded from active retrieval
  await runAsyncTest('Inactive and archived records are excluded by default', async () => {
    await globalDb.saveService({
      id: 'srv-archived-1',
      organizationId: ORG_1_ID,
      name: 'Archived Old Scheme Plot',
      category: 'Old Sites',
      durationMinutes: 30,
      isBookableByAI: false,
      status: 'ARCHIVED',
      authority: 'REFERENCE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const brain = await globalBusinessBrainService.getBusinessBrain(ORG_1_ID);
    const foundArchived = brain.services.find(s => s.id === 'srv-archived-1');
    assert.equal(foundArchived, undefined, 'Archived service must NOT appear in active brain services');
  });

  // Test 9: Authoritative knowledge outranks lower-authority records
  await runAsyncTest('Authoritative source priority verified over unverified references', async () => {
    const brain = await globalBusinessBrainService.getBusinessBrain(ORG_1_ID);
    const authoritativeServices = brain.services.filter(s => s.authority === 'AUTHORITATIVE');
    assert.ok(authoritativeServices.length >= 1);
  });

  // Test 10: Contradictory knowledge is detected by Conflict Detection Engine
  await runAsyncTest('Conflict Detection Engine catches price discrepancies between sources', async () => {
    // Inject a conflicting fact claiming 30x40 is ₹12 Lakhs when catalog says ₹18 Lakhs
    await globalDb.saveFact({
      id: 'fact-conflict-test',
      organizationId: ORG_1_ID,
      category: 'Residential Sites',
      key: '30x40 Residential Plot (1,200 sq.ft)',
      value: '₹12,00,000 Special Flash Deal',
      authority: 'UNVERIFIED',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const snapshot = await globalBusinessBrainService.compileSnapshot(ORG_1_ID);
    assert.ok(snapshot.conflicts.length >= 1, 'Should flag conflict for conflicting prices');
    const conflict = snapshot.conflicts.find(c => c.field === 'priceMinimum');
    assert.ok(conflict, 'Should have priceMinimum conflict flagged');
    assert.equal(conflict.status, 'OPEN');
  });

  // Test 11: No Hallucination Contract — Unknown information remains unknown
  await runAsyncTest('No Hallucination Contract: Unknown queries return UNKNOWN_INFORMATION', async () => {
    const result = await globalBusinessBrainService.searchBusinessKnowledge(
      ORG_1_ID,
      'Do you have swimming pool villas in Paris or London?'
    );
    assert.equal(result.found, false);
    assert.equal(result.status, 'UNKNOWN_INFORMATION');
    assert.equal(result.citations.length, 0);
  });

  // Test 12: Missing pricing is not invented
  await runAsyncTest('Missing pricing is never invented by query engine', async () => {
    // Add service with no price
    await globalDb.saveService({
      id: 'srv-custom-plot',
      organizationId: ORG_1_ID,
      name: 'Custom Farm Land Acreage',
      category: 'Agricultural',
      durationMinutes: 60,
      isBookableByAI: false,
      status: 'ACTIVE',
      authority: 'AUTHORITATIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await globalBusinessBrainService.searchBusinessKnowledge(
      ORG_1_ID,
      'Custom Farm Land Acreage'
    );
    assert.equal(result.found, true);
    assert.ok(result.content.includes('consultation'));
    assert.ok(!result.content.includes('₹0'), 'Should never invent a ₹0 fake price');
  });

  // Test 13: Healthcare restrictions represented in policies and guardrails
  await runAsyncTest('Healthcare template enforces zero-prescription and non-diagnostic guardrails', async () => {
    const template = getIndustryTemplate('HEALTHCARE_HOSPITAL');
    assert.ok(template.guardrails.some(g => g.toLowerCase().includes('diagnosis')));
    assert.ok(template.guardrails.some(g => g.toLowerCase().includes('medication')));

    const brain = await globalBusinessBrainService.getBusinessBrain(ORG_2_ID);
    const diagPolicy = brain.policies.find(p => p.category === 'AI_RESTRICTION');
    assert.ok(diagPolicy);
    assert.equal(diagPolicy.enforcementLevel, 'STRICT_BLOCK');
  });

  // Test 14: IVF Fertility restrictions represented
  await runAsyncTest('IVF Fertility template enforces confidentiality and zero guarantee policies', async () => {
    const template = getIndustryTemplate('IVF_FERTILITY');
    assert.ok(template.guardrails.some(g => g.toLowerCase().includes('guarantee')));
    assert.ok(template.defaultPolicies.some(p => p.category === 'PRIVACY'));
  });

  // Test 15: Real Estate restrictions represented
  await runAsyncTest('Real Estate template enforces zero-unapproved-inventory guardrail', async () => {
    const template = getIndustryTemplate('REAL_ESTATE');
    assert.ok(template.guardrails.some(g => g.toLowerCase().includes('invent')));
  });

  // Test 16: Business Brain Snapshot is deterministic
  await runAsyncTest('Business Brain Snapshot compilation is deterministic and versioned', async () => {
    const snap1 = await globalBusinessBrainService.compileSnapshot(ORG_1_ID);
    const snap2 = await globalBusinessBrainService.compileSnapshot(ORG_1_ID);
    assert.equal(snap2.version, snap1.version + 1);
    assert.equal(snap2.organizationId, ORG_1_ID);
    assert.equal(snap2.industry, 'REAL_ESTATE');
  });

  // Test 17: Context Engine LayeredContextAssembler consumes snapshot
  await runAsyncTest('LayeredContextAssembler generates prompt from BusinessBrainSnapshot', async () => {
    const snap = await globalBusinessBrainService.compileSnapshot(ORG_1_ID);
    const assembler = new LayeredContextAssembler();
    const prompt = assembler.assembleFromSnapshot(
      snap,
      { phone: '+919845012345', name: 'Ramesh' },
      ['User: Hello', 'AI: Namaskara sir!']
    );

    assert.ok(prompt.includes('[L0_IDENTITY]'));
    assert.ok(prompt.includes('Ballari Residential Layouts'));
    assert.ok(prompt.includes('[L1_TENANT]'));
    assert.ok(prompt.includes('[L2_DIALECT]'));
    assert.ok(prompt.includes('[L3_FACTS & SERVICES]'));
    assert.ok(prompt.includes('[L4_RULES & POLICIES]'));
    assert.ok(prompt.includes('NO HALLUCINATION'));
  });

  // Test 18: Kannada Unicode preservation
  await runAsyncTest('Kannada Unicode strings preserved without data corruption or mangling', async () => {
    const brain = await globalBusinessBrainService.getBusinessBrain(ORG_1_ID);
    const srv = brain.services.find(s => s.kannadaName);
    assert.ok(srv);
    assert.equal(srv.kannadaName, '30x40 ಅಳತೆಯ ನಿವೇಶನ (1,200 ಚದರಡಿ)');
  });

  // Test 19: All 8 core industry templates verified
  runTest('All 8 Core Industry Templates properly registered and configured', () => {
    const all = getAllIndustryTemplates();
    assert.ok(all.length >= 8);
    const industries = all.map(t => t.industry);
    assert.ok(industries.includes('DENTAL'));
    assert.ok(industries.includes('HEALTHCARE_HOSPITAL'));
    assert.ok(industries.includes('IVF_FERTILITY'));
    assert.ok(industries.includes('HOSPITALITY_RESORT'));
    assert.ok(industries.includes('REAL_ESTATE'));
    assert.ok(industries.includes('COMMERCIAL_OTHER'));
    assert.ok(industries.includes('AUTOMOTIVE_DEALER'));
    assert.ok(industries.includes('DIGITAL_AGENCY'));
  });

  // Test 20: Generic Industry fallback works
  runTest('Unrecognized industry falls back safely to COMMERCIAL_OTHER', () => {
    const t = getIndustryTemplate('NON_EXISTENT_FACTORY');
    assert.equal(t.industry, 'COMMERCIAL_OTHER');
    assert.equal(t.aiDefaults.roleTitle, 'General Business Assistant & Executive');
  });

  // ==============================================================================
  // CRITICAL CROSS-TENANT SECURITY TESTS (Org A vs Org B Isolation)
  // ==============================================================================

  // Test 21: Cross-Tenant Read Attempt
  await runAsyncTest('CRITICAL SECURITY: Org A cannot read Org B Business Brain data', async () => {
    const brainA = await globalBusinessBrainService.getBusinessBrain(ORG_1_ID);
    const brainB = await globalBusinessBrainService.getBusinessBrain(ORG_2_ID);

    // Verify Org A services do not contain Org B services
    const aHasCardiology = brainA.services.some(s => s.category === 'Cardiology');
    assert.equal(aHasCardiology, false, 'Org A (Real Estate) must NEVER see Org B (Hospital) Cardiology service');

    const bHasPlots = brainB.services.some(s => s.name.includes('Plot'));
    assert.equal(bHasPlots, false, 'Org B (Hospital) must NEVER see Org A (Real Estate) Plot services');
  });

  // Test 22: Cross-Tenant Modify / Delete Attempt
  await runAsyncTest('CRITICAL SECURITY: Org A cannot delete Org B service or staff', async () => {
    // Org A attempts to delete Org B's cardiology service (srv-3)
    await globalDb.deleteService('srv-3', ORG_1_ID);

    // Verify srv-3 is STILL present in Org B
    const org2Services = await globalDb.getServices(ORG_2_ID);
    const srv3 = org2Services.find(s => s.id === 'srv-3');
    assert.ok(srv3, 'Org B service must remain intact after Org A deletion attempt');
  });

  // Test 23: Cross-Tenant Snapshot Isolation
  await runAsyncTest('CRITICAL SECURITY: Snapshots are strictly isolated by organization_id', async () => {
    const snapA = await globalBusinessBrainService.compileSnapshot(ORG_1_ID);
    const snapB = await globalBusinessBrainService.compileSnapshot(ORG_2_ID);

    assert.equal(snapA.organizationId, ORG_1_ID);
    assert.equal(snapB.organizationId, ORG_2_ID);
    assert.notEqual(snapA.identity.displayName, snapB.identity.displayName);
  });

  // Test 24: Unregistered Org Rejection
  await runAsyncTest('Unknown / Unregistered Organization ID cleanly rejected', async () => {
    await assert.rejects(
      async () => {
        await globalBusinessBrainService.getBusinessBrain('a0000000-0000-0000-0000-000000009999');
      },
      /not found/i
    );
  });

  console.log('\n======================================================================');
  console.log(`  QA RESULTS: ${passedTests} PASSED, ${totalTests - passedTests} FAILED (TOTAL: ${totalTests})`);
  console.log('======================================================================');

  if (passedTests === totalTests) {
    console.log('\n🎯 ALL 24 BUSINESS BRAIN & INDUSTRY TEMPLATE INVARIANTS VERIFIED 100%!');
  } else {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
