# Language Detection Engine

## 1. Dual-Tier Detection Architecture
VANNI never relies solely on Unicode script ranges to classify language. Real-world user input from WhatsApp or speech recognition frequently arrives in Latin characters even when the customer is speaking pure Kannada.

The `LanguageDetector` evaluates input via two complementary tiers:
1. **Unicode Script Character Analysis**:
   - `kannadaCharCount` (`[\u0C80-\u0CFF]`)
   - `latinCharCount` (`[a-zA-Z]`)
   - Script classified as `KANNADA`, `LATIN`, or `MIXED`.
2. **Token Lexicon & Loan Noun Analysis**:
   - Compares token stems against:
     - `ROMANIZED_KANNADA_WORDS`: 100+ high-frequency Kannada core functional words (`beku`, `beda`, `eshtu`, `yavaga`, `naale`, `ivathu`, `ideya`, `agutte`, `sigutta`, etc.).
     - `ENGLISH_LOAN_NOUNS`: Words like `doctor`, `clinic`, `appointment`, `time`, `bill` that function as everyday loan nouns in Kannada speech.
     - `ENGLISH_CONVERSATIONAL_WORDS`: Active English conversational verbs, time markers, and adverbs (`tomorrow`, `available`, `cancel`, `confirm`, `actually`, `please`).

## 2. Structured Output DTO
```typescript
interface LanguageDetectionResult {
  primaryLanguage: 'ENGLISH' | 'KANNADA' | 'KANNADA_ENGLISH' | 'KANGLISH' | 'UNKNOWN';
  secondaryLanguage?: LanguageMode;
  confidence: number;
  script: 'KANNADA' | 'LATIN' | 'MIXED';
  isRomanizedKannada: boolean;
  codeSwitchRatio: number;
  tokens?: Array<{ word: string; script: string; language: string }>;
}
```
