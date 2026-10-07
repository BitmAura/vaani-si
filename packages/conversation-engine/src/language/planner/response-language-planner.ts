/**
 * @vanni/conversation-engine — Response Language Planner
 *
 * Formulates the target language, conversational register, and honorific style
 * for outgoing agent replies based on strict priority:
 * 1. Explicit customer preference (e.g. "Please speak in English" or "ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಿ")
 * 2. Current conversation turn detected language (if code-switching is allowed)
 * 3. Agent language configuration (conversationalMode)
 * 4. Business profile defaults
 * 5. Platform default (Natural Kanglish)
 */

import {
  LanguageMode,
  KannadaRegister,
  AgentLanguageConfig,
  ResponseLanguagePlanDTO,
} from '@vanni/shared';

export interface LanguagePlanningInput {
  detectedLanguage: LanguageMode;
  customerExplicitPreference?: 'ENGLISH' | 'KANNADA' | 'KANGLISH' | 'AUTO';
  agentLanguageConfig?: AgentLanguageConfig;
  industry?: string;
}

export class ResponseLanguagePlanner {
  /**
   * Plans the target response language, register, and honorific style
   */
  planResponseLanguage(input: LanguagePlanningInput): ResponseLanguagePlanDTO {
    const isHealthcare = (input.industry || '').toUpperCase().includes('HEALTH') ||
                         (input.industry || '').toUpperCase().includes('DENTAL') ||
                         (input.industry || '').toUpperCase().includes('IVF');

    // Default register & honorific based on industry
    const register: KannadaRegister = isHealthcare ? 'PROFESSIONAL' : 'FRIENDLY';
    const honorificStyle: 'AVARU' | 'NIMMA' | 'SIR_MADAM' | 'NONE' = isHealthcare ? 'NIMMA' : 'AVARU';

    // 1. Priority 1: Explicit Customer Preference Override
    if (input.customerExplicitPreference && input.customerExplicitPreference !== 'AUTO') {
      const mode: LanguageMode = input.customerExplicitPreference === 'KANNADA'
        ? 'KANNADA'
        : input.customerExplicitPreference === 'ENGLISH'
        ? 'ENGLISH'
        : 'KANGLISH';

      return {
        targetMode: mode,
        register,
        honorificStyle,
        allowEnglishLoanwords: mode !== 'KANNADA',
        reasoning: `Targeting ${mode} due to explicit customer preference setting.`,
      };
    }

    // 2. Priority 2: Current Turn Language (if code-switching allowed)
    const allowSwitching = input.agentLanguageConfig?.allowSwitching !== false;

    if (allowSwitching) {
      if (input.detectedLanguage === 'KANNADA') {
        return {
          targetMode: 'KANNADA',
          register,
          honorificStyle,
          allowEnglishLoanwords: true, // Allow common medical/tech loanwords naturally
          reasoning: 'Customer spoke in Kannada script or pure Kannada; matching with respectful Kannada.',
        };
      }

      if (input.detectedLanguage === 'KANGLISH' || input.detectedLanguage === 'KANNADA_ENGLISH') {
        return {
          targetMode: 'KANGLISH',
          register,
          honorificStyle,
          allowEnglishLoanwords: true,
          reasoning: 'Customer used natural Kanglish code-switching; planning natural Kannada-English conversational reply.',
        };
      }

      if (input.detectedLanguage === 'ENGLISH') {
        return {
          targetMode: 'ENGLISH',
          register: 'PROFESSIONAL',
          honorificStyle: 'SIR_MADAM',
          allowEnglishLoanwords: true,
          reasoning: 'Customer spoke in English; replying in English.',
        };
      }
    }

    // 3. Priority 3: Agent Configuration Fallback
    const agentMode = input.agentLanguageConfig?.conversationalMode;
    if (agentMode === 'KANNADA') {
      return {
        targetMode: 'KANNADA',
        register,
        honorificStyle,
        allowEnglishLoanwords: false,
        reasoning: 'Agent configuration enforces pure Kannada conversational mode.',
      };
    } else if (agentMode === 'ENGLISH') {
      return {
        targetMode: 'ENGLISH',
        register: 'PROFESSIONAL',
        honorificStyle: 'SIR_MADAM',
        allowEnglishLoanwords: true,
        reasoning: 'Agent configuration enforces English conversational mode.',
      };
    }

    // 4. Priority 4: Platform Default (Natural Kanglish)
    return {
      targetMode: 'KANGLISH',
      register,
      honorificStyle,
      allowEnglishLoanwords: true,
      reasoning: 'Platform default natural Kanglish response planning applied.',
    };
  }
}
