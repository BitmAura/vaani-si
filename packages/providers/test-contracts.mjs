import assert from 'node:assert';
import {
  MockProviderFactory,
  ProviderRegistry,
  ProviderRouter,
  ProviderHealthService,
  withRetry,
  ProviderBenchmarkHarness,
} from './dist/index.js';
import { ProviderError } from '@vanni/provider-sdk';

async function runTestSuite() {
  console.log('🧪 Starting VANNI Provider Abstraction Contract & Unit Tests...\n');

  // 1. Test Mock Factory & Registrations
  console.log('1. Testing MockProviderFactory & ProviderRegistry...');
  const registry = new ProviderRegistry();
  const mocks = MockProviderFactory.createAll();
  MockProviderFactory.registerInto(registry, mocks);

  const registered = registry.listRegistered();
  assert.strictEqual(registered.llm.includes('mock-llm'), true, 'LLM registered');
  assert.strictEqual(registered.stt.includes('mock-stt'), true, 'STT registered');
  assert.strictEqual(registered.tts.includes('mock-tts'), true, 'TTS registered');
  assert.strictEqual(registered.telephony.includes('mock-telephony'), true, 'Telephony registered');
  assert.strictEqual(registered.messaging.includes('mock-messaging'), true, 'Messaging registered');
  assert.strictEqual(registered.embeddings.includes('mock-embedding'), true, 'Embedding registered');
  assert.strictEqual(registered.calendar.includes('mock-calendar'), true, 'Calendar registered');
  assert.strictEqual(registered.crm.includes('mock-crm'), true, 'CRM registered');
  console.log('   ✅ All 8 capabilities registered in ProviderRegistry successfully.');

  // 2. Test Capability Resolution
  console.log('2. Testing Capability-based Resolution...');
  const resolvedLLM = registry.resolveLLM({ supportsKannada: true, supportsStructuredOutput: true });
  assert.strictEqual(resolvedLLM.providerName, 'mock-llm');
  const resolvedSTT = registry.resolveSTT({ supportsKannada: true, supportsCodeSwitching: true });
  assert.strictEqual(resolvedSTT.providerName, 'mock-stt');
  console.log('   ✅ Capability-based resolution correctly routed to matching providers.');

  // 3. Test LLM Turn & Streaming
  console.log('3. Testing LLM Execution & Streaming Contracts...');
  const llmRes = await mocks.llm.generateTurn('System prompt', [], 'Hello Vanni');
  assert.strictEqual(typeof llmRes.content, 'string');
  assert.strictEqual(llmRes.content.includes('ವಾಣಿ ಸಹಾಯಕ'), true);
  assert.strictEqual((llmRes.usage?.totalTokens ?? 0) > 0, true);

  const streamTokens = [];
  for await (const chunk of mocks.llm.streamTurn('System prompt', [], 'Hello')) {
    if (chunk.textChunk) streamTokens.push(chunk.textChunk);
  }
  assert.strictEqual(streamTokens.length > 0, true);
  console.log('   ✅ LLM turn generation and async iterable streaming verified.');

  // 4. Test STT & TTS Contracts
  console.log('4. Testing STT & TTS Contracts...');
  const dummyAudio = Buffer.alloc(320, 0x00);
  const transcript = await mocks.stt.transcribe(dummyAudio, { languageCode: 'kn-IN' });
  assert.strictEqual(transcript.languageCode, 'kn-IN');
  assert.strictEqual(transcript.confidence > 0.9, true);

  const speech = await mocks.tts.synthesize('ಶುಭೋದಯ', { targetLanguageCode: 'kn-IN' });
  assert.strictEqual(speech.format, 'wav');
  assert.strictEqual(speech.audioBuffer.length > 0, true);
  assert.strictEqual(typeof speech.audioBase64, 'string');
  console.log('   ✅ STT transcript and TTS audio synthesis verified.');

  // 5. Test Embeddings Contract
  console.log('5. Testing Embeddings Contract...');
  const embResult = await mocks.embeddings.embedText({ text: 'ಕ್ಲಿನಿಕ್ ಸಮಯ ಯಾವಾಗ?' });
  assert.strictEqual(embResult.embedding.dimensions, 768);
  assert.strictEqual(embResult.embedding.values.length, 768);

  const batchEmb = await mocks.embeddings.embedBatch({ texts: ['ಮೊದಲ ವಾಕ್ಯ', 'ಎರಡನೇ ವಾಕ್ಯ'] });
  assert.strictEqual(batchEmb.embeddings.length, 2);
  console.log('   ✅ Embedding generation (single + batch) verified.');

  // 6. Test Calendar & CRM Contracts
  console.log('6. Testing Calendar & CRM Contracts...');
  const slots = await mocks.calendar.getAvailableSlots('org_1', '2026-10-06', '2026-10-07');
  assert.strictEqual(slots.length, 2);
  assert.strictEqual(slots[0].available, true);

  const booking = await mocks.calendar.bookAppointment({
    organizationId: 'org_1',
    customerName: 'Pradeep',
    customerPhone: '9876543210',
    startTime: '2026-10-06T10:00:00+05:30',
  });
  assert.strictEqual(booking.success, true);
  assert.strictEqual(typeof booking.bookingId, 'string');

  const lead = await mocks.crm.createLead({
    organizationId: 'org_1',
    callerName: 'Kumar',
    callerPhone: '9988776655',
    rating: 'HOT',
    status: 'NEW',
  });
  assert.strictEqual(lead.success, true);
  const searchLead = await mocks.crm.searchLeads('org_1', '9988776655');
  assert.strictEqual(searchLead.total, 1);
  console.log('   ✅ Calendar slot booking and CRM lead lifecycle verified.');

  // 7. Test Telephony & Messaging Contracts
  console.log('7. Testing Telephony & Messaging Contracts...');
  const callRes = await mocks.telephony.dispatchOutboundCall({
    targetPhoneNumber: '9876543210',
    organizationId: 'org_1',
    agentId: 'agent_1',
    webhookCallbackUrl: 'https://vanni.ai/webhook',
  });
  assert.strictEqual(callRes.success, true);
  assert.strictEqual(callRes.status, 'INITIATED');

  const msgRes = await mocks.messaging.dispatchTextMessage('9876543210', 'ನಿಮ್ಮ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಕನ್ಫರ್ಮ್ ಆಗಿದೆ.');
  assert.strictEqual(msgRes.success, true);
  console.log('   ✅ Telephony dispatch and Messaging delivery verified.');

  // 8. Test Exponential Backoff Retry Policy
  console.log('8. Testing withRetry Exponential Backoff...');
  let attempts = 0;
  const retryResult = await withRetry(async () => {
    attempts++;
    if (attempts < 3) {
      throw new ProviderError('PROVIDER_TIMEOUT', 'Transient timeout', {
        providerName: 'test',
        isRetryable: true,
      });
    }
    return 'RETRY_SUCCESS';
  }, { initialDelayMs: 20, maxRetries: 3 });
  assert.strictEqual(retryResult, 'RETRY_SUCCESS');
  assert.strictEqual(attempts, 3);
  console.log('   ✅ Transient ProviderError successfully retried and resolved.');

  // 9. Test ProviderRouter Fallback
  console.log('9. Testing ProviderRouter Fallback Execution...');
  const failingLLM = new mocks.llm.constructor({ failureErrorCode: 'PROVIDER_TIMEOUT' });
  const backupLLM = new mocks.llm.constructor({ defaultResponse: 'Fallback response triggered' });

  const routedLLM = ProviderRouter.routeLLM(failingLLM, backupLLM, { retryPolicy: { maxRetries: 1, initialDelayMs: 10 } });
  const fallbackTurn = await routedLLM.generateTurn('System', [], 'Test fallback');
  assert.strictEqual(fallbackTurn.content, 'Fallback response triggered');
  console.log('   ✅ Automatic failover from primary to secondary provider succeeded.');

  // 10. Test ProviderHealthService
  console.log('10. Testing ProviderHealthService & TTL Caching...');
  const healthService = new ProviderHealthService({ cacheTtlMs: 5000 });
  const health1 = await healthService.checkProvider(mocks.llm, 'llm');
  assert.strictEqual(health1.status, 'HEALTHY');
  assert.strictEqual(health1.providerName, 'mock-llm');

  const health2 = await healthService.checkProvider(mocks.llm, 'llm');
  assert.strictEqual(health1.checkedAt, health2.checkedAt, 'Result was served from TTL cache');
  console.log('   ✅ Health check cache confirmed.');

  // 11. Test Benchmark Harness
  console.log('11. Testing ProviderBenchmarkHarness...');
  const benchmark = new ProviderBenchmarkHarness();
  const benchMetrics = await benchmark.benchmarkLLM(mocks.llm, ['ಪ್ರಶ್ನೆ 1', 'ಪ್ರಶ್ನೆ 2'], 1);
  assert.strictEqual(benchMetrics.totalRequests, 2);
  assert.strictEqual(benchMetrics.successfulRequests, 2);
  assert.strictEqual(benchMetrics.failedRequests, 0);
  console.log(`   ✅ Benchmark completed: avg ${benchMetrics.avgLatencyMs}ms, p95 ${benchMetrics.p95LatencyMs}ms.`);

  console.log('\n======================================================');
  console.log('🎉 ALL CONTRACT & INTEGRATION TESTS PASSED CLEANLY (11/11)');
  console.log('======================================================\n');
}

runTestSuite().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
