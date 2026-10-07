import {
  IConversationChannel,
  ConversationOrchestrator,
} from '@vanni/conversation-engine';
import {
  ConversationMessageDTO,
  ConversationEventDTO,
  ConversationHandoffDTO,
} from '@vanni/shared';
import { VoiceEventEnvelope, createVoiceEvent } from './voice-events.js';

export interface IVoiceSocketTransport {
  send(data: string | Buffer): void;
  close(code?: number, reason?: string): void;
}

/**
 * Concrete IConversationChannel implementation connecting the Conversation Orchestrator
 * with the Real-Time Voice Runtime.
 */
export class VoiceConversationChannel implements IConversationChannel {
  public readonly channelType = 'VOICE' as const;
  public readonly channelId: string;
  private socket: IVoiceSocketTransport;
  private sequenceCounter = 0;
  private onInterruptCallback?: () => void;
  private onHandoffCallback?: (handoff: ConversationHandoffDTO) => void;

  constructor(channelId: string, socket: IVoiceSocketTransport) {
    this.channelId = channelId;
    this.socket = socket;
  }

  setInterruptHandler(handler: () => void): void {
    this.onInterruptCallback = handler;
  }

  setHandoffHandler(handler: (handoff: ConversationHandoffDTO) => void): void {
    this.onHandoffCallback = handler;
  }

  async sendMessage(message: ConversationMessageDTO): Promise<void> {
    this.sequenceCounter++;
    const event = createVoiceEvent(
      'AI_TEXT_DELTA',
      this.channelId,
      {
        messageId: message.id,
        content: message.content,
        speaker: message.speaker,
      },
      this.sequenceCounter
    );
    this.socket.send(JSON.stringify(event));
  }

  async sendEvent(event: ConversationEventDTO): Promise<void> {
    this.sequenceCounter++;
    const voiceEvt = createVoiceEvent(
      'TURN_COMPLETED',
      this.channelId,
      {
        type: event.eventType,
        payload: event.payload,
      },
      this.sequenceCounter
    );
    this.socket.send(JSON.stringify(voiceEvt));
  }

  async interrupt(): Promise<void> {
    if (this.onInterruptCallback) {
      this.onInterruptCallback();
    }
    this.sequenceCounter++;
    const event = createVoiceEvent(
      'INTERRUPTION',
      this.channelId,
      { reason: 'USER_BARGE_IN' },
      this.sequenceCounter
    );
    this.socket.send(JSON.stringify(event));
  }

  async transfer(handoff: ConversationHandoffDTO): Promise<void> {
    if (this.onHandoffCallback) {
      this.onHandoffCallback(handoff);
    }
  }

  async close(reason?: string): Promise<void> {
    this.sequenceCounter++;
    const event = createVoiceEvent(
      'SESSION_END',
      this.channelId,
      { reason: reason || 'NORMAL_CLOSE' },
      this.sequenceCounter
    );
    this.socket.send(JSON.stringify(event));
    this.socket.close(1000, reason);
  }
}
