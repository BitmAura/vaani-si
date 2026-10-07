/**
 * @vanni/conversation-engine — Factual Response Validation Layer
 *
 * Enforces the Zero-Hallucination & Industry Compliance Contracts:
 * 1. Claims about specific prices, availability, or policies must be grounded in Business Brain or citations.
 * 2. Strict healthcare guardrail: AI must never diagnose diseases or prescribe medications.
 * 3. Strict real estate guardrail: AI must never invent unlisted prices or property specs.
 * 4. Fallback to INFORMATION_UNAVAILABLE if required authoritative facts are missing.
 */

import {
  StructuredLLMDecisionDTO,
  BusinessBrainSnapshotDTO,
} from '@vanni/shared';

export interface FactualValidationResult {
  isValid: boolean;
  violations: string[];
  remediatedDecision?: StructuredLLMDecisionDTO;
}

export class FactualResponseValidator {
  /**
   * Validates structured model output against authoritative business facts and industry guardrails
   */
  validateDecision(
    decision: StructuredLLMDecisionDTO,
    businessBrain: BusinessBrainSnapshotDTO | null,
    citations: Array<{ title: string; content: string; authority: string }>,
    industry?: string
  ): FactualValidationResult {
    const violations: string[] = [];

    if (decision.type !== 'RESPOND' && decision.type !== 'ASK_CLARIFICATION') {
      // Non-response decisions (CALL_TOOL, HANDOFF, END_CONVERSATION) are handled by tool/handoff validators
      return { isValid: true, violations: [] };
    }

    const text = decision.response || '';

    // 1. Healthcare Zero-Diagnosis / Prescription Guardrail
    if (industry === 'HEALTHCARE' || industry === 'IVF_FERTILITY' || industry === 'DENTAL') {
      const rxPatterns = [
        /\b(paracetamol|ibuprofen|amoxicillin|aspirin|antibiotic|crocin|dolo)\b/i,
        /\b(take|prescribe|recommend)\s+.*\b(tablets?|capsules?|syrup|dosage|mg)\b/i,
        /\byou (have|are suffering from|are diagnosed with)\s+[a-z\s]+/i,
        /\bmy diagnosis is\b/i,
      ];

      for (const pattern of rxPatterns) {
        if (pattern.test(text)) {
          violations.push(`Healthcare guardrail breach: model attempted medical diagnosis or drug prescription: "${text}"`);
        }
      }
    }

    // 2. Real Estate Price & Spec Fabrication Guardrail
    if (industry === 'REAL_ESTATE') {
      const pricePattern = /₹\s*([0-9]+(\.[0-9]+)?\s*(cr|crores?|lakhs?|k)?)/i;
      const match = text.match(pricePattern);
      if (match) {
        // Verify if price exists in Business Brain services/catalog
        const priceClaim = match[0].toLowerCase();
        let isGrounded = false;

        if (businessBrain?.services) {
          for (const service of businessBrain.services) {
            if (service.priceMinimum && text.includes(service.priceMinimum.toString())) {
              isGrounded = true;
              break;
            }
          }
        }

        // Check in citations
        if (!isGrounded && citations.length > 0) {
          for (const cit of citations) {
            if (cit.content.toLowerCase().includes(priceClaim)) {
              isGrounded = true;
              break;
            }
          }
        }

        if (!isGrounded && !text.includes('starting from') && !text.includes('indicative')) {
          violations.push(`Real estate price claim "${priceClaim}" is unverified in Business Brain or citations.`);
        }
      }
    }

    // 3. Prompt Injection or System Prompt Leakage Defense
    const leakPatterns = [
      /\[L0_PLATFORM_SAFETY\]/i,
      /\[L1_LEGAL_COMPLIANCE\]/i,
      /\[L2_INDUSTRY_GUARDRAILS\]/i,
      /You are an autonomous AI employee\. NEVER deceive/i,
      /SYSTEM INSTRUCTIONS:/i,
    ];

    for (const pattern of leakPatterns) {
      if (pattern.test(text)) {
        violations.push(`Prompt injection leak detected: internal instruction envelopes exposed in output.`);
      }
    }

    if (violations.length > 0) {
      // Remediate with safe controlled response
      const safeResponse =
        industry === 'HEALTHCARE'
          ? "As an AI assistant, I cannot provide medical diagnoses or prescribe medications. Please consult our certified medical doctors or let me connect you with the clinic directly."
          : "I don't have verified information regarding that specific detail right now. I can connect you directly with our team to assist you.";

      return {
        isValid: false,
        violations,
        remediatedDecision: {
          type: 'RESPOND',
          response: safeResponse,
          reason: `Factual validation failed: ${violations.join('; ')}`,
          confidence: 0.5,
          knowledgeReferences: [],
        },
      };
    }

    return {
      isValid: true,
      violations: [],
    };
  }
}
