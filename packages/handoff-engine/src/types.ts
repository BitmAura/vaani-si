/**
 * @vanni/handoff-engine — Types & Interfaces
 */

import {
  HandoffType,
  HandoffStatus,
  HandoffReason,
  HandoffPriority,
  DestinationType,
  StructuredHandoffSummaryDTO,
  ConversationHandoffRecordDTO,
  TeamDTO,
  TeamMemberDTO,
  NotificationDTO,
  NotificationPreferencesDTO,
  HandoffSLADTO,
  EscalationPolicyDTO,
  CustomerContextDTO,
  ConversationMessageDTO,
} from '@vanni/shared';

export interface RequestHandoffInput {
  organizationId: string;
  conversationId: string;
  voiceSessionId?: string;
  telephonySessionId?: string;
  agentId?: string;
  agentVersionId?: string;
  type?: HandoffType;
  reason: HandoffReason;
  priority?: HandoffPriority;
  customerContext?: CustomerContextDTO;
  recentMessages?: ConversationMessageDTO[];
  notes?: string;
  targetDepartmentOrTeam?: string;
  targetPhoneNumber?: string;
  callerPhoneNumber?: string;
  callerName?: string;
}

export interface EscalationDecision {
  action: 'CONTINUE_AI' | 'ASK_CLARIFICATION' | 'CREATE_CALLBACK' | 'TRANSFER_CALL' | 'ESCALATE_HUMAN';
  type: HandoffType;
  priority: HandoffPriority;
  reason: HandoffReason;
  destinationType: DestinationType;
  destination: string;
  summary: string;
  messageToUser: string;
}

export interface LiveTransferResult {
  success: boolean;
  transferredTo: string;
  status: 'TRANSFERRED' | 'FAILED' | 'CALLBACK_SCHEDULED';
  message: string;
  error?: string;
}

export interface NotificationProvider {
  name: string;
  send(notification: NotificationDTO): Promise<{ success: boolean; messageId?: string; error?: string }>;
  healthCheck(): Promise<{ healthy: boolean }>;
}
