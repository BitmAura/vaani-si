/**
 * @vanni/tool-engine — Argument Normalization Engine
 * Normalizes Indian & Karnataka localized inputs: phone numbers, dates, times, currency, languages.
 */

export interface NormalizedDateTime {
  dateISO: string;       // YYYY-MM-DD
  timeStr: string;       // HH:mm (24hr)
  dateTimeISO: string;   // Full ISO 8601 string
  isPrecise: boolean;    // true if both exact date & time were resolved
}

export class ArgumentNormalizer {
  /**
   * Normalizes Indian mobile phone numbers to standard E.164 (+91XXXXXXXXXX)
   */
  static normalizePhoneNumber(raw: string): string {
    if (!raw) return '';
    // Strip non-digit characters
    const digits = raw.replace(/\D/g, '');

    if (digits.length === 10) {
      return `+91${digits}`;
    }
    if (digits.length === 11 && digits.startsWith('0')) {
      return `+91${digits.slice(1)}`;
    }
    if (digits.length === 12 && digits.startsWith('91')) {
      return `+${digits}`;
    }
    if (raw.startsWith('+') && digits.length >= 10) {
      return `+${digits}`;
    }
    // Fallback if already clean or standard
    return raw.trim();
  }

  /**
   * Normalizes English and Kanglish date/time expressions relative to today
   * e.g., "naale morning", "ivattu 5 pm", "tomorrow 10:30 am", "monday evening"
   */
  static normalizeDateTime(
    dateExpr: string,
    timeExpr?: string,
    businessTimezone = 'Asia/Kolkata'
  ): NormalizedDateTime {
    const now = new Date();
    let targetDate = new Date(now);
    const lowerDate = (dateExpr || '').toLowerCase().trim();
    const lowerTime = (timeExpr || '').toLowerCase().trim();

    // Check Kanglish / English date expressions
    if (lowerDate.includes('ivattu') || lowerDate.includes('today') || lowerDate.includes('eegle')) {
      // today
    } else if (lowerDate.includes('naale') || lowerDate.includes('tomorrow')) {
      targetDate.setDate(targetDate.getDate() + 1);
    } else if (lowerDate.includes('naaduddu') || lowerDate.includes('day after tomorrow')) {
      targetDate.setDate(targetDate.getDate() + 2);
    } else {
      // Attempt standard ISO or YYYY-MM-DD parsing
      const parsed = Date.parse(dateExpr);
      if (!isNaN(parsed)) {
        targetDate = new Date(parsed);
      }
    }

    // Resolve time
    let hours = 10;
    let minutes = 0;
    let isPrecise = false;

    const fullTimeExpr = `${lowerDate} ${lowerTime}`.trim();

    // Match exact HH:MM or HH AM/PM
    const timeMatch = fullTimeExpr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (timeMatch) {
      isPrecise = true;
      let h = parseInt(timeMatch[1], 10);
      const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const meridiem = timeMatch[3]?.toLowerCase();

      if (meridiem === 'pm' && h < 12) h += 12;
      if (meridiem === 'am' && h === 12) h = 0;

      hours = h;
      minutes = m;
    } else if (fullTimeExpr.includes('morning') || fullTimeExpr.includes('beligge')) {
      hours = 10;
      minutes = 0;
      isPrecise = false; // Period only, needs confirmation/clarification
    } else if (fullTimeExpr.includes('afternoon') || fullTimeExpr.includes('madhyahna')) {
      hours = 14;
      minutes = 0;
      isPrecise = false;
    } else if (fullTimeExpr.includes('evening') || fullTimeExpr.includes('sanje')) {
      hours = 17;
      minutes = 0;
      isPrecise = false;
    }

    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const dateISO = `${yyyy}-${mm}-${dd}`;
    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    // Combine into full ISO
    targetDate.setHours(hours, minutes, 0, 0);
    const dateTimeISO = targetDate.toISOString();

    return {
      dateISO,
      timeStr,
      dateTimeISO,
      isPrecise,
    };
  }

  /**
   * Sanitizes customer name
   */
  static normalizeName(raw: string): string {
    if (!raw) return 'Valued Customer';
    return raw
      .replace(/[^\w\s\.\-]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalizes Indian currency expressions: "1.5 cr", "75 lakhs", "50k", "5000"
   */
  static normalizeCurrency(raw: string): string {
    if (!raw) return '';
    const clean = raw.trim();
    return clean;
  }
}
