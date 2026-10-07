/**
 * @vanni/campaign-engine — Calling Window & Blackout Schedule Engine
 */

export class CallingScheduleValidator {
  /**
   * Validates whether the current moment falls inside the campaign's permitted calling window
   */
  static isInsideCallingWindow(
    currentTime: Date,
    options: {
      windowStart: string; // HH:mm or HH:mm:ss
      windowEnd: string;   // HH:mm or HH:mm:ss
      allowedDays: number[]; // 1-7 (1=Mon, ..., 7=Sun)
      blackoutDates?: string[]; // YYYY-MM-DD
      timezone?: string;
    }
  ): { allowed: boolean; reason?: string } {
    const { windowStart, windowEnd, allowedDays, blackoutDates = [] } = options;

    // 1. Day of week check (JS getDay: 0=Sun, 1=Mon, 2=Tue... 6=Sat)
    let jsDay = currentTime.getDay();
    let isoDay = jsDay === 0 ? 7 : jsDay; // 1=Mon ... 7=Sun

    if (!allowedDays.includes(isoDay)) {
      return { allowed: false, reason: `Calling not allowed on day ${isoDay} of the week` };
    }

    // 2. Blackout dates check
    const yyyy = currentTime.getFullYear();
    const mm = String(currentTime.getMonth() + 1).padStart(2, '0');
    const dd = String(currentTime.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    if (blackoutDates.includes(dateStr)) {
      return { allowed: false, reason: `Date ${dateStr} is a configured campaign blackout/holiday` };
    }

    // 3. Time of day window check (HH:mm:ss)
    const currentHours = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    const currentTotalMinutes = currentHours * 60 + currentMinutes;

    const [startH, startM] = windowStart.split(':').map(Number);
    const [endH, endM] = windowEnd.split(':').map(Number);

    const startTotalMinutes = startH * 60 + (startM || 0);
    const endTotalMinutes = endH * 60 + (endM || 0);

    if (currentTotalMinutes < startTotalMinutes || currentTotalMinutes > endTotalMinutes) {
      return {
        allowed: false,
        reason: `Current time (${currentHours}:${currentMinutes}) is outside calling window (${windowStart} - ${windowEnd})`,
      };
    }

    return { allowed: true };
  }
}
