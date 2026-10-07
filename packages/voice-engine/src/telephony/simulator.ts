import { ITelephonyProvider } from '@vanni/provider-sdk';
import { ITelephonyRepository } from './telephony-repository.js';
import { InboundCallRouter } from './inbound-call-router.js';
import { TelephonyWebhookController } from './webhook-controller.js';

export interface TelephonySimulationOptions {
  callerPhoneNumber?: string;
  calledPhoneNumber?: string;
  providerCallSid?: string;
  signature?: string;
}

export interface TelephonySimulationResult {
  statusCode: number;
  accepted: boolean;
  telephonySessionId?: string;
  assignedAgentId?: string;
  mediaStreamUrl?: string;
  responsePayload: string;
}

/**
 * Local Inbound Call Simulator for offline testing and development.
 */
export class TelephonySimulator {
  private controller: TelephonyWebhookController;
  private repo: ITelephonyRepository;

  constructor(repo: ITelephonyRepository, router: InboundCallRouter, provider: ITelephonyProvider) {
    this.repo = repo;
    this.controller = new TelephonyWebhookController(repo, router, provider);
  }

  async simulateInboundCall(opts: TelephonySimulationOptions = {}): Promise<TelephonySimulationResult> {
    const caller = opts.callerPhoneNumber || '+919876543210';
    const called = opts.calledPhoneNumber || '+918047192001';
    const callSid = opts.providerCallSid || `SIM_CALL_${Date.now()}`;

    const res = await this.controller.handleInboundCallWebhook({
      providerName: 'mock',
      signatureHeader: opts.signature || 'valid_test_signature',
      url: 'http://localhost:4200/api/telephony/webhooks/exotel',
      params: {
        CallSid: callSid,
        From: caller,
        To: called,
        Direction: 'inbound',
      },
    });

    const session = await this.repo.findTelephonySessionByProviderSid(callSid);

    return {
      statusCode: res.statusCode,
      accepted: res.statusCode === 200 && !res.isDuplicate,
      telephonySessionId: session?.telephonySessionId,
      assignedAgentId: session?.assignedAgentId,
      responsePayload: res.body,
    };
  }

  async simulateHangup(providerCallSid: string, durationSeconds = 45): Promise<void> {
    await this.controller.handleCallStatusWebhook({
      providerName: 'mock',
      url: 'http://localhost:4200/api/telephony/events/exotel',
      params: {
        CallSid: providerCallSid,
        Status: 'COMPLETED',
        Duration: durationSeconds.toString(),
      },
    });
  }
}
