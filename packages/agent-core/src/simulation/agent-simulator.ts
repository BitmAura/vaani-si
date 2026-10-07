/**
 * @vanni/agent-core — AI Employee Simulation Harness
 *
 * Provides a deterministic, policy-aware text simulation environment
 * allowing operators to test their AI Employee configurations prior to production activation.
 *
 * CRITICAL DIRECTIVE (Prompt 08 Section 31):
 * Clearly distinguishes Simulation from Production. Evaluates knowledge grounding,
 * capability permissions, escalation triggers, and industry safety policies.
 */

import {
  AgentRuntimeConfig,
  KnowledgeRetrievalItemDTO,
} from '@vanni/shared';
import { IDatabaseService } from '@vanni/database';
import { KnowledgeRetrievalEngine } from '@vanni/knowledge-engine';

export interface SimulationTurnResult {
  simulatedResponse: string;
  isSimulation: true;
  groundedSources: Array<{
    sourceName: string;
    documentTitle: string;
    content: string;
    score: number;
    authority: string;
  }>;
  capabilitiesChecked: Array<{
    capability: string;
    enabled: boolean;
    requiresPermission: boolean;
    authorized: boolean;
  }>;
  escalationTriggered?: {
    triggerType: string;
    priority: string;
    destinationTarget: string;
    transferMessage: string;
  };
  policyFlags: string[];
  executionTimeMs: number;
}

export class AgentSimulationHarness {
  private retrievalEngine: KnowledgeRetrievalEngine;

  constructor(private db: IDatabaseService) {
    this.retrievalEngine = new KnowledgeRetrievalEngine(db);
  }

  async simulateTurn(
    runtimeConfig: AgentRuntimeConfig,
    userUtterance: string,
    history: string[] = []
  ): Promise<SimulationTurnResult> {
    const startTime = Date.now();
    const policyFlags: string[] = [];
    const lowerUtterance = userUtterance.toLowerCase();

    // 1. Evaluate Escalation Triggers (Level 2/3)
    let triggeredEscalation: SimulationTurnResult['escalationTriggered'] | undefined;

    // Check emergency trigger
    const isEmergency =
      lowerUtterance.includes('emergency') ||
      lowerUtterance.includes('chest pain') ||
      lowerUtterance.includes('heart attack') ||
      lowerUtterance.includes('bleeding') ||
      lowerUtterance.includes('unconscious') ||
      lowerUtterance.includes('casualty');

    if (isEmergency && runtimeConfig.guardrails.healthcare) {
      policyFlags.push('EMERGENCY_DETECTED_HEALTHCARE');
      const emTrigger = runtimeConfig.escalation.triggers.find(
        t => t.triggerType === 'EMERGENCY' && t.enabled
      );
      if (emTrigger) {
        triggeredEscalation = {
          triggerType: 'EMERGENCY',
          priority: emTrigger.priority,
          destinationTarget: emTrigger.destinationTarget,
          transferMessage: emTrigger.transferMessage,
        };
      }
    }

    // Check request human trigger
    const isHumanRequest =
      lowerUtterance.includes('human') ||
      lowerUtterance.includes('person') ||
      lowerUtterance.includes('doctor') ||
      lowerUtterance.includes('agent') ||
      lowerUtterance.includes('speak to someone') ||
      lowerUtterance.includes('talk to staff') ||
      lowerUtterance.includes('manager');

    if (!triggeredEscalation && isHumanRequest) {
      const humanTrigger = runtimeConfig.escalation.triggers.find(
        t => t.triggerType === 'CUSTOMER_REQUEST_HUMAN' && t.enabled
      );
      if (humanTrigger) {
        triggeredEscalation = {
          triggerType: 'CUSTOMER_REQUEST_HUMAN',
          priority: humanTrigger.priority,
          destinationTarget: humanTrigger.destinationTarget,
          transferMessage: humanTrigger.transferMessage,
        };
      }
    }

    // 2. Evaluate Industry Safety Guardrails
    // Healthcare Medical Diagnosis Block
    const isMedicalDiagnosisQuery =
      lowerUtterance.includes('diagnos') ||
      lowerUtterance.includes('prescribe') ||
      lowerUtterance.includes('what disease') ||
      lowerUtterance.includes('which medicine') ||
      lowerUtterance.includes('take paracetamol') ||
      lowerUtterance.includes('cure for');

    if (runtimeConfig.guardrails.healthcare && isMedicalDiagnosisQuery) {
      policyFlags.push('HEALTHCARE_ZERO_DIAGNOSIS_GUARDRAIL_ENFORCED');
      const executionTimeMs = Date.now() - startTime;
      return {
        simulatedResponse:
          `[SIMULATION MODE] As an AI clinic assistant, I cannot diagnose medical conditions or prescribe medications. ` +
          `Our licensed doctors conduct clinical consultations during OPD hours. Would you like me to schedule an in-person consultation for you?`,
        isSimulation: true,
        groundedSources: [],
        capabilitiesChecked: [
          { capability: 'ANSWER_QUESTIONS', enabled: true, requiresPermission: false, authorized: true },
        ],
        policyFlags,
        executionTimeMs,
      };
    }

    // If emergency was triggered, return immediate escalation notice
    if (triggeredEscalation && triggeredEscalation.triggerType === 'EMERGENCY') {
      const executionTimeMs = Date.now() - startTime;
      return {
        simulatedResponse: `[SIMULATION ESCALATION] ${triggeredEscalation.transferMessage} (Routing to ${triggeredEscalation.destinationTarget})`,
        isSimulation: true,
        groundedSources: [],
        capabilitiesChecked: [
          { capability: 'TRANSFER_TO_HUMAN', enabled: true, requiresPermission: false, authorized: true },
        ],
        escalationTriggered: triggeredEscalation,
        policyFlags,
        executionTimeMs,
      };
    }

    // 3. Knowledge Retrieval Grounding
    const queryResult = await this.retrievalEngine.retrieveKnowledge({
      query: userUtterance,
      organizationId: runtimeConfig.organizationId,
      topK: 3,
    });

    const groundedSources = queryResult.results.map((r: KnowledgeRetrievalItemDTO) => ({
      sourceName: r.sourceTitle,
      documentTitle: r.documentTitle,
      content: r.content,
      score: r.score,
      authority: r.authority,
    }));

    // 4. Capability Permission Check
    const capabilitiesChecked: SimulationTurnResult['capabilitiesChecked'] = [];
    const appointmentWanted =
      lowerUtterance.includes('appointment') ||
      lowerUtterance.includes('book') ||
      lowerUtterance.includes('schedule') ||
      lowerUtterance.includes('site visit');

    if (appointmentWanted) {
      const bookCap = runtimeConfig.capabilities.find(c => c.capability === 'BOOK_APPOINTMENT');
      capabilitiesChecked.push({
        capability: 'BOOK_APPOINTMENT',
        enabled: bookCap?.enabled ?? false,
        requiresPermission: bookCap?.requiresPermission ?? true,
        authorized: (bookCap?.enabled ?? false),
      });
    }

    // 5. Synthesize Grounded Simulated Reply
    let simulatedResponse = '';

    if (triggeredEscalation && isHumanRequest) {
      simulatedResponse = `[SIMULATION] ${triggeredEscalation.transferMessage} (Transferred to ${triggeredEscalation.destinationTarget})`;
    } else if (groundedSources.length > 0) {
      policyFlags.push('GROUNDED_IN_VERIFIED_KNOWLEDGE');
      const topContent = groundedSources[0].content;
      const isKanglishMode = runtimeConfig.language.conversationalMode === 'KANGLISH';

      if (appointmentWanted) {
        simulatedResponse = isKanglishMode
          ? `[SIMULATION] ${topContent} Yes, appointment slots available ide. We can arrange that for you. Would you like me to book it now?`
          : `[SIMULATION] Based on our verified clinic/project information: ${topContent} We would be happy to schedule this appointment for you.`;
      } else {
        simulatedResponse = isKanglishMode
          ? `[SIMULATION] Here is the information: ${topContent}. If you have any further questions, please let me know.`
          : `[SIMULATION] According to ${groundedSources[0].sourceName}: ${topContent}`;
      }
    } else {
      policyFlags.push('NO_GROUNDING_FOUND_STATE_UNCERTAINTY');
      simulatedResponse =
        `[SIMULATION] I don't have verified information regarding this specific inquiry in our business records. ` +
        `Let me connect you with a staff member who can assist you directly.`;
    }

    const executionTimeMs = Date.now() - startTime;
    return {
      simulatedResponse,
      isSimulation: true,
      groundedSources,
      capabilitiesChecked,
      escalationTriggered: triggeredEscalation,
      policyFlags,
      executionTimeMs,
    };
  }
}
