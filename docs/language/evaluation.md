# Kannada & Kanglish Evaluation Suite (126 Golden Test Cases)

## 1. Overview
VANNI includes an exhaustive, permanent evaluation suite containing **126 structured test cases** across 14 distinct categories:

1. **Basic Greetings** (10 test cases): Formal Kannada, casual greetings, Kanglish salutations.
2. **Appointments & Scheduling** (15 test cases): Date/time queries, doctor availability, slot bookings.
3. **Pricing & Billing** (10 test cases): Procedure fees, plot per-sqft costs, room rates.
4. **Operating Hours & Timings** (10 test cases): Clinic opening, closing times, weekend shifts.
5. **Location & Directions** (10 test cases): Address inquiries, landmarks, bypass road branches.
6. **Cancellations & Rescheduling** (10 test cases): Cancellation requests, postponements, negations.
7. **Human Escalation Requests** (8 test cases): Receptionist, manager, and doctor transfers.
8. **Complaints & Dissatisfaction** (7 test cases): Long wait times, billing issues, poor service.
9. **Code-Switching & Kanglish** (10 test cases): Rapid inter-sentential and intra-sentential switches.
10. **Pure Romanized Kannada** (10 test cases): Everyday Kannada typed using the English alphabet.
11. **Numbers, Currency, Dates, Times** (10 test cases): Spoken numbers, currency units, relative dates.
12. **Negations & Short Affirmations** (10 test cases): Short answers (*"Beda"*, *"Haudu"*, *"Adhe sari"*).
13. **Self-Corrections & Repairs** (6 test cases): Retractions and on-the-fly corrections.
14. **Vertical Industry Scenarios** (10 test cases): Dental, Healthcare, Real Estate, Hospitality.

## 2. Benchmark Execution
The evaluation suite runs both locally via unit tests and remotely over HTTP via:
- Local Test: `node scratch/test-kannada-language-engine.mjs`
- API Endpoint: `POST /api/language/evaluation/run`
- Current Verified Accuracy: **126 / 126 (100.0%)**
