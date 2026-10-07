import {
  ICalendarProvider,
  TimeSlot,
  BookingRequest,
  BookingResult,
  ProviderError,
  ProviderErrorCode,
} from '@vanni/provider-sdk';

export interface MockCalendarConfig {
  simulatedLatencyMs?: number;
  failureErrorCode?: ProviderErrorCode;
}

export class MockCalendarProvider implements ICalendarProvider {
  public readonly providerName = 'mock-calendar';
  private latencyMs: number;
  private failureCode?: ProviderErrorCode;
  private bookings = new Map<string, BookingRequest>();

  constructor(config: MockCalendarConfig = {}) {
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_MOCK_PROVIDERS) {
      throw new Error('MockCalendarProvider must NOT be instantiated in production environments');
    }
    this.latencyMs = config.simulatedLatencyMs || 10;
    this.failureCode = config.failureErrorCode;
  }

  simulateFailure(code?: ProviderErrorCode): void {
    this.failureCode = code;
  }

  private async delay(): Promise<void> {
    if (this.latencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.latencyMs));
    }
  }

  async getAvailableSlots(
    organizationId: string,
    startDate: string,
    endDate: string,
    staffId?: string
  ): Promise<TimeSlot[]> {
    await this.delay();

    if (this.failureCode) {
      throw new ProviderError(this.failureCode, `Simulated Calendar failure: ${this.failureCode}`, {
        providerName: this.providerName,
      });
    }

    return [
      {
        slotId: `slot_1_${startDate}`,
        startTime: `${startDate}T10:00:00+05:30`,
        endTime: `${startDate}T10:30:00+05:30`,
        available: true,
        staffId,
        staffName: 'Dr. Ramesh Kumar',
      },
      {
        slotId: `slot_2_${startDate}`,
        startTime: `${startDate}T14:00:00+05:30`,
        endTime: `${startDate}T14:30:00+05:30`,
        available: true,
        staffId,
        staffName: 'Dr. Ramesh Kumar',
      },
    ];
  }

  async bookAppointment(request: BookingRequest): Promise<BookingResult> {
    await this.delay();

    if (this.failureCode) {
      throw new ProviderError(this.failureCode, `Simulated Calendar failure: ${this.failureCode}`, {
        providerName: this.providerName,
      });
    }

    const bookingId = `book_mock_${Date.now()}`;
    this.bookings.set(bookingId, request);

    return {
      success: true,
      bookingId,
      calendarEventId: `cal_event_${Date.now()}`,
      meetingLink: 'https://meet.google.com/mock-vanni-test',
      confirmedStartTime: request.startTime,
    };
  }

  async cancelAppointment(bookingId: string, reason?: string): Promise<boolean> {
    await this.delay();
    return this.bookings.delete(bookingId);
  }
}
