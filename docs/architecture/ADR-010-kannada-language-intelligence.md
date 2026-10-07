# ADR-010: VANNI Kannada & Kanglish Conversation Intelligence Layer

## Status
Accepted & Implemented (Prompt 10)

## Context
VANNI is architected as a Karnataka-first conversational AI employee platform. A standard machine translation approach ("translate English into Kannada") fails catastrophically in production because real Karnataka customers communicate fluidly across native Kannada script, Romanized Kannada (Latin characters representing Kannada words), English, and conversational Kanglish (code-switching). Additionally, customers frequently use colloquial honorifics (*"avaru"*, *"-ri"*, *"-saar"*), informal domain terminology (*"Root canal ge eshtu charge?"*), conversational fillers (*"actually"*, *"ನೋಡಿ"*), and mid-sentence self-corrections.

## Decision
1. **Multi-Mode Language Architecture**: We formalized 4 primary operational language modes: `ENGLISH`, `KANNADA`, `KANNADA_ENGLISH`, and `KANGLISH`, with dynamic runtime code-switching support.
2. **Dual-Tier Language & Script Detection**: The detector analyzes both character scripts (`KANNADA`, `LATIN`, `MIXED`) and token lexicons (`ROMANIZED_KANNADA_WORDS`, `ENGLISH_LOAN_NOUNS`, and `ENGLISH_CONVERSATIONAL_WORDS`). This distinguishes Romanized Kannada (`"Naale doctor appointment ideya?"`) from Kanglish (`"Tomorrow doctor appointment ideya?"`) without relying solely on Unicode.
3. **Conversational Normalizer**: Cleans filler words without intent corruption, extracts currency (`₹500` / `500 rupayi` -> `INR 500`), canonicalizes relative dates (`naale` -> `tomorrow`), resolves times (`sanje 5:30` -> `17:30`), detects ambiguities (`5 ge` -> flagged for AM/PM clarification), and handles on-the-fly self-corrections.
4. **Canonical Terminology Mapping**: Informal spoken variants across Dental, Healthcare, IVF, Real Estate, and Hospitality are mapped to authoritative Business Brain entities with phonetic pronunciation metadata for future TTS engines.
5. **Response Language Planner**: Formulates response mode and register via strict hierarchy: Explicit Customer Preference > Turn Detected Mode > Agent Configuration > Business Default > Platform Kanglish Default.
6. **Post-Generation Linguistic Quality Validator**: Ensures output adheres to planned mode, rejects archaic textbook translations in casual Kanglish mode, and maintains healthcare non-diagnosis/real-estate factuality invariants.
7. **Regional Dialect Extensibility**: Establishes extensible profiles for 6 Karnataka regions (`KARNATAKA_GENERAL`, `BENGALURU`, `MYSURU`, `NORTH_KARNATAKA`, `COASTAL_KARNATAKA`, `HYDERABAD_KARNATAKA`).
8. **Permanent 126-Case Golden Evaluation Suite**: Maintained as an automated regression benchmark achieving 100% verified accuracy.

## Consequences
- The orchestration runtime natively understands how Karnataka customers speak and write in text or voice.
- Zero dependency on external STT, TTS, or LLM providers; entirely modular pure TypeScript implementation.
- Provides clean contracts for Prompt 11+ Realtime Voice and Telephony Audio Stream integration.
