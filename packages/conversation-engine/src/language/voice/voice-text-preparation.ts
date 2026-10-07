/**
 * @vanni/conversation-engine — Voice Text Preparation & TTS Preprocessor
 *
 * Distinguishes visual Display Text from acoustic Speech Text:
 * Display: "₹1,500 for Dr. Ravi at 5:30 PM"
 * Spoken Kannada: "ಒಂದು ಸಾವಿರದ ಐದು ನೂರು ರೂಪಾಯಿ ಡಾಕ್ಟರ್ ರವಿ ಸಂಜೆ ಐದು ಮೂವತ್ತು"
 * Spoken English: "one thousand five hundred rupees for Doctor Ravi at five thirty PM"
 */

import { PronunciationMetadataDTO } from '@vanni/shared';

export class VoiceTextPreparation {
  /**
   * Prepares acoustic spoken text for future TTS audio synthesis
   */
  prepareSpeechText(
    displayText: string,
    language: 'kn' | 'en' | 'kn-en' = 'kn-en'
  ): { displayText: string; spokenTextKannada: string; spokenTextEnglish: string } {
    let spokenKn = displayText;
    let spokenEn = displayText;

    // 1. Expand Honorific & Medical Abbreviations
    spokenKn = spokenKn.replace(/\bDr\.?\s+/gi, 'ಡಾಕ್ಟರ್ ');
    spokenEn = spokenEn.replace(/\bDr\.?\s+/gi, 'Doctor ');

    spokenKn = spokenKn.replace(/\bOPD\b/gi, 'ಒ ಪಿ ಡಿ');
    spokenEn = spokenEn.replace(/\bOPD\b/gi, 'O P D');

    spokenKn = spokenKn.replace(/\bBHK\b/gi, 'ಬಿ ಎಚ್ ಕೆ');
    spokenEn = spokenEn.replace(/\bBHK\b/gi, 'B H K');

    // 2. Expand Currency: ₹ / Rs / Rupees
    spokenKn = spokenKn.replace(/₹\s*(\d+(?:,\d+)*)/g, (_, val) => {
      return `${val} ರೂಪಾಯಿ`;
    });
    spokenEn = spokenEn.replace(/₹\s*(\d+(?:,\d+)*)/g, (_, val) => {
      return `${val} rupees`;
    });

    spokenKn = spokenKn.replace(/(\d+)\s*(?:cr|crores?)/gi, '$1 ಕೋಟಿ ರೂಪಾಯಿ');
    spokenEn = spokenEn.replace(/(\d+)\s*(?:cr|crores?)/gi, '$1 crore rupees');

    spokenKn = spokenKn.replace(/(\d+)\s*(?:lakhs?|lacs?)/gi, '$1 ಲಕ್ಷ ರೂಪಾಯಿ');
    spokenEn = spokenEn.replace(/(\d+)\s*(?:lakhs?|lacs?)/gi, '$1 lakh rupees');

    // 3. Expand Times: 5:30 PM / 10:00 AM
    spokenKn = spokenKn.replace(/(\d{1,2}):(\d{2})\s*PM/gi, 'ಸಂಜೆ $1:$2');
    spokenKn = spokenKn.replace(/(\d{1,2}):(\d{2})\s*AM/gi, 'ಬೆಳಿಗ್ಗೆ $1:$2');

    spokenEn = spokenEn.replace(/(\d{1,2}):00\s*(AM|PM)/gi, '$1 $2');

    return {
      displayText,
      spokenTextKannada: spokenKn.trim(),
      spokenTextEnglish: spokenEn.trim(),
    };
  }
}
