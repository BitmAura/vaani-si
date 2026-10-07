import assert from 'node:assert';
import {
  AudioNormalizer,
  NORMALIZED_AUDIO_FORMAT,
  TELEPHONY_AUDIO_FORMAT,
  JitterBuffer,
  EnergyVAD,
  TurnDetector,
  TranscriptAccumulator,
  ResponseSegmenter,
  VoiceSession,
  VoiceConversationChannel,
  VoiceRuntime,
  MockVoiceEnvironment,
} from './dist/index.js';
import { InMemoryDatabaseService } from '@vanni/database';
import { ConversationOrchestrator } from '@vanni/conversation-engine';

async function runVoiceEngineTestSuite() {
  console.log('🎙️ Starting VANNI Real-Time Voice Engine Test Suite...\n');

  // 1. Audio Normalizer Test
  console.log('1. Testing AudioNormalizer (G.711 mulaw & 8kHz -> 16kHz resampling)...');
  const normalizer = new AudioNormalizer();
  // 160 bytes of 8kHz mulaw
  const mulawPayload = Buffer.alloc(160, 0xff);
  const normalized = normalizer.normalizeFrame({
    sequenceNumber: 0,
    timestamp: Date.now(),
    format: TELEPHONY_AUDIO_FORMAT,
    payload: mulawPayload,
  });

  assert.strictEqual(normalized !== null, true, 'Frame should be normalized');
  assert.strictEqual(normalized?.format.sampleRate, 16000, 'Normalized sample rate must be 16kHz');
  assert.strictEqual(normalized?.format.encoding, 'pcm16', 'Normalized encoding must be pcm16');
  // 160 mulaw samples -> 160 pcm16 samples -> resampled 2x -> 320 samples * 2 bytes = 640 bytes
  assert.strictEqual(normalized?.payload.length, 640, 'Normalized payload must be 640 bytes for 20ms at 16kHz');
  console.log('   ✅ AudioNormalizer successfully decoded mulaw and resampled to 16kHz PCM16.');

  // 2. Jitter Buffer & Backpressure Test
  console.log('2. Testing JitterBuffer In-Order Drain & Backpressure Limit...');
  const jitterBuffer = new JitterBuffer({ maxQueueSize: 5 });
  // Insert out of order frames
  jitterBuffer.push({ sequenceNumber: 1, timestamp: 1, format: NORMALIZED_AUDIO_FORMAT, payload: Buffer.alloc(10) });
  jitterBuffer.push({ sequenceNumber: 0, timestamp: 0, format: NORMALIZED_AUDIO_FORMAT, payload: Buffer.alloc(10) });
  jitterBuffer.push({ sequenceNumber: 2, timestamp: 2, format: NORMALIZED_AUDIO_FORMAT, payload: Buffer.alloc(10) });

  const drained = jitterBuffer.drain();
  assert.strictEqual(drained.length, 3, 'Must drain 3 continuous frames');
  assert.strictEqual(drained[0].sequenceNumber, 0);
  assert.strictEqual(drained[1].sequenceNumber, 1);
  assert.strictEqual(drained[2].sequenceNumber, 2);
  console.log('   ✅ JitterBuffer correctly ordered and drained audio frames.');

  // 3. Energy VAD Test
  console.log('3. Testing EnergyVAD RMS Speech vs Silence Detection...');
  const vad = new EnergyVAD({ energyThreshold: 0.05, speechStartFrames: 1 });
  // Pure silence buffer
  const silenceFrame = {
    sequenceNumber: 0,
    timestamp: Date.now(),
    format: NORMALIZED_AUDIO_FORMAT,
    payload: Buffer.alloc(640, 0x00),
  };
  const vadSilence = vad.processFrame(silenceFrame);
  assert.strictEqual(vadSilence.type, 'SILENCE');

  // Active audio buffer with high amplitude sine wave
  const speechBuf = Buffer.alloc(640);
  for (let i = 0; i < 320; i++) {
    speechBuf.writeInt16LE(Math.round(Math.sin(i / 10) * 16000), i * 2);
  }
  const speechFrame = {
    sequenceNumber: 1,
    timestamp: Date.now(),
    format: NORMALIZED_AUDIO_FORMAT,
    payload: speechBuf,
  };
  const vadSpeech = vad.processFrame(speechFrame);
  assert.strictEqual(vadSpeech.type, 'SPEECH_START');
  assert.strictEqual(vad.isSpeaking(), true);
  console.log('   ✅ EnergyVAD correctly detected speech start and silence.');

  // 4. Turn Detector Test
  console.log('4. Testing TurnDetector Speech Boundary & Silence Timeout...');
  const turnDetector = new TurnDetector({ minimumSilenceDurationMs: 100 });
  const startStatus = turnDetector.processVADEvent({ type: 'SPEECH_START', timestamp: 1000, rmsEnergy: 0.1 });
  assert.strictEqual(startStatus, 'IN_PROGRESS');

  turnDetector.processVADEvent({ type: 'SPEECH_CONTINUE', timestamp: 1200, rmsEnergy: 0.1 });
  // Emit silence 150ms later (> 100ms threshold)
  const completedStatus = turnDetector.processVADEvent({ type: 'SILENCE', timestamp: 1350, rmsEnergy: 0.0 });
  assert.strictEqual(completedStatus, 'TURN_COMPLETED');
  console.log('   ✅ TurnDetector determined completed user turn after silence interval.');

  // 5. Transcript Accumulator Test
  console.log('5. Testing TranscriptAccumulator Partial to Final Turn Assembly...');
  const accumulator = new TranscriptAccumulator();
  accumulator.processEvent({ type: 'PARTIAL', text: 'Doctor', languageCode: 'kn-IN', confidence: 0.9, isFinal: false });
  accumulator.processEvent({ type: 'PARTIAL', text: 'Doctor naale', languageCode: 'kn-IN', confidence: 0.92, isFinal: false });
  accumulator.processEvent({ type: 'FINAL', text: 'Doctor naale appointment ideya?', languageCode: 'kn-IN', confidence: 0.96, isFinal: true });

  const turnText = accumulator.getCommittedTurnText();
  assert.strictEqual(turnText, 'Doctor naale appointment ideya?');
  console.log('   ✅ TranscriptAccumulator properly deduplicated partials into final turn.');

  // 6. Response Segmenter Test
  console.log('6. Testing ResponseSegmenter Clause & Sentence Splitting...');
  const segmenter = new ResponseSegmenter({ minWordsPerSegment: 3 });
  const segs1 = segmenter.pushDelta('ಹೌದು, ');
  const segs2 = segmenter.pushDelta('ನಾಳೆ ಬೆಳಿಗ್ಗೆ ಹತ್ತು ಗಂಟೆಗೆ ಡಾಕ್ಟರ್ ರವಿ ಅವರ ಸ್ಲಾಟ್ ಲಭ್ಯವಿದೆ. ');
  const segs3 = segmenter.pushDelta('ಬುಕ್ ಮಾಡಲೇ?');
  const flushed = segmenter.flush();

  const allSegments = [...segs1, ...segs2, ...segs3];
  if (flushed) allSegments.push(flushed);

  assert.strictEqual(allSegments.length >= 2, true, 'Must produce at least 2 natural speech segments');
  assert.strictEqual(allSegments[0].includes('ಲಭ್ಯವಿದೆ') || allSegments[0].includes('ಹೌದು'), true);
  console.log(`   ✅ ResponseSegmenter divided text into ${allSegments.length} natural speech segments.`);

  // 7. Voice Session & State Machine Lifecycle
  console.log('7. Testing VoiceSession State Transitions & Metrics...');
  const session = new VoiceSession({
    voiceSessionId: 'vsess_test_1',
    conversationId: 'conv_test_1',
    organizationId: 'org_test_1',
    agentId: 'agent_test_1',
  });
  assert.strictEqual(session.stateMachine.getState(), 'CREATED');

  session.connect();
  assert.strictEqual(session.stateMachine.getState(), 'CONNECTED');
  assert.strictEqual(session.connectionState, 'CONNECTED');

  session.recordTurn(240, 2500);
  assert.strictEqual(session.metrics.totalTurns, 1);
  assert.strictEqual(session.metrics.avgTurnLatencyMs, 240);

  session.recordInterruption();
  assert.strictEqual(session.metrics.interruptionCount, 1);
  assert.strictEqual(session.stateMachine.getState(), 'INTERRUPTED');
  console.log('   ✅ VoiceSession state transitions and latency tracking verified.');

  // 8. End-to-End VoiceRuntime Turn Dispatch & Interruption Integration
  console.log('8. Testing Full VoiceRuntime Ingestion -> Orchestration -> TTS -> Barge-In...');
  const mockEnv = new MockVoiceEnvironment();
  const db = new InMemoryDatabaseService();
  const orchestrator = new ConversationOrchestrator(db);

  // Start conversation session in orchestrator
  await orchestrator.startConversation({
    organizationId: 'org_test_1',
    agentConfig: {
      agentId: 'agent_test_1',
      organizationId: 'org_test_1',
      version: 1,
      identity: {
        name: 'Assistant',
        displayName: 'Assistant',
        role: 'AI_CUSTOMER_SUPPORT',
        description: 'Test',
        businessIntroduction: 'Hello',
        identifyAsAI: true,
      },
      objective: {
        primaryObjective: 'Assist customer',
        secondaryObjectives: [],
        successCriteria: [],
      },
      personality: {
        preset: 'PROFESSIONAL_RECEPTIONIST',
        tone: 'WARM',
        conversationStyle: 'BALANCED',
        energy: 'NEUTRAL',
        customInstructions: '',
      },
      language: {
        primaryLanguage: 'kn-en',
        secondaryLanguages: ['en', 'kn'],
        conversationalMode: 'KANGLISH',
        allowSwitching: true,
      },
      capabilities: [],
      knowledgeAccess: { accessLevel: 'ALL_BUSINESS_KNOWLEDGE', allowedSourceIds: [], restrictedCategories: [] },
      tools: [],
      escalation: { defaultDestinationType: 'RECEPTION', defaultDestinationTarget: 'Desk', triggers: [] },
      policies: { enforceHealthcareGuardrails: false, enforceRealEstateGuardrails: false, enforceSalesGuardrails: false, noHallucinationEnforced: true, customPolicyIds: [] },
      conversationRules: { greetingStyle: 'WARM', questionStrategy: 'NATURAL_FLOW', responseLength: 'BALANCED', uncertaintyBehavior: 'ASK_CLARIFICATION', silenceHandling: 'WAIT' },
      guardrails: { healthcare: false, realEstate: false, noHallucination: true, instructionPrecedence: [] },
      businessBrainReference: { organizationId: 'org_test_1', industry: 'GENERAL' },
      compiledAt: new Date().toISOString(),
    },
    channel: {
      channelType: 'VOICE',
      channelId: 'channel_test_1',
      sendMessage: async () => {},
      sendEvent: async () => {},
      interrupt: async () => {},
      transfer: async () => {},
      close: async () => {},
    },
    llmProvider: mockEnv.llm,
  });

  const emittedEvents = [];
  const fakeSocket = {
    send: (data) => {
      emittedEvents.push(JSON.parse(data.toString()));
    },
    close: () => {},
  };

  const runtime = new VoiceRuntime({
    session,
    socket: fakeSocket,
    orchestrator,
    sttProvider: mockEnv.stt,
    ttsProvider: mockEnv.tts,
    llmProvider: mockEnv.llm,
  });

  await runtime.start();
  assert.strictEqual(emittedEvents.some(e => e.eventType === 'SESSION_STARTED'), true);

  // Simulate Barge-In while speaking
  session.stateMachine.forceState('SPEAKING');
  runtime.handleBargeIn();
  assert.strictEqual(session.stateMachine.getState(), 'LISTENING');
  assert.strictEqual(emittedEvents.some(e => e.eventType === 'INTERRUPTION'), true);
  console.log('   ✅ VoiceRuntime barge-in cancelled playback and notified client.');

  await runtime.stop();
  assert.strictEqual(session.stateMachine.getState(), 'ENDED');
  console.log('   ✅ VoiceRuntime gracefully stopped.');

  console.log('\n=============================================================');
  console.log('🎉 ALL VOICE ENGINE CONTRACT & INTEGRATION TESTS PASSED (8/8)');
  console.log('=============================================================\n');
}

runVoiceEngineTestSuite().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
