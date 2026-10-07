/**
 * @vanni/conversation-engine — Mock Channel Implementation
 *
 * Implements IConversationChannel in-memory for testing orchestrator communication.
 */

import {
  ConversationMessageDTO,
  ConversationEventDTO,
  ConversationHandoffDTO,
} from '@vanni/shared';
import { IConversationChannel } from '../channel/channel-interface';

export class MockConversationChannel implements IConversationChannel {
  readonly channelType = 'SIMULATION';
  readonly channelId: string;

  public sentMessages: ConversationMessageDTO[] = [];
  public sentEvents: ConversationEventDTO[] = [];
  public activeHandoff?: ConversationHandoffDTO;
  public interruptedCount = 0;
  public isClosed = false;
  public closeReason?: string;

  constructor(channelId = `mock_chan_${Date.now()}`) {
    this.channelId = channelId;
  }

  async sendMessage(message: ConversationMessageDTO): Promise<void> {
    this.sentMessages.push(message);
  }

  async sendEvent(event: ConversationEventDTO): Promise<void> {
    this.sentEvents.push(event);
  }

  async interrupt(): Promise<void> {
    this.interruptedCount++;
  }

  async transfer(handoff: ConversationHandoffDTO): Promise<void> {
    this.activeHandoff = handoff;
  }

  async close(reason?: string): Promise<void> {
    this.isClosed = true;
    this.closeReason = reason;
  }

  reset(): void {
    this.sentMessages = [];
    this.sentEvents = [];
    this.activeHandoff = undefined;
    this.interruptedCount = 0;
    this.isClosed = false;
    this.closeReason = undefined;
  }
}
