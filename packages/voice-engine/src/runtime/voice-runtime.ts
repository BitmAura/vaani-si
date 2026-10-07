import {
  ConversationOrchestrator,
  IConversationChannel,
  ConversationSession,
} from '@vanni/conversation-engine';
import {
  ISTTProvider,
  ITTSProvider,
  ILLMProvider,
  ProviderError,
} from '@vanni/provider-sdk';
import { AudioNormalizer } from '../audio/audio-normalizer.js';
import { JitterBuffer } from '../audio/jitter-buffer.js';
import { AudioFrame } from '../audio/audio-frame.js';
import { EnergyVAD } from '../vad/energy-vad.js';
import { TurnDetector } from '../vad/turn-detector.js';
import { ProviderStreamingSTTSession } from '../stt/provider-streaming-stt-session.js';
import { TranscriptAccumulator } from '../stt/transcript-accumulator.js';
import { ResponseSegmenter } from '../tts/response-segmenter.js';
import { StreamingTTSManager } from '../tts/streaming-tts-manager.js';
import { VoiceSession } from '../session/voice-session.js';
import { VoiceConversationChannel, IVoiceSocketTransport } from '../transport/voice-conversation-channel.js';
import { createVoiceEvent, VoiceEventEnvelope } from '../transport/voice-events.js';

export interface VoiceRuntimeConfig {
  session: VoiceSession;
  socket: IVoiceSocketTransport;
  orchestrator: ConversationOrchestrator;
  sttProvider: ISTTProvider;
  ttsProvider: ITTSProvider;
  llmProvider: ILLMProvider;
}

export class VoiceRuntime {
  private session: VoiceSession;
  private socket: IVoiceSocketTransport;
  private orchestrator: ConversationOrchestrator;
  private normalizer = new AudioNormalizer();
  private jitterBuffer = new JitterBuffer();
  private vad = new EnergyVAD();
  private turnDetector = new TurnDetector();
  private sttSession: ProviderStreamingSTTSession;
  private transcriptAccumulator = new TranscriptAccumulator();
  private segmenter = new ResponseSegmenter();
  private ttsManager: StreamingTTSManager;
  private channel: VoiceConversationChannel;

  private activeTurnAbortController: AbortController | null = null;
  private isProcessingTurn = false;
  private sequenceCounter = 0;
  private activeUtteranceStart = 0;

  constructor(config: VoiceRuntimeConfig) {
    this.session = config.session;
    this.socket = config.socket;
    this.orchestrator = config.orchestrator;
    this.ttsManager = new StreamingTTSManager(config.ttsProvider);
    this.channel = new VoiceConversationChannel(this.session.voiceSessionId, this.socket);

    this.sttSession = new ProviderStreamingSTTSession({
      provider: config.sttProvider,
      options: {
        languageCode: this.session.language === 'en-IN' ? 'en-IN' : 'kn-IN',
        sampleRate: 16000,
        encoding: 'LINEAR16',
      },
    });

    this.setupSTTListeners();
    this.setupInterruptionHandlers();
  }

  private setupSTTListeners(): void {
    this.sttSession.onTranscript((event) => {
      const state = this.transcriptAccumulator.processEvent(event);

      // Forward partial / final transcript events to client UI
      this.emitEvent('TRANSCRIPT_PARTIAL', {
        partialText: state.currentPartial,
        committedText: state.fullTurnText,
        isFinal: event.isFinal,
        language: state.detectedLanguage,
        confidence: state.confidence,
      });
    });

    this.sttSession.onError((err) => {
      this.emitEvent('ERROR', {
        code: 'STT_ERROR',
        message: err.message,
      });
    });
  }

  private setupInterruptionHandlers(): void {
    this.channel.setInterruptHandler(() => {
      this.handleBargeIn();
    });
  }

  async start(): Promise<void> {
    this.session.connect();
    await this.sttSession.start();

    this.emitEvent('SESSION_STARTED', {
      voiceSessionId: this.session.voiceSessionId,
      conversationId: this.session.conversationId,
      language: this.session.language,
    });
  }

  /**
   * Process raw inbound audio frame from client/telephony
   */
  async handleInboundAudio(frame: AudioFrame): Promise<void> {
    this.session.touch();

    // 1. Audio Normalization (resampling 8k->16k, G.711 mulaw decoding if needed)
    const normalized = this.normalizer.normalizeFrame(frame);
    if (!normalized) return;

    // 2. Jitter Buffer
    this.jitterBuffer.push(normalized);
    const readyFrames = this.jitterBuffer.drain();

    for (const f of readyFrames) {
      // 3. VAD processing
      const vadEvent = this.vad.processFrame(f);

      // 4. Barge-In / Interruption Check
      if (this.session.stateMachine.getState() === 'SPEAKING' && this.turnDetector.isBargeIn(vadEvent)) {
        this.handleBargeIn();
      }

      // 5. Turn Detection
      const turnStatus = this.turnDetector.processVADEvent(vadEvent);

      if (vadEvent.type === 'SPEECH_START') {
        if (!this.activeUtteranceStart) {
          this.activeUtteranceStart = Date.now();
        }
        this.session.stateMachine.transition('LISTENING');
        this.emitEvent('SPEECH_STARTED', { timestamp: f.timestamp });
      }

      // 6. Push audio to Streaming STT
      this.sttSession.pushAudio(f.payload);

      // 7. Check if user finished speaking
      if (turnStatus === 'TURN_COMPLETED' || turnStatus === 'FORCE_COMPLETED') {
        this.emitEvent('SPEECH_STOPPED', { timestamp: f.timestamp });
        await this.dispatchTurnToOrchestrator();
      }
    }
  }

  /**
   * Barge-in handler: Instantly cancels TTS audio output & active LLM generation
   */
  handleBargeIn(): void {
    if (this.session.stateMachine.getState() === 'SPEAKING') {
      this.session.recordInterruption();
      this.ttsManager.cancel();
      if (this.activeTurnAbortController) {
        this.activeTurnAbortController.abort();
        this.activeTurnAbortController = null;
      }
      this.segmenter.reset();
      this.emitEvent('INTERRUPTION', {
        reason: 'USER_BARGE_IN',
        timestamp: Date.now(),
      });
      this.session.stateMachine.transition('LISTENING');
    }
  }

  /**
   * Dispatches completed user utterance to Conversation Orchestrator
   */
  private async dispatchTurnToOrchestrator(): Promise<void> {
    if (this.isProcessingTurn) return;

    const accumulatedText = this.transcriptAccumulator.getCommittedTurnText();
    if (!accumulatedText || accumulatedText.trim().length === 0) {
      this.transcriptAccumulator.reset();
      return;
    }

    this.isProcessingTurn = true;
    this.session.stateMachine.transition('PROCESSING');
    const turnStartTime = Date.now();
    this.activeTurnAbortController = new AbortController();

    this.emitEvent('TURN_STARTED', {
      utterance: accumulatedText,
      timestamp: turnStartTime,
    });

    try {
      // Dispatch turn to existing Conversation Orchestrator
      const turnResult = await this.orchestrator.processCustomerMessage(
        this.session.conversationId,
        accumulatedText
      );

      const responseText = turnResult.agentResponse || '';
      const turnLatencyMs = Date.now() - turnStartTime;
      const audioDuration = this.activeUtteranceStart ? Date.now() - this.activeUtteranceStart : 0;
      this.activeUtteranceStart = 0;
      this.session.recordTurn(turnLatencyMs, audioDuration);

      // Check if conversation was handed off to human or completed
      if (turnResult.stateAfter === 'TRANSFER_PENDING') {
        this.emitEvent('AI_RESPONSE_STARTED', {
          response: responseText,
          handoff: true,
        });
      } else {
        this.emitEvent('AI_RESPONSE_STARTED', {
          response: responseText,
        });
      }

      // Stream TTS audio output
      if (responseText) {
        await this.synthesizeAndStreamResponse(responseText);
      }

      this.emitEvent('TURN_COMPLETED', {
        turnId: turnResult.turnId,
        latencyMs: turnLatencyMs,
        state: turnResult.stateAfter,
      });

      this.session.stateMachine.transition('LISTENING');
    } catch (err: unknown) {
      this.emitEvent('ERROR', {
        code: 'ORCHESTRATOR_ERROR',
        message: (err as Error)?.message || String(err),
      });
      this.session.stateMachine.transition('LISTENING');
    } finally {
      this.isProcessingTurn = false;
      this.transcriptAccumulator.reset();
      this.activeTurnAbortController = null;
    }
  }

  /**
   * Natural speech segmentation and TTS streaming
   */
  private async synthesizeAndStreamResponse(fullText: string): Promise<void> {
    this.session.stateMachine.transition('SPEAKING');

    // Split text into speech segments
    const segments = this.segmenter.pushDelta(fullText);
    const lastSegment = this.segmenter.flush();
    if (lastSegment) {
      segments.push(lastSegment);
    }

    if (segments.length === 0 && fullText.trim()) {
      segments.push(fullText.trim());
    }

    const langMode = this.session.language.includes('kn') ? 'kn-en' : 'en';

    try {
      for await (const chunk of this.ttsManager.synthesizeSegments(segments, { sampleRate: 16000 }, langMode)) {
        if (this.session.stateMachine.getState() !== 'SPEAKING') {
          // Cancelled by barge-in
          break;
        }

        // Send audio chunk to transport
        this.emitEvent('AI_AUDIO_CHUNK', {
          segmentIndex: chunk.segmentIndex,
          text: chunk.text,
          audioBase64: chunk.audioPayload.audioBase64,
          format: chunk.audioPayload.format,
          sampleRate: chunk.audioPayload.sampleRate,
          durationMs: chunk.audioPayload.durationMs,
        });
      }

      this.emitEvent('AI_AUDIO_ENDED', { timestamp: Date.now() });
    } catch (err: unknown) {
      this.emitEvent('ERROR', {
        code: 'TTS_ERROR',
        message: (err as Error)?.message || String(err),
      });
    }
  }

  private emitEvent<T>(type: any, payload: T): void {
    this.sequenceCounter++;
    const envelope = createVoiceEvent(type, this.session.voiceSessionId, payload, this.sequenceCounter);
    this.socket.send(JSON.stringify(envelope));
  }

  async stop(): Promise<void> {
    this.handleBargeIn();
    await this.sttSession.stop();
    this.session.close();
  }

  getSession(): VoiceSession {
    return this.session;
  }
}
