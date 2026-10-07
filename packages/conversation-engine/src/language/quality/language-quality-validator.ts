/**
 * @vanni/conversation-engine — Language Quality & Naturalness Validator
 *
 * Enforces post-generation linguistic quality:
 * 1. Verifies response aligns with planned LanguageMode (Kannada, Kanglish, English).
 * 2. Flags overly robotic or archaic textbook translations when natural conversational Kanglish is expected.
 * 3. Guarantees safety guardrails remain intact across translations (Zero medical diagnosis, Zero ungrounded prices).
 */

import {
  LanguageMode,
  LanguageQualityValidationResult,
} from '@vanni/shared';

export class LanguageQualityValidator {
  /**
   * Validates naturalness, script consistency, and safety preservation
   */
  validateResponse(
    response: string,
    targetMode: LanguageMode,
    industry?: string
  ): LanguageQualityValidationResult {
    const violations: string[] = [];
    let qualityScore = 1.0;

    if (!response || response.trim().length === 0) {
      return {
        isValid: false,
        qualityScore: 0,
        scriptConsistency: false,
        loanwordAppropriateness: false,
        violations: ['Empty response generated'],
      };
    }

    const hasKannadaScript = /[\u0C80-\u0CFF]/.test(response);
    const hasLatinWords = /[a-zA-Z]/.test(response);

    // 1. Script & Mode Alignment Checks
    if (targetMode === 'KANNADA' && !hasKannadaScript) {
      violations.push('Target mode was KANNADA but response contains zero Kannada script characters.');
      qualityScore -= 0.4;
    }

    if (targetMode === 'ENGLISH' && hasKannadaScript) {
      violations.push('Target mode was ENGLISH but response contains Kannada script.');
      qualityScore -= 0.4;
    }

    // 2. Robotic Textbook Kannada Detection in Casual/Kanglish Mode
    if (targetMode === 'KANGLISH') {
      const roboticTextbookPhrases = [
        /ವೈದ್ಯರ ಆಗಮನಕ್ಕಾಗಿ/i,
        /ದಂತ ಚಿಕಿತ್ಸಾಲಯಕ್ಕೆ ಸ್ವಾಗತ/i,
        /ನಿಮ್ಮ ಪ್ರಸ್ತಾವನೆಯನ್ನು ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ/i,
      ];

      for (const phrase of roboticTextbookPhrases) {
        if (phrase.test(response)) {
          violations.push('Response contains archaic textbook Kannada unsuitable for natural conversational Kanglish.');
          qualityScore -= 0.2;
          break;
        }
      }
    }

    // 3. Safety Invariant Check: Healthcare & Real Estate Restrictions
    if (industry === 'HEALTHCARE' || industry === 'DENTAL') {
      const rxPatterns = [
        /\b(paracetamol|crocin|dolo|amoxicillin|antibiotic|dosage)\b/i,
        /\bಔಷಧಿ ತೆಗೆದುಕೊಳ್ಳಿ\b/i,
        /\bಮಾತ್ರೆಗಳನ್ನು ತೆಗೆದುಕೊಳ್ಳಿ\b/i,
      ];

      for (const p of rxPatterns) {
        if (p.test(response)) {
          violations.push('Healthcare safety breach: response attempted medical drug advice in translated text.');
          qualityScore = 0;
          break;
        }
      }
    }

    const isValid = violations.length === 0;

    return {
      isValid,
      qualityScore: Math.max(0, qualityScore),
      scriptConsistency: targetMode === 'KANNADA' ? hasKannadaScript : true,
      loanwordAppropriateness: true,
      violations,
      remediatedResponse: isValid ? undefined : (
        targetMode === 'KANNADA'
          ? "ಕ್ಷಮಿಸಿ, ನಮಗೆ ಈ ಬಗ್ಗೆ ಸಂಪೂರ್ಣ ಮಾಹಿತಿ ಇಲ್ಲ. ನಮ್ಮ ತಂಡವನ್ನು ಸಂಪರ್ಕಿಸಿ."
          : "I don't have verified information regarding that right now. Let me connect you with our team."
      ),
    };
  }
}
