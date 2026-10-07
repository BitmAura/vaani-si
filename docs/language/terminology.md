# Domain & Business Terminology System

## 1. Canonical Terminology Resolution
Informal spoken variants across Kannada, English, and Kanglish are dynamically mapped to authoritative Business Brain entities without requiring textbook phrasing:

| Domain | Spoken Variant | Canonical Business Entity | ID |
| :--- | :--- | :--- | :--- |
| **Dental** | `"Root canal ge"`, `"RCT"`, `"ರೂಟ್ ಕೆನಾಲ್"` | `Root Canal Treatment` | `srv_root_canal` |
| **Dental** | `"Teeth cleaning"`, `"Scaling"`, `"ಹಲ್ಲು ಕ್ಲೀನಿಂಗ್"` | `Dental Cleaning & Scaling` | `srv_dental_cleaning` |
| **Healthcare** | `"Doctor consultation"`, `"ಡಾಕ್ಟರ್ ಕನ್ಸಲ್ಟೇಶನ್"` | `OPD Doctor Consultation` | `srv_doctor_consult` |
| **Healthcare** | `"Physio"`, `"ಫಿಸಿಯೋಥೆರಪಿ"` | `Physiotherapy Session` | `srv_physio` |
| **Real Estate** | `"Site visit"`, `"Free cab"`, `"ಸೈಟ್ ವಿಸಿಟ್"` | `Site Visit & Cab Pickup` | `srv_site_visit` |
| **Real Estate** | `"3bhk"`, `"three bhk"`, `"3 ಬೆಡ್‌ರೂಮ್"` | `3BHK Luxury Residence` | `prop_3bhk` |
| **Hospitality** | `"Room booking"`, `"ರೂಮ್ ಬುಕಿಂಗ್"` | `Room Reservation` | `srv_room_booking` |
| **Hospitality** | `"Early check-in"`, `"ಬೇಗ ಚೆಕ್ ಇನ್"` | `Early Check-in` | `pol_early_checkin` |

## 2. Pronunciation Metadata
For text-to-speech adapters, each entity record optionally defines phonetic annotations:
```typescript
interface PronunciationMetadataDTO {
  displayText: string;
  spokenTextKannada: string;
  spokenTextEnglish: string;
  phoneticHint?: string;
}
```
