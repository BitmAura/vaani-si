/**
 * VANNI — Real-Time Voice Gateway Server (apps/voice-gateway)
 *
 * Exposes authenticated WebSocket connection: /ws/voice-stream
 * Receives JSON control envelopes or binary AudioFrames,
 * wires into @vanni/voice-engine VoiceRuntime and ConversationOrchestrator.
 */

import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import {
  VoiceSession,
  VoiceRuntime,
  AudioFrame,
  NORMALIZED_AUDIO_FORMAT,
  createVoiceEvent,
  InMemoryTelephonyRepository,
  InboundCallRouter,
  TelephonyWebhookController,
} from '@vanni/voice-engine';
import { ConversationOrchestrator } from '@vanni/conversation-engine';
import { InMemoryDatabaseService } from '@vanni/database';
import {
  MockSTTProvider,
  MockTTSProvider,
  MockLLMProvider,
  MockTelephonyProvider,
  SarvamSaarasSTTProvider,
  SarvamBulbulTTSProvider,
  GeminiFlashLLMProvider,
  ExotelTelephonyProvider,
} from '@vanni/providers';
import { AgentRuntimeConfig } from '@vanni/shared';

// Initialize singleton mock or real services
const db = new InMemoryDatabaseService();
const orchestrator = new ConversationOrchestrator(db);
const telephonyRepo = new InMemoryTelephonyRepository();
const exotelProvider = process.env.EXOTEL_ACCOUNT_SID ? new ExotelTelephonyProvider() : new MockTelephonyProvider();
const inboundRouter = new InboundCallRouter({
  repository: telephonyRepo,
  telephonyProvider: exotelProvider,
  wsBaseUrl: process.env.VOICE_WS_URL || 'ws://localhost:4200/ws/voice-stream',
});
const webhookController = new TelephonyWebhookController(telephonyRepo, inboundRouter, exotelProvider);

export async function buildVoiceGateway() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  await fastify.register(cors, { origin: '*' });
  await fastify.register(websocket);

  // Health check
  fastify.get('/health', async () => {
    return {
      status: 'ONLINE',
      service: 'VANNI Real-Time Voice Gateway & Inbound Telephony',
      version: '2.0.0',
    };
  });

  // Telephony Inbound Webhook Endpoint
  fastify.all('/api/telephony/webhooks/:provider', async (req, reply) => {
    const { provider } = req.params as { provider: string };
    const signature = (req.headers['x-exotel-signature'] || req.headers['x-twilio-signature'] || '') as string;
    const params = (req.method === 'GET' ? req.query : req.body) as Record<string, any> || {};

    const result = await webhookController.handleInboundCallWebhook({
      providerName: provider,
      signatureHeader: signature,
      url: `${req.protocol}://${req.hostname}${req.url}`,
      params,
    });

    reply.status(result.statusCode).type(result.contentType).send(result.body);
  });

  // Telephony Status Callback Webhook Endpoint
  fastify.all('/api/telephony/events/:provider', async (req, reply) => {
    const { provider } = req.params as { provider: string };
    const signature = (req.headers['x-exotel-signature'] || req.headers['x-twilio-signature'] || '') as string;
    const params = (req.method === 'GET' ? req.query : req.body) as Record<string, any> || {};

    const result = await webhookController.handleCallStatusWebhook({
      providerName: provider,
      signatureHeader: signature,
      url: `${req.protocol}://${req.hostname}${req.url}`,
      params,
    });

    reply.status(result.statusCode).type(result.contentType).send(result.body);
  });

  // REST API: List Phone Numbers for Organization
  fastify.get('/api/telephony/phone-numbers', async (req, reply) => {
    const orgId = (req.query as any)?.organizationId || 'org_ballari_layouts';
    const numbers = await telephonyRepo.listPhoneNumbersByOrg(orgId);
    return { phoneNumbers: numbers };
  });

  // REST API: Assign Agent to Phone Number
  fastify.post('/api/telephony/phone-numbers/:id/assign', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { organizationId, agentId } = req.body as { organizationId: string; agentId: string };
    const success = await telephonyRepo.assignAgentToPhoneNumber(id, organizationId, agentId);
    return { success };
  });

  // REST API: List Call Sessions for Organization
  fastify.get('/api/telephony/calls', async (req, reply) => {
    const orgId = (req.query as any)?.organizationId || 'org_ballari_layouts';
    const sessions = await telephonyRepo.listSessionsByOrg(orgId);
    return { calls: sessions };
  });

  // REST API: Get Detailed Call Timeline & Metadata
  fastify.get('/api/telephony/calls/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = await telephonyRepo.findTelephonySession(id);
    if (!session) {
      reply.status(404).send({ error: 'Call session not found' });
      return;
    }
    const events = await telephonyRepo.listEventsBySession(id);
    return { call: session, events };
  });

  // WebSocket Audio Stream
  fastify.get('/ws/voice-stream', { websocket: true }, async (socket, req) => {
    // 1. Session & Auth Parameters
    const url = new URL(req.url, 'http://localhost');
    const orgId = url.searchParams.get('orgId') || 'org_ballari_layouts';
    const agentId = url.searchParams.get('agentId') || 'agent_voice_assistant';
    const language = url.searchParams.get('language') || 'kn-IN';
    const isMock = url.searchParams.get('mock') !== 'false';

    const voiceSessionId = `vsess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    fastify.log.info({ voiceSessionId, orgId, agentId, language, isMock }, '[Voice Gateway Connected]');

    // 2. Resolve Providers (Mock or Sarvam/Gemini)
    const sttProvider = isMock || !process.env.SARVAM_API_KEY
      ? new MockSTTProvider()
      : new SarvamSaarasSTTProvider();

    const ttsProvider = isMock || !process.env.SARVAM_API_KEY
      ? new MockTTSProvider()
      : new SarvamBulbulTTSProvider();

    const llmProvider = isMock || !process.env.GEMINI_API_KEY
      ? new MockLLMProvider()
      : new GeminiFlashLLMProvider();

    // 3. Initialize Agent Configuration & Conversation Session
    const agentConfig: AgentRuntimeConfig = {
      agentId,
      organizationId: orgId,
      version: 1,
      identity: {
        name: 'VANNI Assistant',
        displayName: 'VANNI AI Employee',
        role: 'AI_CUSTOMER_SUPPORT',
        description: 'Customer care and voice sales assistant',
        businessIntroduction: 'Namaskara! Ballari Residential Layouts kadeyinda mathadtha iddini.',
        identifyAsAI: true,
      },
      objective: {
        primaryObjective: 'Assist callers with plot inquiries and schedule site visits',
        secondaryObjectives: ['Answer pricing questions', 'Qualify buyer intent'],
        successCriteria: ['Confirmed visit booking', 'Accurate layout information given'],
      },
      personality: {
        preset: 'PROFESSIONAL_RECEPTIONIST',
        tone: 'WARM',
        conversationStyle: 'BALANCED',
        energy: 'NEUTRAL',
        customInstructions: 'Speak courteous Kannada/Kanglish. Address customer with respectful honorifics.',
      },
      language: {
        primaryLanguage: language === 'en-IN' ? 'en' : 'kn-en',
        secondaryLanguages: ['en', 'kn'],
        conversationalMode: language === 'en-IN' ? 'ENGLISH' : 'KANGLISH',
        allowSwitching: true,
      },
      capabilities: [],
      knowledgeAccess: {
        accessLevel: 'ALL_BUSINESS_KNOWLEDGE',
        allowedSourceIds: [],
        restrictedCategories: [],
      },
      tools: [],
      escalation: {
        defaultDestinationType: 'RECEPTION',
        defaultDestinationTarget: 'Reception Desk',
        triggers: [],
      },
      policies: {
        enforceHealthcareGuardrails: false,
        enforceRealEstateGuardrails: true,
        enforceSalesGuardrails: true,
        noHallucinationEnforced: true,
        customPolicyIds: [],
      },
      conversationRules: {
        greetingStyle: 'WARM',
        questionStrategy: 'NATURAL_FLOW',
        responseLength: 'BALANCED',
        uncertaintyBehavior: 'ASK_CLARIFICATION',
        silenceHandling: 'GENTLE_PROMPT',
      },
      guardrails: {
        healthcare: false,
        realEstate: true,
        noHallucination: true,
        instructionPrecedence: ['safety', 'business', 'tone'],
      },
      businessBrainReference: {
        organizationId: orgId,
        industry: 'REAL_ESTATE',
      },
      compiledAt: new Date().toISOString(),
    };

    // Initialize VoiceSession and Socket Transport Adapter
    const voiceSession = new VoiceSession({
      voiceSessionId,
      conversationId: `conv_${Date.now()}`,
      organizationId: orgId,
      agentId,
      language,
    });

    const socketTransport = {
      send: (data: string | Buffer) => {
        try {
          socket.send(data);
        } catch (e) {
          // Socket closed
        }
      },
      close: (code?: number, reason?: string) => {
        try {
          socket.close(code, reason);
        } catch (e) {
          // Ignore
        }
      },
    };

    // Initialize Conversation Orchestrator Session
    try {
      await orchestrator.startConversation({
        organizationId: orgId,
        agentConfig,
        channel: {
          channelType: 'VOICE',
          channelId: voiceSessionId,
          sendMessage: async (msg) => {
            socket.send(JSON.stringify(createVoiceEvent('AI_TEXT_DELTA', voiceSessionId, msg, 1)));
          },
          sendEvent: async () => {},
          interrupt: async () => {},
          transfer: async () => {},
          close: async () => {},
        },
        llmProvider: llmProvider as any,
      });
    } catch (e) {
      fastify.log.error(e, 'Failed to start conversation orchestrator session');
    }

    // 4. Initialize Voice Runtime
    const voiceRuntime = new VoiceRuntime({
      session: voiceSession,
      socket: socketTransport,
      orchestrator,
      sttProvider,
      ttsProvider,
      llmProvider: llmProvider as any,
    });

    await voiceRuntime.start();

    // 5. Wire Incoming Socket Messages
    let sequenceNumber = 0;
    socket.on('message', async (data: Buffer | string) => {
      sequenceNumber++;

      if (Buffer.isBuffer(data)) {
        // Binary Audio Frame (PCM16 standard)
        const frame: AudioFrame = {
          sequenceNumber,
          timestamp: Date.now(),
          format: NORMALIZED_AUDIO_FORMAT,
          payload: data,
        };
        await voiceRuntime.handleInboundAudio(frame);
      } else {
        try {
          const parsed = JSON.parse(data.toString());

          if (parsed.eventType === 'AUDIO_FRAME' && parsed.payload?.audioBase64) {
            const rawAudio = Buffer.from(parsed.payload.audioBase64, 'base64');
            const frame: AudioFrame = {
              sequenceNumber: parsed.sequenceNumber || sequenceNumber,
              timestamp: parsed.timestamp || Date.now(),
              format: NORMALIZED_AUDIO_FORMAT,
              payload: rawAudio,
            };
            await voiceRuntime.handleInboundAudio(frame);
          } else if (parsed.eventType === 'INTERRUPTION' || parsed.event === 'INTERRUPTED') {
            voiceRuntime.handleBargeIn();
          } else if (parsed.eventType === 'SESSION_END') {
            await voiceRuntime.stop();
          }
        } catch (e) {
          // Malformed message
        }
      }
    });

    // 6. Security & Reliability: Idle Watchdog and Maximum Call Duration Cap
    const MAX_CALL_DURATION_MS = 30 * 60 * 1000; // 30 minutes max call duration
    const IDLE_TIMEOUT_MS = 60 * 1000; // 60 seconds silence/idle timeout
    let lastActivityTimestamp = Date.now();

    const maxDurationTimer = setTimeout(async () => {
      fastify.log.warn({ voiceSessionId }, '[Watchdog] Max call duration reached. Terminating cleanly.');
      try {
        socket.send(JSON.stringify({ eventType: 'CALL_LIMIT_REACHED', reason: 'Maximum call duration exceeded' }));
        await voiceRuntime.stop();
        socket.close(1000, 'Max duration exceeded');
      } catch (e) {
        // Socket already closed
      }
    }, MAX_CALL_DURATION_MS);

    const idleCheckInterval = setInterval(async () => {
      if (Date.now() - lastActivityTimestamp > IDLE_TIMEOUT_MS) {
        fastify.log.info({ voiceSessionId }, '[Watchdog] Voice session idle timeout reached.');
        clearInterval(idleCheckInterval);
        clearTimeout(maxDurationTimer);
        try {
          await voiceRuntime.stop();
          socket.close(1000, 'Idle timeout');
        } catch (e) {
          // Socket already closed
        }
      }
    }, 15000);

    socket.on('close', async () => {
      clearTimeout(maxDurationTimer);
      clearInterval(idleCheckInterval);
      fastify.log.info({ voiceSessionId }, '[Voice Gateway Disconnected & Cleaned Up]');
      await voiceRuntime.stop();
    });
  });

  return fastify;
}

async function main() {
  const server = await buildVoiceGateway();
  const port = parseInt(process.env.VOICE_PORT || '4200', 10);
  const host = process.env.HOST || '0.0.0.0';

  try {
    await server.listen({ port, host });
    console.log(`[VANNI Voice Gateway] WebSocket streaming at ws://${host}:${port}/ws/voice-stream`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  main();
}
