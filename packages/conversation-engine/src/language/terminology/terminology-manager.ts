/**
 * @vanni/conversation-engine — Kannada & Business Terminology Manager
 *
 * Maps informal customer expressions (in English, Kannada script, or Kanglish)
 * to verified canonical Business Brain entities (Services, Staff, Procedures, Properties).
 * Generates phonetic and pronunciation metadata for speech/TTS adapters.
 */

import {
  ExtractedEntityDTO,
  PronunciationMetadataDTO,
} from '@vanni/shared';

export interface TerminologyAliasRule {
  canonicalTerm: string;
  entityType: 'SERVICE' | 'DOCTOR' | 'LOCATION' | 'APPOINTMENT' | 'POLICY' | 'PROPERTY' | 'ROOM';
  entityId?: string;
  aliases: string[];
  pronunciation?: PronunciationMetadataDTO;
}

// Built-in Industry Terminology & Multi-Language Spoken Aliases
const DEFAULT_TERMINOLOGY: TerminologyAliasRule[] = [
  // 1. Dental Care
  {
    canonicalTerm: 'Root Canal Treatment',
    entityType: 'SERVICE',
    entityId: 'srv_root_canal',
    aliases: [
      'root canal', 'rct', 'root canal ge', 'root canal treatment',
      'ರೂಟ್ ಕೆನಾಲ್', 'ಹಲ್ಲಿನ ಚಿಕಿತ್ಸೆ', 'root canal charge', 'root canal cost'
    ],
    pronunciation: {
      displayText: 'Root Canal Treatment',
      spokenTextKannada: 'ರೂಟ್ ಕೆನಾಲ್ ಟ್ರೀಟ್‌ಮೆಂಟ್',
      spokenTextEnglish: 'Root Canal Treatment',
      phoneticHint: 'Root Kuh-nahl',
    },
  },
  {
    canonicalTerm: 'Dental Cleaning & Scaling',
    entityType: 'SERVICE',
    entityId: 'srv_dental_cleaning',
    aliases: [
      'cleaning', 'teeth cleaning', 'scaling', 'dental cleaning',
      'ಹಲ್ಲು ಕ್ಲೀನಿಂಗ್', 'ಹಲ್ಲಿನ ಸ್ವಚ್ಛತೆ', 'scaling ge'
    ],
    pronunciation: {
      displayText: 'Dental Cleaning',
      spokenTextKannada: 'ಡೆಂಟಲ್ ಕ್ಲೀನಿಂಗ್',
      spokenTextEnglish: 'Dental Cleaning',
    },
  },
  {
    canonicalTerm: 'Dental Implants',
    entityType: 'SERVICE',
    entityId: 'srv_implants',
    aliases: [
      'implants', 'dental implant', 'artificial tooth',
      'ಡೆಂಟಲ್ ಇಂಪ್ಲಾಂಟ್', 'ಹೊಸ ಹಲ್ಲು'
    ],
  },

  // 2. Healthcare & Hospitals
  {
    canonicalTerm: 'OPD Doctor Consultation',
    entityType: 'SERVICE',
    entityId: 'srv_opd_consult',
    aliases: [
      'consultation', 'doctor consultation', 'opd', 'checkup',
      'ಡಾಕ್ಟರ್ ಕನ್ಸಲ್ಟೇಶನ್', 'ಡಾಕ್ಟರ್ ಭೇಟಿ', 'doctor appointment', 'doctor meet'
    ],
    pronunciation: {
      displayText: 'Doctor Consultation',
      spokenTextKannada: 'ಡಾಕ್ಟರ್ ಕನ್ಸಲ್ಟೇಶನ್',
      spokenTextEnglish: 'Doctor Consultation',
    },
  },
  {
    canonicalTerm: 'Physiotherapy Session',
    entityType: 'SERVICE',
    entityId: 'srv_physio',
    aliases: [
      'physiotherapy', 'physio', 'rehabilitation',
      'ಫಿಸಿಯೋಥೆರಪಿ', 'ವ್ಯಾಯಾಮ ಚಿಕಿತ್ಸೆ'
    ],
  },
  {
    canonicalTerm: 'Emergency Casualty',
    entityType: 'LOCATION',
    entityId: 'loc_casualty',
    aliases: [
      'casualty', 'emergency', 'trauma center', 'icu',
      'ತುರ್ತು ಚಿಕಿತ್ಸಾ ಘಟಕ', 'ಕ್ಯಾಶುವಲ್ಟಿ'
    ],
  },

  // 3. Real Estate
  {
    canonicalTerm: 'Site Visit & Cab Pickup',
    entityType: 'SERVICE',
    entityId: 'srv_site_visit',
    aliases: [
      'site visit', 'layout visit', 'cab pickup', 'free cab',
      'ಸೈಟ್ ವಿಸಿಟ್', 'ನಿವೇಶನ ಭೇಟಿ', 'ಪ್ಲಾಟ್ ನೋಡೋಕೆ', 'site nodona'
    ],
    pronunciation: {
      displayText: 'Site Visit',
      spokenTextKannada: 'ಸೈಟ್ ವಿಸಿಟ್',
      spokenTextEnglish: 'Site Visit',
    },
  },
  {
    canonicalTerm: '3BHK Luxury Residence',
    entityType: 'PROPERTY',
    entityId: 'prop_3bhk',
    aliases: [
      '3bhk', '3 bhk', '3 bedroom', '3 bed room', 'three bhk',
      '3 ಬೆಡ್‌ರೂಮ್', '3 ಬಿಎಚ್‌ಕೆ'
    ],
  },
  {
    canonicalTerm: 'Residential Plot / Site',
    entityType: 'PROPERTY',
    entityId: 'prop_plot',
    aliases: [
      'plot', 'site', 'dc converted plot', 'residential site',
      'ನಿವೇಶನ', 'ಸೈಟ್', 'ಪ್ಲಾಟ್'
    ],
  },

  // 4. Hospitality
  {
    canonicalTerm: 'Room Reservation',
    entityType: 'ROOM',
    entityId: 'srv_room_booking',
    aliases: [
      'room booking', 'room reservation', 'hotel room', 'suite',
      'ರೂಮ್ ಬುಕಿಂಗ್', 'ಕೋಣೆ'
    ],
  },
  {
    canonicalTerm: 'Early Check-in',
    entityType: 'POLICY',
    entityId: 'pol_early_checkin',
    aliases: [
      'early check in', 'early check-in', 'early checkin',
      'ಬೇಗ ಚೆಕ್ ಇನ್'
    ],
  },
];

export class TerminologyManager {
  private rules: TerminologyAliasRule[] = [...DEFAULT_TERMINOLOGY];

  /**
   * Registers custom tenant-specific terminology rules (e.g. from Business Brain or DB)
   */
  registerCustomRule(rule: TerminologyAliasRule): void {
    this.rules.unshift(rule);
  }

  /**
   * Maps an informal expression in an utterance to canonical business entities
   */
  resolveEntities(text: string): ExtractedEntityDTO[] {
    const matchedEntities: ExtractedEntityDTO[] = [];
    const textLower = text.toLowerCase();

    for (const rule of this.rules) {
      for (const alias of rule.aliases) {
        const aliasLower = alias.toLowerCase();
        // Check word boundary or substring match
        const regex = new RegExp(`\\b${aliasLower}\\b`, 'i');
        if (regex.test(textLower) || textLower.includes(aliasLower)) {
          matchedEntities.push({
            type: rule.entityType,
            rawExpression: alias,
            canonicalValue: rule.canonicalTerm,
            confidence: 0.95,
            resolvedEntityId: rule.entityId,
            pronunciationHint: rule.pronunciation?.spokenTextKannada || rule.pronunciation?.phoneticHint,
          });
          break; // Avoid duplicate match for the same rule
        }
      }
    }

    return matchedEntities;
  }

  /**
   * Retrieves pronunciation metadata for TTS speech synthesis
   */
  getPronunciationMetadata(canonicalTerm: string): PronunciationMetadataDTO | undefined {
    const matched = this.rules.find(
      r => r.canonicalTerm.toLowerCase() === canonicalTerm.toLowerCase()
    );
    return matched?.pronunciation;
  }
}
