# VANNI Real-Time Voice Engine Architecture

## 1. System Vision & Architecture

The **VANNI Real-Time Voice Engine** is a provider-independent, low-latency conversational audio runtime built natively on top of the VANNI Conversation Orchestration Engine.

```
+-------------------------------------------------------------------------+
|                  Microphone (Web) / Telephony Audio (Exotel)             |
+------------------------------------+------------------------------------+
                                     |
                                     v
+------------------------------------+------------------------------------+
|               Voice Session Gateway (WebSocket Transport)              |
+------------------------------------+------------------------------------+
                                     |
                                     v
+------------------------------------+------------------------------------+
|            Audio Normalizer (G.711 mulaw -> 16kHz PCM16, VAD)           |
+------------------------------------+------------------------------------+
                                     |
                                     v
+------------------------------------+------------------------------------+
|                    Turn Detector (Speech / Silence)                    |
+------------------------------------+------------------------------------+
                                     |
                                     v
+------------------------------------+------------------------------------+
|         Streaming STT (Sarvam Saaras / Mock) -> Transcript Accumulator  |
+------------------------------------+------------------------------------+
                                     |
                                     v Completed User Turn
+------------------------------------+------------------------------------+
|                VANNI Conversation Orchestration Engine                 |
|  - State Machine (IDLE -> LISTENING -> THINKING -> SPEAKING)            |
|  - Context Engine & Business Brain (Grounding & Domain Rules)           |
|  - Tool Engine (Permissions & Guardrails)                              |
|  - Kannada / Kanglish Intelligence Layer (Dialects & Transliteration)   |
|  - LLM Reasoning (Gemini Flash / Qwen Local / Mock)                     |
+------------------------------------+------------------------------------+
                                     | Approved Agent Response
                                     v
+------------------------------------+------------------------------------+
|            Response Segmenter (Clause / Sentence Splitting)             |
+------------------------------------+------------------------------------+
                                     |
                                     v
+------------------------------------+------------------------------------+
|      Streaming TTS Manager (Voice Preparation -> Sarvam Bulbul / Mock)  |
+------------------------------------+------------------------------------+
                                     | Audio Chunks (Base64 / PCM)
                                     v
+------------------------------------+------------------------------------+
|                         Caller / Browser Speaker                        |
+-------------------------------------------------------------------------+
```

---

## 2. Voice Runtime Principles

1. **Voice is a Channel, Not the Brain**: All business decisions, knowledge lookups, guardrails, and conversation states remain inside `@vanni/conversation-engine`. The voice layer never executes database mutations or LLM prompts directly.
2. **Normalized Internal Audio**: The runtime standardizes external audio (whether G.711 μ-law 8kHz from telephony or Opus/WAV from web browsers) into **16kHz 16-bit Mono PCM (LINEAR16)**.
3. **Instant Barge-In / Interruption**: When user speech is detected while the system is in `SPEAKING` state, the runtime immediately halts playback, aborts pending TTS synthesis and LLM streams, notifies the client via `INTERRUPTION`, and seamlessly records the new turn.
4. **Provider Neutrality**: STT, TTS, and LLM services are injected via `@vanni/provider-sdk` interfaces. Switching from Mock to Sarvam Saaras + Bulbul or Gemini Flash requires zero changes to core voice logic.

---

## 3. Session Lifecycle & State Transitions

Voice sessions follow an explicit finite state machine:

- `CREATED`: Initialized with metadata and tenant ownership.
- `CONNECTING` -> `CONNECTED`: WebSocket transport established.
- `LISTENING`: Awaiting caller speech or actively receiving audio frames.
- `PROCESSING`: Turn completed by turn detector; conversation orchestrator reasoning in progress.
- `SPEAKING`: Streaming synthetic speech chunks back to caller.
- `INTERRUPTED`: Caller barged in during playback; playback aborted.
- `RECONNECTING`: Brief network drop recovery.
- `ENDING` -> `ENDED`: Session terminated gracefully.
- `FAILED`: Fatal error encountered.

---

## 4. Key Sub-Modules in `@vanni/voice-engine`

- **`audio/`**: `AudioFormat`, `AudioFrame`, `AudioNormalizer` (table-driven G.711 μ-law decoding, 8k->16k linear interpolation, WAV header stripping), and `JitterBuffer` (bounded queue with backpressure drop).
- **`vad/`**: `EnergyVAD` (zero-dependency RMS energy thresholding) and `TurnDetector` (configurable silence thresholds, speech duration filtering, barge-in detection).
- **`stt/`**: `IStreamingSTTSession`, `ProviderStreamingSTTSession` (handles native bidirectional streaming or fallback audio burst buffering), and `TranscriptAccumulator` (deduplicates partial transcripts into coherent turns).
- **`tts/`**: `ResponseSegmenter` (splits streamed LLM responses into natural speech clauses) and `StreamingTTSManager` (integrates `VoiceTextPreparation` for Kannada currency, time, honorifics).
- **`session/`**: `VoiceSession`, `VoiceSessionStateMachine`, and metrics tracker (calculates turn latency, audio duration, interruption count, and p95 timings).
- **`transport/`**: `VoiceConversationChannel` (implements `IConversationChannel` from `@vanni/conversation-engine`) and `VoiceEventEnvelope` protocol.
- **`runtime/`**: `VoiceRuntime` master coordinator connecting the pipeline.
- **`mocks/`**: `MockVoiceEnvironment` for deterministic, offline testing without paid vendor APIs.

---

## 5. Security & Tenant Isolation

- Inbound WebSocket sessions validate `organizationId` and `agentId`.
- Database schema `supabase/migrations/009_realtime_voice_engine.sql` applies Row-Level Security (RLS) on `voice_sessions`, `voice_session_events`, and `voice_session_metrics`.
- Healthcare and IVF agents remain bound by orchestrator guardrails (`policies.enforceHealthcareGuardrails`, non-hallucination checks, and `TRANSFER_PENDING` escalations).
