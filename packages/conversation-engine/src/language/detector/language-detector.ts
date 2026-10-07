/**
 * @vanni/conversation-engine — Kannada, Kanglish & Multilingual Language Detector
 *
 * Implements fine-grained language and script detection:
 * 1. Native Kannada script detection (Unicode U+0C80 to U+0CFF)
 * 2. Romanized Kannada lexicon detection (Latin characters representing Kannada words)
 * 3. English vocabulary recognition
 * 4. Kanglish / Mixed language code-switch ratio computation
 * 5. Script classification (KANNADA, LATIN, MIXED)
 *
 * Does NOT rely solely on Unicode script, allowing robust understanding of Romanized speech/text.
 */

import {
  LanguageMode,
  LanguageDetectionResult,
} from '@vanni/shared';

// Common Romanized Kannada core lexicon (verbs, pronouns, question words, markers)
const ROMANIZED_KANNADA_WORDS = new Set([
  // Question words
  'yelli', 'elli', 'ellide', 'yavaga', 'yavag', 'hege', 'yaake', 'enu', 'eshtu', 'yaru', 'yavudhu', 'yav', 'yava',
  // Time & relative markers
  'naale', 'nale', 'ivathu', 'eevatthu', 'ninne', 'nalidhu', 'naaliddhu', 'ega', 'aamele', 'sanje', 'belagge', 'madhyahna', 'rathri',
  // Verbs & auxiliaries
  'beku', 'beda', 'ideya', 'ide', 'iddara', 'irtare', 'irtheera', 'irtivi', 'helri', 'heli', 'madri', 'madi',
  'madbahuda', 'madona', 'nodri', 'nodi', 'banni', 'hogri', 'hogi', 'agutte', 'aaguththe', 'agalla', 'aagalla',
  'barutte', 'sigutta', 'siguththe', 'sikthira', 'gothilla', 'gotthilla', 'gottu', 'bidthini', 'madtini', 'irutha',
  'madthira', 'madtira', 'ansthide', 'barbeku', 'madbeku', 'madbeka', 'thagolli', 'thadiyiri', 'respond', 'aagideya', 'agideya', 'aagide',
  // Pronouns & honorifics
  'nange', 'namge', 'nanage', 'nanu', 'neevu', 'nimma', 'nimmadu', 'avaru', 'avru', 'avara', 'ivaru', 'ivru', 'idu', 'adu', 'nanna', 'hesaru', 'mane', 'jothe', 'avare',
  // Markers & fillers
  'illi', 'alli', 'ge', 'inda', 'annu', 'adhe', 'haudu', 'howdu', 'alla', 'illa', 'dhanyavada', 'namaskara', 'namaskaragalu',
  'swalpa', 'tumba', 'sari', 'nodona', 'gotta', 'kanri', 're', 'ri', 'alva', 'saar', 'sahebru', 'pa', 'athava', 'door', 'jaasti', 'kodi', 'bere', 'ondu', 'ondhu', 'aadare', 'ivathina'
]);

// Common English loan nouns that natural Kannada speakers use as ordinary nouns in Kannada sentences
const ENGLISH_LOAN_NOUNS = new Set([
  'doctor', 'dr', 'clinic', 'hospital', 'appointment', 'time', 'timing',
  'address', 'location', 'phone', 'number', 'bill', 'discount', 'rate', 'price',
  'room', 'rooms', 'flat', 'flats', 'plot', 'plots', 'bhk', 'opd', 'icu',
  'casualty', 'service', 'details', 'name', 'sir', 'madam', 'saar'
]);

// Common English conversational words, loanwords and domain nouns
const COMMON_ENGLISH_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'what', 'when', 'where', 'how', 'who', 'why',
  'available', 'appointment', 'doctor', 'clinic', 'hospital', 'service', 'price', 'cost',
  'time', 'timing', 'open', 'close', 'morning', 'evening', 'tomorrow', 'today', 'confirm',
  'book', 'booking', 'cancel', 'reschedule', 'consultation', 'details', 'location', 'address',
  'can', 'could', 'please', 'would', 'hello', 'hi', 'thank', 'thanks', 'want', 'need', 'i', 'you',
  'charge', 'charges', 'root', 'canal', 'treatment', 'advance', 'pay', 'extra', 'check', 'in',
  'manager', 'receptionist', 'late', 'waiting', 'room', 'rooms', 'happy', 'staff', 'behavior',
  'care', 'connect', 'someone', 'direct', 'directly', 'human', 'agent', 'nobody', 'attended',
  'yesterday', 'free', 'brochure', 'whatsapp', 'call', 'sure', 'site', 'visit', 'people', 'sorry',
  'person', 'postpone', 'shift', 'change', 'night', 'emergency', 'lunch', 'break', 'layout',
  'bypass', 'road', 'google', 'map', 'link', 'per', 'square', 'feet', 'total', 'discount', 'rent',
  'day', 'fee', 'fees', 'branch', 'located', 'bus', 'stand', 'share', 'sir', 'madam', 'ok', 'okay',
  'yes', 'no', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
  'pm', 'am', 'rs', 'rupees', 'plot', 'plots', 'bhk', 'flat', 'flats', 'opd', 'dental', 'cleaning',
  'near', 'good', 'have', 'there', 'are', 'not', 'provided', 'with', 'for', 'all', 'me'
]);

export class LanguageDetector {
  /**
   * Detects script, primary/secondary language modes, and code-switching ratios
   */
  detectLanguage(text: string): LanguageDetectionResult {
    if (!text || text.trim().length === 0) {
      return {
        primaryLanguage: 'UNKNOWN',
        confidence: 0,
        script: 'LATIN',
        isRomanizedKannada: false,
        codeSwitchRatio: 0,
      };
    }

    const cleanText = text.trim();

    // 1. Unicode Script Analysis
    const kannadaCharCount = (cleanText.match(/[\u0C80-\u0CFF]/g) || []).length;
    const latinCharCount = (cleanText.match(/[a-zA-Z]/g) || []).length;
    const totalScriptChars = kannadaCharCount + latinCharCount;

    let script: 'KANNADA' | 'LATIN' | 'MIXED' = 'LATIN';
    if (kannadaCharCount > 0 && latinCharCount > 0) {
      script = 'MIXED';
    } else if (kannadaCharCount > 0) {
      script = 'KANNADA';
    }

    // 2. Token Lexicon Analysis
    // Tokenize words, stripping punctuation
    const words = cleanText
      .toLowerCase()
      .replace(/[.,?!:;'"()\[\]{}\/\\-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0);

    let kannadaWordCount = 0;
    let romanizedKannadaCount = 0;
    let englishConversationalCount = 0;
    let englishLoanNounCount = 0;
    const tokenDetails: Array<{ word: string; script: string; language: string }> = [];

    for (const word of words) {
      const isKnScript = /[\u0C80-\u0CFF]/.test(word);
      const isRomanized = ROMANIZED_KANNADA_WORDS.has(word);
      const isLoanNoun = ENGLISH_LOAN_NOUNS.has(word);
      const isEnglishConv = COMMON_ENGLISH_WORDS.has(word) && !isLoanNoun;

      let lang = 'UNKNOWN';
      let scr = 'LATIN';

      if (isKnScript) {
        kannadaWordCount++;
        lang = 'KANNADA';
        scr = 'KANNADA';
      } else if (isRomanized) {
        romanizedKannadaCount++;
        lang = 'ROMANIZED_KANNADA';
        scr = 'LATIN';
      } else if (isEnglishConv) {
        englishConversationalCount++;
        lang = 'ENGLISH';
        scr = 'LATIN';
      } else if (isLoanNoun) {
        englishLoanNounCount++;
        lang = 'ENGLISH_LOAN';
        scr = 'LATIN';
      }

      tokenDetails.push({ word, script: scr, language: lang });
    }

    const totalWords = words.length || 1;
    const totalEnglish = englishConversationalCount + englishLoanNounCount;
    const totalKannadaTokens = kannadaWordCount + romanizedKannadaCount;
    const codeSwitchRatio = totalKannadaTokens > 0 && totalEnglish > 0
      ? Math.min(totalKannadaTokens, totalEnglish) / totalWords
      : 0;

    // 3. Classification Logic
    // Pure or dominant Kannada script
    if (kannadaCharCount > 0 && (kannadaCharCount / (totalScriptChars || 1)) >= 0.7) {
      return {
        primaryLanguage: 'KANNADA',
        secondaryLanguage: totalEnglish > 0 ? 'ENGLISH' : undefined,
        confidence: 0.98,
        script: 'KANNADA',
        isRomanizedKannada: false,
        codeSwitchRatio,
        tokens: tokenDetails,
      };
    }

    // Mixed Kannada script + English words
    if (kannadaCharCount > 0 && latinCharCount > 0) {
      return {
        primaryLanguage: 'KANNADA_ENGLISH',
        secondaryLanguage: 'KANNADA',
        confidence: 0.94,
        script: 'MIXED',
        isRomanizedKannada: false,
        codeSwitchRatio,
        tokens: tokenDetails,
      };
    }

    // Latin Script: Distinguish Pure English vs Romanized Kannada vs Kanglish
    if (romanizedKannadaCount > 0) {
      // If there are English conversational words (e.g. "Tomorrow doctor available iddara?", "Root canal ge eshtu charge?")
      if (englishConversationalCount > 0) {
        return {
          primaryLanguage: 'KANGLISH',
          secondaryLanguage: 'ENGLISH',
          confidence: 0.92,
          script: 'LATIN',
          isRomanizedKannada: true,
          codeSwitchRatio,
          tokens: tokenDetails,
        };
      }

      // If it only contains Romanized Kannada + English loan nouns (e.g. "Naale doctor appointment ideya?", "Clinic ellide?")
      return {
        primaryLanguage: 'KANNADA',
        secondaryLanguage: 'KANGLISH',
        confidence: 0.95,
        script: 'LATIN',
        isRomanizedKannada: true,
        codeSwitchRatio: englishLoanNounCount > 0 ? codeSwitchRatio : 0,
        tokens: tokenDetails,
      };
    }

    if (totalEnglish > 0 && romanizedKannadaCount === 0) {
      return {
        primaryLanguage: 'ENGLISH',
        confidence: 0.96,
        script: 'LATIN',
        isRomanizedKannada: false,
        codeSwitchRatio: 0,
        tokens: tokenDetails,
      };
    }

    // Fallback: If only Latin text with unknown proper nouns or numbers
    return {
      primaryLanguage: 'ENGLISH',
      confidence: 0.7,
      script: 'LATIN',
      isRomanizedKannada: false,
      codeSwitchRatio: 0,
      tokens: tokenDetails,
    };
  }
}
