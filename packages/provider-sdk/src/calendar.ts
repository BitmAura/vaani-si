/**
 * VANNI Provider SDK — Calendar & Appointment Scheduling Contract
 */

export interface TimeSlot {
  slotId: string;
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
  available: boolean;
  staffId?: string;
  staffName?: string;
}

export interface BookingRequest {
  organizationId: string;
  customerName: string;
  customerPhone: string;
  serviceId?: string;
  staffId?: string;
  startTime: string; // ISO 8601
  notes?: string;
}

export interface BookingResult {
  success: boolean;
  bookingId: string;
  calendarEventId?: string;
  meetingLink?: string;
  confirmedStartTime: string;
  errorMessage?: string;
}

export interface ICalendarProvider {
  readonly providerName: string;

  /**
   * Retrieves available appointment slots for a given date range
   */
  getAvailableSlots(
    organizationId: string,
    startDate: string,
    endDate: string,
    staffId?: string
  ): Promise<TimeSlot[]>;

  /**
   * Locks and confirms an appointment booking
   */
  bookAppointment(request: BookingRequest): Promise<BookingResult>;

  /**
   * Cancels a scheduled appointment
   */
  cancelAppointment(bookingId: string, reason?: string): Promise<boolean>;
}
