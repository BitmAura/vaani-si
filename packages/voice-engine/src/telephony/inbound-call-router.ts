import {
  ITelephonyProvider,
  InboundCallWebhookPayload,
  InboundCallAnswerOptions,
} from '@vanni/provider-sdk';
import { ITelephonyRepository } from './telephony-repository.js';
import { TelephonySessionDTO, BusinessPhoneNumberDTO } from './telephony-types.js';

export interface InboundCallRoutingResult {
  accepted: boolean;
  rejectReason?: string;
  responsePayload: string; // XML (TwiML / Exotel) or JSON
  telephonySession?: TelephonySessionDTO;
  assignedAgentId?: string;
  organizationId?: string;
  mediaStreamUrl?: string;
}

export interface InboundCallRouterConfig {
  repository: ITelephonyRepository;
  telephonyProvider: ITelephonyProvider;
  wsBaseUrl: string; // e.g. "ws://gateway.vanni.ai:4200/ws/voice-stream"
}

/**
 * Server-Side Inbound Call Router.
 * Resolves destination number -> organization -> assigned AI agent -> publishes session.
 * Enforces strict tenant isolation and prevents caller-spoofed parameters.
 */
export class InboundCallRouter {
  private repo: ITelephonyRepository;
  private provider: ITelephonyProvider;
  private wsBaseUrl: string;

  constructor(config: InboundCallRouterConfig) {
    this.repo = config.repository;
    this.provider = config.telephonyProvider;
    this.wsBaseUrl = config.wsBaseUrl;
  }

  async handleInboundCall(payload: InboundCallWebhookPayload): Promise<InboundCallRoutingResult> {
    const calledNumber = payload.calledPhoneNumber;
    const callerNumber = payload.callerPhoneNumber;
    const providerCallSid = payload.providerCallSid;

    // 1. Resolve Registered Business Phone Number
    const phoneRecord = await this.repo.findPhoneNumber(calledNumber);
    if (!phoneRecord) {
      // Unassigned or unknown phone number
      const rejectResponse = this.provider.generateInboundAnswerResponse({
        wsMediaStreamUrl: '',
        welcomeGreeting: 'Sorry, this phone number is not configured on the VANNI platform. Goodbye.',
        language: 'en-IN',
      });
      return {
        accepted: false,
        rejectReason: 'NUMBER_NOT_FOUND',
        responsePayload: rejectResponse,
      };
    }

    // 2. Validate Phone Number Status
    if (phoneRecord.status !== 'ACTIVE') {
      const rejectResponse = this.provider.generateInboundAnswerResponse({
        wsMediaStreamUrl: '',
        welcomeGreeting: 'This service is currently unavailable. Please try again later.',
        language: 'en-IN',
      });
      return {
        accepted: false,
        rejectReason: 'NUMBER_INACTIVE',
        responsePayload: rejectResponse,
      };
    }

    // 3. Resolve Assigned AI Employee
    const orgSettings = await this.repo.getOrgSettings(phoneRecord.organizationId);
    const assignedAgentId = phoneRecord.assignedAgentId || orgSettings?.defaultAgentId;

    if (!assignedAgentId) {
      const rejectResponse = this.provider.generateInboundAnswerResponse({
        wsMediaStreamUrl: '',
        welcomeGreeting: 'No virtual assistant is currently assigned to this line.',
        language: 'en-IN',
      });
      return {
        accepted: false,
        rejectReason: 'NO_ASSIGNED_AGENT',
        responsePayload: rejectResponse,
      };
    }

    // 4. Create Normalized Telephony Session
    const telephonySessionId = `tsess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const conversationId = `conv_tel_${Date.now()}`;
    const voiceSessionId = `vsess_tel_${Date.now()}`;

    const telephonySession: TelephonySessionDTO = {
      telephonySessionId,
      providerCallSid,
      organizationId: phoneRecord.organizationId,
      phoneNumberId: phoneRecord.id,
      assignedAgentId,
      conversationId,
      voiceSessionId,
      direction: 'INBOUND',
      callerPhoneNumber: callerNumber,
      destinationPhoneNumber: calledNumber,
      status: 'ANSWERED',
      startedAt: new Date().toISOString(),
      answeredAt: new Date().toISOString(),
      durationSeconds: 0,
      callOutcome: 'UNKNOWN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.repo.saveTelephonySession(telephonySession);

    // 5. Construct Media Stream URL with Authorized Session Parameters
    const mediaStreamUrl = `${this.wsBaseUrl}?orgId=${encodeURIComponent(phoneRecord.organizationId)}&agentId=${encodeURIComponent(assignedAgentId)}&telephonySessionId=${encodeURIComponent(telephonySessionId)}&callerPhone=${encodeURIComponent(callerNumber)}&mock=false`;

    // 6. Generate Telephony Streaming Response (e.g. Exotel / TwiML XML or JSON)
    const welcomeGreeting = orgSettings?.aiDisclosureEnabled
      ? 'Namaskara! Naanu VANNI AI sahayaka. Details heli sir.'
      : 'Namaskara! Ballari Layouts kadeyinda mathadtha iddini. Details heli sir.';

    const answerResponse = this.provider.generateInboundAnswerResponse({
      wsMediaStreamUrl: mediaStreamUrl,
      welcomeGreeting,
      language: 'kn-IN',
    });

    return {
      accepted: true,
      responsePayload: answerResponse,
      telephonySession,
      assignedAgentId,
      organizationId: phoneRecord.organizationId,
      mediaStreamUrl,
    };
  }
}
