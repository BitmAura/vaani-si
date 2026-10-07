/**
 * @vanni/context-engine — Layered Context Assembler (L0 to L8)
 * Connects authoritative Business Brain Snapshots to runtime conversational prompt layers.
 */

import { TenantContext, BusinessBrainSnapshotDTO } from '@vanni/shared';

export interface ContextLayers {
  L0_SystemIdentity: string;
  L1_TenantIdentity: string;
  L2_DialectStyle: string;
  L3_KnowledgeFacts: string;
  L4_OperatingRules: string;
  L5_ToolSchemas: string;
  L6_CallerDossier: string;
  L7_RecentTurns: string;
  L8_CurrentIntent: string;
}

export class LayeredContextAssembler {
  /**
   * Assemble prompt from authoritative BusinessBrainSnapshot (Prompt 06 Architecture)
   */
  assembleFromSnapshot(
    snapshot: BusinessBrainSnapshotDTO,
    callerInfo: { phone: string; name?: string },
    recentTurns: string[],
    retrievedKnowledge?: string
  ): string {
    const servicesList = snapshot.services
      .slice(0, 5)
      .map(s => `- ${s.name}: ${s.priceMinimum ? `₹${s.priceMinimum.toLocaleString('en-IN')}` : 'Consultation required'}`)
      .join('\n');

    const policiesList = snapshot.policies
      .slice(0, 3)
      .map(p => `- ${p.title}: ${p.policyStatement}`)
      .join('\n');

    const guardrailsList = snapshot.aiConfiguration.guardrails
      .map(g => `* NEVER: ${g}`)
      .join('\n');

    return `
[L0_IDENTITY] You are VANNI, an autonomous conversational voice employee serving as ${snapshot.aiConfiguration.roleTitle} for ${snapshot.identity.displayName}.
[L1_TENANT] Industry: ${snapshot.industry}. Official Phone: ${snapshot.identity.phone}.
[L2_DIALECT] Speech Style: ${snapshot.primaryDialect}. Pace: ${snapshot.aiConfiguration.speechPace}x.
Speak naturally in polite Kannada or Kanglish. Keep replies concise (under 25 words) for sub-750ms voice latency.
Initial Greeting: "${snapshot.aiConfiguration.greetingKanglish}"

[L3_FACTS & SERVICES]
${servicesList}
${retrievedKnowledge ? `\n[SPECIFIC KNOWLEDGE]\n${retrievedKnowledge}` : ''}

[L4_RULES & POLICIES]
${policiesList}
${guardrailsList}
* NO HALLUCINATION: If pricing, availability, or policies are not listed above, follow policy: "${snapshot.aiConfiguration.unknownFallbackPolicy}". Do NOT invent numbers.

[L6_CALLER] Caller: ${callerInfo.name || 'Valued Customer'} (${callerInfo.phone}).
[L7_CONVERSATION_HISTORY]
${recentTurns.slice(-6).join('\n')}
    `.trim();
  }

  /**
   * Legacy assembly method for backward compatibility
   */
  assemblePrompt(
    tenant: TenantContext,
    callerInfo: { phone: string; name?: string },
    recentTurns: string[],
    facts: string
  ): string {
    return `
[L0_IDENTITY] You are VANNI, an autonomous conversational voice employee representing ${tenant.name}.
[L1_TENANT] Industry: ${tenant.industry}. Office Timings: ${tenant.officeTimings}.
[L2_DIALECT] Speech Style: ${tenant.primaryDialect}. Speak in natural, polite Kannada or Kanglish. Keep replies under 25 words so voice latency remains low.
[L3_FACTS] ${facts || tenant.catalogSummary}
[L4_RULES] Never invent medical advice or quote unapproved discounts. Transfer to humans if caller requests.
[L6_CALLER] Caller Phone: ${callerInfo.phone}. Caller Name: ${callerInfo.name || 'Customer'}.
[L7_HISTORY]
${recentTurns.slice(-6).join('\n')}
    `.trim();
  }
}
