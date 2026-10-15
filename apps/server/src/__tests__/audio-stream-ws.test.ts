import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { buildServer } from '../server.js';
import { TelephonyMediaBridge } from '@vanni/voice-engine';

describe('Audio Stream WebSocket Endpoint Integration (/ws/audio-stream)', () => {
  let server: any;
  let serverPort: number;
  let wsUrl: string;
  const mediaBridge = new TelephonyMediaBridge();

  beforeAll(async () => {
    // Ensure test environment
    process.env.NODE_ENV = 'test';
    server = await buildServer();
    // Listen on ephemeral port
    const address = await server.listen({ port: 0, host: '127.0.0.1' });
    const parsedUrl = new URL(address);
    serverPort = Number(parsedUrl.port);
    wsUrl = `ws://127.0.0.1:${serverPort}/ws/audio-stream?tenant=real_estate`;
  });

  afterAll(async () => {
    if (server) {
      await server.close();
    }
  });

  it('should accept WebSocket connection and respond to start_call event', async () => {
    const ws = new WebSocket(wsUrl);

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', reject);
    });

    const receivedMessages: any[] = [];
    ws.on('message', (data: Buffer) => {
      receivedMessages.push(JSON.parse(data.toString()));
    });

    // Send start_call event
    ws.send(JSON.stringify({ event: 'start_call' }));

    // Wait for CALL_STARTED
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        const found = receivedMessages.find((m) => m.type === 'CALL_STARTED');
        if (found) {
          clearInterval(check);
          resolve();
        }
      }, 20);
    });

    const callStarted = receivedMessages.find((m) => m.type === 'CALL_STARTED');
    expect(callStarted).toBeDefined();
    expect(callStarted.persona).toBeDefined();
    expect(callStarted.greeting).toBeDefined();

    ws.close();
  });

  it('should receive and decode simulated telephony media packets via TelephonyMediaBridge', async () => {
    const ws = new WebSocket(wsUrl);

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', reject);
    });

    // Generate 20ms of audio (160 samples at 8kHz μ-law)
    const rawMulaw = Buffer.alloc(160, 0xff); // μ-law silence
    const base64Payload = rawMulaw.toString('base64');

    // Simulate telephony provider sending Twilio/Exotel media event format
    const mediaPacket = {
      event: 'media',
      media: {
        payload: base64Payload,
        timestamp: Date.now(),
        track: 'inbound',
      },
    };

    // Send multiple media chunks
    expect(() => {
      for (let i = 0; i < 5; i++) {
        ws.send(JSON.stringify(mediaPacket));
      }
    }).not.toThrow();

    // Give server event-loop time to process through mediaBridge and pipeline
    await new Promise((r) => setTimeout(r, 100));

    // Ensure connection is still active and healthy
    expect(ws.readyState).toBe(WebSocket.OPEN);

    ws.close();
  });

  it('should process user text turns and stream back transcripts and latency telemetry', async () => {
    const ws = new WebSocket(wsUrl);

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', reject);
    });

    const receivedMessages: any[] = [];
    ws.on('message', (data: Buffer) => {
      receivedMessages.push(JSON.parse(data.toString()));
    });

    // Send a user text turn
    ws.send(
      JSON.stringify({
        event: 'user_text_turn',
        text: 'ನಮಸ್ಕಾರ, ಪ್ಲಾಟ್ ಬೆಲೆ ಎಷ್ಟು?',
      })
    );

    // Wait for transcript event or latency event
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 3000);
      const check = setInterval(() => {
        const transcript = receivedMessages.find((m) => m.type === 'TRANSCRIPT');
        if (transcript) {
          clearTimeout(timeout);
          clearInterval(check);
          resolve();
        }
      }, 50);
    });

    const userTranscript = receivedMessages.find(
      (m) => m.type === 'TRANSCRIPT' && m.speaker === 'USER'
    );
    expect(userTranscript).toBeDefined();
    expect(userTranscript.text).toBe('ನಮಸ್ಕಾರ, ಪ್ಲಾಟ್ ಬೆಲೆ ಎಷ್ಟು?');

    ws.close();
  });
});
