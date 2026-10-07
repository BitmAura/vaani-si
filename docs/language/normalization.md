# Conversational Normalization & Speech Repairs

## 1. Conversational Fillers Removal
Fillers are common hesitation markers that add zero semantic value:
- English fillers: `actually`, `haan`, `umm`, `uh`
- Kannada fillers: `ಹೌದು`, `ಅಂದರೆ`, `ನೋಡಿ`, `ಕಣ್ರೀ`, `ರೀ`
- Stored in `fillersRemoved` array and sanitized from the normalized text.

## 2. Self-Corrections & Conversational Repairs
Customers regularly change their mind mid-utterance:
- Example: `"Tomorrow... no, sorry, day after tomorrow."`
- The system detects the repair boundary, captures the retracted token (`"Tomorrow"`), and updates the operating utterance to `"day after tomorrow"`.
- Output: `isCorrection: true`, `correctedFrom: "Tomorrow"`.

## 3. Negation Preservation
Negation in Kannada and Kanglish must never be misinterpreted:
- Keywords: `beda` (ಬೇಡ), `alla` (ಅಲ್ಲ), `illa` (ಇಲ್ಲ), `madtilla`, `agalla`, `aagalla`, `gothilla`, `kodbeda`, `cancel`, `not`, `no`, `never`.
- Flags: `isNegation: true`.

## 4. Numbers, Currency, Dates & Times
- Currency: `₹500`, `500 rs`, `500 rupayi`, `500 rupees` -> Canonical `{ amount: 500, currency: "INR" }`.
- Dates: `naale` -> `tomorrow` (+1 day ISO), `ivathu` -> `today` (0 day ISO), `naaliddhu` -> `day after tomorrow` (+2 days ISO).
- Times: `sanje 5:30` -> `17:30`, `belagge 10` -> `10:00`.
- Ambiguity Detection: Expressions like `"5 ge"` without AM/PM or daylight context trigger `isAmbiguous: true` with clarification hints.
