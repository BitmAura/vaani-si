/**
 * @vanni/conversation-engine — Conversation Test Harness
 *
 * Provides scriptable multi-turn conversation execution for regression,
 * red-teaming, Kannada preservation, and factual verification tests.
 */

import {
  AgentRuntimeConfig,
  BusinessBrainSnapshotDTO,
  CustomerContextDTO,
  ConversationRuntimeState,
} from '@vanni/shared';
import { ConversationOrchestrator } from '../orchestrator/conversation-orchestrator';
import { MockConversationChannel } from '../providers/mock-channel';
import { MockStructuredLLMProvider } from '../providers/mock-llm-provider';

export interface ScriptedTurn {
  customerInput: string;
  expectStateAfter?: ConversationRuntimeState;
  expectResponseContains?: string;
  expectToolCall?: string;
  expectHandoff?: boolean;
}

export interface TurnExecutionReport {
  turnIndex: number;
  customerInput: string;
  agentResponse: string;
  stateBefore: ConversationRuntimeState;
  stateAfter: ConversationRuntimeState;
  toolCalled?: string;
  passed: boolean;
  failureReasons: string[];
}

export interface ScriptExecutionSummary {
  conversationId: string;
  totalTurns: number;
  passedTurns: number;
  failedTurns: number;
  reports: TurnExecutionReport[];
  overallSuccess: boolean;
}

export class ConversationTestHarness {
  constructor(private orchestrator: ConversationOrchestrator) {}

  /**
   * Executes a scripted sequence of turns against an agent runtime configuration
   */
  async runScript(
    organizationId: string,
    agentConfig: AgentRuntimeConfig,
    script: ScriptedTurn[],
    options: {
      businessBrain?: BusinessBrainSnapshotDTO | null;
      customerContext?: CustomerContextDTO;
      knowledgeChunks?: Array<{ title: string; content: string; authority: string }>;
    } = {}
  ): Promise<ScriptExecutionSummary> {
    const mockChannel = new MockConversationChannel();
    const mockLLM = new MockStructuredLLMProvider();

    // Start conversation
    const { conversation } = await this.orchestrator.startConversation({
      organizationId,
      agentConfig,
      businessBrain: options.businessBrain,
      customerContext: options.customerContext,
      channel: mockChannel,
      llmProvider: mockLLM,
      knowledgeChunks: options.knowledgeChunks,
    });

    const reports: TurnExecutionReport[] = [];
    let passedCount = 0;

    for (let i = 0; i < script.length; i++) {
      const step = script[i];
      const failureReasons: string[] = [];

      try {
        const turn = await this.orchestrator.processCustomerMessage(
          conversation.id,
          step.customerInput
        );

        const responseText = turn.agentResponse || '';

        if (step.expectStateAfter && turn.stateAfter !== step.expectStateAfter) {
          failureReasons.push(`Expected state "${step.expectStateAfter}", got "${turn.stateAfter}"`);
        }

        if (step.expectResponseContains && !responseText.toLowerCase().includes(step.expectResponseContains.toLowerCase())) {
          failureReasons.push(`Expected response containing "${step.expectResponseContains}", got "${responseText}"`);
        }

        const toolName = turn.toolInteractions[0]?.toolName;
        if (step.expectToolCall && toolName !== step.expectToolCall) {
          failureReasons.push(`Expected tool "${step.expectToolCall}", got "${toolName || 'none'}"`);
        }

        if (step.expectHandoff && !mockChannel.activeHandoff) {
          failureReasons.push(`Expected human handoff to be dispatched`);
        }

        const passed = failureReasons.length === 0;
        if (passed) passedCount++;

        reports.push({
          turnIndex: i + 1,
          customerInput: step.customerInput,
          agentResponse: responseText,
          stateBefore: turn.stateBefore,
          stateAfter: turn.stateAfter,
          toolCalled: toolName,
          passed,
          failureReasons,
        });
      } catch (err: any) {
        reports.push({
          turnIndex: i + 1,
          customerInput: step.customerInput,
          agentResponse: `ERROR: ${err.message}`,
          stateBefore: 'ERROR',
          stateAfter: 'ERROR',
          passed: false,
          failureReasons: [`Turn threw exception: ${err.message}`],
        });
      }
    }

    return {
      conversationId: conversation.id,
      totalTurns: script.length,
      passedTurns: passedCount,
      failedTurns: script.length - passedCount,
      reports,
      overallSuccess: passedCount === script.length,
    };
  }
}
