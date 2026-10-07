# ADR-002: Provider-Independent Abstraction Layer (Zero Vendor Lock-In)

## Status
**ACCEPTED**

## Context
Voice AI infrastructure is evolving at an unprecedented pace. Today's top Kannada TTS (Sarvam Bulbul v2) or fast LLM (Gemini 1.5 Flash / Qwen 2.5) may be eclipsed by newer models within 6 months.
Directly importing vendor SDKs into business logic binds the startup to external vendor roadmaps, price increases, and potential outages.

## Decision
We decouple all external infrastructure behind abstract TypeScript provider interfaces:
1. `ISTTProvider`: Implemented by `SarvamSaarasAdapter`, `WhisperLocalAdapter`, `DeepgramAdapter`.
2. `ITTSProvider`: Implemented by `SarvamBulbulAdapter`, `KokoroLocalAdapter`, `ElevenLabsAdapter`.
3. `ILLMProvider`: Implemented by `GeminiFlashAdapter`, `QwenLocalAdapter`, `OpenAIAdapter`, `GroqAdapter`.
4. `ITelephonyProvider`: Implemented by `ExotelAdapter`, `TwilioAdapter`, `TataTelephonyAdapter`, `BrowserWebRTCAdapter`.
5. `IMessagingProvider`: Implemented by `WhatsAppCloudAdapter`, `GupshupAdapter`, `InteraktAdapter`.

All conversational state machines and tool dispatch engines communicate exclusively through these contracts.

## Consequences
### Positive
- A customer or deployment can switch between Sarvam Cloud, Local Qwen 2.5 on-premise, or Gemini without changing a single line of conversation logic.
- Testing is effortless: mock providers can simulate any network latency, audio drop, or STT error rate in CI.
- Resilience: If a provider suffers an outage, the system can automatically fail over to an alternate provider in sub-100ms.

### Negative / Trade-offs
- Writing adapters requires maintaining normalization code for audio sample rates (e.g. 8kHz PCM for telephony vs 16/24kHz for web).
