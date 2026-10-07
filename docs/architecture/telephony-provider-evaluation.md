# Telephony Provider Evaluation for VANNI (Indian Market)

## 1. Provider Comparison Matrix

| Evaluation Criteria | Exotel (Selected for India) | Twilio (Global Standard) | Plivo |
| :--- | :--- | :--- | :--- |
| **India Local PSTN / DID Numbers** | **Native Tier-1 Telecom Partnerships** in Bangalore, Delhi, Mumbai, Hyderabad | Available via regulatory bundle (higher friction) | Limited local CLI support |
| **WebSockets & Bidirectional Streaming** | Supported via Exotel Voice Streams (TwiML / JSON Stream) | Twilio Media Streams (WebSocket / G.711 μ-law) | Plivo AudioStream |
| **PSTN Call Audio Codec** | G.711 μ-law / 8kHz mono | G.711 μ-law / 8kHz mono | G.711 μ-law / 8kHz mono |
| **Kannada TTS / STT Path** | Compatible via WebSocket audio bridge to Sarvam Saaras | Compatible via WebSocket audio bridge to Sarvam Saaras | Compatible |
| **Call Transfer Support** | Yes (Warm / Cold PSTN Transfer via XML/API) | Yes (SIP / PSTN Dial Transfer) | Yes |
| **TRAI / DoT Compliance in India** | Strict compliance with Indian telecom regulations & DND registry | Global compliance; requires specialized Indian DID documentation | Compliant |
| **Pricing for Local Indian Calling** | Cost-effective domestic INR pricing (~₹0.40 - ₹0.60 / min) | Higher USD rates + regulatory surcharge | Moderate |

---

## 2. Decision Record (ADR-004)

- **Selected Primary Provider for India**: **Exotel**
  - Native presence in Karnataka and pan-India local landline / mobile numbers (+91 80...).
  - Full support for real-time bidirectional WebSocket media streams.
- **Scaffolding & Mocking**: Both `ExotelTelephonyProvider` and `MockTelephonyProvider` implement `ITelephonyProvider`.
- **Production Credentials Notice**: When `EXOTEL_ACCOUNT_SID` and `EXOTEL_API_KEY` are not configured in `.env`, the system safely falls back to `MockTelephonyProvider` with complete fidelity, preventing spurious live connection attempts while keeping local test harnesses fully functional.
