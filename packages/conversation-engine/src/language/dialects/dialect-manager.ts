/**
 * @vanni/conversation-engine — Karnataka Regional Dialect Architecture
 *
 * Provides regional linguistic profiles across Karnataka:
 * - KARNATAKA_GENERAL (Default modern statewide standard)
 * - BENGALURU (Urban Kanglish, tech/business code-mixing)
 * - MYSURU (Polite, classical Kannada, respectful grammatical suffixes)
 * - NORTH_KARNATAKA (Hubballi-Dharwad, Ballari, Belagavi: "helri", "aitri", "nodri")
 * - COASTAL_KARNATAKA (Mangaluru / Udupi Tulu-influenced Kannada cadences)
 * - HYDERABAD_KARNATAKA (Kalyana Karnataka regional vocabulary)
 */

import { DialectProfile } from '@vanni/shared';

export interface DialectDefinition {
  profile: DialectProfile;
  name: string;
  regions: string[];
  characteristicHonorifics: string[];
  commonPhrases: Record<string, string>;
  description: string;
}

export const REGIONAL_DIALECT_PROFILES: Record<DialectProfile, DialectDefinition> = {
  KARNATAKA_GENERAL: {
    profile: 'KARNATAKA_GENERAL',
    name: 'Statewide Communicative Standard',
    regions: ['All Karnataka Districts'],
    characteristicHonorifics: ['Avaru', 'Nimma', 'Sir'],
    commonPhrases: {
      greeting: 'Namaskara! Hege sahayaka madabahudu?',
      confirmation: 'Sari, confirm madona.',
      inquiry: 'Enu inquiry ide?',
    },
    description: 'Standard modern communicative Kannada and Kanglish widely understood across Karnataka.',
  },

  BENGALURU: {
    profile: 'BENGALURU',
    name: 'Bengaluru Urban Kanglish',
    regions: ['Bengaluru Urban', 'Bengaluru Rural'],
    characteristicHonorifics: ['Sir', 'Madam', 'Avaru'],
    commonPhrases: {
      greeting: 'Hello! Namaskara. How can I help you today?',
      confirmation: 'Sure, confirm madtini.',
      inquiry: 'Details heli.',
    },
    description: 'High code-switching between English technical/business loanwords and conversational Kannada.',
  },

  MYSURU: {
    profile: 'MYSURU',
    name: 'Mysuru Classical Polite',
    regions: ['Mysuru', 'Mandya', 'Chamarajanagar'],
    characteristicHonorifics: ['Avaru', 'Thamma', 'Nimma Dayavittu'],
    commonPhrases: {
      greeting: 'Namaskaragalu! Namma samsthege swagatha.',
      confirmation: 'Kanditha, dayavittu kshana thadeyiri.',
      inquiry: 'Tamma apeksha enu?',
    },
    description: 'Courteous, classical Kannada with rich honorifics and clear phonetic articulation.',
  },

  NORTH_KARNATAKA: {
    profile: 'NORTH_KARNATAKA',
    name: 'Uttara Karnataka Spoken Vernacular',
    regions: ['Hubballi-Dharwad', 'Ballari', 'Belagavi', 'Bagalkote', 'Vijayapura'],
    characteristicHonorifics: ['Ri', 'Appa', 'Saar'],
    commonPhrases: {
      greeting: 'Namaskara ri! Enu sahaya bekaithu helri?',
      confirmation: 'Aitri, eega madona ri.',
      inquiry: 'En sangathi ri?',
    },
    description: 'Fast-paced, vibrant Northern colloquial speech featuring distinct verbal suffixes like -ri and -aitri.',
  },

  COASTAL_KARNATAKA: {
    profile: 'COASTAL_KARNATAKA',
    name: 'Karavali Coastal Vernacular',
    regions: ['Dakshina Kannada', 'Udupi', 'Uttara Kannada'],
    characteristicHonorifics: ['Avare', 'Bhatre', 'Sir'],
    commonPhrases: {
      greeting: 'Namaskara! En vishaya helle?',
      confirmation: 'Aavodu, confirm maduva.',
      inquiry: 'En bekitthu?',
    },
    description: 'Melodic coastal Kannada cadence influenced by Karavali linguistic heritage.',
  },

  HYDERABAD_KARNATAKA: {
    profile: 'HYDERABAD_KARNATAKA',
    name: 'Kalyana Karnataka Regional Vernacular',
    regions: ['Kalaburagi', 'Bidar', 'Raichur', 'Koppal', 'Yadgir'],
    characteristicHonorifics: ['Sahib', 'Gowdre', 'Ri'],
    commonPhrases: {
      greeting: 'Namaskara ri! Heli en kam aagbeku?',
      confirmation: 'Haudri, eegle madona.',
      inquiry: 'En vishaya aithu?',
    },
    description: 'Distinct northeastern Karnataka dialect with rich regional idioms.',
  },
};

export class DialectManager {
  /**
   * Retrieves all regional dialect profiles
   */
  getAllProfiles(): DialectDefinition[] {
    return Object.values(REGIONAL_DIALECT_PROFILES);
  }

  /**
   * Resolves dialect profile configuration
   */
  getDialectProfile(profile: DialectProfile = 'KARNATAKA_GENERAL'): DialectDefinition {
    return REGIONAL_DIALECT_PROFILES[profile] || REGIONAL_DIALECT_PROFILES.KARNATAKA_GENERAL;
  }

  /**
   * Alias for getDialectProfile
   */
  getProfile(profile: DialectProfile = 'KARNATAKA_GENERAL'): DialectDefinition {
    return this.getDialectProfile(profile);
  }

  /**
   * Adapts greeting based on selected regional dialect
   */
  getDialectGreeting(profile: DialectProfile = 'KARNATAKA_GENERAL', businessName = 'Our Clinic'): string {
    const dialect = this.getDialectProfile(profile);
    switch (profile) {
      case 'NORTH_KARNATAKA':
        return `Namaskara ri! ${businessName} ge swagatha ri. En sahaya bekaithu helri?`;
      case 'MYSURU':
        return `Namaskaragalu. ${businessName} ge thavugaLigey swagatha. Naanu hege sahayaka maadabahudhu?`;
      case 'BENGALURU':
      case 'KARNATAKA_GENERAL':
      default:
        return `Namaskara! Welcome to ${businessName}. How can I assist you today?`;
    }
  }
}
