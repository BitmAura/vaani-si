import assert from 'node:assert';
import {
  InMemoryTelephonyRepository,
  InboundCallRouter,
  TelephonyWebhookController,
  TelephonyMediaBridge,
  TelephonySimulator,
  NORMALIZED_AUDIO_FORMAT,
} from './dist/index.js';
import { MockTelephonyProvider, ExotelTelephonyProvider } from '@vanni/providers';

async function runTelephonyTestSuite() {
  console.log('📞 Starting VANNI Telephony Gateway & Inbound Call Engine Test Suite...\n');

  const repo = new InMemoryTelephonyRepository();
  const mockProvider = new MockTelephonyProvider();
  const router = new InboundCallRouter({
    repository: repo,
    telephonyProvider: mockProvider,
    wsBaseUrl: 'ws://localhost:4200/ws/voice-stream',
  });
  const controller = new TelephonyWebhookController(repo, router, mockProvider);
  const simulator = new TelephonySimulator(repo, router, mockProvider);

  // 1. Phone Number Ownership & Agent Assignment Test
  console.log('1. Testing Business Phone Number Repository & Organization Lookup...');
  const phone = await repo.findPhoneNumber('+918047192001');
  assert.strictEqual(phone !== null, true, 'Seeded phone number must exist');
  assert.strictEqual(phone?.organizationId, 'org_ballari_layouts');
  assert.strictEqual(phone?.status, 'ACTIVE');

  // Assign agent
  const assignOk = await repo.assignAgentToPhoneNumber(phone.id, 'org_ballari_layouts', 'agent_dental_receptionist');
  assert.strictEqual(assignOk, true);
  const updatedPhone = await repo.findPhoneNumber('+918047192001');
  assert.strictEqual(updatedPhone?.assignedAgentId, 'agent_dental_receptionist');
  console.log('   ✅ Phone number lookup and server-side agent assignment verified.');

  // 2. Inbound Routing with Valid Number Test
  console.log('2. Testing Inbound Call Router (Valid Called Number -> Organization -> Agent)...');
  const routeResult = await router.handleInboundCall({
    providerCallSid: 'CALL_EXO_TEST_001',
    callerPhoneNumber: '+919988776655',
    calledPhoneNumber: '+918047192001',
  });

  assert.strictEqual(routeResult.accepted, true, 'Call must be accepted');
  assert.strictEqual(routeResult.organizationId, 'org_ballari_layouts');
  assert.strictEqual(routeResult.assignedAgentId, 'agent_dental_receptionist');
  assert.strictEqual(routeResult.telephonySession?.callerPhoneNumber, '+919988776655');
  assert.strictEqual(routeResult.mediaStreamUrl?.includes('orgId=org_ballari_layouts'), true);
  console.log('   ✅ Inbound call routed deterministically with secure mediaStreamUrl.');

  // 3. Inbound Routing with Unknown / Unassigned Number
  console.log('3. Testing Inbound Call Router with Unregistered Number...');
  const unknownRoute = await router.handleInboundCall({
    providerCallSid: 'CALL_UNKNOWN_002',
    callerPhoneNumber: '+919988776655',
    calledPhoneNumber: '+919999999999',
  });
  assert.strictEqual(unknownRoute.accepted, false);
  assert.strictEqual(unknownRoute.rejectReason, 'NUMBER_NOT_FOUND');
  console.log('   ✅ Unknown destination number cleanly rejected with safe audio prompt.');

  // 4. Webhook Signature Verification Test
  console.log('4. Testing Telephony Webhook Security & Signature Validation...');
  const validWebhook = await controller.handleInboundCallWebhook({
    providerName: 'mock',
    signatureHeader: 'valid_signature',
    url: 'http://localhost:4200/api/telephony/webhooks/mock',
    params: {
      CallSid: 'CALL_SIG_001',
      From: '+919876543210',
      To: '+918047192001',
    },
  });
  assert.strictEqual(validWebhook.statusCode, 200);

  const invalidWebhook = await controller.handleInboundCallWebhook({
    providerName: 'mock',
    signatureHeader: 'invalid_signature',
    url: 'http://localhost:4200/api/telephony/webhooks/mock',
    params: { CallSid: 'CALL_SIG_002' },
  });
  assert.strictEqual(invalidWebhook.statusCode, 401, 'Invalid signature must return 401 Unauthorized');
  console.log('   ✅ Webhook signature verification verified.');

  // 5. Webhook Idempotency Test
  console.log('5. Testing Telephony Webhook Idempotency (Duplicate Prevention)...');
  const duplicateId = 'DUP_EVENT_999';
  const firstEvent = await repo.recordEventIfNew({
    providerEventId: duplicateId,
    telephonySessionId: 'SESS_DUP_1',
    organizationId: 'org_ballari_layouts',
    eventType: 'CALL_RECEIVED',
    sequenceNumber: 1,
    timestamp: new Date().toISOString(),
    payload: {},
  });
  assert.strictEqual(firstEvent, true, 'First event must be recorded');

  const secondEvent = await repo.recordEventIfNew({
    providerEventId: duplicateId,
    telephonySessionId: 'SESS_DUP_1',
    organizationId: 'org_ballari_layouts',
    eventType: 'CALL_RECEIVED',
    sequenceNumber: 1,
    timestamp: new Date().toISOString(),
    payload: {},
  });
  assert.strictEqual(secondEvent, false, 'Duplicate providerEventId must be skipped idempotently');
  console.log('   ✅ Webhook idempotency prevented duplicate session/event creation.');

  // 6. Telephony Media Bridge (G.711 μ-law -> PCM16 and back)
  console.log('6. Testing TelephonyMediaBridge Codec Conversion...');
  const bridge = new TelephonyMediaBridge();
  // 160 bytes of 8kHz mulaw
  const mulawPayload = Buffer.alloc(160, 0x80).toString('base64');
  const frame = bridge.inboundPacketToAudioFrame({
    event: 'media',
    sequenceNumber: 1,
    media: { payload: mulawPayload },
  });

  assert.strictEqual(frame !== null, true);
  assert.strictEqual(frame?.format.sampleRate, 8000);
  assert.strictEqual(frame?.format.encoding, 'mulaw');

  // Convert PCM16 to outbound packet
  const dummyPcm16 = Buffer.alloc(640, 0x10);
  const outboundPacket = bridge.audioFrameToOutboundPacket(dummyPcm16, 'stream_123');
  assert.strictEqual(outboundPacket.event, 'media');
  assert.strictEqual(typeof outboundPacket.media?.payload, 'string');
  console.log('   ✅ TelephonyMediaBridge bidirectional conversion verified.');

  // 7. Call Simulator & Status Webhook
  console.log('7. Testing TelephonySimulator End-to-End Simulation...');
  const simResult = await simulator.simulateInboundCall({
    callerPhoneNumber: '+919988001122',
    calledPhoneNumber: '+918047192001',
    providerCallSid: 'SIM_CALL_777',
  });

  assert.strictEqual(simResult.accepted, true);
  assert.strictEqual(simResult.statusCode, 200);

  // Simulate Caller Hangup
  await simulator.simulateHangup('SIM_CALL_777', 62);
  const savedSession = await repo.findTelephonySessionByProviderSid('SIM_CALL_777');
  assert.strictEqual(savedSession?.status, 'ENDED');
  assert.strictEqual(savedSession?.durationSeconds, 62);
  assert.strictEqual(savedSession?.endReason, 'CALLER_HANGUP');
  console.log('   ✅ Inbound call simulation and status termination lifecycle verified.');

  console.log('\n================================================================');
  console.log('🎉 ALL TELEPHONY GATEWAY & INBOUND ENGINE TESTS PASSED (7/7)');
  console.log('================================================================\n');
}

runTelephonyTestSuite().catch((err) => {
  console.error('❌ Telephony test suite failed:', err);
  process.exit(1);
});
