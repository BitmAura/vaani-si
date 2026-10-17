import { CallStatus, CallRecordDTO, UsageEventDTO } from '@vanni/shared';

export type CanonicalCallStatus =
  | 'INITIATED'
  | 'RINGING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'NO_ANSWER'
  | 'BUSY'
  | 'CANCELLED';

export const ALLOWED_CALL_TRANSITIONS: Record<CanonicalCallStatus, CanonicalCallStatus[]> = {
  INITIATED: ['RINGING', 'IN_PROGRESS', 'COMPLETED', 'NO_ANSWER', 'BUSY', 'CANCELLED', 'FAILED'],
  RINGING: ['IN_PROGRESS', 'COMPLETED', 'NO_ANSWER', 'BUSY', 'FAILED', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'FAILED', 'CANCELLED'],
  COMPLETED: [],
  FAILED: [],
  NO_ANSWER: [],
  BUSY: [],
  CANCELLED: [],
};

export interface CallLifecycleEvent {
  callId: string;
  providerCallSid?: string;
  provider: 'exotel' | 'twilio' | 'sip' | 'mock';
  targetStatus: CanonicalCallStatus;
  providerEventId?: string;
  timestamp?: string;
  rawDurationSeconds?: number;
  failureReason?: string;
  costInr?: number;
}

export interface CallSessionLifecycleState {
  callId: string;
  organizationId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  callerPhone: string;
  destinationPhone?: string;
  currentStatus: CanonicalCallStatus;
  providerCallSid?: string;
  telephonyProvider: string;
  initiatedAt: string;
  ringingAt?: string;
  answeredAt?: string;
  endedAt?: string;
  durationSeconds: number;
  failureReason?: string;
  costInr: number;
  history: Array<{ status: CanonicalCallStatus; timestamp: string; reason?: string }>;
}

export interface CallPersistencePort {
  saveCall(call: CallRecordDTO): Promise<void>;
  getCallById(id: string, organizationId?: string): Promise<CallRecordDTO | null>;
  saveUsageEvent?(event: any): Promise<void>;
  getClientWorkspaceById?(id: string, organizationId?: string): Promise<any>;
}

/**
 * Authoritative Call Lifecycle State Machine & Idempotent Webhook Manager
 *
 * Enforces single source of truth for all call states, validates allowed transitions,
 * deduplicates out-of-order and duplicate provider webhooks, and persists transitions
 * into the authoritative database.
 */
export class CallLifecycleManager {
  private activeCalls = new Map<string, CallSessionLifecycleState>();
  private processedEvents = new Set<string>(); // Webhook deduplication key cache
  private persistence?: CallPersistencePort;

  constructor(persistence?: CallPersistencePort) {
    this.persistence = persistence;
  }

  /**
   * Initializes a new call session in INITIATED state.
   */
  public initializeCall(params: {
    callId: string;
    organizationId: string;
    direction: 'INBOUND' | 'OUTBOUND';
    callerPhone: string;
    destinationPhone?: string;
    providerCallSid?: string;
    telephonyProvider?: string;
    callerName?: string;
  }): CallSessionLifecycleState {
    const initiatedAt = new Date().toISOString();
    const session: CallSessionLifecycleState = {
      callId: params.callId,
      organizationId: params.organizationId,
      direction: params.direction,
      callerPhone: params.callerPhone,
      destinationPhone: params.destinationPhone,
      currentStatus: 'INITIATED',
      providerCallSid: params.providerCallSid,
      telephonyProvider: params.telephonyProvider || 'exotel',
      initiatedAt,
      durationSeconds: 0,
      costInr: 0,
      history: [{ status: 'INITIATED', timestamp: initiatedAt }],
    };

    this.activeCalls.set(params.callId, session);
    if (params.providerCallSid) {
      this.activeCalls.set(params.providerCallSid, session);
    }

    this.persistCallRecord(session, params.callerName).catch((err) => {
      console.warn(`[CallLifecycle] Failed to persist initial call ${session.callId}:`, err);
    });

    return session;
  }

  /**
   * Applies a state transition to an existing call.
   * Returns { success, session, isDuplicate, error }
   */
  public async transition(event: CallLifecycleEvent): Promise<{
    success: boolean;
    session?: CallSessionLifecycleState;
    isDuplicate?: boolean;
    error?: string;
  }> {
    // 1. Webhook Deduplication by Event ID
    if (event.providerEventId) {
      const dedupKey = `${event.provider}:${event.providerEventId}`;
      if (this.processedEvents.has(dedupKey)) {
        const existing = this.activeCalls.get(event.callId) || (event.providerCallSid ? this.activeCalls.get(event.providerCallSid) : undefined);
        return { success: true, session: existing, isDuplicate: true };
      }
      this.processedEvents.add(dedupKey);
      // Evict old events to avoid unbounded memory growth (keep last 5000)
      if (this.processedEvents.size > 5000) {
        const firstKey = this.processedEvents.values().next().value;
        if (firstKey) this.processedEvents.delete(firstKey);
      }
    }

    // 2. Find Call Session
    let session = this.activeCalls.get(event.callId);
    if (!session && event.providerCallSid) {
      session = this.activeCalls.get(event.providerCallSid);
    }

    if (!session) {
      // If call session was lost in memory (e.g. process restart), attempt hydration from persistence
      if (this.persistence) {
        const persisted = await this.persistence.getCallById(event.callId);
        if (persisted) {
          session = {
            callId: persisted.id,
            organizationId: persisted.tenantId,
            direction: persisted.direction,
            callerPhone: persisted.phone,
            currentStatus: (persisted.status as CanonicalCallStatus) || 'IN_PROGRESS',
            providerCallSid: persisted.providerCallSid || event.providerCallSid,
            telephonyProvider: persisted.telephonyProvider || event.provider,
            initiatedAt: persisted.startedAt || persisted.createdAt,
            durationSeconds: persisted.durationSeconds || 0,
            costInr: persisted.costInr || 0,
            history: [{ status: (persisted.status as CanonicalCallStatus) || 'IN_PROGRESS', timestamp: persisted.createdAt }],
          };
          this.activeCalls.set(session.callId, session);
        }
      }
    }

    if (!session) {
      // Auto-initialize call session from provider CDR if seeing this call for the first time
      const initiatedAt = new Date(Date.now() - (event.rawDurationSeconds || 0) * 1000).toISOString();
      session = {
        callId: event.callId,
        organizationId: (event as any).organizationId || 'a0000000-0000-0000-0000-000000000001',
        direction: 'INBOUND',
        callerPhone: 'Verified Caller',
        currentStatus: 'INITIATED',
        providerCallSid: event.providerCallSid || event.callId,
        telephonyProvider: event.provider || 'exotel',
        initiatedAt,
        durationSeconds: 0,
        costInr: 0,
        history: [{ status: 'INITIATED', timestamp: initiatedAt }],
      };
      this.activeCalls.set(session.callId, session);
    }

    // 3. Prevent duplicate same-state transitions
    if (session.currentStatus === event.targetStatus) {
      return { success: true, session, isDuplicate: true };
    }

    // 4. Validate allowed transition
    const allowed = ALLOWED_CALL_TRANSITIONS[session.currentStatus] || [];
    if (!allowed.includes(event.targetStatus)) {
      // Terminal state protection: if already in COMPLETED/FAILED/CANCELLED, do not reopen!
      const isTerminal = ['COMPLETED', 'FAILED', 'NO_ANSWER', 'BUSY', 'CANCELLED'].includes(session.currentStatus);
      return {
        success: false,
        session,
        error: isTerminal
          ? `Cannot transition from terminal state ${session.currentStatus} to ${event.targetStatus}`
          : `Invalid transition from ${session.currentStatus} to ${event.targetStatus}`,
      };
    }

    // 5. Update State and Timestamps
    const now = event.timestamp || new Date().toISOString();
    session.currentStatus = event.targetStatus;
    session.history.push({
      status: event.targetStatus,
      timestamp: now,
      reason: event.failureReason,
    });

    if (event.providerCallSid) {
      session.providerCallSid = event.providerCallSid;
      this.activeCalls.set(event.providerCallSid, session);
    }

    if (event.targetStatus === 'RINGING') {
      session.ringingAt = now;
    } else if (event.targetStatus === 'IN_PROGRESS') {
      session.answeredAt = now;
    } else if (['COMPLETED', 'FAILED', 'NO_ANSWER', 'BUSY', 'CANCELLED'].includes(event.targetStatus)) {
      session.endedAt = now;
      if (event.failureReason) session.failureReason = event.failureReason;
      if (event.costInr !== undefined) session.costInr = event.costInr;

      // Calculate confirmed duration
      if (event.rawDurationSeconds !== undefined && event.rawDurationSeconds > 0) {
        session.durationSeconds = event.rawDurationSeconds;
      } else if (session.answeredAt) {
        const startMs = new Date(session.answeredAt).getTime();
        const endMs = new Date(now).getTime();
        session.durationSeconds = Math.max(0, Math.round((endMs - startMs) / 1000));
      } else {
        session.durationSeconds = 0;
      }
    }

    // 6. Persist to authoritative database
    await this.persistCallRecord(session);

    // 7. Prompt 09: Usage Metering — Emit auditable usage event for completed voice duration
    if (session.currentStatus === 'COMPLETED' && session.durationSeconds > 0 && this.persistence?.saveUsageEvent) {
      let billingOrgId = session.organizationId;
      let clientWorkspaceId: string | undefined;

      if (this.persistence.getClientWorkspaceById) {
        try {
          const clientWs = await this.persistence.getClientWorkspaceById(session.organizationId);
          if (clientWs) {
            billingOrgId = clientWs.organizationId;
            clientWorkspaceId = clientWs.id;
          }
        } catch {}
      }

      const usageEvent: UsageEventDTO = {
        id: `usage_${session.callId}_voice`,
        organizationId: billingOrgId,
        clientWorkspaceId,
        eventType: 'VOICE_DURATION',
        resourceType: 'VOICE_MINUTE',
        provider: session.telephonyProvider || 'exotel',
        quantity: session.durationSeconds,
        unit: 'seconds',
        costType: 'ESTIMATED',
        estimatedCost: Math.round(((session.durationSeconds / 60) * 0.85) * 10000) / 10000,
        actualCost: session.costInr || Math.round(((session.durationSeconds / 60) * 0.85) * 10000) / 10000,
        currency: 'INR',
        correlationId: session.callId,
        durationSource: event.rawDurationSeconds ? 'PROVIDER_CDR' : 'WEBSOCKET_SESSION',
        confirmedDurationSec: session.durationSeconds,
        channel: 'VOICE',
        language: 'kn-IN',
        occurredAt: session.endedAt || now,
        metadata: {
          direction: session.direction,
          callerPhone: session.callerPhone,
          destinationPhone: session.destinationPhone,
          providerCallSid: session.providerCallSid,
          callStatus: session.currentStatus,
        },
      };

      try {
        await this.persistence.saveUsageEvent(usageEvent);
      } catch (err) {
        console.warn(`[CallLifecycle] Failed to emit usage event for call ${session.callId}:`, err);
      }
    }

    return { success: true, session };
  }

  /**
   * Maps provider status strings (from Exotel, Twilio, or webhooks) to CanonicalCallStatus
   */
  public mapProviderStatus(rawStatus: string): CanonicalCallStatus {
    const s = (rawStatus || '').toLowerCase().trim();
    switch (s) {
      case 'queued':
      case 'initiated':
      case 'dialing':
        return 'INITIATED';
      case 'ringing':
        return 'RINGING';
      case 'in-progress':
      case 'answered':
      case 'connected':
        return 'IN_PROGRESS';
      case 'completed':
      case 'normal-clearing':
        return 'COMPLETED';
      case 'busy':
        return 'BUSY';
      case 'no-answer':
      case 'noanswer':
        return 'NO_ANSWER';
      case 'failed':
      case 'congestion':
        return 'FAILED';
      case 'canceled':
      case 'cancelled':
        return 'CANCELLED';
      default:
        return 'IN_PROGRESS';
    }
  }

  public getCall(callIdOrSid: string): CallSessionLifecycleState | undefined {
    return this.activeCalls.get(callIdOrSid);
  }

  private async persistCallRecord(session: CallSessionLifecycleState, callerName?: string): Promise<void> {
    if (!this.persistence) return;

    const record: CallRecordDTO = {
      id: session.callId,
      tenantId: session.organizationId,
      caller: callerName || 'Customer',
      phone: session.callerPhone,
      direction: session.direction,
      durationSeconds: session.durationSeconds,
      intent: 'Voice Call',
      outcome: session.currentStatus === 'COMPLETED' ? 'Call Completed' : `Status: ${session.currentStatus}`,
      leadRating: session.durationSeconds > 60 ? 'HOT' : 'WARM',
      transcript: [],
      createdAt: session.initiatedAt,
      status: session.currentStatus,
      startedAt: session.initiatedAt,
      answeredAt: session.answeredAt,
      endedAt: session.endedAt,
      providerCallSid: session.providerCallSid,
      telephonyProvider: session.telephonyProvider,
      failureReason: session.failureReason,
      costInr: session.costInr,
    };

    try {
      await this.persistence.saveCall(record);
    } catch (err: any) {
      console.warn(`[CallLifecycle] Failed to save call record ${session.callId}:`, err.message);
    }
  }
}
