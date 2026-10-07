/**
 * @vanni/conversation-engine — Kannada, Kanglish & Multilingual Normalizer
 *
 * Implements conversational speech normalization:
 * 1. Conversational fillers removal without altering core intent
 * 2. Self-corrections resolution ("Tomorrow... no, sorry, day after tomorrow")
 * 3. Negation detection ("Appointment beda", "Sunday beda")
 * 4. Question forms classification ("Eshtu?", "How much agutte?")
 * 5. Structured numbers, currency (₹ / rupees / rupayi), dates (naale / ivathu), and times (5 ge / sanje 5)
 * 6. Ambiguity detection (e.g. "5 ge" without AM/PM or morning/evening context)
 * 7. Karnataka geographic locations normalization
 */

import {
  NormalizedUtteranceDTO,
  ExtractedEntityDTO,
} from '@vanni/shared';
import { LanguageDetector } from '../detector/language-detector';

// Common conversational fillers in English and Kannada
const CONVERSATIONAL_FILLERS = [
  /\bactually\b/gi,
  /\bhaan\b/gi,
  /\bumm+\b/gi,
  /\buh+\b/gi,
  /\bಹೌದು\b/g,
  /\bಅಂದರೆ\b/g,
  /\bನೋಡಿ\b/g,
  /\bಕಣ್ರೀ\b/g,
  /\bರೀ\b/g,
];

// Karnataka geographic location aliases
const KARNATAKA_LOCATIONS: Record<string, { canonical: string; district: string }> = {
  'bengaluru': { canonical: 'Bengaluru', district: 'Bengaluru Urban' },
  'bangalore': { canonical: 'Bengaluru', district: 'Bengaluru Urban' },
  'ಬೆಂಗಳೂರು': { canonical: 'Bengaluru', district: 'Bengaluru Urban' },
  'mysuru': { canonical: 'Mysuru', district: 'Mysuru' },
  'mysore': { canonical: 'Mysuru', district: 'Mysuru' },
  'ಮೈಸೂರು': { canonical: 'Mysuru', district: 'Mysuru' },
  'ballari': { canonical: 'Ballari', district: 'Ballari' },
  'bellary': { canonical: 'Ballari', district: 'Ballari' },
  'ಬಳ್ಳಾರಿ': { canonical: 'Ballari', district: 'Ballari' },
  'hubballi': { canonical: 'Hubballi', district: 'Dharwad' },
  'hubli': { canonical: 'Hubballi', district: 'Dharwad' },
  'ಹುಬ್ಬಳ್ಳಿ': { canonical: 'Hubballi', district: 'Dharwad' },
  'mangaluru': { canonical: 'Mangaluru', district: 'Dakshina Kannada' },
  'mangalore': { canonical: 'Mangaluru', district: 'Dakshina Kannada' },
  'ಮಂಗಳೂರು': { canonical: 'Mangaluru', district: 'Dakshina Kannada' },
  'belagavi': { canonical: 'Belagavi', district: 'Belagavi' },
  'belgaum': { canonical: 'Belagavi', district: 'Belagavi' },
  'davanagere': { canonical: 'Davanagere', district: 'Davanagere' },
  'kalaburagi': { canonical: 'Kalaburagi', district: 'Kalaburagi' },
  'gulbarga': { canonical: 'Kalaburagi', district: 'Kalaburagi' },
  'udupi': { canonical: 'Udupi', district: 'Udupi' },
  'ಉಡುಪಿ': { canonical: 'Udupi', district: 'Udupi' },
  'shivamogga': { canonical: 'Shivamogga', district: 'Shivamogga' },
  'shimoga': { canonical: 'Shivamogga', district: 'Shivamogga' },
  'tumakuru': { canonical: 'Tumakuru', district: 'Tumakuru' },
  'tumkur': { canonical: 'Tumakuru', district: 'Tumakuru' },
};

export class LanguageNormalizer {
  private detector = new LanguageDetector();

  /**
   * Performs full normalization, self-correction handling, and entity extraction on raw utterance
   */
  normalize(rawText: string, contextReferenceDate: Date = new Date()): NormalizedUtteranceDTO {
    const detectedLanguage = this.detector.detectLanguage(rawText);
    const fillersRemoved: string[] = [];
    const extractedEntities: ExtractedEntityDTO[] = [];
    const ambiguityReasons: string[] = [];

    let currentText = rawText.trim();

    // 1. Self-Correction / Repair Detection
    // Pattern: "[X]... no, sorry, [Y]" or "[X]... alla [Y]" or "[X]... beda [Y]"
    let isCorrection = false;
    let correctedFrom: string | undefined;

    const correctionRegex = /^(.*?)(?:\s*\.{2,}\s*(?:no\s*,?\s*sorry|\bno\b|\bsorry\b|\balla\b|\bbeda\b)?|\s*,\s*(?:no\s*,?\s*sorry|\bsorry\b|\balla\b|\bbeda\b))\s*,?\s*(.*)$/i;
    const correctionMatch = currentText.match(correctionRegex);
    if (correctionMatch && correctionMatch[1].trim().length > 0 && correctionMatch[2].trim().length > 0) {
      isCorrection = true;
      correctedFrom = correctionMatch[1].trim();
      currentText = correctionMatch[2].trim();
    }

    // 2. Fillers Extraction & Removal
    let textWithoutFillers = currentText;
    for (const fillerRegex of CONVERSATIONAL_FILLERS) {
      const match = textWithoutFillers.match(fillerRegex);
      if (match) {
        fillersRemoved.push(...match);
        textWithoutFillers = textWithoutFillers.replace(fillerRegex, ' ');
      }
    }
    textWithoutFillers = textWithoutFillers.replace(/\s+/g, ' ').trim();

    // 3. Negation Detection
    // Matches Kannada "beda", "alla", "illa", "madtilla", "agalla" or English "not", "no", "don't"
    const negationRegex = /\b(beda|ಬೇಡ|alla|ಅಲ್ಲ|illa|ಇಲ್ಲ|madtilla|agalla|aagalla|gothilla|gotthilla|kodbeda|don'?t|not|never|cancel|no)\b/i;
    const isNegation = negationRegex.test(textWithoutFillers);

    // 4. Question Detection
    const questionRegex = /\b(eshtu|ಎಷ್ಟು|yelli|ಎಲ್ಲಿ|yavaga|ಯಾವಾಗ|hege|ಹೇಗೆ|yaake|ಯಾಕೆ|enu|ಏನು|ideya|ಇದೆಯಾ|iddara|ಇದ್ದಾರಾ|agutta|ಆಗುತ್ತಾ|sigutta|ಸಿಗುತ್ತಾ|how much|what time|when|where|why|can i|could you)\b|\?/i;
    const isQuestion = questionRegex.test(textWithoutFillers);

    // 5. Currency & Amount Normalization
    // e.g. "₹500", "500 rupees", "500 rs", "500 rupayi", "500/-", "ಐದು ನೂರು ರೂಪಾಯಿ"
    const currencyRegex = /(?:₹\s*|rs\.?\s*|rupees?\s*)?(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:₹|rs\.?|rupees?|rupayi|ರೂಪಾಯಿ|\/-)?\b/i;
    const currencyMatch = textWithoutFillers.match(currencyRegex);
    if (currencyMatch && !textWithoutFillers.match(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm|ge)\b/i)) {
      const numVal = parseFloat(currencyMatch[1].replace(/,/g, ''));
      const lowerText = textWithoutFillers.toLowerCase();
      const hasCurrencyContext =
        textWithoutFillers.includes('₹') ||
        lowerText.includes('rs') ||
        lowerText.includes('rupee') ||
        lowerText.includes('rupayi') ||
        lowerText.includes('ರೂಪಾಯಿ') ||
        lowerText.includes('fee') ||
        lowerText.includes('charge') ||
        lowerText.includes('cost') ||
        lowerText.includes('price') ||
        lowerText.includes('lakh') ||
        lowerText.includes('eshtu');

      if (!isNaN(numVal) && hasCurrencyContext) {
        extractedEntities.push({
          type: 'AMOUNT',
          rawExpression: currencyMatch[0].trim(),
          canonicalValue: { amount: numVal, currency: 'INR' },
          confidence: 0.95,
        });
      }
    }

    // 6. Dates Normalization
    // "today" / "ivathu", "tomorrow" / "naale", "day after tomorrow" / "naaliddhu"
    const dateRegex = /\b(today|ivathu|ಇವತ್ತು|tomorrow|naale|nale|ನಾಳೆ|day after tomorrow|naaliddhu|nalidhu|ನಾಳಿದ್ದು)\b/i;
    const dateMatch = textWithoutFillers.match(dateRegex);
    if (dateMatch) {
      const matchLower = dateMatch[0].toLowerCase();
      const targetDate = new Date(contextReferenceDate);

      let dayOffset = 0;
      if (['tomorrow', 'naale', 'nale', 'ನಾಳೆ'].includes(matchLower)) {
        dayOffset = 1;
      } else if (['day after tomorrow', 'naaliddhu', 'nalidhu', 'ನಾಳಿದ್ದು'].includes(matchLower)) {
        dayOffset = 2;
      }

      targetDate.setDate(targetDate.getDate() + dayOffset);
      const isoDate = targetDate.toISOString().split('T')[0];

      extractedEntities.push({
        type: 'DATE',
        rawExpression: dateMatch[0],
        canonicalValue: isoDate,
        confidence: 0.98,
      });
    }

    // 7. Time Normalization & Ambiguity Detection
    // "5 PM", "5:30", "5 ge", "5:30 ge", "sanje 5 gante", "belagge 10 gante"
    const timeWithDaypartRegex = /\b(belagge|morning|sanje|evening|madhyahna|afternoon|rathri|night)\s*(\d{1,2})(?::(\d{2}))?\s*(?:gante|ge|pm|am)?\b/i;
    const timeStandardRegex = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;
    const timeBareSuffixRegex = /\b(\d{1,2})(?::(\d{2}))?\s*(?:ge|ಗಂಟೆಗೆ)\b/i;

    const daypartMatch = textWithoutFillers.match(timeWithDaypartRegex);
    const standardMatch = textWithoutFillers.match(timeStandardRegex);
    const bareMatch = textWithoutFillers.match(timeBareSuffixRegex);

    if (daypartMatch) {
      const daypart = daypartMatch[1].toLowerCase();
      let hour = parseInt(daypartMatch[2], 10);
      const minute = daypartMatch[3] ? parseInt(daypartMatch[3], 10) : 0;

      const isPm = ['sanje', 'evening', 'madhyahna', 'afternoon', 'rathri', 'night'].includes(daypart);
      if (isPm && hour < 12) hour += 12;
      if (!isPm && hour === 12) hour = 0;

      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      extractedEntities.push({
        type: 'TIME',
        rawExpression: daypartMatch[0],
        canonicalValue: timeStr,
        confidence: 0.96,
      });
    } else if (standardMatch) {
      let hour = parseInt(standardMatch[1], 10);
      const minute = standardMatch[2] ? parseInt(standardMatch[2], 10) : 0;
      const meridiem = standardMatch[3].toUpperCase();

      if (meridiem === 'PM' && hour < 12) hour += 12;
      if (meridiem === 'AM' && hour === 12) hour = 0;

      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      extractedEntities.push({
        type: 'TIME',
        rawExpression: standardMatch[0],
        canonicalValue: timeStr,
        confidence: 0.98,
      });
    } else if (bareMatch) {
      // Ambiguous bare time: e.g. "5 ge" without morning/evening or am/pm
      const rawHour = parseInt(bareMatch[1], 10);
      const rawMin = bareMatch[2] || '00';
      ambiguityReasons.push(`Time "${bareMatch[0]}" is ambiguous between morning and evening without AM/PM or daylight context.`);

      extractedEntities.push({
        type: 'TIME',
        rawExpression: bareMatch[0],
        canonicalValue: `${rawHour.toString().padStart(2, '0')}:${rawMin}`,
        confidence: 0.6,
      });
    }

    // 8. Karnataka Locations Normalization
    for (const [key, loc] of Object.entries(KARNATAKA_LOCATIONS)) {
      const locRegex = new RegExp(`\\b${key}\\b`, 'i');
      if (locRegex.test(textWithoutFillers)) {
        extractedEntities.push({
          type: 'LOCATION',
          rawExpression: key,
          canonicalValue: loc.canonical,
          confidence: 0.95,
        });
        break; // Match first dominant location
      }
    }

    return {
      rawText,
      normalizedText: textWithoutFillers,
      detectedLanguage,
      isCorrection,
      correctedFrom,
      isNegation,
      isQuestion,
      isAmbiguous: ambiguityReasons.length > 0,
      ambiguityReasons,
      fillersRemoved,
      extractedEntities,
    };
  }
}
