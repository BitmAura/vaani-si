/**
 * @vanni/conversation-engine — Human Handoff & Emergency Escalation Manager
 *
 * Provides structured escalation when:
 * 1. Customer explicitly asks for a human.
 * 2. Emergency or casualty keywords are detected in healthcare/IVF.
 * 3. A high-priority tool fails or policy mandates human intervention.
 * 4. Generates concise internal handoff summaries without revealing internal prompts.
 */

import {
  ConversationHandoffDTO,
  CustomerContextDTO,
  ConversationMessageDTO,
} from '@vanni/shared';

export interface CreateHandoffOptions {
  conversationId: string;
  organizationId: string;
  reason: 'CUSTOMER_REQUEST' | 'EMERGENCY' | 'COMPLAINT' | 'LOW_CONFIDENCE' | 'TOOL_FAILURE' | 'POLICY_VIOLATION' | 'HIGH_VALUE_LEAD';
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  customerContext?: CustomerContextDTO;
  recentMessages?: ConversationMessageDTO[];
  destinationDepartment?: string;
  notes?: string;
}

export class HandoffManager {
  /**
   * Evaluates if caller utterance warrants an emergency escalation
   * Includes Kannada/Kanglish medical red flags
   */
  detectEmergencySignals(utterance: string): { isEmergency: boolean; trigger?: string } {
    // Kannada script triggers
    const kannadaTriggers = ['ಎದೆ ನೋವು', 'ಉಸಿರಾಟ ಕಷ್ಟ', 'ರಕ್ತಸ್ರಾವ', 'ದೆವ್ವ'];
    for (const kt of kannadaTriggers) {
      if (utterance.includes(kt)) {
        return { isEmergency: true, trigger: kt };
      }
    }

    const emergencyRegex = /\b(emergency|chest pain|heart attack|breathing|breathing difficulty|unconscious|severe bleeding|bleeding heavily|stroke|accident|108|casualty|ambulance|severe trauma)\b/i;
    const match = utterance.match(emergencyRegex);
    if (match) {
      return {
        isEmergency: true,
        trigger: match[0],
      };
    }
    return { isEmergency: false };
  }

  /**
   * Evaluates if caller utterance explicitly requests a human representative (Kannada/Kanglish/English)
   */
  detectHumanRequest(utterance: string): boolean {
    const humanRegex = /\b(speak to (a )?human|talk to (a )?person|call (an? )?agent|representative|receptionist|manager|doctor directly|connect me with someone|senior|manushya|human ge|manager ge|manager hanna|direct doctor|transfer madi|connect madi|owner)\b/i;
    return humanRegex.test(utterance);
  }

  /**
   * Evaluates if caller is angry, frustrated, or lodging a serious service complaint
   */
  detectFrustrationOrComplaint(utterance: string): { isFrustrated: boolean; trigger?: string } {
    const frustrationRegex = /\b(kopa|waste|useless|worst|fraud|cheat|complaint|bad service|time waste|bekagilla nimma|nonsense|scam|angry|disappointed)\b/i;
    const match = utterance.match(frustrationRegex);
    if (match) {
      return {
        isFrustrated: true,
        trigger: match[0],
      };
    }
    return { isFrustrated: false };
  }

  /**
   * Generates a concise internal handoff summary
   */
  generateHandoffSummary(options: CreateHandoffOptions): string {
    const customerName = options.customerContext?.name || 'Caller';
    const customerPhone = options.customerContext?.phone || 'Not provided';
    const reasonText = options.reason.replace(/_/g, ' ');

    let summary = `TRANSFER SUMMARY\nCaller: ${customerName} (${customerPhone})\nTrigger: ${reasonText}\nPriority: ${options.priority || 'NORMAL'}`;

    if (options.destinationDepartment) {
      summary += `\nDestination: ${options.destinationDepartment}`;
    }

    if (options.notes) {
      summary += `\nNotes: ${options.notes}`;
    }

    // Add last customer utterance if available
    const lastCustomerMsg = (options.recentMessages || [])
      .filter(m => m.speaker === 'CUSTOMER')
      .slice(-1)[0];
    if (lastCustomerMsg) {
      summary += `\nLast Utterance: "${lastCustomerMsg.content}"`;
    }

    return summary;
  }

  /**
   * Creates a formal Handoff DTO
   */
  createHandoff(options: CreateHandoffOptions): ConversationHandoffDTO {
    const isEmergency = options.reason === 'EMERGENCY';
    const priority = options.priority || (isEmergency ? 'CRITICAL' : (options.reason === 'COMPLAINT' ? 'HIGH' : 'NORMAL'));
    const handoffSummary = this.generateHandoffSummary({ ...options, priority });

    return {
      id: `handoff_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      conversationId: options.conversationId,
      organizationId: options.organizationId,
      reason: options.reason,
      priority,
      destinationType: isEmergency ? 'PHONE_NUMBER' : 'RECEPTION',
      destinationTarget: options.destinationDepartment || (isEmergency ? '108 / Emergency Casualty' : 'Front Desk'),
      handoffSummary,
      customerContext: options.customerContext || {},
      isEmergencyCasualty: isEmergency,
      createdAt: new Date().toISOString(),
    };
  }
}
