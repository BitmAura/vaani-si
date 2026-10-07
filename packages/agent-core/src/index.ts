/**
 * @vanni/agent-core — AI Employee Architecture & Orchestration Core
 */

import { TenantContext } from '@vanni/shared';
import { VoiceConversationFSM } from '@vanni/conversation-engine';
import { LayeredContextAssembler } from '@vanni/context-engine';
import { KnowledgeRetrievalEngine } from '@vanni/knowledge-engine';
import { ToolExecutionEngine } from '@vanni/tool-engine';

export * from './roles/role-templates';
export * from './validation/agent-validator';
export * from './compiler/runtime-compiler';
export * from './lifecycle/agent-lifecycle-service';
export * from './simulation/agent-simulator';

export class AgentRuntimeOrchestrator {
  private fsm: VoiceConversationFSM;
  private contextAssembler: LayeredContextAssembler;
  private knowledgeEngine: KnowledgeRetrievalEngine;
  private toolRegistry: ToolExecutionEngine;

  constructor() {
    this.fsm = new VoiceConversationFSM();
    this.contextAssembler = new LayeredContextAssembler();
    this.knowledgeEngine = new KnowledgeRetrievalEngine();
    this.toolRegistry = new ToolExecutionEngine();
  }

  getFsm(): VoiceConversationFSM {
    return this.fsm;
  }

  getKnowledgeEngine(): KnowledgeRetrievalEngine {
    return this.knowledgeEngine;
  }

  getToolRegistry(): ToolExecutionEngine {
    return this.toolRegistry;
  }

  async processTurn(
    tenant: TenantContext,
    callerPhone: string,
    userUtterance: string,
    history: string[]
  ): Promise<string> {
    this.fsm.transition('USER_SPEECH_END');
    const facts = await this.knowledgeEngine.searchRelevantFacts(tenant.id, userUtterance);
    const prompt = this.contextAssembler.assemblePrompt(tenant, { phone: callerPhone }, history, facts);

    // In production this routes to ILLMProvider
    this.fsm.transition('LLM_REPLY_READY');
    return prompt;
  }
}
