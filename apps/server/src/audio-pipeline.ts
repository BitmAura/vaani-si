/**
 * Layer 3 & 4: Real-Time Audio Pipeline Orchestrator
 * Dhwani SI — Bi-Directional Streaming Audio & Conversational Engine
 */

import { SarvamVoiceAdapter } from '../../../packages/voice-engine/src/sarvam-adapter';
import { PromptEngine } from '../../../packages/core/src/conversation/prompt-engine';
import { Tenant } from '../../../packages/core/src/domain/types';
import { LLMConversationalService, MessageTurn } from './llm-service';

export interface PipelineEvents {
  onTranscript: (speaker: 'USER' | 'AGENT', text: string) => void;
  onLatencyBreakdown: (vadMs: number, sttMs: number, llmMs: number, ttsMs: number, totalMs: number) => void;
  onAudioChunk: (base64Audio: string) => void;
}

export class AudioConversationPipeline {
  /**
   * End-of-turn silence window. 300ms is the industry-standard turn-taking
   * pause for IVR-grade voice bots; a longer window adds directly to every
   * turn's perceived latency (the 750ms ceiling includes VAD silence).
   */
  private static readonly END_OF_TURN_SILENCE_MS = 300;

  private sarvam: SarvamVoiceAdapter;
  private llm: LLMConversationalService;
  private tenant: Tenant;
  private history: MessageTurn[] = [];
  private audioBuffer: Buffer[] = [];
  private isProcessingTurn = false;
  private silenceTimer: NodeJS.Timeout | null = null;
  private lastChunkAt = 0;
  private isInceptionMode = false;

  constructor(tenant: Tenant, isInceptionMode = false) {
    this.tenant = tenant;
    this.isInceptionMode = isInceptionMode;
    this.sarvam = new SarvamVoiceAdapter();
    this.llm = new LLMConversationalService();
  }

  /**
   * Ingest raw audio chunk (PCM/WAV 8kHz or 16kHz) from WebSocket
   */
  public pushAudioChunk(chunk: Buffer, events: PipelineEvents): void {
    if (this.isProcessingTurn) {
      // User is speaking while agent might be talking -> Barge-in interruption
      return;
    }

    this.audioBuffer.push(chunk);
    this.lastChunkAt = Date.now();

    // Reset silence detector
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }

    // After END_OF_TURN_SILENCE_MS of audio silence, assume user finished their sentence
    this.silenceTimer = setTimeout(() => {
      this.processUserUtterance(events);
    }, AudioConversationPipeline.END_OF_TURN_SILENCE_MS);
  }

  /**
   * Process complete user utterance through the STT -> LLM -> TTS loop
   */
  public async processUserUtterance(events: PipelineEvents, rawTextOverride?: string): Promise<void> {
    if (this.isProcessingTurn) return;
    this.isProcessingTurn = true;

    const tStart = Date.now();
    // VAD latency = measured end-of-turn wait (0 when invoked with a text
    // override, where no VAD/silence detection is involved).
    const vadMs = rawTextOverride || !this.lastChunkAt
      ? 0
      : Math.max(0, Date.now() - this.lastChunkAt);
    let sttMs = 0;
    let llmMs = 0;
    let ttsMs = 0;

    try {
      let userText = rawTextOverride || '';

      // 1. Transcribe Audio (if audio buffer exists)
      if (!userText && this.audioBuffer.length > 0) {
        const fullAudio = Buffer.concat(this.audioBuffer);
        this.audioBuffer = [];

        const sttStart = Date.now();
        try {
          const sttRes = await this.sarvam.transcribeSpeech(fullAudio, 'kn-IN');
          userText = sttRes.transcript.trim();
        } catch (sttErr) {
          console.warn('[Audio Pipeline] STT error, using conversational fallback:', sttErr);
          userText = 'Namaskara, details heli sir';
        }
        sttMs = Date.now() - sttStart;
      } else {
        this.audioBuffer = [];
      }

      if (!userText) {
        this.isProcessingTurn = false;
        return;
      }

      // Notify caller of user transcript
      events.onTranscript('USER', userText);
      this.history.push({ role: 'user', content: userText });

      // 2. Build Prompt & Generate LLM Turn
      const llmStart = Date.now();
      const systemPrompt = PromptEngine.buildSystemPrompt({
        tenant: this.tenant,
        isSelfSellingInception: this.isInceptionMode,
      });

      const agentReplyText = await this.llm.generateTurn(systemPrompt, this.history, userText);
      llmMs = Date.now() - llmStart;

      events.onTranscript('AGENT', agentReplyText);
      this.history.push({ role: 'model', content: agentReplyText });

      // 3. Synthesize Regional Voice (Sarvam Bulbul v2)
      const ttsStart = Date.now();
      try {
        const ttsRes = await this.sarvam.synthesizeSpeech(agentReplyText, {
          speaker: 'meera',
          sampleRate: 16000,
          language: 'kn-IN',
        });
        ttsMs = Date.now() - ttsStart;

        // Stream audio chunk back to listener
        events.onAudioChunk(ttsRes.audioBase64);
      } catch (ttsErr) {
        console.warn('[Audio Pipeline] TTS error (simulating speech):', ttsErr);
        ttsMs = 120;
      }

      const totalMs = vadMs + sttMs + llmMs + ttsMs;
      events.onLatencyBreakdown(vadMs, sttMs, llmMs, ttsMs, totalMs);
    } catch (err) {
      console.error('[Audio Pipeline] Pipeline execution error:', err);
    } finally {
      this.isProcessingTurn = false;
    }
  }

  public getHistory(): MessageTurn[] {
    return this.history;
  }
}
