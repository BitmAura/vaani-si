/**
 * @vanni/voice-gateway — RealtimeSession & Finite State Machine
 */

import { VoiceConversationFSM } from '@vanni/conversation-engine';
import { VadArbiter } from '../vad/vad-arbiter.js';
import { LatencyTracker } from '@vanni/observability';
import { TenantContext } from '@vanni/shared';

export class RealtimeSession {
  public id: string;
  public tenant: TenantContext;
  public fsm: VoiceConversationFSM;
  public vad: VadArbiter;
  public latencyTracker: LatencyTracker;

  constructor(id: string, tenant: TenantContext) {
    this.id = id;
    this.tenant = tenant;
    this.fsm = new VoiceConversationFSM();
    this.vad = new VadArbiter();
    this.latencyTracker = new LatencyTracker();
  }

  handleInboundAudio(chunk: Buffer, onBargeIn: () => void) {
    if (this.fsm.getState() === 'SPEAKING') {
      const isBargeIn = this.vad.detectBargeIn(chunk);
      if (isBargeIn) {
        this.fsm.transition('BARGE_IN_DETECTED');
        onBargeIn();
      }
    }
  }
}
