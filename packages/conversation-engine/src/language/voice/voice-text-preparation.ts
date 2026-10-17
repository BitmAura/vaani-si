/**
 * @vanni/conversation-engine — Voice Text Preparation & Vernacular Phonetic Normalizer
 *
 * Distinguishes visual Display Text from acoustic Speech Text:
 * Display: "₹18 Lakhs for 30x40 site at 11:00 AM on Sunday"
 * Spoken Kannada: "ಹದಿನೆಂಟು ಲಕ್ಷ ರೂಪಾಯಿ ಮೂವತ್ತು ನಲವತ್ತು ಸೈಟ್ ಭಾನುವಾರ ಬೆಳಿಗ್ಗೆ ಹನ್ನೊಂದು ಗಂಟೆಗೆ"
 * Spoken Kanglish: "18 lakh rupees thirty-forty site Sunday morning 11 AM ge"
 * Spoken English: "18 lakh rupees for thirty by forty site at 11 AM on Sunday"
 */

import { PronunciationMetadataDTO } from '@vanni/shared';

export class VoiceTextPreparation {
  /**
   * Prepares acoustic spoken text for future TTS audio synthesis
   */
  prepareSpeechText(
    displayText: string,
    language: 'kn' | 'en' | 'kn-en' | 'kanglish' = 'kn-en'
  ): { displayText: string; spokenTextKannada: string; spokenTextKanglish: string; spokenTextEnglish: string } {
    let spokenKn = displayText;
    let spokenKanglish = displayText;
    let spokenEn = displayText;

    // 1. Expand Plot Dimensions & Land Measurement Units (Consume optional following "site/plot/ನಿವೇಶನ")
    spokenKn = spokenKn.replace(/30\s*[*xX]\s*40(?:\s*(?:sites?|plots?|ನಿವೇಶನ))?/gi, 'ಮೂವತ್ತು ನಲವತ್ತು ಸೈಟ್');
    spokenKanglish = spokenKanglish.replace(/30\s*[*xX]\s*40(?:\s*(?:sites?|plots?|ನಿವೇಶನ))?/gi, 'thirty-forty site');
    spokenEn = spokenEn.replace(/30\s*[*xX]\s*40(?:\s*(?:sites?|plots?|ನಿವೇಶನ))?/gi, 'thirty by forty site');

    spokenKn = spokenKn.replace(/40\s*[*xX]\s*60(?:\s*(?:sites?|plots?|ನಿವೇಶನ))?/gi, 'ನಲವತ್ತು ಅರವತ್ತು ಸೈಟ್');
    spokenKanglish = spokenKanglish.replace(/40\s*[*xX]\s*60(?:\s*(?:sites?|plots?|ನಿವೇಶನ))?/gi, 'forty-sixty site');
    spokenEn = spokenEn.replace(/40\s*[*xX]\s*60(?:\s*(?:sites?|plots?|ನಿವೇಶನ))?/gi, 'forty by sixty site');

    spokenKn = spokenKn.replace(/60\s*[*xX]\s*40(?:\s*(?:sites?|plots?|ನಿವೇಶನ))?/gi, 'ಅರವತ್ತು ನಲವತ್ತು ಸೈಟ್');
    spokenKanglish = spokenKanglish.replace(/60\s*[*xX]\s*40(?:\s*(?:sites?|plots?|ನಿವೇಶನ))?/gi, 'sixty-forty site');
    spokenEn = spokenEn.replace(/60\s*[*xX]\s*40(?:\s*(?:sites?|plots?|ನಿವೇಶನ))?/gi, 'sixty by forty site');

    spokenEn = spokenEn.replace(/(\d+)\s*[*xX]\s*(\d+)/g, '$1 by $2');
    spokenKn = spokenKn.replace(/(\d+)\s*[*xX]\s*(\d+)/g, '$1 ಬೈ $2');
    spokenKanglish = spokenKanglish.replace(/(\d+)\s*[*xX]\s*(\d+)/g, '$1 by $2');

    // Area units: sqft, gunta, acre
    spokenKn = spokenKn.replace(/\b(?:sq\.?ft|sqft|sft)\b/gi, 'ಸ್ಕ್ವೇರ್ ಫೀಟ್');
    spokenKanglish = spokenKanglish.replace(/\b(?:sq\.?ft|sqft|sft)\b/gi, 'square feet');
    spokenEn = spokenEn.replace(/\b(?:sq\.?ft|sqft|sft)\b/gi, 'square feet');

    spokenKn = spokenKn.replace(/\b(\d+)\s*(?:guntas?|guntha)\b/gi, '$1 ಗುಂಟೆ');
    spokenKanglish = spokenKanglish.replace(/\b(\d+)\s*(?:guntas?|guntha)\b/gi, '$1 gunta');

    // 2. Expand Currency: Multi-word values FIRST (before single-symbol ₹)
    spokenKn = spokenKn.replace(/₹?\s*18\s*(?:lakhs?|lacs?|L)\b/gi, 'ಹದಿನೆಂಟು ಲಕ್ಷ ರೂಪಾಯಿ');
    spokenKanglish = spokenKanglish.replace(/₹?\s*18\s*(?:lakhs?|lacs?|L)\b/gi, '18 lakh rupees');
    spokenEn = spokenEn.replace(/₹?\s*18\s*(?:lakhs?|lacs?|L)\b/gi, '18 lakh rupees');

    spokenKn = spokenKn.replace(/₹?\s*35\s*(?:lakhs?|lacs?|L)\b/gi, 'ಮೂವತ್ತೈದು ಲಕ್ಷ ರೂಪಾಯಿ');
    spokenKanglish = spokenKanglish.replace(/₹?\s*35\s*(?:lakhs?|lacs?|L)\b/gi, '35 lakh rupees');
    spokenEn = spokenEn.replace(/₹?\s*35\s*(?:lakhs?|lacs?|L)\b/gi, '35 lakh rupees');

    spokenKn = spokenKn.replace(/₹?\s*(\d+(?:\.\d+)?)\s*(?:cr|crores?)\b/gi, '$1 ಕೋಟಿ ರೂಪಾಯಿ');
    spokenKanglish = spokenKanglish.replace(/₹?\s*(\d+(?:\.\d+)?)\s*(?:cr|crores?)\b/gi, '$1 crore rupees');
    spokenEn = spokenEn.replace(/₹?\s*(\d+(?:\.\d+)?)\s*(?:cr|crores?)\b/gi, '$1 crore rupees');

    spokenKn = spokenKn.replace(/₹?\s*(\d+)\s*(?:lakhs?|lacs?)\b/gi, '$1 ಲಕ್ಷ ರೂಪಾಯಿ');
    spokenKanglish = spokenKanglish.replace(/₹?\s*(\d+)\s*(?:lakhs?|lacs?)\b/gi, '$1 lakh rupees');
    spokenEn = spokenEn.replace(/₹?\s*(\d+)\s*(?:lakhs?|lacs?)\b/gi, '$1 lakh rupees');

    spokenKn = spokenKn.replace(/₹\s*(\d+(?:,\d+)*)/g, (_, val) => `${val.replace(/,/g, '')} ರೂಪಾಯಿ`);
    spokenKanglish = spokenKanglish.replace(/₹\s*(\d+(?:,\d+)*)/g, (_, val) => `${val.replace(/,/g, '')} rupees`);
    spokenEn = spokenEn.replace(/₹\s*(\d+(?:,\d+)*)/g, (_, val) => `${val.replace(/,/g, '')} rupees`);

    // 3. Expand Honorific & Medical Abbreviations
    spokenKn = spokenKn.replace(/\bDr\.?\s+/gi, 'ಡಾಕ್ಟರ್ ');
    spokenKanglish = spokenKanglish.replace(/\bDr\.?\s+/gi, 'Doctor ');
    spokenEn = spokenEn.replace(/\bDr\.?\s+/gi, 'Doctor ');

    spokenKn = spokenKn.replace(/\bOPD\b/gi, 'ಒ ಪಿ ಡಿ');
    spokenKanglish = spokenKanglish.replace(/\bOPD\b/gi, 'OPD');
    spokenEn = spokenEn.replace(/\bOPD\b/gi, 'O P D');

    spokenKn = spokenKn.replace(/\bBHK\b/gi, 'ಬಿ ಎಚ್ ಕೆ');
    spokenKanglish = spokenKanglish.replace(/\bBHK\b/gi, 'BHK');
    spokenEn = spokenEn.replace(/\bBHK\b/gi, 'B H K');

    spokenKn = spokenKn.replace(/\bDC\s+Converted\b/gi, 'ಡಿಸಿ ಕನ್ವರ್ಟೆಡ್');
    spokenKanglish = spokenKanglish.replace(/\bDC\s+Converted\b/gi, 'DC converted');

    // 4. Expand Times & Days (Consume optional trailing "ge")
    spokenKn = spokenKn.replace(/11:00\s*AM(?:\s*ge)?/gi, 'ಬೆಳಿಗ್ಗೆ ಹನ್ನೊಂದು ಗಂಟೆಗೆ');
    spokenKanglish = spokenKanglish.replace(/11:00\s*AM(?:\s*ge)?/gi, 'morning 11 AM ge');

    spokenKn = spokenKn.replace(/11:30\s*AM(?:\s*ge)?/gi, 'ಬೆಳಿಗ್ಗೆ ಹನ್ನೊಂದೂವರೆ ಗಂಟೆಗೆ');
    spokenKanglish = spokenKanglish.replace(/11:30\s*AM(?:\s*ge)?/gi, 'morning 11:30 AM ge');

    spokenKn = spokenKn.replace(/3:00\s*PM(?:\s*ge)?/gi, 'ಮಧ್ಯಾಹ್ನ ಮೂರು ಗಂಟೆಗೆ');
    spokenKanglish = spokenKanglish.replace(/3:00\s*PM(?:\s*ge)?/gi, 'afternoon 3 PM ge');

    spokenKn = spokenKn.replace(/(\d{1,2}):(\d{2})\s*PM(?:\s*ge)?/gi, 'ಸಂಜೆ $1:$2 ಗಂಟೆಗೆ');
    spokenKn = spokenKn.replace(/(\d{1,2}):(\d{2})\s*AM(?:\s*ge)?/gi, 'ಬೆಳಿಗ್ಗೆ $1:$2 ಗಂಟೆಗೆ');

    spokenKanglish = spokenKanglish.replace(/(\d{1,2}):(\d{2})\s*PM(?:\s*ge)?/gi, '$1:$2 PM ge');
    spokenKanglish = spokenKanglish.replace(/(\d{1,2}):(\d{2})\s*AM(?:\s*ge)?/gi, '$1:$2 AM ge');

    spokenEn = spokenEn.replace(/(\d{1,2}):00\s*(AM|PM)/gi, '$1 $2');

    spokenKn = spokenKn.replace(/\bSunday\b/gi, 'ಭಾನುವಾರ');
    spokenKn = spokenKn.replace(/\bSaturday\b/gi, 'ಶನಿವಾರ');
    spokenKn = spokenKn.replace(/\bTomorrow\b/gi, 'ನಾಳೆ');

    return {
      displayText,
      spokenTextKannada: spokenKn.trim(),
      spokenTextKanglish: spokenKanglish.trim(),
      spokenTextEnglish: spokenEn.trim(),
    };
  }
}
