# Conversational Kanglish Architecture

## 1. What is Kanglish?
Kanglish is not merely "Kannada with English words sprinkled in". It is the natural, fluid communicative mode spoken across urban and semi-urban Karnataka (Bengaluru, Mysuru, Hubballi-Dharwad, Ballari, Mangaluru):
- Examples:
  - `"Tomorrow doctor available iddara?"`
  - `"Root canal ge eshtu charge?"`
  - `"Appointment confirm madbahuda?"`
  - `"Clinic location WhatsApp alli send madi."`

## 2. Distinction from Pure Romanized Kannada
As defined in Prompt 10 Section 4:
- `"Naale doctor appointment ideya?"`
  - Carrier sentence is Romanized Kannada (`Naale`, `ideya`). `doctor` and `appointment` are everyday loan nouns.
  - Classified as: **Romanized Kannada (`KANNADA`)**.
- `"Tomorrow doctor appointment ideya?"`
  - Uses an English conversational time marker (`Tomorrow`) alongside Kannada verbs (`ideya`).
  - Classified as: **Kanglish (`KANGLISH`)**.

## 3. Natural Response Generation
VANNI's response planner avoids awkward textbook translations in Kanglish mode:
- **Unnatural/Robotic**: *"ನಾಳೆ ಸಂಜೆ 5 ಗಂಟೆಗೆ ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ಸ್ಲಾಟ್ ಲಭ್ಯವಿದೆ. ನೀವು ಬುಕ್ ಮಾಡಲು ಬಯಸುತ್ತೀರಾ?"*
- **Natural Kanglish**: *"Tomorrow 5 PM ge doctor available iddara. Nimma slot confirm madona?"*
