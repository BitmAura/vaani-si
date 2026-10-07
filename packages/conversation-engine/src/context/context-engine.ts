/**
 * @vanni/conversation-engine — Dedicated 11-Layer Context Engine (L0 to L10)
 *
 * Implements token-budget-aware context assembly with strict structural separation
 * between authoritative system policies (instructions) and untrusted external data (knowledge/caller input).
 */

import {
  AgentRuntimeConfig,
  BusinessBrainSnapshotDTO,
  ConversationMessageDTO,
  CustomerContextDTO,
  ConversationToolCallDTO,
} from '@vanni/shared';

export interface StructuredContextAssembly {
  L0_PlatformSafety: string;
  L1_Compliance: string;
  L2_IndustryRules: string;
  L3_AgentIdentity: string;
  L4_AgentObjective: string;
  L5_BusinessBrain: string;
  L6_BusinessPolicies: string;
  L7_RetrievedKnowledge: string;
  L8_ConversationHistory: string;
  L9_CurrentInput: string;
  L10_ToolResults: string;
  estimatedTokens: number;
}

export interface ContextAssemblerOptions {
  maxHistoryTurns?: number;
  maxKnowledgeTokens?: number;
  languageMode?: string;
}

export class ConversationContextEngine {
  /**
   * Assembles the 11-layer structured context package
   */
  assembleContext(
    agentConfig: AgentRuntimeConfig,
    businessBrain: BusinessBrainSnapshotDTO | null,
    history: ConversationMessageDTO[],
    currentUserInput: string,
    retrievedKnowledgeChunks: Array<{ title: string; content: string; authority: string }>,
    customerContext?: CustomerContextDTO,
    activeToolCall?: ConversationToolCallDTO | null,
    options: ContextAssemblerOptions = {}
  ): StructuredContextAssembly {
    const maxTurns = options.maxHistoryTurns || 6;

    // L0: Platform Safety (Non-negotiable)
    const L0_PlatformSafety = `[L0_PLATFORM_SAFETY]
Strictly refuse to assist with illegal, dangerous, abusive, self-harm, or toxic requests. Never violate ethical safety boundaries.`;

    // L1: Legal & Compliance Rules
    const L1_Compliance = `[L1_LEGAL_COMPLIANCE]
1. You are an autonomous AI employee. NEVER deceive callers into believing you are a human. Identify yourself as an AI assistant if asked.
2. In situations involving human medical distress, life-threatening symptoms, or acute danger, escalate immediately to emergency casualty.`;

    // L2: Industry Safety Guardrails
    const industryRules: string[] = [];
    if (agentConfig.guardrails.healthcare) {
      industryRules.push(
        '* HEALTHCARE ZERO DIAGNOSIS: You are NOT a doctor. You MUST NOT diagnose symptoms, interpret lab values, or prescribe/recommend medications.',
        '* EMERGENCY ROUTING: If caller reports chest pain, acute bleeding, or severe distress, route immediately to casualty.'
      );
    }
    if (agentConfig.guardrails.realEstate) {
      industryRules.push(
        '* REAL ESTATE ZERO FABRICATION: NEVER invent plot dimensions, sq.ft. prices, availability, or unauthorized discounts not listed in the verified catalogue.'
      );
    }
    industryRules.push(
      '* ZERO HALLUCINATION CONTRACT: If requested business information is not available in Business Brain or verified citations, follow policy: STATE UNCERTAINTY and offer human handoff. Never invent answers.'
    );
    const L2_IndustryRules = `[L2_INDUSTRY_GUARDRAILS]\n${industryRules.join('\n')}`;

    // L3: Agent Identity & Voice Persona
    const L3_AgentIdentity = `[L3_AGENT_IDENTITY]
Name: ${agentConfig.identity.name}
Role: ${agentConfig.identity.displayName}
Business: ${agentConfig.businessBrainReference.organizationId}
Conversational Mode: ${agentConfig.language.conversationalMode} (Primary: ${agentConfig.language.primaryLanguage})
Tone: ${agentConfig.personality.tone} | Style: ${agentConfig.personality.conversationStyle} | Energy: ${agentConfig.personality.energy}
Custom Phrasing Instructions: ${agentConfig.personality.customInstructions || 'None'}
Greeting: "${agentConfig.identity.businessIntroduction}"`;

    // L4: Agent Primary Objective
    const L4_AgentObjective = `[L4_AGENT_OBJECTIVE]
Primary Mission: ${agentConfig.objective.primaryObjective}
Secondary Goals: ${(agentConfig.objective.secondaryObjectives || []).join('; ') || 'None'}
Success Criteria: ${(agentConfig.objective.successCriteria || []).join('; ') || 'Inquiry addressed accurately'}`;

    // L5: Business Brain Authoritative Data
    let L5_BusinessBrain = '[L5_BUSINESS_BRAIN_DATA]\n';
    if (businessBrain) {
      const services = (businessBrain.services || [])
        .slice(0, 5)
        .map(s => `- ${s.name}: ${s.priceMinimum ? `₹${s.priceMinimum.toLocaleString('en-IN')}` : 'Consultation required'}`)
        .join('\n');
      const hours = (businessBrain.operatingHours || [])
        .map(h => `${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][h.dayOfWeek]}: ${h.isClosed ? 'Closed' : `${h.opensAt}-${h.closesAt}`}`)
        .join(', ');
      L5_BusinessBrain += `Business: ${businessBrain.identity.displayName} (${businessBrain.industry})\nServices:\n${services || 'Standard services available'}\nHours: ${hours || 'Standard business hours'}`;
    } else {
      L5_BusinessBrain += 'Authoritative business catalogue active.';
    }

    // L6: Business Operational Policies
    const policiesList = (businessBrain?.policies || [])
      .slice(0, 4)
      .map(p => `- ${p.title} (${p.category}): ${p.policyStatement}`)
      .join('\n');
    const L6_BusinessPolicies = `[L6_BUSINESS_POLICIES]\n${policiesList || 'Standard operational policies apply.'}`;

    // L7: Retrieved Knowledge (Untrusted Data Envelopes)
    let L7_RetrievedKnowledge = '[L7_RETRIEVED_KNOWLEDGE_CITATIONS]\n';
    if (retrievedKnowledgeChunks.length > 0) {
      L7_RetrievedKnowledge += retrievedKnowledgeChunks
        .map(
          (c, idx) =>
            `<citation index="${idx + 1}" source="${c.title}" authority="${c.authority}">\n${c.content}\n</citation>`
        )
        .join('\n\n');
    } else {
      L7_RetrievedKnowledge += 'No external document citations retrieved for this turn.';
    }

    // L8: Conversation History (Windowed to Token Budget)
    const recentMessages = history.slice(-maxTurns);
    const L8_ConversationHistory = `[L8_CONVERSATION_HISTORY]\n` +
      recentMessages
        .map(m => `${m.speaker}: ${m.content}`)
        .join('\n');

    // L9: Current User Input & Customer Context
    const callerName = customerContext?.name || 'Customer';
    const callerPhone = customerContext?.phone ? ` (Phone: ${customerContext.phone})` : '';
    const L9_CurrentInput = `[L9_CURRENT_INPUT]
Caller: ${callerName}${callerPhone}
Utterance: "${currentUserInput}"`;

    // L10: Tool Execution Results or Pending Confirmation
    let L10_ToolResults = '[L10_TOOL_STATE]\n';
    if (activeToolCall) {
      L10_ToolResults += `Active Tool: ${activeToolCall.toolName} (Status: ${activeToolCall.status})\nArguments: ${JSON.stringify(activeToolCall.arguments)}\nResult: ${JSON.stringify(activeToolCall.result || {})}`;
      if (activeToolCall.requiresConfirmation && !activeToolCall.isConfirmed) {
        L10_ToolResults += `\n* PENDING CUSTOMER CONFIRMATION: Ask caller explicitly to confirm before executing this action.`;
      }
    } else {
      L10_ToolResults += 'No pending tool calls.';
    }

    // Token Estimation (Rough word/character based token count)
    const allText = [
      L0_PlatformSafety,
      L1_Compliance,
      L2_IndustryRules,
      L3_AgentIdentity,
      L4_AgentObjective,
      L5_BusinessBrain,
      L6_BusinessPolicies,
      L7_RetrievedKnowledge,
      L8_ConversationHistory,
      L9_CurrentInput,
      L10_ToolResults,
    ].join('\n\n');

    const estimatedTokens = Math.ceil(allText.length / 3.8);

    return {
      L0_PlatformSafety,
      L1_Compliance,
      L2_IndustryRules,
      L3_AgentIdentity,
      L4_AgentObjective,
      L5_BusinessBrain,
      L6_BusinessPolicies,
      L7_RetrievedKnowledge,
      L8_ConversationHistory,
      L9_CurrentInput,
      L10_ToolResults,
      estimatedTokens,
    };
  }

  /**
   * Compiles structured context into an instruction string for an LLM Provider
   */
  compileToPromptString(assembly: StructuredContextAssembly): string {
    return [
      assembly.L0_PlatformSafety,
      assembly.L1_Compliance,
      assembly.L2_IndustryRules,
      assembly.L3_AgentIdentity,
      assembly.L4_AgentObjective,
      assembly.L5_BusinessBrain,
      assembly.L6_BusinessPolicies,
      assembly.L7_RetrievedKnowledge,
      assembly.L8_ConversationHistory,
      assembly.L9_CurrentInput,
      assembly.L10_ToolResults,
    ].join('\n\n');
  }
}
