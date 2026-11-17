/**
 * @vanni/core — Vernacular Dialect Classifier & Semantic Turn Endpointing Engine
 * 
 * Inspired by LiveKit Agents & Bolna AI architectures:
 * 1. Automatic Real-Time Dialect Classification for Karnataka & Pan-India callers
 * 2. Semantic Turn Endpointing (distinguishes mid-sentence pauses from completed turns)
 */

import { RegionalDialect } from '../domain/types';

export interface DialectClassificationResult {
  dialect: RegionalDialect;
  confidence: number;
  detectedMarkers: string[];
}

export interface SemanticTurnDetectionResult {
  isComplete: boolean;
  recommendedSilenceMs: number;
  hasIncompleteConnector: boolean;
  reason: string;
}

export class VernacularDialectClassifier {
  // --- North Karnataka (Uttara Karnataka / Hubli / Dharwad / Belagavi / Ballari) Markers ---
  private static readonly NORTH_KANNADA_MARKERS = [
    /\bri\b/i,
    /\bhaudri\b/i,
    /\bhelri\b/i,
    /\bnodri\b/i,
    /\bbhesh\b/i,
    /\baithi\b/i,
    /\baithri\b/i,
    /\bundya\b/i,
    /\bundri\b/i,
    /\byakri\b/i,
    /\byakaang\b/i,
    /\baake\b/i,
    /\beeike\b/i,
    /\bbarle\b/i,
    /\bhogle\b/i,
    /\bkelri\b/i,
    /\bmadri\b/i,
    /\banthri\b/i,
    /\bchhan\b/i,
    /\bkalisri\b/i,
    /\bbidthri\b/i,
  ];

  // --- Old Mysuru & South Karnataka (Mysore / Mandya / Hassan) Markers ---
  private static readonly MYSURU_KANNADA_MARKERS = [
    /\bswamy\b/i,
    /\bbanni swamy\b/i,
    /\bchennagiddira\b/i,
    /\bchennagidira\b/i,
    /\bkhanditha swamy\b/i,
    /\bthumpa\b/i,
    /\bbanni sir\b/i,
  ];

  // --- Bengaluru Urban Kanglish Markers ---
  private static readonly BENGALURU_KANGLISH_MARKERS = [
    /\bguru\b/i,
    /\bboss\b/i,
    /\bbro\b/i,
    /\bsort mad\b/i,
    /\bscenes\b/i,
    /\bchill\b/i,
    /\bquick call\b/i,
    /\bshare madi\b/i,
    /\bwhatsapp alli\b/i,
    /\bavailable ideya\b/i,
    /\blocation kalisi\b/i,
    /\bconfirm madi\b/i,
  ];

  // --- Coastal Karnataka (Karavali / Mangalore / Udupi) Markers ---
  private static readonly COASTAL_KANNADA_MARKERS = [
    /\bkori\b/i,
    /\bnendra\b/i,
    /\byethara\b/i,
    /\bpanche\b/i,
    /\bmangalore\b/i,
    /\budupi\b/i,
    /\bmalpe\b/i,
  ];

  // --- Hindi & Hinglish Markers ---
  private static readonly HINDI_HINGLISH_MARKERS = [
    /\bbhaiya\b/i,
    /\bhaanji\b/i,
    /\bkya rate\b/i,
    /\bkitna hai\b/i,
    /\bbataiye\b/i,
    /\bdekhna hai\b/i,
    /\bkab aana\b/i,
    /\btheek hai\b/i,
    /\bachha\b/i,
    /\bnamaste ji\b/i,
    /\bshukriya\b/i,
    /\bbataye\b/i,
    /\bplot chahiye\b/i,
    /\bdoctor kab\b/i,
  ];

  // --- Telugu & Tenglish Markers ---
  private static readonly TELUGU_MARKERS = [
    /\bandi\b/i,
    /\bnamaskaram andi\b/i,
    /\bentha\b/i,
    /\bcheppandi\b/i,
    /\beppudu\b/i,
    /\bkavali\b/i,
    /\bunnaya\b/i,
    /\bplotlu\b/i,
  ];

  // --- Incomplete Sentence Connectors (Extends turn endpointing timeout) ---
  private static readonly INCOMPLETE_CONNECTORS = [
    // Kannada
    /\bmatte\s*$/i,
    /\bnodri\s*$/i,
    /\byandre\s*$/i,
    /\baadre\s*$/i,
    /\baadare\s*$/i,
    /\bhaagagi\s*$/i,
    /\byakandre\s*$/i,
    /\banthu\s*$/i,
    /\bond nimsha\s*$/i,
    /\bmatte innondhu\s*$/i,
    // Hindi
    /\baur\s*$/i,
    /\blekin\s*$/i,
    /\btoh\s*$/i,
    /\bmatlab\s*$/i,
    /\bkyunki\s*$/i,
    // English
    /\band\s*$/i,
    /\bbut\s*$/i,
    /\bso\s*$/i,
    /\bbecause\s*$/i,
    /\balso\s*$/i,
    /\blike\s*$/i,
    /\buhm\s*$/i,
    /\bwait\s*$/i,
  ];

  // --- Sentence Completion Indicators (Triggers instant snappy turn handover) ---
  private static readonly COMPLETION_INDICATORS = [
    /\?$/,
    /\bestu\??$/i,
    /\bideya\??$/i,
    /\baagutha\??$/i,
    /\bhelri\??$/i,
    /\bmadtira\??$/i,
    /\bkya hai\??$/i,
    /\bkitna hai\??$/i,
    /\bplease$/i,
    /\bthanks$/i,
    /\bdhanyavadagalu$/i,
    /\bshukriya$/i,
  ];

  /**
   * Classify user dialect from conversational transcript
   */
  public static classifyDialect(
    text: string,
    currentDialect: RegionalDialect = 'KANNADA_STANDARD_POLITE'
  ): DialectClassificationResult {
    const trimmed = text.trim();
    if (!trimmed) {
      return { dialect: currentDialect, confidence: 1.0, detectedMarkers: [] };
    }

    const hits: Record<RegionalDialect, { count: number; markers: string[] }> = {
      KANNADA_NORTH: { count: 0, markers: [] },
      KANNADA_MYSURU: { count: 0, markers: [] },
      KANGLISH_BUSINESS: { count: 0, markers: [] },
      KANNADA_COASTAL: { count: 0, markers: [] },
      HINDI_HINGLISH: { count: 0, markers: [] },
      TELUGU_STANDARD: { count: 0, markers: [] },
      INDIAN_ENGLISH: { count: 0, markers: [] },
      KANNADA_STANDARD_POLITE: { count: 0, markers: [] },
    };

    for (const regex of this.NORTH_KANNADA_MARKERS) {
      if (regex.test(trimmed)) {
        hits.KANNADA_NORTH.count++;
        hits.KANNADA_NORTH.markers.push(regex.source.replace(/\\b/g, ''));
      }
    }
    for (const regex of this.HINDI_HINGLISH_MARKERS) {
      if (regex.test(trimmed)) {
        hits.HINDI_HINGLISH.count++;
        hits.HINDI_HINGLISH.markers.push(regex.source.replace(/\\b/g, ''));
      }
    }
    for (const regex of this.TELUGU_MARKERS) {
      if (regex.test(trimmed)) {
        hits.TELUGU_STANDARD.count++;
        hits.TELUGU_STANDARD.markers.push(regex.source.replace(/\\b/g, ''));
      }
    }
    for (const regex of this.MYSURU_KANNADA_MARKERS) {
      if (regex.test(trimmed)) {
        hits.KANNADA_MYSURU.count++;
        hits.KANNADA_MYSURU.markers.push(regex.source.replace(/\\b/g, ''));
      }
    }
    for (const regex of this.COASTAL_KANNADA_MARKERS) {
      if (regex.test(trimmed)) {
        hits.KANNADA_COASTAL.count++;
        hits.KANNADA_COASTAL.markers.push(regex.source.replace(/\\b/g, ''));
      }
    }
    for (const regex of this.BENGALURU_KANGLISH_MARKERS) {
      if (regex.test(trimmed)) {
        hits.KANGLISH_BUSINESS.count++;
        hits.KANGLISH_BUSINESS.markers.push(regex.source.replace(/\\b/g, ''));
      }
    }

    // Find highest scored dialect
    let maxDialect: RegionalDialect = currentDialect;
    let maxCount = 0;
    let detectedMarkers: string[] = [];

    for (const [dialect, info] of Object.entries(hits) as [RegionalDialect, { count: number; markers: string[] }][]) {
      if (info.count > maxCount) {
        maxCount = info.count;
        maxDialect = dialect;
        detectedMarkers = info.markers;
      }
    }

    if (maxCount >= 1) {
      return { dialect: maxDialect, confidence: Math.min(0.95, 0.6 + maxCount * 0.15), detectedMarkers };
    }

    // Check if predominantly English
    const englishWordCount = (trimmed.match(/[a-zA-Z]+/g) || []).length;
    const totalWords = trimmed.split(/\s+/).length;
    if (englishWordCount / Math.max(1, totalWords) > 0.8 && totalWords >= 4) {
      return { dialect: 'INDIAN_ENGLISH', confidence: 0.85, detectedMarkers: ['predominantly_english'] };
    }

    // Default to current dialect
    return { dialect: currentDialect, confidence: 0.5, detectedMarkers: [] };
  }

  /**
   * Semantic Turn Endpointing (LiveKit & Pipecat Pattern)
   * Prevents premature turn cut-offs when caller pauses mid-sentence on connectors
   */
  public static evaluateTurnCompletion(transcript: string): SemanticTurnDetectionResult {
    const trimmed = transcript.trim();
    if (!trimmed) {
      return { isComplete: false, recommendedSilenceMs: 800, hasIncompleteConnector: false, reason: 'Empty speech' };
    }

    // 1. Check for trailing incomplete discourse connectors
    for (const regex of this.INCOMPLETE_CONNECTORS) {
      if (regex.test(trimmed)) {
        return {
          isComplete: false,
          recommendedSilenceMs: 850, // Give caller 850ms to continue sentence
          hasIncompleteConnector: true,
          reason: `Trailing incomplete connector: ${regex.source}`,
        };
      }
    }

    // 2. Check for explicit completion indicators
    for (const regex of this.COMPLETION_INDICATORS) {
      if (regex.test(trimmed)) {
        return {
          isComplete: true,
          recommendedSilenceMs: 250, // Snappy 250ms handover
          hasIncompleteConnector: false,
          reason: `Sentence completion indicator: ${regex.source}`,
        };
      }
    }

    // 3. Short single-word hesitation ("hmm", "ah", "ha")
    if (trimmed.length <= 4 && /^(hmm|ha|aa|uh|oh|ok|hmm\.*)$/i.test(trimmed)) {
      return {
        isComplete: false,
        recommendedSilenceMs: 700,
        hasIncompleteConnector: true,
        reason: 'Hesitation or backchannel',
      };
    }

    // Default normal completion
    return {
      isComplete: true,
      recommendedSilenceMs: 300,
      hasIncompleteConnector: false,
      reason: 'Normal turn completion',
    };
  }
}
