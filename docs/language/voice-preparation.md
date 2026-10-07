# Voice & Speech Text Preparation Layer

## 1. Visual Display vs Acoustic Speech Text
A vital architectural principle in conversational voice AI is distinguishing between **Visual Display Text** (what appears on a screen or WhatsApp chat) and **Acoustic Spoken Text** (what a TTS model speaks over telephony):

- **Example 1 (Currency)**:
  - Display Text: `₹1,500`
  - Spoken Kannada: `ಒಂದು ಸಾವಿರದ ಐದು ನೂರು ರೂಪಾಯಿ` (or `1500 ರೂಪಾಯಿ`)
  - Spoken English: `one thousand five hundred rupees`
- **Example 2 (Medical Abbreviations)**:
  - Display Text: `Dr. Ravi in OPD`
  - Spoken Kannada: `ಡಾಕ್ಟರ್ ರವಿ ಒ ಪಿ ಡಿ ಯಲ್ಲಿ`
  - Spoken English: `Doctor Ravi in O P D`
- **Example 3 (Real Estate Units)**:
  - Display Text: `3BHK flat at 85 Lakhs`
  - Spoken Kannada: `3 ಬಿ ಎಚ್ ಕೆ ಫ್ಲಾಟ್ 85 ಲಕ್ಷ ರೂಪಾಯಿ`
  - Spoken English: `3 B H K flat at 85 lakh rupees`

## 2. TTS Provider Decoupling
The `VoiceTextPreparation` class performs pre-synthesis text expansion deterministically in TypeScript, ensuring that any downstream STT/TTS provider (Sarvam, ElevenLabs, Azure, Google Cloud TTS) receives clean, acoustically unambiguous text.
