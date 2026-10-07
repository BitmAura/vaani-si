/**
 * @vanni/conversation-engine — Tool Permission & Execution Gateway
 *
 * Enforces server-side tool execution security and connects directly to @vanni/tool-engine:
 * 1. Resolves authoritative tenant and agent capability contexts.
 * 2. Checks permission flags from agent configuration.
 * 3. Enforces confirmation policies (LOW/MEDIUM/HIGH risk).
 * 4. Executes through ToolExecutionEngine with Zod schemas, normalization, and concurrency safety.
 */

import {
  AgentRuntimeConfig,
  StructuredLLMDecisionDTO,
  ConversationToolCallDTO,
} from '@vanni/shared';
import {
  ToolExecutionEngine,
  ToolSecurityContext,
  ToolRequest,
  defaultBusinessStore,
} from '@vanni/tool-engine';

export interface ToolEvaluationResult {
  isPermitted: boolean;
  requiresConfirmation: boolean;
  rejectionReason?: string;
  toolCallRecord?: ConversationToolCallDTO;
}

export class ToolPermissionEvaluator {
  private toolEngine: ToolExecutionEngine;

  constructor(engine?: ToolExecutionEngine) {
    this.toolEngine = engine || new ToolExecutionEngine(defaultBusinessStore);
  }

  /**
   * Evaluates if a tool invocation requested by the LLM is permitted and whether it requires caller confirmation
   */
  evaluateToolRequest(
    conversationId: string,
    organizationId: string,
    decision: StructuredLLMDecisionDTO,
    agentConfig: AgentRuntimeConfig
  ): ToolEvaluationResult {
    if (decision.type !== 'CALL_TOOL' || !decision.toolRequest) {
      return {
        isPermitted: false,
        requiresConfirmation: false,
        rejectionReason: 'Decision is not a tool request',
      };
    }

    const { toolName, args } = decision.toolRequest;

    // 1. Inspect registered tool in ToolExecutionEngine
    const toolDef = this.toolEngine.getTool(toolName);

    // 2. Permission Check against Agent Runtime Config
    const configuredTools = agentConfig.tools || [];
    const matchedTool = configuredTools.find(t => {
      if (t.toolName === toolName) return true;
      if (t.toolName === 'appointment_scheduler' && (toolName === 'create_appointment' || toolName === 'book_appointment' || toolName === 'check_availability' || toolName === 'cancel_appointment' || toolName === 'reschedule_appointment')) return true;
      if (t.toolName === 'telephony_transfer' && (toolName === 'request_human_handoff' || toolName === 'transfer_to_human' || toolName === 'handoff')) return true;
      if (t.toolName === 'crm_lead_capture' && (toolName === 'qualify_lead' || toolName === 'create_lead' || toolName === 'update_lead' || toolName === 'create_customer')) return true;
      return false;
    });

    const isExplicitlyAllowed = matchedTool ? (matchedTool.enabled && matchedTool.permissions.canExecute) : false;
    const isWildcardOrDemo = configuredTools.length === 0 || configuredTools.some(t => t.toolName === '*');
    const isPermitted = isExplicitlyAllowed || isWildcardOrDemo;

    if (!isPermitted) {
      return {
        isPermitted: false,
        requiresConfirmation: false,
        rejectionReason: `Tool "${toolName}" is not permitted for agent "${agentConfig.agentId}" (version ${agentConfig.version}).`,
      };
    }

    // 3. Confirmation Check: High-impact mutation vs Read-only lookup
    let requiresConfirmation = false;
    if (toolDef) {
      requiresConfirmation = toolDef.confirmationRequired;
    } else if (matchedTool) {
      requiresConfirmation = matchedTool.permissions.requiresConfirmation;
    } else {
      requiresConfirmation = ['create_appointment', 'book_appointment', 'cancel_appointment', 'reschedule_appointment'].includes(toolName);
    }

    // 4. Create initial Tool Call record
    const toolCallRecord: ConversationToolCallDTO = {
      id: `tool_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      conversationId,
      organizationId,
      toolName,
      arguments: args || {},
      status: requiresConfirmation ? 'PENDING_CONFIRMATION' : 'EXECUTING',
      requiresConfirmation,
      isConfirmed: false,
      createdAt: new Date().toISOString(),
    };

    return {
      isPermitted: true,
      requiresConfirmation,
      toolCallRecord,
    };
  }

  /**
   * Executes allowed tools through the controlled ToolExecutionEngine boundary
   */
  async executeTool(
    toolCall: ConversationToolCallDTO,
    agentConfig?: AgentRuntimeConfig
  ): Promise<{ success: boolean; result: any; error?: string; userSafeMessage?: string }> {
    const { toolName, arguments: args, organizationId, conversationId, id: toolCallId, isConfirmed } = toolCall;

    // Build trusted server-side Security Context
    const secCtx: ToolSecurityContext = {
      organizationId,
      conversationId,
      agentId: agentConfig?.agentId || 'agent_default',
      agentVersionId: agentConfig?.version || 1,
      industry: (agentConfig?.businessBrainReference?.industry as any) || 'DENTAL',
      businessTimezone: (agentConfig?.businessBrainReference as any)?.timezone || 'Asia/Kolkata',
      capabilities: {
        canCaptureLeads: true,
        canBookAppointments: true,
        canTransferCalls: true,
        canAccessKnowledge: true,
      },
    };

    // Normalize legacy tool names if sent by model
    let targetToolName = toolName;
    if (toolName === 'book_appointment') targetToolName = 'create_appointment';
    if (toolName === 'transfer_to_human') targetToolName = 'request_human_handoff';

    const toolRequest: ToolRequest = {
      toolName: targetToolName,
      conversationId,
      organizationId,
      agentId: secCtx.agentId,
      agentVersionId: secCtx.agentVersionId,
      requestedBy: 'AI_AGENT',
      arguments: args || {},
      requestedAt: new Date().toISOString(),
      correlationId: toolCallId,
      isConfirmed: !!isConfirmed,
    };

    const toolResult = await this.toolEngine.executeTool(toolRequest, secCtx);

    return {
      success: toolResult.success,
      result: toolResult.data || {},
      error: toolResult.errorCode,
      userSafeMessage: toolResult.userSafeMessage,
    };
  }
}
