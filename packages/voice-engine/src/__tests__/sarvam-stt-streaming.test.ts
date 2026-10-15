import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import EventEmitter from 'node:events';
import { SarvamSTTStreamingSession } from '../stt/sarvam-stt-streaming';

// Use vi.hoisted to ensure mock object is available before vi.mock executes
const mocks = vi.hoisted(() => {
  return {
    currentMockWs: null as any,
  };
});

vi.mock('ws', () => {
  const { EventEmitter: Emitter } = require('node:events');

  class MockWebSocket extends Emitter {
    readyState = 1; // WebSocket.OPEN
    static OPEN = 1;
    static CLOSED = 3;
    send = vi.fn();
    close = vi.fn(() => {
      this.readyState = 3;
      this.emit('close');
    });
  }

  const constructorFn = vi.fn().mockImplementation(() => {
    const ws = new MockWebSocket();
    mocks.currentMockWs = ws;
    // Simulate open on next tick
    setTimeout(() => {
      ws.emit('open');
    }, 5);
    return ws;
  });

  (constructorFn as any).OPEN = 1;
  (constructorFn as any).CLOSED = 3;

  return {
    default: constructorFn,
    OPEN: 1,
    CLOSED: 3,
  };
});

describe('SarvamSTTStreamingSession Unit Tests', () => {
  let session: SarvamSTTStreamingSession;

  beforeEach(() => {
    session = new SarvamSTTStreamingSession('fake-sarvam-api-key', 'wss://api.sarvam.ai/streaming/stt');
  });

  afterEach(() => {
    if (session) {
      session.close();
    }
    vi.clearAllMocks();
  });

  it('should establish connection and send initial audio config', async () => {
    const onPartial = vi.fn();
    const onFinal = vi.fn();

    await session.connect({
      languageCode: 'kn-IN',
      highFidelity: true,
      onPartial,
      onFinal,
    });

    expect(session.isConnected()).toBe(true);
    expect(mocks.currentMockWs.send).toHaveBeenCalled();
    const initPayload = JSON.parse(mocks.currentMockWs.send.mock.calls[0][0]);
    expect(initPayload.type).toBe('config');
    expect(initPayload.language_code).toBe('kn-IN');
  });

  it('should stream audio chunks as base64 payload to WebSocket', async () => {
    await session.connect({
      languageCode: 'kn-IN',
    });

    const testChunk = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
    session.sendAudioChunk(testChunk);

    expect(mocks.currentMockWs.send).toHaveBeenCalledTimes(2); // 1: config, 2: audio
    const audioPayload = JSON.parse(mocks.currentMockWs.send.mock.calls[1][0]);
    expect(audioPayload.type).toBe('audio');
    expect(audioPayload.data).toBe(testChunk.toString('base64'));
  });

  it('should receive partial hypotheses and trigger onPartial callback', async () => {
    const onPartial = vi.fn();
    const onFinal = vi.fn();

    await session.connect({
      languageCode: 'kn-IN',
      onPartial,
      onFinal,
    });

    // Simulate Sarvam server sending partial hypothesis
    const partialMsg = JSON.stringify({
      type: 'partial',
      transcript: 'ನಮಸ್ಕಾರ',
    });
    mocks.currentMockWs.emit('message', Buffer.from(partialMsg));

    expect(onPartial).toHaveBeenCalledWith('ನಮಸ್ಕಾರ');
    expect(session.getCurrentTranscript()).toBe('ನಮಸ್ಕಾರ');
    expect(onFinal).not.toHaveBeenCalled();
  });

  it('should flush turn on silence and trigger onFinal callback', async () => {
    const onPartial = vi.fn();
    const onFinal = vi.fn();

    await session.connect({
      languageCode: 'kn-IN',
      onPartial,
      onFinal,
    });

    // Partial update first
    mocks.currentMockWs.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          type: 'partial',
          transcript: 'ನಮಸ್ಕಾರ ಸಾರ್',
        })
      )
    );

    // Call flushTurn (e.g. triggered by silence VAD)
    const finalPromise = session.flushTurn();

    // Verify flush command sent to server
    expect(mocks.currentMockWs.send).toHaveBeenCalledWith(JSON.stringify({ type: 'flush' }));

    // Simulate Sarvam responding with final turn transcript
    mocks.currentMockWs.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          type: 'final',
          transcript: 'ನಮಸ್ಕಾರ ಸಾರ್ ಪ್ಲಾಟ್ ಡೀಟೇಲ್ಸ್ ಬೇಕಿತ್ತು',
        })
      )
    );

    const result = await finalPromise;
    expect(result).toBe('ನಮಸ್ಕಾರ ಸಾರ್ ಪ್ಲಾಟ್ ಡೀಟೇಲ್ಸ್ ಬೇಕಿತ್ತು');
    expect(onFinal).toHaveBeenCalledWith('ನಮಸ್ಕಾರ ಸಾರ್ ಪ್ಲಾಟ್ ಡೀಟೇಲ್ಸ್ ಬೇಕಿತ್ತು');
  });

  it('should resetTurnBuffer and clear accumulated state', async () => {
    await session.connect({
      languageCode: 'kn-IN',
    });

    mocks.currentMockWs.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          type: 'partial',
          transcript: 'ಕೆಲವು ಪದಗಳು',
        })
      )
    );

    expect(session.getCurrentTranscript()).toBe('ಕೆಲವು ಪದಗಳು');

    // Reset turn buffer (e.g. after turn completion or barge-in interrupt)
    session.resetTurnBuffer();

    expect(session.getCurrentTranscript()).toBe('');
  });

  it('should fallback to local transcript on flushTurn timeout if server does not respond', async () => {
    await session.connect({
      languageCode: 'kn-IN',
    });

    mocks.currentMockWs.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          type: 'partial',
          transcript: 'ಸ್ಥಳೀಯ ಪ್ರತಿ',
        })
      )
    );

    // flushTurn with a very small timeout for test
    const flushPromise = session.flushTurn(50);
    const result = await flushPromise;

    // Should resolve with accumulated transcript instead of hanging
    expect(result).toBe('ಸ್ಥಳೀಯ ಪ್ರತಿ');
  });
});
