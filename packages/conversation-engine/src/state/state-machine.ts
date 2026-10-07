/**
 * @vanni/conversation-engine — Deterministic Conversation State Machine
 *
 * Implements a strict, typed state transition mechanism for channel-independent conversations.
 * Arbitrary browser/client-side state mutation is strictly forbidden.
 */

import {
  ConversationRuntimeState,
  ConversationEventType,
} from '@vanni/shared';

export interface StateTransitionResult {
  previousState: ConversationRuntimeState;
  newState: ConversationRuntimeState;
  event: ConversationEventType;
  isValid: boolean;
  error?: string;
}

// Explicit State Transition Matrix
const ALLOWED_TRANSITIONS: Record<ConversationRuntimeState, ConversationRuntimeState[]> = {
  IDLE: ['CONNECTING', 'GREETING', 'LISTENING', 'ERROR', 'ENDED'],
  CONNECTING: ['GREETING', 'LISTENING', 'ERROR', 'ENDED'],
  GREETING: ['LISTENING', 'INTERRUPTED', 'THINKING', 'ERROR', 'ENDED'],
  LISTENING: ['THINKING', 'INTERRUPTED', 'TRANSFER_PENDING', 'ENDED', 'ERROR'],
  THINKING: ['SPEAKING', 'TOOL_EXECUTION', 'CONFIRMING', 'TRANSFER_PENDING', 'INTERRUPTED', 'ENDED', 'ERROR'],
  SPEAKING: ['LISTENING', 'INTERRUPTED', 'TOOL_EXECUTION', 'TRANSFER_PENDING', 'ENDED', 'ERROR'],
  INTERRUPTED: ['LISTENING', 'THINKING', 'ERROR', 'ENDED'],
  TOOL_EXECUTION: ['CONFIRMING', 'THINKING', 'SPEAKING', 'TRANSFER_PENDING', 'ENDED', 'ERROR'],
  CONFIRMING: ['TOOL_EXECUTION', 'THINKING', 'SPEAKING', 'TRANSFER_PENDING', 'ENDED', 'ERROR'],
  TRANSFER_PENDING: ['ENDED', 'ERROR'],
  ENDED: [], // Terminal state
  ERROR: ['ENDED'], // Terminal or recovery to ENDED
};

export class ConversationStateMachine {
  private currentState: ConversationRuntimeState;

  constructor(initialState: ConversationRuntimeState = 'IDLE') {
    this.currentState = initialState;
  }

  getCurrentState(): ConversationRuntimeState {
    return this.currentState;
  }

  canTransition(toState: ConversationRuntimeState): boolean {
    const allowed = ALLOWED_TRANSITIONS[this.currentState] || [];
    return allowed.includes(toState);
  }

  transition(toState: ConversationRuntimeState, event: ConversationEventType): StateTransitionResult {
    const prev = this.currentState;

    if (toState === prev) {
      return {
        previousState: prev,
        newState: prev,
        event,
        isValid: true,
      };
    }

    if (!this.canTransition(toState)) {
      const errorMsg = `Illegal state transition attempted: ${prev} -> ${toState} on event ${event}`;
      return {
        previousState: prev,
        newState: prev,
        event,
        isValid: false,
        error: errorMsg,
      };
    }

    this.currentState = toState;
    return {
      previousState: prev,
      newState: toState,
      event,
      isValid: true,
    };
  }

  forceState(state: ConversationRuntimeState): void {
    this.currentState = state;
  }
}
