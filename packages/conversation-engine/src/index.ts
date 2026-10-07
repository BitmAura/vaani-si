/**
 * @vanni/conversation-engine — Central Barrel Export
 */

export * from './state/state-machine';
export * from './channel/channel-interface';
export * from './context/context-engine';
export * from './validation/factual-validator';
export * from './tools/tool-permission-evaluator';
export * from './handoff/handoff-manager';
export * from './memory/conversation-memory';
export * from './providers/mock-llm-provider';
export * from './providers/mock-channel';
export * from './orchestrator/conversation-orchestrator';
export * from './harness/conversation-test-harness';
export * from './language/index';

// Legacy / Voice Gateway Compatibility FSM
export type FSMState =
  | 'IDLE'
  | 'RINGING'
  | 'GREETING'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'INTERRUPTED'
  | 'TRANSFERRED'
  | 'COMPLETED';

export type FSMEvent =
  | 'CALL_START'
  | 'GREETING_DONE'
  | 'USER_SPEECH_START'
  | 'USER_SPEECH_END'
  | 'LLM_REPLY_READY'
  | 'TTS_CHUNK_DONE'
  | 'BARGE_IN_DETECTED'
  | 'TRANSFER_TRIGGERED'
  | 'CALL_HANGUP';

export class VoiceConversationFSM {
  private currentState: FSMState = 'IDLE';

  getState(): FSMState {
    return this.currentState;
  }

  transition(event: FSMEvent): FSMState {
    switch (this.currentState) {
      case 'IDLE':
        if (event === 'CALL_START') this.currentState = 'GREETING';
        break;
      case 'GREETING':
        if (event === 'GREETING_DONE') this.currentState = 'LISTENING';
        if (event === 'BARGE_IN_DETECTED') this.currentState = 'LISTENING';
        break;
      case 'LISTENING':
        if (event === 'USER_SPEECH_END') this.currentState = 'THINKING';
        break;
      case 'THINKING':
        if (event === 'LLM_REPLY_READY') this.currentState = 'SPEAKING';
        if (event === 'TRANSFER_TRIGGERED') this.currentState = 'TRANSFERRED';
        break;
      case 'SPEAKING':
        if (event === 'BARGE_IN_DETECTED') this.currentState = 'LISTENING';
        if (event === 'TTS_CHUNK_DONE') this.currentState = 'LISTENING';
        break;
      case 'INTERRUPTED':
        if (event === 'USER_SPEECH_END') this.currentState = 'THINKING';
        break;
      case 'TRANSFERRED':
        if (event === 'CALL_HANGUP') this.currentState = 'COMPLETED';
        break;
    }

    if (event === 'CALL_HANGUP') {
      this.currentState = 'COMPLETED';
    }

    return this.currentState;
  }
}
