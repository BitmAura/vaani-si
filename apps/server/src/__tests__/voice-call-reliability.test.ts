import { describe, it, expect, beforeEach } from 'vitest';
import {
  CallLifecycleManager,
  CanonicalCallStatus,
} from '../../../../packages/voice-engine/src/telephony/call-lifecycle';
import {
  ExotelTelephonyProvider,
  validateIndianPhoneNumber,
} from '../../../../packages/providers/src/telephony/exotel-gateway';
import { AudioConversationPipeline } from '../audio-pipeline';
import { globalDb, InMemoryDatabaseService } from '@vanni/database';
import { buildServer } from '../server';
import crypto from 'node:crypto';

describe('Prompt 08: End-to-End Voice Call Reliability & Telephony Integration', () => {
  let memDb: InMemoryDatabaseService;
  let lifecycle: CallLifecycleManager;

  beforeEach(() => {
    memDb = new InMemoryDatabaseService();
    lifecycle = new CallLifecycleManager(memDb);
  });

  // =========================================================================
  // 1. CALL LIFECYCLE & STATE TRANSITION TESTS
  // =========================================================================
  describe('Call Lifecycle State Machine', () => {
    it('initializes call in INITIATED state and records in persistence', async () => {
      const session = lifecycle.initializeCall({
        callId: 'call_test_001',
        organizationId: 'org_123',
        direction: 'OUTBOUND',
        callerPhone: '+919845012345',
        callerName: 'Ramesh Patil',
      });

      expect(session.currentStatus).toBe('INITIATED');
      expect(session.callId).toBe('call_test_001');
      expect(session.history.length).toBe(1);
      expect(session.history[0].status).toBe('INITIATED');

      const saved = await memDb.getCallById('call_test_001');
      expect(saved).toBeDefined();
      expect(saved?.status).toBe('INITIATED');
    });

    it('allows valid sequential state transitions: INITIATED -> RINGING -> IN_PROGRESS -> COMPLETED', async () => {
      lifecycle.initializeCall({
        callId: 'call_seq_001',
        organizationId: 'org_123',
        direction: 'INBOUND',
        callerPhone: '+919845012345',
      });

      // 1. INITIATED -> RINGING
      const r1 = await lifecycle.transition({
        callId: 'call_seq_001',
        provider: 'exotel',
        targetStatus: 'RINGING',
        providerEventId: 'evt_ring_1',
      });
      expect(r1.success).toBe(true);
      expect(r1.session?.currentStatus).toBe('RINGING');
      expect(r1.session?.ringingAt).toBeDefined();

      // 2. RINGING -> IN_PROGRESS
      const r2 = await lifecycle.transition({
        callId: 'call_seq_001',
        provider: 'exotel',
        targetStatus: 'IN_PROGRESS',
        providerEventId: 'evt_ans_1',
      });
      expect(r2.success).toBe(true);
      expect(r2.session?.currentStatus).toBe('IN_PROGRESS');
      expect(r2.session?.answeredAt).toBeDefined();

      // 3. IN_PROGRESS -> COMPLETED with duration
      const r3 = await lifecycle.transition({
        callId: 'call_seq_001',
        provider: 'exotel',
        targetStatus: 'COMPLETED',
        providerEventId: 'evt_comp_1',
        rawDurationSeconds: 125,
        costInr: 1.77,
      });
      expect(r3.success).toBe(true);
      expect(r3.session?.currentStatus).toBe('COMPLETED');
      expect(r3.session?.durationSeconds).toBe(125);
      expect(r3.session?.costInr).toBe(1.77);
      expect(r3.session?.endedAt).toBeDefined();

      // Verify authoritative database persistence
      const persisted = await memDb.getCallById('call_seq_001');
      expect(persisted?.status).toBe('COMPLETED');
      expect(persisted?.durationSeconds).toBe(125);
    });

    it('rejects invalid state transitions from terminal states (COMPLETED -> IN_PROGRESS)', async () => {
      lifecycle.initializeCall({
        callId: 'call_term_001',
        organizationId: 'org_123',
        direction: 'INBOUND',
        callerPhone: '+919845012345',
      });

      await lifecycle.transition({
        callId: 'call_term_001',
        provider: 'exotel',
        targetStatus: 'IN_PROGRESS',
      });

      await lifecycle.transition({
        callId: 'call_term_001',
        provider: 'exotel',
        targetStatus: 'COMPLETED',
      });

      // Attempt to revive completed call
      const invalidTransition = await lifecycle.transition({
        callId: 'call_term_001',
        provider: 'exotel',
        targetStatus: 'IN_PROGRESS',
      });

      expect(invalidTransition.success).toBe(false);
      expect(invalidTransition.error).toContain('Cannot transition from terminal state COMPLETED');
      expect(invalidTransition.session?.currentStatus).toBe('COMPLETED');
    });

    it('safely deduplicates identical provider webhooks', async () => {
      lifecycle.initializeCall({
        callId: 'call_dedup_001',
        organizationId: 'org_123',
        direction: 'OUTBOUND',
        callerPhone: '+919845012345',
      });

      // First webhook event
      const res1 = await lifecycle.transition({
        callId: 'call_dedup_001',
        provider: 'exotel',
        targetStatus: 'RINGING',
        providerEventId: 'webhook_evt_unique_101',
      });
      expect(res1.success).toBe(true);
      expect(res1.isDuplicate).toBeUndefined();

      // Duplicate delivery of the exact same webhook
      const res2 = await lifecycle.transition({
        callId: 'call_dedup_001',
        provider: 'exotel',
        targetStatus: 'RINGING',
        providerEventId: 'webhook_evt_unique_101',
      });
      expect(res2.success).toBe(true);
      expect(res2.isDuplicate).toBe(true);
    });
  });

  // =========================================================================
  // 2. EXOTEL INTEGRATION & PHONE VALIDATION TESTS
  // =========================================================================
  describe('Exotel Telephony Adapter & Phone Validation', () => {
    it('validates and formats legitimate Indian mobile numbers (+91, 10-digit)', () => {
      const v1 = validateIndianPhoneNumber('+91 98450 12345');
      expect(v1.isValid).toBe(true);
      expect(v1.normalized).toBe('+919845012345');

      const v2 = validateIndianPhoneNumber('9845012345');
      expect(v2.isValid).toBe(true);
      expect(v2.normalized).toBe('+919845012345');

      const v3 = validateIndianPhoneNumber('08123456789');
      expect(v3.isValid).toBe(true);
      expect(v3.normalized).toBe('+918123456789');
    });

    it('rejects invalid or malformed telephone numbers', () => {
      const bad1 = validateIndianPhoneNumber('12345');
      expect(bad1.isValid).toBe(false);
      expect(bad1.error).toContain('Invalid Indian mobile number');

      const bad2 = validateIndianPhoneNumber('not-a-number');
      expect(bad2.isValid).toBe(false);

      const bad3 = validateIndianPhoneNumber('+14155552671'); // Non-Indian international number
      expect(bad3.isValid).toBe(false);
    });

    it('verifies HMAC-SHA256 webhook signatures with timing-safe comparison', () => {
      const provider = new ExotelTelephonyProvider({
        webhookSecret: 'test_exotel_secret_key_123',
      });

      const url = 'https://api.vanni.ai/api/telephony/cdr';
      const params = { CallSid: 'EXO_12345', Status: 'completed' };
      const sortedKeys = Object.keys(params).sort();
      const paramStr = sortedKeys.map(k => `${k}=${params[k as keyof typeof params]}`).join('');
      const payload = `${url}${paramStr}`;
      const validSig = crypto.createHmac('sha256', 'test_exotel_secret_key_123').update(payload).digest('hex');

      // Valid signature passes
      const check1 = provider.verifyWebhookSignature(validSig, url, params);
      expect(check1.isValid).toBe(true);

      // Forged signature rejected
      const check2 = provider.verifyWebhookSignature('forged_signature_0000000000000000000000000000000000000000000000000000000000000000', url, params);
      expect(check2.isValid).toBe(false);
    });

    it('enforces rate limiting on outbound calls per organization', async () => {
      const provider = new ExotelTelephonyProvider();
      const orgId = 'org_rate_test';

      // 5 calls allowed
      for (let i = 0; i < 5; i++) {
        const res = await provider.dispatchOutboundCall({
          targetPhoneNumber: '+919845012345',
          organizationId: orgId,
          agentId: 'agent_1',
          webhookCallbackUrl: 'http://localhost:4000/callback',
        });
        expect(res.success).toBe(true);
      }

      // 6th call should be blocked by rate limit
      const blocked = await provider.dispatchOutboundCall({
        targetPhoneNumber: '+919845012345',
        organizationId: orgId,
        agentId: 'agent_1',
        webhookCallbackUrl: 'http://localhost:4000/callback',
      });
      expect(blocked.success).toBe(false);
      expect(blocked.status).toBe('FAILED');
      expect(blocked.errorMessage).toContain('Rate limit exceeded');
    });
  });

  // =========================================================================
  // 3. AUDIO STREAMING, BARGE-IN & TOOL EXECUTION TESTS
  // =========================================================================
  describe('Audio Conversation Pipeline & Duplex Barge-In', () => {
    const dummyTenant = {
      id: 'tenant_audio_test',
      name: 'Ballari Residential Layouts',
      industry: 'REAL_ESTATE' as const,
      virtualPhoneNumber: '+918047192000',
      ownerWhatsAppNumber: '+919845012345',
      dialect: 'KANNADA_STANDARD_POLITE' as const,
      monthlyMinuteLimit: 1000,
      minutesUsedCurrentMonth: 25,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      knowledge: {
        companyName: 'Ballari Residential Layouts',
        industry: 'REAL_ESTATE' as const,
        primaryDialect: 'KANNADA_STANDARD_POLITE' as const,
        officeTimings: '9:00 AM - 7:00 PM',
        catalogSummary: 'Plotted layouts 30x40 at 18 Lakhs with DC conversion and clear title.',
        faqs: [],
      },
    };

    it('handles silence VAD detection and processes user utterance', async () => {
      const pipeline = new AudioConversationPipeline(dummyTenant);
      let receivedTranscript = false;

      const events = {
        onTranscript: (speaker: 'USER' | 'AGENT', text: string) => {
          if (speaker === 'USER') receivedTranscript = true;
        },
        onLatencyBreakdown: () => {},
        onAudioChunk: () => {},
      };

      // Push raw PCM silence buffer
      const pcmChunk = Buffer.alloc(320); // 10ms frame at 16kHz
      pipeline.pushAudioChunk(pcmChunk, events);

      // Trigger user utterance turn
      await pipeline.processUserUtterance(events, 'Plot rate eshtu ide sir?');
      expect(receivedTranscript).toBe(true);
    });

    it('triggers immediate duplex barge-in interruption when caller speaks over agent', async () => {
      const pipeline = new AudioConversationPipeline(dummyTenant);
      let interrupted = false;

      const events = {
        onTranscript: () => {},
        onLatencyBreakdown: () => {},
        onAudioChunk: () => {},
        onInterrupt: () => {
          interrupted = true;
        },
      };

      // Simulate agent currently speaking
      (pipeline as any).isAgentSpeaking = true;

      // Create high-energy PCM buffer (> 2.5% RMS threshold)
      const highEnergyChunk = Buffer.alloc(640);
      for (let i = 0; i < 320; i++) {
        highEnergyChunk.writeInt16LE(15000, i * 2); // loud speech sample
      }

      pipeline.pushAudioChunk(highEnergyChunk, events);
      expect(interrupted).toBe(true);
      expect((pipeline as any).isAgentSpeaking).toBe(false);
    });

    it('executes authoritative typed tools and passes ground truth to conversation', async () => {
      const pipeline = new AudioConversationPipeline(dummyTenant, false, undefined, 'call_tool_test', 'tenant_audio_test');
      let toolExecuted = false;

      const events = {
        onTranscript: () => {},
        onLatencyBreakdown: () => {},
        onAudioChunk: () => {},
        onToolExecuted: (name: string, success: boolean) => {
          if (name === 'create_lead' && success) {
            toolExecuted = true;
          }
        },
      };

      await pipeline.processUserUtterance(events, 'Ee Sunday layout site visit nodbeku');
      expect(toolExecuted).toBe(true);

      const history = pipeline.getHistory();
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[0].role).toBe('user');
      expect(history[1].role).toBe('model');
    });
  });

  // =========================================================================
  // 4. SERVER HTTP ENDPOINTS & TELEPHONY DIAGNOSTICS TESTS
  // =========================================================================
  describe('Server Telephony & Inbound Endpoints', () => {
    it('GET /api/telephony/diagnostics returns provider readiness and lifecycle states', async () => {
      const server = await buildServer();
      const res = await server.inject({
        method: 'GET',
        url: '/api/telephony/diagnostics',
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);
      expect(data.telephony.provider).toBe('Exotel');
      expect(data.speech.sttPrimary).toContain('Sarvam Saaras');
      expect(data.speech.speechFallback).toContain('Azure Cognitive Services');
      expect(data.callLifecycle.allowedStates).toEqual([
        'INITIATED', 'RINGING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'NO_ANSWER', 'BUSY', 'CANCELLED'
      ]);
      await server.close();
    });

    it('POST /api/telephony/outbound rejects invalid phone numbers with 400', async () => {
      const server = await buildServer();
      const res = await server.inject({
        method: 'POST',
        url: '/api/telephony/outbound',
        payload: {
          targetPhoneNumber: 'invalid_number_123',
          businessName: 'Ballari Layouts',
          industry: 'REAL_ESTATE',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.error).toContain('Invalid Indian mobile number');
      await server.close();
    });

    it('GET /api/telephony/inbound-webhook returns streaming TwiML with callSid', async () => {
      const server = await buildServer();
      const res = await server.inject({
        method: 'GET',
        url: '/api/telephony/inbound-webhook?CallSid=EXO_INBOUND_TEST_999&From=%2B919845012345',
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/xml');
      expect(res.payload).toContain('<Stream url="wss://');
      expect(res.payload).toContain('EXO_INBOUND_TEST_999');
      await server.close();
    });
  });
});
