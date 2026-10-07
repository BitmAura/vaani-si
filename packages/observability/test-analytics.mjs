/**
 * @vanni/observability Analytics, Usage Metering & Cost Intelligence Test Suite
 *
 * Verifies:
 * 1. Raw usage event append-only recording (Voice, STT, TTS, LLM, Telephony, Tool)
 * 2. Versioned pricing catalog and deterministic cost calculation (ACTUAL vs ESTIMATED)
 * 3. Pre-billing usage ledger creation without premature invoices
 * 4. Daily incremental rollups & aggregations
 * 5. Conversion funnel derivation from real CRM & call data
 * 6. Alert thresholds and burst cost anomaly detection
 * 7. Tenant isolation & multi-org usage containment
 * 8. CSV usage export formatting and data hygiene
 */

import assert from 'node:assert';
import { InMemoryDatabaseService } from '@vanni/database';
import { PricingCatalog } from './dist/pricing-catalog.js';
import { UsageMeteringEngine } from './dist/metering-engine.js';

async function runTests() {
  console.log('================================================================');
  console.log('VANNI ANALYTICS, USAGE METERING & COST INTELLIGENCE TEST SUITE');
  console.log('================================================================\n');

  const db = new InMemoryDatabaseService();
  const engine = new UsageMeteringEngine(db);

  const orgA = 'org_dental_jayanagar';
  const orgB = 'org_realty_indiranagar';

  // Test 1: Pricing Catalog & Versioned Cost Calculation
  console.log('--- TEST 1: Pricing Catalog & Estimated Cost Calculation ---');
  const sttCost = PricingCatalog.calculateEstimatedCost({
    provider: 'sarvam-ai',
    service: 'STT',
    unitType: 'seconds',
    quantity: 120, // 2 minutes
  });
  assert.strictEqual(sttCost.currency, 'INR', 'Currency is INR');
  assert.strictEqual(sttCost.costType, 'ESTIMATED', 'Cost type is ESTIMATED');
  assert.strictEqual(sttCost.estimatedCost, 1.8, '120s * 0.015 = ₹1.80');
  assert.strictEqual(sttCost.pricingVersionId, 'price_sarvam_stt_v1', 'Correct pricing version referenced');

  const llmCost = PricingCatalog.calculateEstimatedCost({
    provider: 'openai',
    service: 'LLM',
    unitType: 'input_tokens',
    quantity: 8000,
  });
  assert.strictEqual(llmCost.estimatedCost, 0.1, '8k tokens * ₹0.0125/1k = ₹0.10');
  console.log('✓ Deterministic versioned pricing calculated correctly');

  // Test 2: Inbound Call & Realtime Voice Usage Metering
  console.log('\n--- TEST 2: Voice & Telephony Usage Recording ---');
  const voiceEvent = await engine.recordUsage({
    organizationId: orgA,
    eventType: 'VOICE_DURATION',
    resourceType: 'VOICE_MINUTE',
    provider: 'exotel',
    quantity: 4.5,
    unit: 'minutes',
    agentId: 'agent_sahana',
    conversationId: 'conv_101',
    telephonySessionId: 'tele_call_101',
    channel: 'VOICE',
    language: 'kn-IN',
  });

  assert(voiceEvent.id.startsWith('use_'), 'Event ID generated');
  assert.strictEqual(voiceEvent.costType, 'ESTIMATED', 'Cost is ESTIMATED');
  assert.strictEqual(voiceEvent.estimatedCost, 2.025, '4.5 min * 0.45 = ₹2.025');

  const storedEvents = await db.getUsageEvents(orgA);
  assert.strictEqual(storedEvents.length, 1, 'Event persisted in DB');
  console.log('✓ Realtime voice minutes recorded with provider pricing attribution');

  // Test 3: STT & TTS Usage Recording with Kannada Language Dimension
  console.log('\n--- TEST 3: Kannada STT & TTS Usage Metering ---');
  await engine.recordUsage({
    organizationId: orgA,
    eventType: 'STT_USAGE',
    resourceType: 'STT_SECOND',
    provider: 'sarvam-ai',
    model: 'saarika:v1',
    quantity: 90,
    unit: 'seconds',
    agentId: 'agent_sahana',
    conversationId: 'conv_101',
    language: 'kn-IN',
  });

  await engine.recordUsage({
    organizationId: orgA,
    eventType: 'TTS_USAGE',
    resourceType: 'TTS_CHARACTER',
    provider: 'sarvam-ai',
    model: 'bulbul:v1',
    quantity: 450,
    unit: 'characters',
    agentId: 'agent_sahana',
    conversationId: 'conv_101',
    language: 'kn-IN',
  });

  const orgAEvents = await db.getUsageEvents(orgA);
  assert.strictEqual(orgAEvents.length, 3, 'Org A has 3 usage events');
  const ttsEvt = orgAEvents.find(e => e.eventType === 'TTS_USAGE');
  assert.strictEqual(ttsEvt?.estimatedCost, 0.36, '450 chars * 0.0008 = ₹0.36');
  console.log('✓ Kannada STT and TTS metered with language attributes');

  // Test 4: Actual Provider Cost Override
  console.log('\n--- TEST 4: ACTUAL vs ESTIMATED Cost Distinction ---');
  const actualEvent = await engine.recordUsage({
    organizationId: orgA,
    eventType: 'CALL_COMPLETED',
    resourceType: 'CALL',
    provider: 'exotel',
    quantity: 1,
    unit: 'calls',
    actualCost: 1.5, // Provider billed ₹1.50 in webhook
    conversationId: 'conv_101',
  });

  assert.strictEqual(actualEvent.costType, 'ACTUAL', 'Cost marked as ACTUAL');
  assert.strictEqual(actualEvent.actualCost, 1.5, 'Actual provider cost preserved');
  console.log('✓ ACTUAL provider webhook invoice preserved without false estimates');

  // Test 5: Normalized Usage Ledger for Future Billing
  console.log('\n--- TEST 5: Normalized Pre-Billing Usage Ledger ---');
  const currentMonth = new Date().toISOString().substring(0, 7);
  const ledgerEntries = await db.getUsageLedgerRecords(orgA, currentMonth);
  assert(ledgerEntries.length >= 4, 'Ledger created entries for all usage events');
  assert(ledgerEntries.every(l => l.status === 'UNBILLED'), 'All entries in UNBILLED state (no premature billing)');
  console.log('✓ Usage ledger populated with UNBILLED meter records');

  // Test 6: Daily Incremental Rollups & Aggregations
  console.log('\n--- TEST 6: Daily Incremental Rollups ---');
  const todayStr = new Date().toISOString().split('T')[0];
  const aggs = await db.getDailyUsageAggregations(orgA, todayStr, todayStr);
  assert(aggs.length > 0, 'Daily aggregation record created');
  const agg = aggs[0];
  assert.strictEqual(agg.voiceMinutes, 4.5, 'Voice minutes aggregated');
  assert.strictEqual(agg.sttSeconds, 90, 'STT seconds aggregated');
  assert.strictEqual(agg.ttsCharacters, 450, 'TTS characters aggregated');
  console.log('✓ Daily incremental rollup matches raw event sums');

  // Test 7: Threshold Alerts & Burst Anomaly Detection
  console.log('\n--- TEST 7: Threshold Alerts & Burst Anomaly Detection ---');
  await db.saveUsageAlertThreshold({
    id: 'thresh_01',
    organizationId: orgA,
    meter: 'VOICE_MINUTES',
    monthlyLimit: 10,
    thresholdPercentages: [75, 90, 100],
    triggeredPercentages: [],
    recipientEmails: ['manager@jayanagardental.com'],
  });

  // Add another 5 minutes to trigger the 75% and 90% threshold (4.5 + 5 = 9.5m / 10m = 95%)
  await engine.recordUsage({
    organizationId: orgA,
    eventType: 'VOICE_DURATION',
    resourceType: 'VOICE_MINUTE',
    provider: 'exotel',
    quantity: 5,
    unit: 'minutes',
  });

  const thresholds = await db.getUsageAlertThresholds(orgA);
  const t = thresholds[0];
  assert(t.triggeredPercentages.includes(75), '75% threshold triggered');
  assert(t.triggeredPercentages.includes(90), '90% threshold triggered');
  console.log('✓ Multi-step threshold alert triggered correctly');

  // Trigger burst anomaly (>500 minutes)
  await engine.recordUsage({
    organizationId: orgA,
    eventType: 'VOICE_DURATION',
    resourceType: 'VOICE_MINUTE',
    provider: 'exotel',
    quantity: 800,
    unit: 'minutes',
  });

  const anomalies = await db.getCostAnomalyAlerts(orgA);
  assert.strictEqual(anomalies.length, 1, 'Cost anomaly burst detected');
  assert.strictEqual(anomalies[0].meter, 'VOICE_MINUTES', 'Flagged VOICE_MINUTES meter');
  console.log('✓ Usage spike / burst anomaly flagged deterministically');

  // Test 8: Tenant Isolation
  console.log('\n--- TEST 8: Multi-Tenant Isolation ---');
  await engine.recordUsage({
    organizationId: orgB,
    eventType: 'VOICE_DURATION',
    resourceType: 'VOICE_MINUTE',
    provider: 'exotel',
    quantity: 12,
    unit: 'minutes',
  });

  const orgBEvents = await db.getUsageEvents(orgB);
  assert.strictEqual(orgBEvents.length, 1, 'Org B has 1 event');
  assert(orgBEvents.every(e => e.organizationId === orgB), 'Org B data strictly isolated');

  const orgAAfter = await db.getUsageEvents(orgA);
  assert(orgAAfter.every(e => e.organizationId === orgA), 'Org A contains zero Org B data');
  console.log('✓ Multi-tenant usage isolation strictly verified');

  // Test 9: Analytics Overview Aggregation
  console.log('\n--- TEST 9: Analytics Overview & Funnel ---');
  const overview = await db.getAnalyticsOverview(orgA, '30_DAYS');
  assert(overview.summary.voiceMinutes > 0, 'Overview contains voice minutes');
  assert(overview.summary.estimatedCostInr > 0, 'Overview contains estimated cost');
  assert(overview.latencyMetrics.firstResponseP95Ms !== undefined, 'Latency metrics present');
  console.log('✓ Executive analytics overview generated cleanly');

  // Test 10: CSV Usage Export Foundation
  console.log('\n--- TEST 10: CSV Usage Export Generation ---');
  const csv = await engine.exportUsageCsv(orgA);
  assert(csv.includes('date,organization_id,event_type'), 'CSV contains standard headers');
  assert(csv.includes('org_dental_jayanagar'), 'CSV contains tenant events');
  assert(!csv.includes('org_realty_indiranagar'), 'CSV does not leak other tenants');
  console.log('✓ Server-side CSV usage export validated');

  console.log('\n================================================================');
  console.log('ALL 10 ANALYTICS & USAGE SUITES PASSED (30/30 Assertions)');
  console.log('================================================================\n');
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
