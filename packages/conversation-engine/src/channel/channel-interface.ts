/**
 * @vanni/conversation-engine — Channel-Independent Interface
 *
 * Defines the generic communication interface decoupling the Conversation Orchestrator
 * from underlying telephony (Exotel/Twilio), WebSockets, WebChat, or WhatsApp messaging gateways.
 */

import {
  ConversationMessageDTO,
  ConversationEventDTO,
  ConversationHandoffDTO,
} from '@vanni/shared';

export interface IConversationChannel {
  readonly channelType: 'VOICE' | 'WEB_CHAT' | 'WHATSAPP' | 'SMS' | 'SIMULATION';
  readonly channelId: string;

  /**
   * Dispatches an outbound agent or system message to the caller/customer
   */
  sendMessage(message: ConversationMessageDTO): Promise<void>;

  /**
   * Emits a lifecycle or operational event to the channel
   */
  sendEvent(event: ConversationEventDTO): Promise<void>;

  /**
   * Signals that caller speech has begun and active audio/output should be interrupted immediately
   */
  interrupt(): Promise<void>;

  /**
   * Initiates human telephony transfer or live agent handoff
   */
  transfer(handoff: ConversationHandoffDTO): Promise<void>;

  /**
   * Gracefully terminates the session
   */
  close(reason?: string): Promise<void>;
}
