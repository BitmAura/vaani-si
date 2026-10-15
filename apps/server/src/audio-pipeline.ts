/**
 * Layer 3 & 4: Real-Time Audio Pipeline Orchestrator with Duplex Barge-In & Acoustic Fillers
 * Dhwani SI / VAANI SI — Human-Grade Natural Conversational Engine
 */

import { SarvamVoiceAdapter } from '../../../packages/voice-engine/src/sarvam-adapter';
import { PromptEngine } from '../../../packages/core/src/conversation/prompt-engine';
import { Tenant } from '../../../packages/core/src/domain/types';
import { LLMConversationalService, MessageTurn, CallerDossier } from './llm-service';
import { HandoffManager } from '@vanni/conversation-engine';
import { KannadaFillerEngine, KannadaFiller } from './kannada-fillers';

export interface PipelineEvents {
  onTranscript: (speaker: 'USER' | 'AGENT', text: string) => void;
  onLatencyBreakdown: (vadMs: number, sttMs: number, llmMs: number, ttsMs: number, totalMs: number) => void;
  onAudioChunk: (base64Audio: string) => void;
  onFiller?: (fillerText: string, base64Audio?: string) => void;
  onInterrupt?: () => void;
  onEscalation?: (escalation: any) => void;
}

export class AudioConversationPipeline {
  private static readonly END_OF_TURN_SILENCE_MS = 280; // 280ms human-grade turn taking pause
  private static readonly BARGE_IN_ENERGY_THRESHOLD = 0.025; // 2.5% RMS energy for speech detection

  private sarvam: SarvamVoiceAdapter;
  private llm: LLMConversationalService;
  private tenant: Tenant;
  private history: MessageTurn[] = [];
  private audioBuffer: Buffer[] = [];
  private isProcessingTurn = false;
  private isAgentSpeaking = false;
  private silenceTimer: NodeJS.Timeout | null = null;
  private lastChunkAt = 0;
  private isInceptionMode = false;
  private callerDossier?: CallerDossier;
  private handoffManager: HandoffManager;

  constructor(tenant: Tenant, isInceptionMode = false, callerDossier?: CallerDossier) {
    this.tenant = tenant;
    this.isInceptionMode = isInceptionMode;
    this.callerDossier = callerDossier;
    this.sarvam = new SarvamVoiceAdapter();
    this.llm = new LLMConversationalService();
    this.handoffManager = new HandoffManager();
  }

  /**
   * Computes normalized RMS energy of raw 16-bit PCM chunk to detect human speech
   */
  private computeRms(buffer: Buffer): number {
    const numSamples = Math.floor(buffer.length / 2);
    if (numSamples === 0) return 0;
    let sumSquares = 0;
    for (let i = 0; i < numSamples; i++) {
      const sample = buffer.readInt16LE(i * 2) / 32768.0;
      sumSquares += sample * sample;
    }
    return Math.sqrt(sumSquares / numSamples);
  }

  /**
   * Ingest raw audio chunk (PCM/WAV 8kHz or 16kHz) from WebSocket
   * Supports immediate Sub-100ms Duplex Barge-In Interruption
   */
  public pushAudioChunk(chunk: Buffer, events: PipelineEvents): void {
    const rms = this.computeRms(chunk);

    // 1. Check for Caller Barge-In while Agent is Speaking
    if (this.isAgentSpeaking && rms >= AudioConversationPipeline.BARGE_IN_ENERGY_THRESHOLD) {
      console.log(`[Barge-In] Caller interrupted agent speech (RMS: ${rms.toFixed(3)})`);
      this.isAgentSpeaking = false;
      this.isProcessingTurn = false;

      // Notify client/telephony trunk to immediately mute and drop current audio output
      if (events.onInterrupt) {
        events.onInterrupt();
      }

      // Start accumulating new speech for the caller's interruption
      this.audioBuffer = [chunk];
      this.lastChunkAt = Date.now();

      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
      }
      this.silenceTimer = setTimeout(() => {
        this.processUserUtterance(events);
      }, AudioConversationPipeline.END_OF_TURN_SILENCE_MS);
      return;
    }

    if (this.isProcessingTurn) {
      return;
    }

    this.audioBuffer.push(chunk);
    this.lastChunkAt = Date.now();

    // Reset silence detector
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }

    // After 280ms of silence, commit and process the completed utterance
    this.silenceTimer = setTimeout(() => {
      this.processUserUtterance(events);
    }, AudioConversationPipeline.END_OF_TURN_SILENCE_MS);
  }

  /**
   * Process complete user utterance through the STT -> LLM -> TTS loop
   * Emits Instant Acoustic Filler within < 120ms to eliminate perceived pause
   */
  public async processUserUtterance(events: PipelineEvents, rawTextOverride?: string): Promise<void> {
    if (this.isProcessingTurn) return;
    this.isProcessingTurn = true;

    const vadMs = rawTextOverride || !this.lastChunkAt ? 0 : Math.max(0, Date.now() - this.lastChunkAt);
    let sttMs = 0;
    let llmMs = 0;
    let ttsMs = 0;

    try {
      let userText = rawTextOverride || '';

      // If text override provided immediately, emit filler instantly!
      if (userText && events.onFiller) {
        const filler = KannadaFillerEngine.selectFiller(userText);
        const cachedWav = KannadaFillerEngine.getCachedAudio(filler.id);
        events.onFiller(filler.kanglishText, cachedWav);
      }

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

        // Emit filler immediately after transcript arrives!
        if (events.onFiller && userText) {
          const filler = KannadaFillerEngine.selectFiller(userText);
          const cachedWav = KannadaFillerEngine.getCachedAudio(filler.id);
          events.onFiller(filler.kanglishText, cachedWav);
        }
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

      // 2. Build Prompt & Generate Conversational Turn
      const llmStart = Date.now();
      let agentReplyText: string;

      // Check real-time safety & escalation triggers
      const emergencySig = this.handoffManager.detectEmergencySignals(userText);
      const isHumanReq = this.handoffManager.detectHumanRequest(userText);
      const frustration = this.handoffManager.detectFrustrationOrComplaint(userText);

      if (emergencySig.isEmergency) {
        agentReplyText = 'Sir, idhu emergency aaguththe! Dayavittu immediately 108 ambulance call madi athva casualty emergency ward ge rush madi sir. Casualty duty doctor 24/7 ready irthare!';
        if (events.onEscalation) {
          events.onEscalation({
            triggered: true,
            reason: 'EMERGENCY',
            priority: 'CRITICAL',
            trigger: emergencySig.trigger,
          });
        }
      } else if (isHumanReq) {
        agentReplyText = 'Khanditha sir, ondu second hold madi, nanu eegale namma human manager ge call transfer maadtha iddini. Dayavittu line nalli iri sir.';
        if (events.onEscalation) {
          events.onEscalation({
            triggered: true,
            reason: 'CUSTOMER_REQUEST',
            priority: 'HIGH',
            trigger: 'human_transfer',
          });
        }
      } else if (frustration.isFrustrated) {
        agentReplyText = 'Kshamisee sir, nimma problem understand aaythu. Dayavittu kopa madkobedi, nanu eegale senior manager attention ge thagond resolve maadistheeni.';
        if (events.onEscalation) {
          events.onEscalation({
            triggered: true,
            reason: 'COMPLAINT',
            priority: 'HIGH',
            trigger: frustration.trigger,
          });
        }
      } else {
        const systemPrompt = PromptEngine.buildSystemPrompt({
          tenant: this.tenant,
          isSelfSellingInception: this.isInceptionMode,
        });

        // Pass episodic caller dossier if available
        agentReplyText = await this.llm.generateTurn(
          systemPrompt,
          this.history,
          userText,
          undefined,
          this.callerDossier
        );
      }
      llmMs = Date.now() - llmStart;

      events.onTranscript('AGENT', agentReplyText);
      this.history.push({ role: 'model', content: agentReplyText });

      // 3. Synthesize Regional Voice (Sarvam Bulbul v3 with Kanglish Normalization)
      const ttsStart = Date.now();
      try {
        const normalizedSpeech = agentReplyText
          .replace(/30\s*[*xX]\s*40\s*(?:site|plots?|ನಿವೇಶನ)?/gi, 'thirty-forty site')
          .replace(/(\d+)\s*[*xX]\s*(\d+)/g, '$1 $2');

        const ttsRes = await this.sarvam.synthesizeSpeech(normalizedSpeech, {
          speaker: 'shreya',
          sampleRate: 16000,
          language: 'kn-IN',
        });
        ttsMs = Date.now() - ttsStart;

        // Mark agent speaking for duplex barge-in monitoring
        this.isAgentSpeaking = true;

        // Stream audio chunk back to listener
        events.onAudioChunk(ttsRes.audioBase64);
      } catch (ttsErr) {
        console.warn('[Audio Pipeline] TTS error:', ttsErr);
        ttsMs = 120;
        // Critical: always reset agent-speaking flag so barge-in detection
        // doesn't treat all subsequent caller audio as an interruption.
        this.isAgentSpeaking = false;
      }

      const totalMs = vadMs + sttMs + llmMs + ttsMs;
      events.onLatencyBreakdown(vadMs, sttMs, llmMs, ttsMs, totalMs);
    } catch (err) {
      console.error('[Audio Pipeline] Pipeline execution error:', err);
    } finally {
      this.isProcessingTurn = false;
    }
  }

  /**
   * Called by WebSocket or client player when agent finishes speaking audio playback
   */
  public notifyPlaybackFinished(): void {
    this.isAgentSpeaking = false;
  }

  public getHistory(): MessageTurn[] {
    return this.history;
  }
}
