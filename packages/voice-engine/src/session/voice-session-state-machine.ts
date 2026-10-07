import { VoiceSessionState } from './voice-session-types.js';

const VALID_TRANSITIONS: Record<VoiceSessionState, VoiceSessionState[]> = {
  CREATED: ['CONNECTING', 'CONNECTED', 'FAILED'],
  CONNECTING: ['CONNECTED', 'FAILED', 'ENDING'],
  CONNECTED: ['LISTENING', 'PROCESSING', 'SPEAKING', 'INTERRUPTED', 'RECONNECTING', 'ENDING', 'ENDED', 'FAILED'],
  LISTENING: ['PROCESSING', 'INTERRUPTED', 'RECONNECTING', 'ENDING', 'ENDED', 'FAILED'],
  PROCESSING: ['SPEAKING', 'LISTENING', 'INTERRUPTED', 'RECONNECTING', 'ENDING', 'ENDED', 'FAILED'],
  SPEAKING: ['LISTENING', 'INTERRUPTED', 'RECONNECTING', 'ENDING', 'ENDED', 'FAILED'],
  INTERRUPTED: ['LISTENING', 'PROCESSING', 'ENDING', 'ENDED', 'FAILED'],
  RECONNECTING: ['CONNECTED', 'LISTENING', 'ENDING', 'ENDED', 'FAILED'],
  ENDING: ['ENDED', 'FAILED'],
  ENDED: [],
  FAILED: ['ENDED'],
};

export class VoiceSessionStateMachine {
  private currentState: VoiceSessionState;
  private history: { state: VoiceSessionState; timestamp: number }[] = [];

  constructor(initialState: VoiceSessionState = 'CREATED') {
    this.currentState = initialState;
    this.history.push({ state: initialState, timestamp: Date.now() });
  }

  transition(targetState: VoiceSessionState): boolean {
    const allowed = VALID_TRANSITIONS[this.currentState] || [];
    if (!allowed.includes(targetState)) {
      return false;
    }
    this.currentState = targetState;
    this.history.push({ state: targetState, timestamp: Date.now() });
    return true;
  }

  forceState(state: VoiceSessionState): void {
    this.currentState = state;
    this.history.push({ state, timestamp: Date.now() });
  }

  getState(): VoiceSessionState {
    return this.currentState;
  }

  getHistory(): { state: VoiceSessionState; timestamp: number }[] {
    return [...this.history];
  }
}
