/**
 * Layer 3.5: Instant Natural Kannada Fillers & Backchannel Engine
 * Dhwani SI / VAANI SI — Sub-100ms Human-Grade Conversational Feedback
 * Eliminates awkward silences and delivers authentic Kannada phone mannerisms.
 */

export interface KannadaFiller {
  id: string;
  category: 'ACKNOWLEDGMENT' | 'PRICE_QUERY' | 'BOOKING_INTENT' | 'LOCATION_QUERY' | 'EMPATHY' | 'GENERAL';
  kannadaText: string;
  kanglishText: string;
  approxDurationMs: number;
}

export const KANNADA_FILLERS: KannadaFiller[] = [
  {
    id: 'f_price_check',
    category: 'PRICE_QUERY',
    kannadaText: 'ಹೌದಾ ಸರ್, ಒಂದು ನಿಮಿಷ...',
    kanglishText: 'Haudaa sir, ondu nimisha...',
    approxDurationMs: 900,
  },
  {
    id: 'f_booking_affirm',
    category: 'BOOKING_INTENT',
    kannadaText: 'ಖಂಡಿತ ಸರ್, ನೋಡಿ...',
    kanglishText: 'Khanditha sir, nodi...',
    approxDurationMs: 850,
  },
  {
    id: 'f_location_info',
    category: 'LOCATION_QUERY',
    kannadaText: 'ಓಹ್ ಸರಿ ಸರ್, ಹೇಳ್ತೀನಿ...',
    kanglishText: 'Oh sari sir, heltini...',
    approxDurationMs: 900,
  },
  {
    id: 'f_empathy_care',
    category: 'EMPATHY',
    kannadaText: 'ಖಂಡಿತ ಅರ್ಥವಾಯ್ತು ಸರ್...',
    kanglishText: 'Khanditha understand aaythu sir...',
    approxDurationMs: 1100,
  },
  {
    id: 'f_general_ack',
    category: 'GENERAL',
    kannadaText: 'ಹೌದು ಸರ್, ಡೀಟೇಲ್ಸ್ ಹೇಳ್ತೀನಿ ಕೇಳಿ...',
    kanglishText: 'Haudu sir, details heltini keli...',
    approxDurationMs: 1200,
  },
];

export class KannadaFillerEngine {
  private static cachedAudio: Map<string, string> = new Map();
  private static isPrecached = false;

  /**
   * Intelligently selects the most natural Kannada conversational filler based on caller's input and active dialect.
   */
  public static selectFiller(callerTranscript: string, dialect?: string): KannadaFiller {
    const text = callerTranscript.toLowerCase();
    let selected: KannadaFiller;

    // 1. Price / Cost / Discount / Budget
    if (
      text.includes('rate') ||
      text.includes('cost') ||
      text.includes('jasti') ||
      text.includes('expensive') ||
      text.includes('kammi') ||
      text.includes('discount') ||
      text.includes('budget') ||
      text.includes('eshtu') ||
      text.includes('kitna')
    ) {
      selected = KANNADA_FILLERS.find(f => f.id === 'f_price_check')!;
    }
    // 2. Booking / Visit / Appointment / Slot
    else if (
      text.includes('book') ||
      text.includes('visit') ||
      text.includes('appointment') ||
      text.includes('sunday') ||
      text.includes('cab') ||
      text.includes('time') ||
      text.includes('naale') ||
      text.includes('slot') ||
      text.includes('milna')
    ) {
      selected = KANNADA_FILLERS.find(f => f.id === 'f_booking_affirm')!;
    }
    // 3. Location / Distance / Route / Landmark
    else if (
      text.includes('doora') ||
      text.includes('elli') ||
      text.includes('where') ||
      text.includes('distance') ||
      text.includes('bypass') ||
      text.includes('station') ||
      text.includes('route') ||
      text.includes('kahan')
    ) {
      selected = KANNADA_FILLERS.find(f => f.id === 'f_location_info')!;
    }
    // 4. Frustration / Doubt / Complaint
    else if (
      text.includes('problem') ||
      text.includes('waste') ||
      text.includes('kopa') ||
      text.includes('worst') ||
      text.includes('doubt') ||
      text.includes('gussa')
    ) {
      selected = KANNADA_FILLERS.find(f => f.id === 'f_empathy_care')!;
    }
    // 5. Default natural backchannel
    else {
      selected = KANNADA_FILLERS.find(f => f.id === 'f_general_ack')!;
    }

    // Dialect adaptation for spoken filler text
    if (dialect === 'KANNADA_NORTH') {
      const northMap: Record<string, string> = {
        f_price_check: 'Haudri, ond nimsha nodri...',
        f_booking_affirm: 'Khanditha ri, nodri...',
        f_location_info: 'Oh sari ri, heltini kelri...',
        f_empathy_care: 'Khanditha understand aaythu ri...',
        f_general_ack: 'Haudri, details heltini kelri...',
      };
      return { ...selected, kanglishText: northMap[selected.id] || selected.kanglishText };
    }

    if (dialect === 'HINDI_HINGLISH') {
      const hindiMap: Record<string, string> = {
        f_price_check: 'Ji bilkul, ek minute bhaiya...',
        f_booking_affirm: 'Haanji, bilkul dekh raha hoon...',
        f_location_info: 'Ji bilkul, batata hoon...',
        f_empathy_care: 'Ji main samajh sakta hoon...',
        f_general_ack: 'Ji bilkul, main batata hoon...',
      };
      return { ...selected, kanglishText: hindiMap[selected.id] || selected.kanglishText };
    }

    if (dialect === 'INDIAN_ENGLISH') {
      const englishMap: Record<string, string> = {
        f_price_check: 'Sure thing, checking that right away...',
        f_booking_affirm: 'Certainly, let me check the schedule...',
        f_location_info: 'Sure, let me share the directions...',
        f_empathy_care: 'I completely understand your point...',
        f_general_ack: 'Sure thing, let me help you with that...',
      };
      return { ...selected, kanglishText: englishMap[selected.id] || selected.kanglishText };
    }

    if (dialect === 'KANGLISH_BUSINESS') {
      const kanglishMap: Record<string, string> = {
        f_price_check: 'Sure guru, one second...',
        f_booking_affirm: 'Definitely boss, check madona...',
        f_location_info: 'Oh sari boss, share madtini...',
        f_empathy_care: 'Definitely understand aaythu guru...',
        f_general_ack: 'Haudu guru, details share madtini...',
      };
      return { ...selected, kanglishText: kanglishMap[selected.id] || selected.kanglishText };
    }

    return selected;
  }

  /**
   * Pre-caches Sarvam neural audio for all core fillers at server startup.
   */
  public static async precacheFillers(sarvamApiKey?: string): Promise<void> {
    if (this.isPrecached) return;
    const apiKey = sarvamApiKey || process.env.SARVAM_API_KEY;
    if (!apiKey) {
      console.warn('[Filler Precache] SARVAM_API_KEY not configured. Fillers will run in text-only mode.');
      this.isPrecached = true;
      return;
    }

    for (const filler of KANNADA_FILLERS) {
      try {
        const res = await fetch('https://api.sarvam.ai/text-to-speech', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-subscription-key': apiKey,
          },
          body: JSON.stringify({
            inputs: [filler.kannadaText],
            target_language_code: 'kn-IN',
            speaker: 'shreya',
            pace: 1.05, // Slightly brisk for human naturalness
            pitch: 0.05,
            model: process.env.SARVAM_TTS_MODEL?.trim() || 'bulbul:v4-flash',
          }),
        });

        if (res.ok) {
          const data = await res.json() as any;
          const b64 = data.audios?.[0] || data.audioBase64;
          if (b64) {
            this.cachedAudio.set(filler.id, b64);
          }
        }
      } catch (err) {
        console.warn(`[Filler Precache] Warning for ${filler.id}:`, err);
      }
    }

    this.isPrecached = true;
    console.log(`[VAANI SI] Pre-cached ${this.cachedAudio.size} Natural Kannada Audio Fillers`);
  }

  /**
   * Retrieves base64 audio for a filler if pre-cached (sub-1ms execution).
   */
  public static getCachedAudio(fillerId: string): string | undefined {
    return this.cachedAudio.get(fillerId);
  }
}
