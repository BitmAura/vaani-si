# Natural Kannada Language Support

## 1. Native Kannada Script (Unicode `\u0C80-\u0CFF`)
VANNI provides first-class support for native Kannada script text:
- Examples: `"ನಾಳೆ ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ಸಿಗುತ್ತಾ?"`, `"ಕ್ಲಿನಿಕ್ ಎಲ್ಲಿ ಇದೆ?"`, `"ಡಾಕ್ಟರ್ ಯಾವ ಸಮಯಕ್ಕೆ ಇರುತ್ತಾರೆ?"`
- Unicode integrity is guaranteed end-to-end across database storage, API JSON serialization, prompt injection, and browser UI rendering without character encoding distortion.

## 2. Romanized Kannada
In digital chat and speech transcripts across Karnataka, users predominantly type Kannada using the Latin alphabet (Romanized Kannada):
- Examples: `"Naale appointment ideya?"`, `"Doctor yava time ge irtare?"`, `"Nange 5 PM ge appointment beku."`
- VANNI detects Romanized Kannada by analyzing a dedicated core lexicon of Kannada interrogatives (`yelli`, `yavaga`, `eshtu`), relative temporal markers (`naale`, `ivathu`), auxiliaries (`beku`, `beda`, `ideya`, `sigutta`), and verbal suffixes (`-ge`, `-inda`, `-alli`).
- The system preserves the original customer wording without aggressive mechanical translation to textbook Kannada script before reasoning.

## 3. Conversational Registers & Respect
Kannada conversation relies heavily on respectful honorifics and situational registers:
- `FORMAL`: High-respect, used for senior dignitaries and formal institutional letters.
- `PROFESSIONAL` (Default for Healthcare & Legal): Respectful communicative tone utilizing *"Nimma"* and *"Avaru"* without robotic verbosity.
- `FRIENDLY` (Default for Hospitality & Retail): Warm, courteous interaction.
- `CASUAL`: Conversational everyday tone for modern youth-oriented brands.
