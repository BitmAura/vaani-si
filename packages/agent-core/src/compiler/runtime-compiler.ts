/**
 * @vanni/agent-core — AI Employee Runtime Configuration Compiler
 *
 * Compiles a structured AI Employee entity into an immutable, validated
 * AgentRuntimeConfig ready for consumption by the Conversation Orchestrator.
 *
 * CRITICAL ARCHITECTURAL DIRECTIVE (Prompt 08 Section 27 & 29):
 * Do NOT serialize into a giant string prompt here. The compiler builds
 * a typed, layered configuration package enforcing the 10-level instruction precedence.
 */

import {
  AIEmployeeDTO,
  AgentRuntimeConfig,
  BusinessBrainSnapshotDTO,
} from '@vanni/shared';
import { validateAgent } from '../validation/agent-validator';

export const INSTRUCTION_PRECEDENCE_HIERARCHY: string[] = [
  '1. PLATFORM_SAFETY: Absolute prevention of harmful, abusive, or dangerous advice.',
  '2. LEGAL_COMPLIANCE: Non-deceptive AI identification and emergency routing.',
  '3. INDUSTRY_GUARDRAILS: Healthcare zero diagnosis/prescription; Real Estate zero price/inventory fabrication.',
  '4. BUSINESS_POLICIES: Authoritative operational policies (cancellation, refunds, appointments).',
  '5. BUSINESS_BRAIN_DATA: Verified business facts, locations, services, staff, operating hours.',
  '6. AGENT_CAPABILITY_PERMISSIONS: Strict server-side tool execution boundaries.',
  '7. AGENT_PRIMARY_OBJECTIVE: The core mission and secondary goals of this AI employee.',
  '8. PERSONALITY_AND_TONE: Conversational style, warmth, energy, and greeting rules.',
  '9. CUSTOM_INSTRUCTIONS: Tenant-specific phrasing and conversational guidance.',
  '10. CONVERSATIONAL_CONTEXT: Caller utterance, turn history, and user intent.',
];

export function compileAgentConfiguration(
  agent: AIEmployeeDTO,
  brainSnapshot?: BusinessBrainSnapshotDTO | null
): AgentRuntimeConfig {
  // 1. Pre-compilation Validation
  const validation = validateAgent(agent);
  if (!validation.isValid) {
    throw new Error(
      `Cannot compile invalid AI Employee configuration [${agent.id}]: ${validation.errors.join('; ')}`
    );
  }

  const now = new Date().toISOString();
  const normIndustry = (agent.industry || '').toUpperCase().replace(/\s+/g, '_');
  const isHealthcare =
    normIndustry.includes('HEALTH') ||
    normIndustry.includes('CLINIC') ||
    normIndustry.includes('DENTAL') ||
    normIndustry.includes('IVF') ||
    normIndustry.includes('HOSPITAL');
  const isRealEstate =
    normIndustry.includes('REAL_ESTATE') ||
    normIndustry.includes('BUILDER') ||
    normIndustry.includes('PROPERTY') ||
    normIndustry.includes('LAYOUT');

  // Filter tools to ensure only valid permissions are compiled
  const sanitizedTools = (agent.tools || []).map(tool => ({
    ...tool,
    permissions: {
      canExecute: tool.isImplemented ? (tool.permissions?.canExecute ?? false) : false,
      requiresConfirmation: tool.permissions?.requiresConfirmation ?? true,
    },
  }));

  // Build immutable runtime configuration package
  const runtimeConfig: AgentRuntimeConfig = {
    agentId: agent.id,
    organizationId: agent.organizationId,
    version: agent.activeVersion || 1,
    identity: {
      name: agent.identity?.name || agent.name,
      displayName: agent.identity?.displayName || agent.displayName,
      role: agent.role,
      customRoleName: agent.identity?.customRoleName,
      description: agent.identity?.description || agent.description,
      businessIntroduction: agent.identity?.businessIntroduction || `Hello, I'm ${agent.name}, your AI assistant.`,
      identifyAsAI: true, // Non-deceptive AI identity enforced
    },
    objective: {
      primaryObjective: agent.objective.primaryObjective,
      secondaryObjectives: agent.objective.secondaryObjectives || [],
      successCriteria: agent.objective.successCriteria || [],
    },
    personality: {
      preset: agent.personality?.preset || 'PROFESSIONAL_RECEPTIONIST',
      tone: agent.personality?.tone || 'PROFESSIONAL',
      conversationStyle: agent.personality?.conversationStyle || 'BALANCED',
      energy: agent.personality?.energy || 'NEUTRAL',
      customInstructions: agent.personality?.customInstructions || '',
    },
    language: {
      primaryLanguage: agent.language?.primaryLanguage || 'en',
      secondaryLanguages: agent.language?.secondaryLanguages || [],
      conversationalMode: agent.language?.conversationalMode || 'CUSTOMER_DETECTED',
      allowSwitching: agent.language?.allowSwitching ?? true,
    },
    capabilities: (agent.capabilities || []).map(c => ({ ...c })),
    knowledgeAccess: {
      accessLevel: agent.knowledgeAccess?.accessLevel || 'ALL_BUSINESS_KNOWLEDGE',
      allowedSourceIds: agent.knowledgeAccess?.allowedSourceIds || [],
      restrictedCategories: agent.knowledgeAccess?.restrictedCategories || [],
    },
    tools: sanitizedTools,
    escalation: {
      defaultDestinationType: agent.escalation?.defaultDestinationType || 'RECEPTION',
      defaultDestinationTarget: agent.escalation?.defaultDestinationTarget || 'Reception Desk',
      triggers: (agent.escalation?.triggers || []).map(t => ({ ...t })),
    },
    policies: {
      enforceHealthcareGuardrails: agent.policies?.enforceHealthcareGuardrails ?? isHealthcare,
      enforceRealEstateGuardrails: agent.policies?.enforceRealEstateGuardrails ?? isRealEstate,
      enforceSalesGuardrails: agent.policies?.enforceSalesGuardrails ?? !isHealthcare,
      noHallucinationEnforced: true,
      customPolicyIds: agent.policies?.customPolicyIds || [],
    },
    conversationRules: {
      greetingStyle: agent.conversationRules?.greetingStyle || 'WARM',
      questionStrategy: agent.conversationRules?.questionStrategy || 'NATURAL_FLOW',
      responseLength: agent.conversationRules?.responseLength || 'BALANCED',
      uncertaintyBehavior: agent.conversationRules?.uncertaintyBehavior || 'STATE_UNCERTAINTY',
      silenceHandling: agent.conversationRules?.silenceHandling || 'GENTLE_PROMPT',
    },
    guardrails: {
      healthcare: agent.policies?.enforceHealthcareGuardrails ?? isHealthcare,
      realEstate: agent.policies?.enforceRealEstateGuardrails ?? isRealEstate,
      noHallucination: true,
      instructionPrecedence: INSTRUCTION_PRECEDENCE_HIERARCHY,
    },
    businessBrainReference: {
      organizationId: agent.organizationId,
      industry: agent.industry,
    },
    compiledAt: now,
  };

  return runtimeConfig;
}
