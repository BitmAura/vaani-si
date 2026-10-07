/**
 * @vanni/handoff-engine — Core Handoff, Escalation & Call Transfer Engine
 *
 * Implements the controlled boundary between AI Employee and Human Employee.
 * - Live Transfers via ITelephonyProvider.transferCall()
 * - Callback Fallbacks via Tool Engine create_callback_request
 * - Precedence: Platform Safety > Compliance > Emergency/Safety > Industry Policy > Business Policy > Agent Config > Context
 * - Atomic human claiming and work queue management
 */

import {
  HandoffType,
  HandoffStatus,
  HandoffReason,
  HandoffPriority,
  StructuredHandoffSummaryDTO,
  ConversationHandoffRecordDTO,
  EscalationPolicyDTO,
} from '@vanni/shared';
import { IDatabaseService } from '@vanni/database';
import { ITelephonyProvider } from '@vanni/provider-sdk';
import { ToolExecutionEngine } from '@vanni/tool-engine';
import { NotificationDispatcher } from './notifications.js';
import { DestinationResolver } from './routing.js';
import { SLAMonitor } from './sla.js';
import { RequestHandoffInput, EscalationDecision, LiveTransferResult } from './types.js';

export class HandoffEngine {
  private destinationResolver: DestinationResolver;
  public notifications: NotificationDispatcher;
  public slaMonitor: SLAMonitor;

  constructor(
    private db: IDatabaseService,
    private telephonyProvider?: ITelephonyProvider,
    private toolEngine?: ToolExecutionEngine
  ) {
    this.destinationResolver = new DestinationResolver(db);
    this.notifications = new NotificationDispatcher(db);
    this.slaMonitor = new SLAMonitor(db, this.notifications);
  }

  /**
   * Precedence Hierarchy Evaluator:
   * Platform Safety > Compliance > Emergency/Safety > Industry Policy > Business Policy > Agent Configuration > Context
   */
  evaluateEscalationDecision(input: {
    reason: HandoffReason;
    requestedPriority?: HandoffPriority;
    utterance?: string;
    isCallActive: boolean;
    policy?: EscalationPolicyDTO | null;
  }): { priority: HandoffPriority; type: HandoffType } {
    const { reason, requestedPriority, utterance = '', isCallActive, policy } = input;

    // 1. Platform Safety / Emergency / Medical (HIGHEST PRECEDENCE)
    if (
      reason === 'EMERGENCY' ||
      reason === 'MEDICAL_SAFETY' ||
      /\b(emergency|chest pain|heart attack|casualty|ambulance|severe bleeding)\b/i.test(utterance)
    ) {
      return {
        priority: 'URGENT',
        type: isCallActive ? 'LIVE_TRANSFER' : 'URGENT_ESCALATION',
      };
    }

    // 2. Compliance / Legal / Privacy
    if (reason === 'LEGAL_QUESTION' || reason === 'PRIVACY_REQUEST') {
      return {
        priority: 'HIGH',
        type: 'HUMAN_REVIEW',
      };
    }

    // 3. User Explicit Request for Human
    if (reason === 'USER_REQUEST' || reason === 'CUSTOMER_REQUEST') {
      return {
        priority: requestedPriority || 'NORMAL',
        type: isCallActive ? 'LIVE_TRANSFER' : 'CALLBACK_REQUEST',
      };
    }

    // 4. Industry / Business Negotiation
    if (reason === 'NEGOTIATION_REQUIRED' || reason === 'HIGH_VALUE_LEAD') {
      return {
        priority: 'HIGH',
        type: isCallActive ? 'LIVE_TRANSFER' : 'TEAM_ESCALATION',
      };
    }

    // 5. Tool Failure or Knowledge Gap
    if (reason === 'TOOL_FAILURE' || reason === 'KNOWLEDGE_GAP' || reason === 'AI_UNABLE_TO_ANSWER') {
      return {
        priority: requestedPriority || 'NORMAL',
        type: isCallActive && policy?.fallbackToCallback ? 'CALLBACK_REQUEST' : 'HUMAN_REVIEW',
      };
    }

    return {
      priority: requestedPriority || 'NORMAL',
      type: isCallActive ? 'LIVE_TRANSFER' : 'HUMAN_REVIEW',
    };
  }

  /**
   * Generates a safe, factual, non-hallucinated handoff summary
   */
  generateStructuredSummary(input: RequestHandoffInput, priority: HandoffPriority): StructuredHandoffSummaryDTO {
    const custName = input.customerContext?.name || input.callerName || 'Caller';
    const custPhone = input.customerContext?.phone || input.callerPhoneNumber || 'Unknown';
    const reasonText = input.reason.replace(/_/g, ' ');

    let lastUtterance = '';
    const recentMsgs = input.recentMessages || [];
    const custMsgs = recentMsgs.filter(m => m.speaker === 'CUSTOMER');
    if (custMsgs.length > 0) {
      lastUtterance = custMsgs[custMsgs.length - 1].content;
    }

    return {
      customerSummary: `${custName} (${custPhone})`,
      reason: input.reason,
      request: lastUtterance || `Customer requested assistance regarding ${reasonText.toLowerCase()}`,
      relevantEntities: {
        department: input.targetDepartmentOrTeam || 'General',
        verified: !!(input.customerContext as any)?.verified,
      },
      recentActions: recentMsgs.slice(-3).map(m => `[${m.speaker}] ${m.content.substring(0, 80)}`),
      pendingAction: input.notes || `Awaiting human engagement for ${reasonText}`,
      preferredLanguage: input.customerContext?.preferredLanguage || 'kn-IN',
      urgency: priority,
      appointmentContext: undefined,
      leadContext: undefined,
      generatedByAI: true,
    };
  }

  /**
   * Main Escalation Entrypoint:
   * Creates a formal handoff record, routes destination, dispatches live transfer or fallback callback
   */
  async requestHandoff(input: RequestHandoffInput): Promise<{
    handoff: ConversationHandoffRecordDTO;
    decision: EscalationDecision;
    transferResult?: LiveTransferResult;
  }> {
    const policy = await this.db.getEscalationPolicy(input.organizationId, input.agentId);
    const isLiveCall = !!input.telephonySessionId || !!input.voiceSessionId;

    const evaluation = this.evaluateEscalationDecision({
      reason: input.reason,
      requestedPriority: input.priority,
      isCallActive: isLiveCall,
      policy,
    });

    const summary = this.generateStructuredSummary(input, evaluation.priority);

    // Resolve Destination
    const resolvedDest = await this.destinationResolver.resolveDestination(input.organizationId, {
      targetTeamSlugOrId: input.targetDepartmentOrTeam,
      targetPhone: input.targetPhoneNumber || policy?.defaultLiveTransferDestinationPhone,
      policy,
    });

    const handoffId = `handoff_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const handoffRecord: ConversationHandoffRecordDTO = {
      id: handoffId,
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      voiceSessionId: input.voiceSessionId,
      telephonySessionId: input.telephonySessionId,
      agentId: input.agentId,
      agentVersionId: input.agentVersionId,
      type: evaluation.type,
      reason: input.reason,
      priority: evaluation.priority,
      status: 'REQUESTED',
      destinationType: resolvedDest.type,
      destination: resolvedDest.targetIdOrPhone,
      assignedTeamId: resolvedDest.type === 'TEAM' ? resolvedDest.targetIdOrPhone : undefined,
      assignedUserId: resolvedDest.memberUserId,
      summary,
      notes: input.notes,
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    let transferResult: LiveTransferResult | undefined;

    // 1. LIVE CALL TRANSFER PATH
    if (evaluation.type === 'LIVE_TRANSFER' && isLiveCall) {
      if (resolvedDest.isAvailable && this.telephonyProvider && input.telephonySessionId) {
        handoffRecord.status = 'TRANSFER_PENDING';
        try {
          const transferResp = await this.telephonyProvider.transferCall({
            callSid: input.telephonySessionId,
            destinationPhoneNumber: resolvedDest.targetIdOrPhone,
            transferType: 'WARM',
          });

          if (transferResp.success) {
            handoffRecord.status = 'TRANSFERRED';
            handoffRecord.startedAt = new Date().toISOString();
            transferResult = {
              success: true,
              transferredTo: resolvedDest.targetIdOrPhone,
              status: 'TRANSFERRED',
              message: 'Connecting you with our specialist team now. Please hold on.',
            };
          } else {
            handoffRecord.status = 'FAILED';
            handoffRecord.failureReason = transferResp.message || 'Telephony provider transfer returned failure';
          }
        } catch (err: any) {
          handoffRecord.status = 'FAILED';
          handoffRecord.failureReason = err.message;
        }
      }

      // If transfer failed or destination was offline/unavailable -> Fallback to Callback
      if (handoffRecord.status === 'FAILED' || !resolvedDest.isAvailable) {
        if (policy?.fallbackToCallback !== false && this.toolEngine && input.callerPhoneNumber) {
          const cbResult = await this.scheduleFallbackCallback(input, handoffRecord);
          if (cbResult.success) {
            handoffRecord.status = 'CALLBACK_SCHEDULED';
            handoffRecord.callbackTaskId = cbResult.callbackId;
            transferResult = {
              success: false,
              transferredTo: resolvedDest.targetIdOrPhone,
              status: 'CALLBACK_SCHEDULED',
              message: "Our specialist team isn't available right now. I have arranged a confirmed callback for you.",
            };
          } else {
            handoffRecord.status = 'PENDING';
            transferResult = {
              success: false,
              transferredTo: resolvedDest.targetIdOrPhone,
              status: 'FAILED',
              message: "I couldn't connect you right now, but I have flagged this for our front desk to contact you.",
              error: handoffRecord.failureReason,
            };
          }
        } else {
          handoffRecord.status = 'PENDING';
        }
      }
    } else if (evaluation.type === 'CALLBACK_REQUEST') {
      if (this.toolEngine && input.callerPhoneNumber) {
        const cbResult = await this.scheduleFallbackCallback(input, handoffRecord);
        if (cbResult.success) {
          handoffRecord.status = 'CALLBACK_SCHEDULED';
          handoffRecord.callbackTaskId = cbResult.callbackId;
        } else {
          handoffRecord.status = 'PENDING';
        }
      } else {
        handoffRecord.status = 'PENDING';
      }
    } else {
      handoffRecord.status = 'PENDING';
    }

    // Save to database
    await this.db.saveHandoffRecord(handoffRecord);

    // Dispatch Notifications to designated human or team members
    const recipientUser = handoffRecord.assignedUserId;
    if (recipientUser) {
      await this.notifications.dispatch({
        organizationId: input.organizationId,
        recipientUserId: recipientUser,
        type: evaluation.priority === 'URGENT' ? 'HANDOFF_URGENT' : 'HANDOFF_CREATED',
        priority: evaluation.priority,
        title: `New Handoff [${evaluation.priority}]: ${input.reason}`,
        body: `${summary.customerSummary} - ${summary.request}`,
        entityType: 'HANDOFF',
        entityId: handoffRecord.id,
        eventId: `req_${handoffRecord.id}`,
      });
    }

    const decision: EscalationDecision = {
      action: handoffRecord.status === 'TRANSFERRED'
        ? 'TRANSFER_CALL'
        : handoffRecord.status === 'CALLBACK_SCHEDULED'
        ? 'CREATE_CALLBACK'
        : 'ESCALATE_HUMAN',
      type: handoffRecord.type,
      priority: handoffRecord.priority,
      reason: handoffRecord.reason,
      destinationType: handoffRecord.destinationType || 'QUEUE',
      destination: handoffRecord.destination,
      summary: summary.customerSummary,
      messageToUser: transferResult?.message || "I've flagged your request for our team.",
    };

    return { handoff: handoffRecord, decision, transferResult };
  }

  /**
   * Helper to schedule callback through existing ToolEngine without duplicating logic
   */
  private async scheduleFallbackCallback(
    input: RequestHandoffInput,
    handoff: ConversationHandoffRecordDTO
  ): Promise<{ success: boolean; callbackId?: string }> {
    if (!this.toolEngine) return { success: false };

    try {
      const result = await this.toolEngine.executeTool(
        {
          toolName: 'create_callback_request',
          conversationId: input.conversationId,
          organizationId: input.organizationId,
          agentId: input.agentId || 'agent_handoff',
          requestedBy: 'AI_AGENT',
          arguments: {
            name: input.customerContext?.name || input.callerName || 'Caller',
            phone: input.callerPhoneNumber || input.customerContext?.phone || 'Unknown',
            preferredTime: 'Next available business window',
            reason: `Handoff fallback: ${input.reason.replace(/_/g, ' ')}`,
          },
          requestedAt: new Date().toISOString(),
          correlationId: `cb_fallback_${handoff.id}`,
          idempotencyKey: `cb_fallback_${handoff.id}`,
        },
        {
          organizationId: input.organizationId,
          conversationId: input.conversationId,
          agentId: input.agentId || 'agent_handoff',
          industry: 'HEALTHCARE_HOSPITAL',
          businessTimezone: 'Asia/Kolkata',
          capabilities: {
            canCaptureLeads: true,
          },
        }
      );

      return {
        success: result.success,
        callbackId: result.data?.callbackId,
      };
    } catch {
      return { success: false };
    }
  }

  /**
   * Atomic human acceptance: locks handoff to single user
   */
  async acceptHandoff(handoffId: string, userId: string, organizationId: string): Promise<{ success: boolean; handoff?: ConversationHandoffRecordDTO; error?: string }> {
    return this.db.claimHandoffRecord(handoffId, userId, organizationId);
  }

  /**
   * Resolves a handoff with human notes, outcome, and optional follow-up action
   */
  async resolveHandoff(params: {
    handoffId: string;
    organizationId: string;
    userId: string;
    resolution: any;
    resolutionNotes?: string;
    nextAction?: 'NONE' | 'CALLBACK' | 'APPOINTMENT' | 'FOLLOW_UP';
  }): Promise<{ success: boolean; handoff?: ConversationHandoffRecordDTO; error?: string }> {
    const handoff = await this.db.getHandoffRecordById(params.handoffId, params.organizationId);
    if (!handoff) {
      return { success: false, error: 'Handoff record not found' };
    }

    const now = new Date().toISOString();
    handoff.status = 'RESOLVED';
    handoff.resolution = params.resolution;
    handoff.resolutionNotes = params.resolutionNotes;
    handoff.resolutionNextAction = params.nextAction || 'NONE';
    handoff.resolvedAt = now;
    handoff.updatedAt = now;

    await this.db.saveHandoffRecord(handoff);
    return { success: true, handoff };
  }
}
