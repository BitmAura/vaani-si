import fs from 'node:fs';
/**
 * PROMPT 09 — Voice Pipeline, Kannada Conversation Quality & Telephony Reliability Remediation
 * Comprehensive Verification Test Suite covering Scenarios 1 to 22.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import WebSocket from 'ws';
import {
  CallLifecycleManager,
  CanonicalCallStatus,
} from '../../../../packages/voice-engine/src/telephony/call-lifecycle';
import {
  ExotelTelephonyProvider,
  validateIndianPhoneNumber,
} from '../../../../packages/providers/src/telephony/exotel-gateway';
import { SarvamSaarasSTTProvider } from '../../../../packages/providers/src/stt/sarvam-saaras';
import { SarvamBulbulTTSProvider } from '../../../../packages/providers/src/tts/sarvam-bulbul';
import { AudioConversationPipeline } from '../audio-pipeline';
import { LLMConversationalService } from '../llm-service';
import { globalDb, InMemoryDatabaseService } from '@vanni/database';
import { buildServer } from '../server';
import {
  SYNTHETIC_KANNADA_LEAD_DIALOGUES,
  SyntheticDialogueScenario,
} from '../../../../packages/conversation-engine/src/language/evaluation/kannada-dialogue-scenarios';
import { UsageEventDTO, CallRecordDTO } from '@vanni/shared';

describe('Prompt 09: Voice Pipeline, Kannada Speech & Telephony Reliability Hardening', () => {
  let memDb: InMemoryDatabaseService;
  let lifecycle: CallLifecycleManager;

  const realEstateTenant = {
    id: 'ws_re_test_01',
    name: 'Ballari Plotted Layouts',
    industry: 'REAL_ESTATE' as const,
    virtualPhoneNumber: '+918047192000',
    ownerWhatsAppNumber: '+919845012345',
    dialect: 'KANNADA_STANDARD_POLITE' as const,
    monthlyMinuteLimit: 2000,
    minutesUsedCurrentMonth: 10,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    knowledge: {
      companyName: 'Ballari Plotted Layouts',
      industry: 'REAL_ESTATE' as const,
      primaryDialect: 'KANNADA_STANDARD_POLITE' as const,
      officeTimings: '9:00 AM - 7:00 PM',
      catalogSummary: '30x40 plots at 18 Lakhs on Siruguppa road with DC conversion.',
      faqs: [],
      appointmentRules: {
        slotDurationMinutes: 60,
        availableDays: ['Sunday'],
        freeCabOffered: true,
      },
    },
  };

  const healthcareTenant = {
    id: 'ws_hc_test_01',
    name: 'Apollo Specialty Clinic',
    industry: 'HEALTHCARE_HOSPITAL' as const,
    virtualPhoneNumber: '+918047192002',
    ownerWhatsAppNumber: '+919980123456',
    dialect: 'KANNADA_STANDARD_POLITE' as const,
    monthlyMinuteLimit: 3000,
    minutesUsedCurrentMonth: 15,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    knowledge: {
      companyName: 'Apollo Specialty Clinic',
      industry: 'HEALTHCARE_HOSPITAL' as const,
      primaryDialect: 'KANNADA_STANDARD_POLITE' as const,
      officeTimings: '8:00 AM - 9:00 PM',
      catalogSummary: 'Super specialty consultations for Cardiology, Ortho, and General Medicine.',
      faqs: [],
    },
  };

  beforeEach(() => {
    memDb = new InMemoryDatabaseService();
    lifecycle = new CallLifecycleManager(memDb);
  });

  // =========================================================================
  // Scenario 1: Provider configuration and production fail-closed behavior
  // =========================================================================
  it('Scenario 1: Provider configuration and production fail-closed behavior', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      // STT provider without key in production throws
      const stt = new SarvamSaarasSTTProvider('');
      await expect(stt.transcribe(Buffer.alloc(320))).rejects.toThrow('Missing SARVAM_API_KEY');

      // TTS provider without key in production throws
      const tts = new SarvamBulbulTTSProvider('');
      await expect(tts.synthesize('Namaskara')).rejects.toThrow('Missing SARVAM_API_KEY');

      // Exotel provider without credentials in production fails closed
      const exotel = new ExotelTelephonyProvider({ apiKey: '', accountSid: '' });
      const dispatchRes = await exotel.dispatchOutboundCall({
        targetPhoneNumber: '+919845012345',
        organizationId: 'org_test',
        agentId: 'agent_1',
        webhookCallbackUrl: 'https://vanni.ai/callback',
      });
      expect(dispatchRes.success).toBe(false);
      expect(dispatchRes.status).toBe('FAILED');
      expect(dispatchRes.errorMessage).toContain('CRITICAL TELEPHONY ERROR');
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  // =========================================================================
  // Scenario 2: Unauthorized WebSocket connection rejection
  // =========================================================================
  it('Scenario 2: Unauthorized WebSocket connection rejection in production', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const server = await buildServer();
    const address = await server.listen({ port: 0, host: '127.0.0.1' });
    const port = Number(new URL(address).port);

    try {
      const wsUrl = `ws://127.0.0.1:${port}/ws/audio-stream?tenant=real_estate`;
      const ws = new WebSocket(wsUrl);

      const closeEvent = await new Promise<{ code: number; reason: string }>((resolve) => {
        ws.on('close', (code, reason) => resolve({ code, reason: reason.toString() }));
      });

      expect(closeEvent.code).toBe(1008);
      expect(closeEvent.reason).toContain('Unauthorized');
    } finally {
      await server.close();
      process.env.NODE_ENV = origEnv;
    }
  });

  // =========================================================================
  // Scenario 3: Cross-tenant call and stream access denial
  // =========================================================================
  it('Scenario 3: Cross-tenant call and stream access denial', async () => {
    const server = await buildServer();
    const address = await server.listen({ port: 0, host: '127.0.0.1' });
    const port = Number(new URL(address).port);

    try {
      // Attempting to stream with an unknown or unauthorized tenant closes connection
      const wsUrl = `ws://127.0.0.1:${port}/ws/audio-stream?workspaceId=unknown_cross_tenant_12345`;
      const ws = new WebSocket(wsUrl);

      const closeEvent = await new Promise<{ code: number; reason: string }>((resolve) => {
        ws.on('close', (code, reason) => resolve({ code, reason: reason.toString() }));
      });

      expect(closeEvent.code).toBe(1008);
      expect(closeEvent.reason).toContain('Unauthorized');
    } finally {
      await server.close();
    }
  });

  // =========================================================================
  // Scenario 4: Malformed, oversized, or unsupported audio frames
  // =========================================================================
  it('Scenario 4: Malformed, oversized, or unsupported audio frames rejected', async () => {
    const server = await buildServer();
    const address = await server.listen({ port: 0, host: '127.0.0.1' });
    const port = Number(new URL(address).port);

    try {
      const wsUrl = `ws://127.0.0.1:${port}/ws/audio-stream?tenant=real_estate`;
      const ws = new WebSocket(wsUrl);

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => resolve());
        ws.on('error', reject);
      });

      // Send 300KB oversized buffer (> 256KB cap)
      const oversizedBuffer = Buffer.alloc(300 * 1024);
      ws.send(oversizedBuffer);

      const closeEvent = await new Promise<{ code: number; reason: string }>((resolve) => {
        ws.on('close', (code, reason) => resolve({ code, reason: reason.toString() }));
      });

      expect(closeEvent.code).toBe(1009); // Message too large
      expect(closeEvent.reason).toContain('Message too large');
    } finally {
      await server.close();
    }
  });

  // =========================================================================
  // Scenario 5: Disconnect cleanup and timeout behavior
  // =========================================================================
  it('Scenario 5: Disconnect cleanup and timeout behavior', () => {
    const pipeline = new AudioConversationPipeline(realEstateTenant);
    expect((pipeline as any).isDestroyed).toBe(false);

    // Call destroy on caller hangup
    pipeline.destroy();

    expect((pipeline as any).isDestroyed).toBe(true);
    expect((pipeline as any).audioBuffer.length).toBe(0);
    expect((pipeline as any).isAgentSpeaking).toBe(false);
    expect((pipeline as any).isProcessingTurn).toBe(false);
  });

  // =========================================================================
  // Scenario 6: Duplicate and out-of-order call events
  // =========================================================================
  it('Scenario 6: Duplicate and out-of-order call events', async () => {
    lifecycle.initializeCall({
      callId: 'call_lifecycle_ord_1',
      organizationId: 'org_test',
      direction: 'INBOUND',
      callerPhone: '+919845012345',
    });

    // 1. Initial event
    const r1 = await lifecycle.transition({
      callId: 'call_lifecycle_ord_1',
      provider: 'exotel',
      targetStatus: 'IN_PROGRESS',
      providerEventId: 'evt_dedup_001',
    });
    expect(r1.success).toBe(true);
    expect(r1.isDuplicate).toBeUndefined();

    // 2. Duplicate webhook with exact same event ID
    const r2 = await lifecycle.transition({
      callId: 'call_lifecycle_ord_1',
      provider: 'exotel',
      targetStatus: 'IN_PROGRESS',
      providerEventId: 'evt_dedup_001',
    });
    expect(r2.success).toBe(true);
    expect(r2.isDuplicate).toBe(true);

    // 3. Mark completed
    await lifecycle.transition({
      callId: 'call_lifecycle_ord_1',
      provider: 'exotel',
      targetStatus: 'COMPLETED',
      rawDurationSeconds: 45,
    });

    // 4. Out-of-order late event arriving after completion
    const rLate = await lifecycle.transition({
      callId: 'call_lifecycle_ord_1',
      provider: 'exotel',
      targetStatus: 'IN_PROGRESS',
      providerEventId: 'evt_stale_delayed',
    });
    expect(rLate.success).toBe(false);
    expect(rLate.error).toContain('Cannot transition from terminal state COMPLETED');
  });

  // =========================================================================
  // Scenario 7: Correct call lifecycle transitions
  // =========================================================================
  it('Scenario 7: Correct call lifecycle transitions: INITIATED -> RINGING -> IN_PROGRESS -> COMPLETED', async () => {
    const session = lifecycle.initializeCall({
      callId: 'call_orderly_01',
      organizationId: 'org_test',
      direction: 'OUTBOUND',
      callerPhone: '+919845012345',
    });
    expect(session.currentStatus).toBe('INITIATED');

    const ring = await lifecycle.transition({
      callId: 'call_orderly_01',
      provider: 'exotel',
      targetStatus: 'RINGING',
    });
    expect(ring.session?.currentStatus).toBe('RINGING');

    const ans = await lifecycle.transition({
      callId: 'call_orderly_01',
      provider: 'exotel',
      targetStatus: 'IN_PROGRESS',
    });
    expect(ans.session?.currentStatus).toBe('IN_PROGRESS');

    const comp = await lifecycle.transition({
      callId: 'call_orderly_01',
      provider: 'exotel',
      targetStatus: 'COMPLETED',
      rawDurationSeconds: 65,
    });
    expect(comp.session?.currentStatus).toBe('COMPLETED');
    expect(comp.session?.durationSeconds).toBe(65);
  });

  // =========================================================================
  // Scenario 8: Failed call initiation does not produce a false success
  // =========================================================================
  it('Scenario 8: Failed call initiation does not produce a false success', async () => {
    const exotel = new ExotelTelephonyProvider();
    const result = await exotel.dispatchOutboundCall({
      targetPhoneNumber: '9999', // Invalid phone number
      organizationId: 'org_test',
      agentId: 'agent_1',
      webhookCallbackUrl: 'http://localhost/cb',
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('FAILED');
    expect(result.errorMessage).toContain('Invalid Indian mobile number');
  });

  // =========================================================================
  // Scenario 9: STT failure and empty transcript recovery
  // =========================================================================
  it('Scenario 9: STT failure and empty transcript recovery prompts caller politely', async () => {
    const pipeline = new AudioConversationPipeline(realEstateTenant);
    let spokenAgentPrompt = '';

    const events = {
      onTranscript: (speaker: 'USER' | 'AGENT', text: string) => {
        if (speaker === 'AGENT') spokenAgentPrompt = text;
      },
      onLatencyBreakdown: () => {},
      onAudioChunk: () => {},
    };

    // Inject 1200 bytes of silence audio buffer without text override
    (pipeline as any).audioBuffer = [Buffer.alloc(1200)];

    // Force STT error or empty result in adapter
    vi.spyOn((pipeline as any).sarvam, 'transcribeSpeech').mockResolvedValueOnce({
      transcript: '',
      language_code: 'kn-IN',
      confidence: 0,
    });

    await pipeline.processUserUtterance(events);

    // Agent politely asks caller to repeat rather than fabricating speech
    expect(spokenAgentPrompt).toContain('Kshamisee sir, nimma dhwani spashtavaagi kelisallilla');
  });

  // =========================================================================
  // Scenario 10: TTS failure and invalid audio response handling
  // =========================================================================
  it('Scenario 10: TTS failure and invalid audio response handled cleanly', async () => {
    const pipeline = new AudioConversationPipeline(realEstateTenant);

    const events = {
      onTranscript: () => {},
      onLatencyBreakdown: () => {},
      onAudioChunk: () => {},
    };

    // Mock TTS throwing an error
    vi.spyOn((pipeline as any).sarvam, 'synthesizeSpeech').mockRejectedValueOnce(
      new Error('TTS provider timeout')
    );

    await expect(pipeline.processUserUtterance(events, 'Rate eshtu ide?')).resolves.not.toThrow();
    expect((pipeline as any).isAgentSpeaking).toBe(false);
  });

  // =========================================================================
  // Scenario 11: Kannada-English text and locale handling at the contract level
  // =========================================================================
  it('Scenario 11: Kannada-English text and locale handling at the contract level', () => {
    const llm = new LLMConversationalService();

    // Kannada script detection
    expect(llm.detectLanguage('ನಮಸ್ಕಾರ, ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ಸಿಗುತ್ತಾ?')).toBe('kn-IN');

    // Kanglish phonemes detection
    expect(llm.detectLanguage('Namaskara sir, plot rate eshtu ide?')).toBe('kn-IN');

    // English detection
    expect(llm.detectLanguage('Good morning, could you share the property details?')).toBe('en-IN');

    // Verifies 9 synthetic dialogues exist and have turns
    expect(SYNTHETIC_KANNADA_LEAD_DIALOGUES.length).toBe(9);
    for (const dlg of SYNTHETIC_KANNADA_LEAD_DIALOGUES) {
      expect(dlg.turns.length).toBeGreaterThan(0);
      expect(dlg.expectedFinalOutcome).toBeDefined();
    }
  });

  // =========================================================================
  // Scenario 12: Interruption and repeated-response safeguards
  // =========================================================================
  it('Scenario 12: Interruption and repeated-response safeguards', () => {
    const pipeline = new AudioConversationPipeline(realEstateTenant);
    let interruptFired = false;

    const events = {
      onTranscript: () => {},
      onLatencyBreakdown: () => {},
      onAudioChunk: () => {},
      onInterrupt: () => {
        interruptFired = true;
      },
    };

    (pipeline as any).isAgentSpeaking = true;

    // Loud speech chunk (> 2.5% RMS)
    const loudChunk = Buffer.alloc(640);
    for (let i = 0; i < 320; i++) {
      loudChunk.writeInt16LE(12000, i * 2);
    }

    pipeline.pushAudioChunk(loudChunk, events);

    expect(interruptFired).toBe(true);
    expect((pipeline as any).isAgentSpeaking).toBe(false);
  });

  // =========================================================================
  // Scenario 13: Tool input validation and authorization
  // =========================================================================
  it('Scenario 13: Tool input validation and authorization', async () => {
    const pipeline = new AudioConversationPipeline(healthcareTenant);
    const evaluator = (pipeline as any).toolEvaluator;

    // Disallowed tool evaluation
    const res = evaluator.evaluateToolRequest(
      'conv_1',
      'org_1',
      {
        type: 'CALL_TOOL',
        toolRequest: { toolName: 'unregistered_dangerous_tool', args: {} },
      } as any,
      {
        agentId: 'agent_restricted',
        organizationId: 'org_1',
        version: 1,
        tools: [{ toolName: 'check_availability', enabled: true, permissions: { canExecute: true, requiresConfirmation: false } }],
      } as any
    );

    expect(res.isPermitted).toBe(false);
    expect(res.rejectionReason).toContain('not permitted');
  });

  // =========================================================================
  // Scenario 14: Tool execution failure does not create a false spoken confirmation
  // =========================================================================
  it('Scenario 14: Tool execution failure does not create a false spoken confirmation', async () => {
    const pipeline = new AudioConversationPipeline(healthcareTenant);

    // Mock toolEvaluator to return failure
    vi.spyOn((pipeline as any).toolEvaluator, 'executeTool').mockResolvedValueOnce({
      success: false,
      error: 'ROSTER_UNAVAILABLE',
      userSafeMessage: 'Doctor appointment slots are currently offline',
    });

    let agentTranscript = '';
    const events = {
      onTranscript: (speaker: 'USER' | 'AGENT', text: string) => {
        if (speaker === 'AGENT') agentTranscript = text;
      },
      onLatencyBreakdown: () => {},
      onAudioChunk: () => {},
    };

    await pipeline.processUserUtterance(events, 'Doctor appointment slot ideya?');

    // Agent turn does not claim false confirmed appointment
    expect(agentTranscript).toBeDefined();
    expect(agentTranscript).not.toContain('appointment confirm maadiddini');
  });

  // =========================================================================
  // Scenario 15: Duplicate tool execution does not duplicate a business action
  // =========================================================================
  it('Scenario 15: Duplicate tool execution does not duplicate a business action', async () => {
    const pipeline = new AudioConversationPipeline(realEstateTenant);
    let executionCount = 0;

    const events = {
      onTranscript: () => {},
      onLatencyBreakdown: () => {},
      onAudioChunk: () => {},
      onToolExecuted: (name: string) => {
        if (name === 'create_lead') executionCount++;
      },
    };

    // First inquiry
    await pipeline.processUserUtterance(events, 'Site visit layout price helri');
    expect(executionCount).toBe(1);

    // Repeated utterance in same call
    await pipeline.processUserUtterance(events, 'Site visit plot price helri innomme');
    // Deduplication prevents second execution
    expect(executionCount).toBe(1);
  });

  // =========================================================================
  // Scenario 16: Call record and usage event persistence
  // =========================================================================
  it('Scenario 16: Call record and usage event persistence upon call completion', async () => {
    lifecycle.initializeCall({
      callId: 'call_usage_persist_01',
      organizationId: 'org_persist_test',
      direction: 'INBOUND',
      callerPhone: '+919845012345',
    });

    await lifecycle.transition({
      callId: 'call_usage_persist_01',
      provider: 'exotel',
      targetStatus: 'IN_PROGRESS',
    });

    await lifecycle.transition({
      callId: 'call_usage_persist_01',
      provider: 'exotel',
      targetStatus: 'COMPLETED',
      rawDurationSeconds: 120,
      costInr: 1.70,
    });

    // 1. Check Call Record in persistence
    const callRecord = await memDb.getCallById('call_usage_persist_01');
    expect(callRecord).toBeDefined();
    expect(callRecord?.status).toBe('COMPLETED');
    expect(callRecord?.durationSeconds).toBe(120);

    // 2. Check Usage Event in persistence
    const usageList = await memDb.getUsageEvents('org_persist_test');
    expect(usageList.length).toBe(1);
    expect(usageList[0].quantity).toBe(120);
    expect(usageList[0].eventType).toBe('VOICE_DURATION');
  });

  // =========================================================================
  // Scenario 17: Duplicate usage events do not inflate billable minutes
  // =========================================================================
  it('Scenario 17: Duplicate usage events do not inflate billable minutes', async () => {
    const event: UsageEventDTO = {
      id: 'usage_call_unique_dup_101_voice',
      organizationId: 'org_test',
      correlationId: 'call_unique_dup_101',
      eventType: 'VOICE_DURATION',
      resourceType: 'VOICE_MINUTE',
      provider: 'exotel',
      quantity: 60,
      unit: 'seconds',
      costType: 'ESTIMATED',
      estimatedCost: 0.85,
      actualCost: 0.85,
      currency: 'INR',
      occurredAt: new Date().toISOString(),
    };

    // Save initial event
    await memDb.saveUsageEvent(event);

    // Save identical duplicate event with same correlationId & eventType
    await memDb.saveUsageEvent(event);

    const usageEvents = await memDb.getUsageEvents('org_test');
    expect(usageEvents.length).toBe(1);
    expect(usageEvents[0].quantity).toBe(60);
  });

  // =========================================================================
  // Scenario 18: Provider webhook signature and tenant validation
  // =========================================================================
  it('Scenario 18: Provider webhook signature and tenant validation', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.EXOTEL_WEBHOOK_SECRET = 'secret_webhook_123';

    const server = await buildServer();
    try {
      // 1. Missing signature in production -> 401
      const res1 = await server.inject({
        method: 'POST',
        url: '/api/telephony/cdr',
        payload: { CallSid: 'CALL_101', Status: 'completed' },
      });
      expect(res1.statusCode).toBe(401);

      // 2. Valid HMAC signature -> 200
      const bodyStr = JSON.stringify({ CallSid: 'CALL_101', Status: 'completed' });
      const fullUrl = 'http://localhost:80/api/telephony/cdr';
      const validSig = crypto.createHmac('sha256', 'secret_webhook_123').update(`${fullUrl}${bodyStr}`).digest('hex');

      const res2 = await server.inject({
        method: 'POST',
        url: '/api/telephony/cdr',
        headers: {
          'x-exotel-signature': validSig,
        },
        payload: { CallSid: 'CALL_101', Status: 'completed' },
      });
      expect(res2.statusCode).toBe(200);
    } finally {
      await server.close();
      process.env.NODE_ENV = origEnv;
      delete process.env.EXOTEL_WEBHOOK_SECRET;
    }
  });

  // =========================================================================
  // Scenario 19: Healthcare clinical-advice refusal behavior
  // =========================================================================
  it('Scenario 19: Healthcare clinical-advice refusal behavior', async () => {
    const pipeline = new AudioConversationPipeline(healthcareTenant);
    let agentReply = '';

    const events = {
      onTranscript: (speaker: 'USER' | 'AGENT', text: string) => {
        if (speaker === 'AGENT') agentReply = text;
      },
      onLatencyBreakdown: () => {},
      onAudioChunk: () => {},
    };

    // Caller asking for clinical diagnosis / prescription
    await pipeline.processUserUtterance(events, 'Nange fever ide, yaava antibiotic tablet thagobeku prescribe madi');

    // Agent refuses prescribing medicine and refers caller to direct doctor consultation
    expect(agentReply.toLowerCase()).toContain('prescribe');
    expect(agentReply.toLowerCase()).toContain('consultation');
  });

  // =========================================================================
  // Scenario 20: Real-estate and agency tenant boundaries
  // =========================================================================
  it('Scenario 20: Real-estate and agency tenant boundaries prevent cross-domain tool leakage', async () => {
    // 1. Real Estate tenant asking for a doctor appointment should NOT invoke healthcare tool
    const rePipeline = new AudioConversationPipeline(realEstateTenant);
    let doctorToolInvoked = false;

    await rePipeline.processUserUtterance({
      onTranscript: () => {},
      onLatencyBreakdown: () => {},
      onAudioChunk: () => {},
      onToolExecuted: (toolName) => {
        if (toolName === 'check_availability') doctorToolInvoked = true;
      },
    }, 'Doctor appointment timing helri');
    expect(doctorToolInvoked).toBe(false);

    // 2. Healthcare tenant asking about plots should NOT create real estate lead
    const hcPipeline = new AudioConversationPipeline(healthcareTenant);
    let leadToolInvoked = false;

    await hcPipeline.processUserUtterance({
      onTranscript: () => {},
      onLatencyBreakdown: () => {},
      onAudioChunk: () => {},
      onToolExecuted: (toolName) => {
        if (toolName === 'create_lead') leadToolInvoked = true;
      },
    }, 'Plots rate eshtu ide?');
    expect(leadToolInvoked).toBe(false);
  });

  // =========================================================================
  // Scenario 21: Cleanup when caller disconnects during LLM or TTS request
  // =========================================================================
  it('Scenario 21: Cleanup when caller disconnects during LLM or TTS request', async () => {
    const pipeline = new AudioConversationPipeline(realEstateTenant);
    let chunkCount = 0;

    const events = {
      onTranscript: () => {},
      onLatencyBreakdown: () => {},
      onAudioChunk: () => {
        chunkCount++;
      },
    };

    // Caller disconnects mid-flight
    pipeline.destroy();

    // Utterance turn should immediately exit without emitting chunks
    await pipeline.processUserUtterance(events, 'Site visit layout');
    expect(chunkCount).toBe(0);
    expect((pipeline as any).isProcessingTurn).toBe(false);
  });

  // =========================================================================
  // Scenario 22: Frontend call-status synchronization / display truthfulness
  // =========================================================================
  it('Scenario 22: Frontend call-status synchronization / display truthfulness in calls.html', () => {
    const htmlPath = 'P:\\crazy-ai-stack\\vaani-si\\apps\\web\\app\\calls.html';
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // Confirms dynamic /api/calls integration and escapeHtml protection
    expect(htmlContent).toContain('loadCallLogs');
    expect(htmlContent).toContain("fetch('/api/calls'");
    expect(htmlContent).toContain('renderCallsTable');
    expect(htmlContent).toContain('escapeHtml');
    expect(htmlContent).toContain('openDrawerFromIndex');
  });
});
