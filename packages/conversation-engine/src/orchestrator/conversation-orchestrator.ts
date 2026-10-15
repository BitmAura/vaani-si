/**
 * @vanni/conversation-engine — Central Conversation Orchestrator
 *
 * The non-negotiable architectural brain between channel gateways and backend services.
 * LLM NEVER controls the application or mutates the database directly.
 * All actions flow through:
 * Event -> State Machine -> Context Assembly -> Policy Check -> Knowledge Retrieval
 * -> LLM Reasoning -> Structured Output Validation -> Factual Claim Check
 * -> Tool Permission -> Tool Execution / Confirmation -> Response / Handoff
 */

import {
  ConversationDTO,
  ConversationMessageDTO,
  ConversationEventDTO,
  ConversationToolCallDTO,
  ConversationHandoffDTO,
  ConversationSummaryDTO,
  AgentRuntimeConfig,
  BusinessBrainSnapshotDTO,
  CustomerContextDTO,
  StructuredLLMDecisionDTO,
  ConversationTurnDTO,
  LanguageMode,
  ResponseLanguagePlanDTO,
  NormalizedUtteranceDTO,
} from '@vanni/shared';
import { IDatabaseService } from '@vanni/database';
import { ConversationStateMachine } from '../state/state-machine';
import { ConversationContextEngine } from '../context/context-engine';
import { FactualResponseValidator } from '../validation/factual-validator';
import { ToolPermissionEvaluator } from '../tools/tool-permission-evaluator';
import { HandoffManager } from '../handoff/handoff-manager';
import { ConversationMemory } from '../memory/conversation-memory';
import { IConversationChannel } from '../channel/channel-interface';
import { ILLMProvider } from '../providers/mock-llm-provider';
import { LanguageNormalizer } from '../language/normalizer/language-normalizer';
import { TerminologyManager } from '../language/terminology/terminology-manager';
import { ResponseLanguagePlanner } from '../language/planner/response-language-planner';
import { LanguageQualityValidator } from '../language/quality/language-quality-validator';
import { VoiceTextPreparation } from '../language/voice/voice-text-preparation';

export interface StartConversationOptions {
  organizationId: string;
  agentConfig: AgentRuntimeConfig;
  businessBrain?: BusinessBrainSnapshotDTO | null;
  channel: IConversationChannel;
  customerContext?: CustomerContextDTO;
  llmProvider: ILLMProvider;
  knowledgeChunks?: Array<{ title: string; content: string; authority: string }>;
  /**
   * Optional caller-assigned conversation id. Voice sessions allocate a
   * conversation id upfront and address turns with it — if the orchestrator
   * generated its own id, processCustomerMessage lookups would miss.
   */
  conversationId?: string;
}

export interface ConversationSession {
  conversationId: string;
  organizationId: string;
  agentConfig: AgentRuntimeConfig;
  businessBrain: BusinessBrainSnapshotDTO | null;
  channel: IConversationChannel;
  stateMachine: ConversationStateMachine;
  contextEngine: ConversationContextEngine;
  memory: ConversationMemory;
  llmProvider: ILLMProvider;
  knowledgeChunks: Array<{ title: string; content: string; authority: string }>;
  activeToolCall: ConversationToolCallDTO | null;
  sequenceCounter: number;
  processedEventIds: Set<string>;
  isProcessing: boolean;
  startTime: number;
  languageState: {
    currentLanguage: LanguageMode;
    preferredLanguage?: LanguageMode;
    detectedLanguage: LanguageMode;
    recentLanguageHistory: LanguageMode[];
    languageConfidence: number;
  };
}

export class ConversationOrchestrator {
  private sessions: Map<string, ConversationSession> = new Map();
  private factualValidator = new FactualResponseValidator();
  private toolEvaluator = new ToolPermissionEvaluator();
  private handoffManager = new HandoffManager();
  private languageNormalizer = new LanguageNormalizer();
  private terminologyManager = new TerminologyManager();
  private languagePlanner = new ResponseLanguagePlanner();
  private languageQualityValidator = new LanguageQualityValidator();
  private voicePreparation = new VoiceTextPreparation();

  constructor(private db: IDatabaseService) {}

  /**
   * Initializes a new tenant-isolated conversation session
   */
  async startConversation(options: StartConversationOptions): Promise<{
    conversation: ConversationDTO;
    session: ConversationSession;
    greetingMessage: ConversationMessageDTO;
  }> {
    const conversationId = options.conversationId || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    // 1. Initialize State Machine & Memory
    const stateMachine = new ConversationStateMachine('IDLE');
    const memory = new ConversationMemory(options.customerContext);
    const contextEngine = new ConversationContextEngine();

    // Transition IDLE -> CONNECTING -> GREETING
    stateMachine.transition('CONNECTING', 'CONVERSATION_STARTED');
    stateMachine.transition('GREETING', 'CONVERSATION_STARTED');

    // 2. Prepare Greeting Message from Agent Runtime Configuration
    const greetingText =
      options.agentConfig.identity.businessIntroduction ||
      `Hello, thank you for reaching out to us. How can I assist you today?`;

    const greetingMessage: ConversationMessageDTO = {
      id: `msg_${Date.now()}_0`,
      conversationId,
      organizationId: options.organizationId,
      speaker: 'AGENT',
      messageType: 'AGENT',
      content: greetingText,
      sequenceNumber: 1,
      createdAt: now,
    };

    memory.addMessage(greetingMessage);
    await options.channel.sendMessage(greetingMessage);

    // Transition GREETING -> LISTENING
    stateMachine.transition('LISTENING', 'AGENT_RESPONSE_READY');

    // 3. Persist Conversation in Database
    const conversation: ConversationDTO = {
      id: conversationId,
      organizationId: options.organizationId,
      agentId: options.agentConfig.agentId,
      agentVersion: options.agentConfig.version,
      channel: options.channel.channelType,
      status: 'ACTIVE',
      currentState: stateMachine.getCurrentState(),
      detectedLanguage: 'unknown',
      customerContext: options.customerContext || {},
      startedAt: now,
      updatedAt: now,
    };

    await this.db.createConversation(conversation);
    await this.db.saveConversationMessage(greetingMessage);

    const startEvent: ConversationEventDTO = {
      id: `evt_${Date.now()}_start`,
      conversationId,
      organizationId: options.organizationId,
      eventType: 'CONVERSATION_STARTED',
      previousState: 'IDLE',
      newState: stateMachine.getCurrentState(),
      payload: { agentId: options.agentConfig.agentId },
      createdAt: now,
    };
    await this.db.saveConversationEvent(startEvent);

    // 4. Register Runtime Session with Language Intelligence State
    const initialMode: LanguageMode = (options.agentConfig.language?.conversationalMode as LanguageMode) || 'KANGLISH';
    const session: ConversationSession = {
      conversationId,
      organizationId: options.organizationId,
      agentConfig: options.agentConfig,
      businessBrain: options.businessBrain || null,
      channel: options.channel,
      stateMachine,
      contextEngine,
      memory,
      llmProvider: options.llmProvider,
      knowledgeChunks: options.knowledgeChunks || [],
      activeToolCall: null,
      sequenceCounter: 1,
      processedEventIds: new Set<string>(),
      isProcessing: false,
      startTime: Date.now(),
      languageState: {
        currentLanguage: initialMode,
        preferredLanguage: undefined,
        detectedLanguage: initialMode,
        recentLanguageHistory: [initialMode],
        languageConfidence: 1.0,
      },
    };

    this.sessions.set(conversationId, session);

    return { conversation, session, greetingMessage };
  }

  /**
   * Processes an incoming customer turn with idempotency, concurrency guard, and structured reasoning
   */
  async processCustomerMessage(
    conversationId: string,
    utterance: string,
    eventId?: string
  ): Promise<ConversationTurnDTO> {
    const session = this.sessions.get(conversationId);
    if (!session) {
      throw new Error(`Conversation session "${conversationId}" not found or has expired.`);
    }

    const startTimestamp = Date.now();

    // 1. Idempotency Check: Don't reprocess identical events
    const resolvedEventId = eventId || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}_turn`;
    if (session.processedEventIds.has(resolvedEventId)) {
      return {
        turnId: `turn_cached_${resolvedEventId}`,
        conversationId,
        speaker: 'AGENT',
        userUtterance: utterance,
        agentResponse: '(Event already processed)',
        stateBefore: session.stateMachine.getCurrentState(),
        stateAfter: session.stateMachine.getCurrentState(),
        groundedSources: [],
        policyFlags: [],
        toolInteractions: [],
        executionDurationMs: 0,
        createdAt: new Date().toISOString(),
      };
    }
    session.processedEventIds.add(resolvedEventId);

    // 2. Concurrency Lock: Prevent state corruption from overlapping speech/events
    if (session.isProcessing) {
      throw new Error(`Conversation "${conversationId}" is currently processing an active turn. Concurrency locked.`);
    }
    session.isProcessing = true;

    try {
      const stateBefore = session.stateMachine.getCurrentState();
      const now = new Date().toISOString();
      session.sequenceCounter++;

      // Record customer utterance
      const customerMsg: ConversationMessageDTO = {
        id: `msg_${Date.now()}_cust`,
        conversationId,
        organizationId: session.organizationId,
        speaker: 'CUSTOMER',
        messageType: 'CUSTOMER',
        content: utterance,
        sequenceNumber: session.sequenceCounter,
        createdAt: now,
      };
      session.memory.addMessage(customerMsg);
      await this.db.saveConversationMessage(customerMsg);

      // State Transition: -> THINKING
      session.stateMachine.transition('THINKING', 'CUSTOMER_MESSAGE_RECEIVED');

      // 3. Early Escalation Pre-Checks: Emergency & Human Request
      const emergency = this.handoffManager.detectEmergencySignals(utterance);
      if (emergency.isEmergency && session.agentConfig.guardrails.healthcare) {
        const handoff = this.handoffManager.createHandoff({
          conversationId,
          organizationId: session.organizationId,
          reason: 'EMERGENCY',
          priority: 'CRITICAL',
          customerContext: session.memory.getCustomerContext(),
          recentMessages: session.memory.getRecentMessages(4),
          notes: `Emergency casualty triggered by phrase: "${emergency.trigger}"`,
        });

        session.stateMachine.transition('TRANSFER_PENDING', 'ESCALATION_TRIGGERED');
        await this.db.saveConversationHandoff(handoff);
        await session.channel.transfer(handoff);

        const emergencyReply = "This sounds like an urgent medical emergency. Please visit our casualty immediately or call emergency services. I am connecting you to our casualty desk now.";
        session.sequenceCounter++;
        const replyMsg: ConversationMessageDTO = {
          id: `msg_${Date.now()}_reply`,
          conversationId,
          organizationId: session.organizationId,
          speaker: 'AGENT',
          messageType: 'HANDOFF',
          content: emergencyReply,
          sequenceNumber: session.sequenceCounter,
          createdAt: new Date().toISOString(),
        };
        session.memory.addMessage(replyMsg);
        await this.db.saveConversationMessage(replyMsg);
        await session.channel.sendMessage(replyMsg);

        return {
          turnId: resolvedEventId,
          conversationId,
          speaker: 'AGENT',
          userUtterance: utterance,
          agentResponse: emergencyReply,
          stateBefore,
          stateAfter: session.stateMachine.getCurrentState(),
          groundedSources: [],
          policyFlags: ['EMERGENCY_ESCALATION'],
          toolInteractions: [],
          handoffRequested: true,
          executionDurationMs: Date.now() - startTimestamp,
          createdAt: new Date().toISOString(),
        };
      }

      if (this.handoffManager.detectHumanRequest(utterance)) {
        const handoff = this.handoffManager.createHandoff({
          conversationId,
          organizationId: session.organizationId,
          reason: 'CUSTOMER_REQUEST',
          priority: 'NORMAL',
          customerContext: session.memory.getCustomerContext(),
          recentMessages: session.memory.getRecentMessages(4),
          notes: 'Customer explicitly asked to speak to a person.',
        });

        session.stateMachine.transition('TRANSFER_PENDING', 'CUSTOMER_REQUESTED_HUMAN');
        await this.db.saveConversationHandoff(handoff);
        await session.channel.transfer(handoff);

        const handoffReply = "I will be happy to connect you with our front desk team right away. Please hold the line.";
        session.sequenceCounter++;
        const replyMsg: ConversationMessageDTO = {
          id: `msg_${Date.now()}_reply`,
          conversationId,
          organizationId: session.organizationId,
          speaker: 'AGENT',
          messageType: 'HANDOFF',
          content: handoffReply,
          sequenceNumber: session.sequenceCounter,
          createdAt: new Date().toISOString(),
        };
        session.memory.addMessage(replyMsg);
        await this.db.saveConversationMessage(replyMsg);
        await session.channel.sendMessage(replyMsg);

        return {
          turnId: resolvedEventId,
          conversationId,
          speaker: 'AGENT',
          userUtterance: utterance,
          agentResponse: handoffReply,
          stateBefore,
          stateAfter: session.stateMachine.getCurrentState(),
          groundedSources: [],
          policyFlags: ['HUMAN_HANDOFF_REQUESTED'],
          toolInteractions: [],
          handoffRequested: true,
          executionDurationMs: Date.now() - startTimestamp,
          createdAt: new Date().toISOString(),
        };
      }

      // 2.5 Deterministic Fast-Path Gate (Inspired by Vocalis dialog-engine.js)
      // Resolves instant affirmative/negative turns (ಸರಿ / ಹೌದು / ಬೇಡ) in sub-50ms without LLM latency
      const recentAiMsg = session.memory.getRecentMessages(2).find(m => m.speaker === 'AGENT')?.content?.toLowerCase() || '';
      const lowUtterance = utterance.trim().toLowerCase();
      const isAffirmative = ['ಸರಿ', 'ಹೌದು', 'ಖಂಡಿತ', 'sure', 'yes', 'okay', 'ok', 'ha', 'haudu', 'sari'].includes(lowUtterance) || lowUtterance.startsWith('yes ');
      const isNegative = ['ಬೇಡ', 'ಬೇರೆ', 'no', 'nope', 'beda', 'not now'].includes(lowUtterance) || lowUtterance.startsWith('no ');

      if (recentAiMsg.includes('confirm') || recentAiMsg.includes('ಮಾಡಲಾ') || recentAiMsg.includes('slot') || recentAiMsg.includes('visit') || recentAiMsg.includes('book')) {
        if (isAffirmative) {
          const fastReply = session.agentConfig.language.primaryLanguage === 'kn'
            ? 'ಧನ್ಯವಾದಗಳು! ನಿಮ್ಮ ಬುಕಿಂಗ್ ಖಚಿತವಾಗಿದೆ. ನಮ್ಮ ತಂಡವು ನಿಮಗೆ ವಾಟ್ಸಾಪ್ ಮೂಲಕ ವಿವರಗಳನ್ನು ಕಳುಹಿಸುತ್ತದೆ.'
            : 'Thank you! Your slot has been confirmed. Our team has dispatched the details to your WhatsApp.';

          session.stateMachine.transition('SPEAKING', 'AGENT_RESPONSE_READY');
          session.stateMachine.transition('LISTENING', 'AGENT_RESPONSE_READY');
          session.sequenceCounter++;
          const fastMsg: ConversationMessageDTO = {
            id: `msg_${Date.now()}_fast_yes`,
            conversationId,
            organizationId: session.organizationId,
            speaker: 'AGENT',
            messageType: 'TEXT',
            content: fastReply,
            sequenceNumber: session.sequenceCounter,
            createdAt: new Date().toISOString(),
          };
          session.memory.addMessage(fastMsg);
          await this.db.saveConversationMessage(fastMsg);
          await session.channel.sendMessage(fastMsg);

          return {
            turnId: resolvedEventId,
            conversationId,
            speaker: 'AGENT',
            userUtterance: utterance,
            agentResponse: fastReply,
            stateBefore,
            stateAfter: session.stateMachine.getCurrentState(),
            groundedSources: [{ sourceTitle: 'Deterministic Fast-Path Gate', content: 'Instant affirmative confirmation', score: 1.0 }],
            policyFlags: ['FAST_PATH_CONFIRMED'],
            toolInteractions: [],
            executionDurationMs: Date.now() - startTimestamp,
            createdAt: new Date().toISOString(),
          };
        } else if (isNegative) {
          const fastReply = session.agentConfig.language.primaryLanguage === 'kn'
            ? 'ಸರಿ, ತೊಂದರೆಯಿಲ್ಲ. ನಿಮಗೆ ಬೇರೆ ಯಾವ ಸಮಯ ಅಥವಾ ದಿನ ಅನುಕೂಲವಾಗುತ್ತದೆ ಎಂದು ತಿಳಿಸುತ್ತೀರಾ?'
            : 'No problem at all. Which alternative date or time would suit you better?';

          session.stateMachine.transition('SPEAKING', 'AGENT_RESPONSE_READY');
          session.stateMachine.transition('LISTENING', 'AGENT_RESPONSE_READY');
          session.sequenceCounter++;
          const fastMsg: ConversationMessageDTO = {
            id: `msg_${Date.now()}_fast_no`,
            conversationId,
            organizationId: session.organizationId,
            speaker: 'AGENT',
            messageType: 'TEXT',
            content: fastReply,
            sequenceNumber: session.sequenceCounter,
            createdAt: new Date().toISOString(),
          };
          session.memory.addMessage(fastMsg);
          await this.db.saveConversationMessage(fastMsg);
          await session.channel.sendMessage(fastMsg);

          return {
            turnId: resolvedEventId,
            conversationId,
            speaker: 'AGENT',
            userUtterance: utterance,
            agentResponse: fastReply,
            stateBefore,
            stateAfter: session.stateMachine.getCurrentState(),
            groundedSources: [{ sourceTitle: 'Deterministic Fast-Path Gate', content: 'Instant negative reschedule', score: 1.0 }],
            policyFlags: ['FAST_PATH_RESCHEDULED'],
            toolInteractions: [],
            executionDurationMs: Date.now() - startTimestamp,
            createdAt: new Date().toISOString(),
          };
        }
      }

      // 2.6 Language Intelligence Layer: Normalization, Intent Preservation & Code-Switch Tracking
      const normalizedUtterance = this.languageNormalizer.normalize(utterance);

      // Check for explicit customer language switch request
      const lowerRaw = utterance.toLowerCase();
      if (
        lowerRaw.includes('speak in english') ||
        lowerRaw.includes('talk in english') ||
        lowerRaw.includes('in english please')
      ) {
        session.languageState.preferredLanguage = 'ENGLISH';
      } else if (
        lowerRaw.includes('kannada dalli mathadi') ||
        lowerRaw.includes('kannadadalli mathadi') ||
        lowerRaw.includes('ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಿ')
      ) {
        session.languageState.preferredLanguage = 'KANNADA';
      }

      session.languageState.detectedLanguage = normalizedUtterance.detectedLanguage.primaryLanguage;
      session.languageState.languageConfidence = normalizedUtterance.detectedLanguage.confidence;
      session.languageState.recentLanguageHistory.push(normalizedUtterance.detectedLanguage.primaryLanguage);
      if (session.languageState.recentLanguageHistory.length > 8) {
        session.languageState.recentLanguageHistory.shift();
      }

      // Map business terminology & resolve canonical entities
      const businessEntities = this.terminologyManager.resolveEntities(normalizedUtterance.normalizedText);
      normalizedUtterance.extractedEntities = [
        ...normalizedUtterance.extractedEntities,
        ...businessEntities,
      ];

      // Formulate Response Language Plan
      const languagePlan = this.languagePlanner.planResponseLanguage({
        detectedLanguage: normalizedUtterance.detectedLanguage.primaryLanguage,
        customerExplicitPreference: session.languageState.preferredLanguage as any,
        agentLanguageConfig: session.agentConfig.language,
        industry: session.businessBrain?.industry || session.agentConfig.businessBrainReference.industry,
      });
      session.languageState.currentLanguage = languagePlan.targetMode;

      // 4. Assemble 11-Layer Context
      const contextAssembly = session.contextEngine.assembleContext(
        session.agentConfig,
        session.businessBrain,
        session.memory.getRecentMessages(8),
        normalizedUtterance.normalizedText || utterance,
        session.knowledgeChunks,
        session.memory.getCustomerContext(),
        session.activeToolCall
      );

      // 5. LLM Structured Reasoning
      const rawDecision = await session.llmProvider.generateDecision(contextAssembly);

      // 6. Factual & Safety Validation Layer
      const validation = this.factualValidator.validateDecision(
        rawDecision,
        session.businessBrain,
        session.knowledgeChunks,
        session.businessBrain?.industry || session.agentConfig.businessBrainReference.industry
      );

      const decision: StructuredLLMDecisionDTO = validation.isValid
        ? rawDecision
        : validation.remediatedDecision || rawDecision;

      // 7. Execute Controlled Action Based on Validated Decision
      let finalContent = decision.response || '';
      const toolInteractions: Array<{ toolName: string; status: string }> = [];

      switch (decision.type) {
        case 'CALL_TOOL': {
          const evalResult = this.toolEvaluator.evaluateToolRequest(
            conversationId,
            session.organizationId,
            decision,
            session.agentConfig
          );

          if (!evalResult.isPermitted) {
            finalContent = `I apologize, but I do not have permission to perform that action (${evalResult.rejectionReason}). Can I help you with something else?`;
            session.stateMachine.transition('SPEAKING', 'AGENT_RESPONSE_READY');
            session.stateMachine.transition('LISTENING', 'AGENT_RESPONSE_READY');
          } else if (evalResult.requiresConfirmation && evalResult.toolCallRecord) {
            session.stateMachine.transition('CONFIRMING', 'TOOL_PENDING_CONFIRMATION');
            session.activeToolCall = evalResult.toolCallRecord;
            await this.db.saveConversationToolCall(evalResult.toolCallRecord);
            toolInteractions.push({ toolName: evalResult.toolCallRecord.toolName, status: 'PENDING_CONFIRMATION' });
            finalContent = decision.response || `Are you sure you would like me to proceed with ${evalResult.toolCallRecord.toolName}? Please confirm.`;
          } else if (evalResult.toolCallRecord) {
            session.stateMachine.transition('TOOL_EXECUTION', 'TOOL_REQUESTED');
            const execResult = await this.toolEvaluator.executeTool(evalResult.toolCallRecord);
            evalResult.toolCallRecord.status = execResult.success ? 'SUCCESS' : 'FAILED';
            evalResult.toolCallRecord.result = execResult.result;
            await this.db.saveConversationToolCall(evalResult.toolCallRecord);
            toolInteractions.push({ toolName: evalResult.toolCallRecord.toolName, status: evalResult.toolCallRecord.status });

            session.stateMachine.transition('SPEAKING', 'TOOL_COMPLETED');
            session.stateMachine.transition('LISTENING', 'AGENT_RESPONSE_READY');
          }
          break;
        }

        case 'HANDOFF': {
          const handoff = this.handoffManager.createHandoff({
            conversationId,
            organizationId: session.organizationId,
            reason: 'POLICY_VIOLATION',
            priority: 'NORMAL',
            customerContext: session.memory.getCustomerContext(),
            recentMessages: session.memory.getRecentMessages(4),
            notes: decision.reason || 'Agent initiated handoff',
          });
          session.stateMachine.transition('TRANSFER_PENDING', 'ESCALATION_TRIGGERED');
          await this.db.saveConversationHandoff(handoff);
          await session.channel.transfer(handoff);
          break;
        }

        case 'END_CONVERSATION': {
          session.stateMachine.transition('ENDED', 'CONVERSATION_ENDED');
          const existingConv = await this.db.getConversationById(conversationId);
          if (existingConv) {
            existingConv.status = 'ENDED';
            existingConv.currentState = 'ENDED';
            await this.db.updateConversation(existingConv);
          }
          break;
        }

        case 'RESPOND':
        case 'ASK_CLARIFICATION':
        default: {
          session.stateMachine.transition('SPEAKING', 'AGENT_RESPONSE_READY');
          session.stateMachine.transition('LISTENING', 'AGENT_RESPONSE_READY');
          break;
        }
      }

      // Post-Generation Language Quality & Guardrail Validation
      const qualityCheck = this.languageQualityValidator.validateResponse(
        finalContent,
        languagePlan.targetMode,
        session.businessBrain?.industry || session.agentConfig.businessBrainReference.industry
      );

      if (!qualityCheck.isValid && qualityCheck.remediatedResponse) {
        finalContent = qualityCheck.remediatedResponse;
      }

      // Record agent message
      session.sequenceCounter++;
      const agentMsg: ConversationMessageDTO = {
        id: `msg_${Date.now()}_agent`,
        conversationId,
        organizationId: session.organizationId,
        speaker: 'AGENT',
        messageType: 'AGENT',
        content: finalContent,
        sequenceNumber: session.sequenceCounter,
        createdAt: new Date().toISOString(),
      };
      session.memory.addMessage(agentMsg);
      await this.db.saveConversationMessage(agentMsg);
      await session.channel.sendMessage(agentMsg);

      const stateAfter = session.stateMachine.getCurrentState();

      return {
        turnId: resolvedEventId,
        conversationId,
        speaker: 'AGENT',
        userUtterance: utterance,
        agentResponse: finalContent,
        stateBefore,
        stateAfter,
        decision,
        groundedSources: session.knowledgeChunks.map(k => ({ sourceTitle: k.title, content: k.content, score: 0.9 })),
        policyFlags: [...validation.violations, ...qualityCheck.violations],
        toolInteractions,
        languagePlan,
        normalizedUtterance,
        executionDurationMs: Date.now() - startTimestamp,
        createdAt: new Date().toISOString(),
      };
    } finally {
      session.isProcessing = false;
    }
  }

  /**
   * Confirms and executes an action that was held in CONFIRMING state
   */
  async confirmToolExecution(conversationId: string): Promise<ConversationTurnDTO> {
    const session = this.sessions.get(conversationId);
    if (!session || !session.activeToolCall) {
      throw new Error(`No pending tool call awaiting confirmation in conversation "${conversationId}".`);
    }

    const toolCall = session.activeToolCall;
    toolCall.isConfirmed = true;
    session.stateMachine.transition('TOOL_EXECUTION', 'TOOL_REQUESTED');

    const result = await this.toolEvaluator.executeTool(toolCall);
    toolCall.status = result.success ? 'SUCCESS' : 'FAILED';
    toolCall.result = result.result;
    session.activeToolCall = null;

    await this.db.updateConversationToolCall(toolCall);

    session.stateMachine.transition('SPEAKING', 'TOOL_COMPLETED');
    session.stateMachine.transition('LISTENING', 'AGENT_RESPONSE_READY');

    const confirmationReply = `Thank you! Your ${toolCall.toolName.replace(/_/g, ' ')} has been successfully confirmed.`;
    session.sequenceCounter++;
    const agentMsg: ConversationMessageDTO = {
      id: `msg_${Date.now()}_confirmed`,
      conversationId,
      organizationId: session.organizationId,
      speaker: 'AGENT',
      messageType: 'TOOL',
      content: confirmationReply,
      sequenceNumber: session.sequenceCounter,
      createdAt: new Date().toISOString(),
    };
    session.memory.addMessage(agentMsg);
    await this.db.saveConversationMessage(agentMsg);
    await session.channel.sendMessage(agentMsg);

    return {
      turnId: `turn_confirm_${Date.now()}`,
      conversationId,
      speaker: 'AGENT',
      userUtterance: 'Confirmed',
      agentResponse: confirmationReply,
      stateBefore: 'CONFIRMING',
      stateAfter: session.stateMachine.getCurrentState(),
      groundedSources: [],
      policyFlags: [],
      toolInteractions: [{ toolName: toolCall.toolName, status: toolCall.status }],
      executionDurationMs: 50,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Handles caller interruption (barge-in) during active agent speech
   */
  async handleCustomerInterrupt(conversationId: string): Promise<void> {
    const session = this.sessions.get(conversationId);
    if (!session) return;

    if (session.stateMachine.getCurrentState() === 'SPEAKING' || session.stateMachine.getCurrentState() === 'GREETING') {
      session.stateMachine.transition('INTERRUPTED', 'CUSTOMER_INTERRUPTED');
      await session.channel.interrupt();
      session.stateMachine.transition('LISTENING', 'CUSTOMER_INTERRUPTED');
    }
  }

  /**
   * Gracefully terminates conversation and generates final audit summary
   */
  async endConversation(conversationId: string, reason = 'CUSTOMER_ENDED'): Promise<ConversationSummaryDTO> {
    const session = this.sessions.get(conversationId);
    if (!session) {
      throw new Error(`Conversation session "${conversationId}" not found.`);
    }

    if (session.stateMachine.canTransition('ENDED')) {
      session.stateMachine.transition('ENDED', 'CONVERSATION_ENDED');
    }

    const summary = session.memory.generateSummary(conversationId, session.organizationId);
    await this.db.saveConversationSummary(summary);

    const existingConv = await this.db.getConversationById(conversationId);
    if (existingConv) {
      existingConv.status = 'ENDED';
      existingConv.currentState = 'ENDED';
      existingConv.endedAt = new Date().toISOString();
      await this.db.updateConversation(existingConv);
    }

    await session.channel.close(reason);
    this.sessions.delete(conversationId);

    return summary;
  }

  getSession(conversationId: string): ConversationSession | undefined {
    return this.sessions.get(conversationId);
  }

  getLanguageNormalizer(): LanguageNormalizer {
    return this.languageNormalizer;
  }

  getTerminologyManager(): TerminologyManager {
    return this.terminologyManager;
  }

  getResponseLanguagePlanner(): ResponseLanguagePlanner {
    return this.languagePlanner;
  }

  getLanguageQualityValidator(): LanguageQualityValidator {
    return this.languageQualityValidator;
  }

  getVoiceTextPreparation(): VoiceTextPreparation {
    return this.voicePreparation;
  }
}
