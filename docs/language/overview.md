# VANNI Language Intelligence Layer — Architectural Overview

## 1. Karnataka-First Philosophy
VANNI is architected from the ground up as a **Karnataka-first conversational AI employee platform**.
The core design principle is:
> **The goal is NOT to translate textbook English into robotic textbook Kannada. The goal is to deeply understand how real people in Karnataka naturally communicate — across native Kannada script, Romanized Kannada, English, and natural conversational Kanglish.**

## 2. Core Processing Pipeline
The Language Intelligence layer sits directly between incoming speech/text gateways and the central `ConversationOrchestrator`:

```
Customer Utterance
       │
       ▼
1. Language & Script Detection (Unicode Script + Dual-Lexicon Analysis)
       │
       ▼
2. Language Normalization (Fillers, Self-Corrections, Negation, Ambiguity)
       │
       ▼
3. Terminology & Business Entity Resolution (Canonical Brain Mapping)
       │
       ▼
4. Response Language Planning (Priority: Customer > Turn > Agent > Platform)
       │
       ▼
5. Context Assembly & LLM Reasoning (Language Instructions & Grounded Knowledge)
       │
       ▼
6. Post-Generation Quality & Safety Validation (Script Check, Non-Diagnosis Invariant)
       │
       ▼
7. Voice Text Preparation (Acoustic Number, Time & Currency Expansion)
```

## 3. Decoupling & Independence
The Language Intelligence layer is completely decoupled from:
- STT Providers (Sarvam, Whisper, Google, AssemblyAI)
- TTS Providers (Sarvam, ElevenLabs, Azure, Coqui)
- Telephony & Audio Transport (Exotel, Twilio, WebRTC, SIP)
- LLM Providers (OpenAI, Gemini, Anthropic, DeepSeek, Local models)

All operations are deterministic, sub-millisecond in-memory pipelines suitable for real-time telephony latencies.
