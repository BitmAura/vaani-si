# Dhwani SI — Complete API Keys & Industry Deployment Guide

**Document Version:** 1.0  
**Last Updated:** October 6, 2026

---

## 🔑 Required API Keys Overview

### **TIER 1: ESSENTIAL (Must Have for Basic Demo)**

| API Key | Provider | Purpose | Free Tier | Production Cost |
|---------|----------|---------|-----------|-----------------|
| `SARVAM_API_KEY` | Sarvam AI | Kannada STT/TTS | 1 hour/month free | ₹15,000/month (2M chars) |
| `GEMINI_API_KEY` | Google AI | LLM dialogue | 60 requests/min free | ₹2,500/month (1M tokens) |
| `SUPABASE_URL` | Supabase | Database + Auth | 500MB free | $25/month (8GB) |
| `SUPABASE_ANON_KEY` | Supupabase | Client access | Included | Included |

**Minimum Cost for Demo:** FREE (with free tiers)  
**Minimum Cost for Production:** ~₹17,500/month (~$210/month)

---

### **TIER 2: PRODUCTION TELEPHONY (Required for Phone Calls)**

| API Key | Provider | Purpose | Cost |
|---------|----------|---------|------|
| `EXOTEL_ACCOUNT_SID` | Exotel | SIP trunk account | ₹999/month per DID |
| `EXOTEL_API_KEY` | Exotel | API authentication | Included |
| `EXOTEL_API_TOKEN` | Exotel | API token | Included |
| `EXOTEL_CALLER_ID` | Exotel | Virtual phone number | ₹999/month |
| `COOKIE_SECRET` | Self-generated | Session encryption | FREE |

**Telephony Cost:** ₹0.85/minute + ₹999/month per phone number

---

### **TIER 3: BUSINESS ENHANCEMENT (Optional but Recommended)**

| API Key | Provider | Purpose | Cost |
|---------|----------|---------|------|
| `WHATSAPP_API_TOKEN` | Meta | Lead delivery to WhatsApp | ₹0.0065/conversation |
| `WHATSAPP_PHONE_ID` | Meta | WhatsApp Business number | ₹0.0065/conversation |
| `RAZORPAY_KEY_ID` | Razorpay | Subscription billing | 2% per transaction |
| `RAZORPAY_KEY_SECRET` | Razorpay | Payment auth | Included |
| `GROQ_API_KEY` | Groq | Fast LLM (alternative to Gemini) | FREE tier: 14M tokens/month |
| `OPENAI_API_KEY` | OpenAI | GPT-4 (premium quality) | $0.03/1K tokens |

---

## 🏭 Industry-Specific Deployment Plans

### **Industry 1: Real Estate Layout Developers** 🏗️

**Target Customers:** Ballari, Hospet, Vijayapura, Kalaburagi region plot sellers

#### **Required APIs**
- ✅ Sarvam AI (Kanglish dialect: `KANGLISH_BUSINESS`)
- ✅ Gemini Flash (real estate guardrails enabled)
- ✅ Exotel (outbound calls to plot seekers)
- ✅ WhatsApp Business (site visit booking confirmations)
- ⚠️ Razorpay (optional: for token advance collection)

#### **Domain-Specific Knowledge Required**
```json
{
  "industry": "REAL_ESTATE",
  "dialect": "KANGLISH_BUSINESS",
  "guardrails": {
    "enforceRealEstateGuardrails": true,
    "enforceSalesGuardrails": true
  },
  "knowledge": {
    "plotSizes": ["30x40", "40x60", "50x80"],
    "priceRange": "₹18L - ₹45L",
    "approvals": ["BUDA", "DC Converted", "RERA"],
    "banks": ["SBI", "HDFC", "ICICI", "Canara Bank"],
    "siteVisitDays": ["Sunday", "Saturday"],
    "freeCabOffered": true
  },
  "faqs": [
    "Plots ge bank loan siguththe alva?",
    "Sunday site visit ideya?",
    "DC Converted certificate ideya?",
    "Token amount eshtu?"
  ]
}
```

#### **Conversation Flow**
```
1. Greeting: "Namaskara sir! Ballari Residential Layouts ge swagatha."
2. Qualify: "Site size yavudu beku sir? 30x40 athva 40x60?"
3. Budget Check: "Budget eshtu ide sir? Bank loan factor madthira?"
4. Site Visit: "Sunday 11 AM ge free cab pickup ide. Confirm madla?"
5. WhatsApp: Send location map + brochure
```

#### **Cost Estimate (Monthly)**
- Telephony: 100 calls × 3 min × ₹0.85 = ₹255
- STT/TTS: 300 minutes × ₹50/min = ₹15,000
- LLM: 1M tokens = ₹2,500
- **Total: ~₹18,000/month for 100 calls**

---

### **Industry 2: Multi-Specialty Hospitals** 🏥

**Target Customers:** Apollo, Manipal, Narayana clinics in Karnataka

#### **Required APIs**
- ✅ Sarvam AI (Kannada Standard Polite: `KANNADA_STANDARD_POLITE`)
- ✅ Gemini Flash (healthcare guardrails CRITICAL)
- ✅ Exotel (appointment reminders, OPD bookings)
- ✅ WhatsApp (prescription delivery, appointment confirmations)
- ✅ Cal.com integration (doctor slot availability)

#### **Domain-Specific Knowledge Required**
```json
{
  "industry": "HEALTHCARE_HOSPITAL",
  "dialect": "KANNADA_STANDARD_POLITE",
  "guardrails": {
    "enforceHealthcareGuardrails": true,
    "noHallucinationEnforced": true,
    "medicalDisclaimers": true
  },
  "knowledge": {
    "departments": ["Cardiology", "Orthopedics", "Pediatrics", "General Medicine"],
    "doctors": [
      {
        "name": "Dr. Ramesh Patil",
        "specialty": "Cardiology",
        "timings": "Mon-Sat 10 AM - 1 PM, 5 PM - 8 PM",
        "fee": "₹750"
      }
    ],
    "facilities": ["OPD", "Emergency 24x7", "Pharmacy", "Lab"],
    "insuranceAccepted": ["Star Health", "ICICI Lombard", "Cashless TPA"]
  },
  "faqs": [
    "OPD fee eshtu?",
    "Dr. Ramesh avaru yaavaga irthare?",
    "Insurance cashless siguththa?",
    "Emergency number yavadu?"
  ]
}
```

#### **Conversation Flow**
```
1. Greeting: "Namaskara! Apollo Specialty Clinic ge nimage swagatha."
2. Symptom Check: "Yavaga inda ondu problem ideya? Doctor consultation beka?"
3. Doctor Selection: "Dr. Ramesh Patil avaru cardiology specialist. Naale 10 AM slot ide."
4. Appointment: "Name heli sir, phone number confirm madli."
5. WhatsApp: Send appointment confirmation + clinic location
```

#### **Critical Guardrails**
- ❌ Cannot diagnose medical conditions
- ❌ Cannot recommend specific medicines
- ❌ Cannot replace doctor consultation
- ✅ Can book appointments
- ✅ Can share doctor availability
- ✅ Can answer general hospital queries

#### **Cost Estimate (Monthly)**
- Telephony: 200 calls × 4 min × ₹0.85 = ₹680
- STT/TTS: 800 minutes × ₹50/min = ₹40,000
- LLM: 2M tokens = ₹5,000
- **Total: ~₹46,000/month for 200 calls**

---

### **Industry 3: Automobile Dealerships** 🚗

**Target Customers:** Maruti, Hyundai, Tata, Honda dealers in Karnataka

#### **Required APIs**
- ✅ Sarvam AI (Kanglish colloquial)
- ✅ Gemini Flash (sales guardrails enabled)
- ✅ Exotel (test drive scheduling, follow-ups)
- ✅ WhatsApp (car brochures, price quotes)
- ⚠️ Razorpay (optional: booking amount collection)

#### **Domain-Specific Knowledge Required**
```json
{
  "industry": "AUTOMOTIVE_DEALER",
  "dialect": "KANGLISH_COLLOQUIAL",
  "knowledge": {
    "brands": ["Maruti Suzuki", "Hyundai", "Tata Motors", "Honda"],
    "models": {
      "Maruti": ["Swift", "Baleno", "Dzire", "Brezza", "Creta"],
      "Hyundai": ["i20", "Venue", "Creta", "Verna"],
      "Tata": ["Nexon", "Punch", "Harrier", "Safari"]
    },
    "priceRange": {
      "Swift": "₹6.5L - ₹9.5L",
      "Creta": "₹11L - ₹18L",
      "Nexon": "₹8L - ₹14L"
    },
    "finance": {
      "emiStarting": "₹8,500/month",
      "banks": ["HDFC", "ICICI", "SBI", "Kotak"],
      "downPayment": "10-20%"
    },
    "testDriveDays": ["Saturday", "Sunday"],
    "exchangeBonus": "Up to ₹50,000"
  }
}
```

#### **Conversation Flow**
```
1. Greeting: "Namaskara! Maruti Suzuki Ballari showroom ge swagatha."
2. Model Interest: "Yava car model beku sir? Swift athva Creta?"
3. Budget Discussion: "Budget eshtu ide? EMI option idya, ₹8,500/month starting."
4. Test Drive: "Sunday test drive book madla? Home test drive ide!"
5. WhatsApp: Send brochure + EMI calculator + location
```

#### **Cost Estimate (Monthly)**
- Telephony: 150 calls × 5 min × ₹0.85 = ₹637
- STT/TTS: 750 minutes × ₹50/min = ₹37,500
- LLM: 1.5M tokens = ₹3,750
- **Total: ~₹42,000/month for 150 calls**

---

### **Industry 4: Dental Clinics** 🦷

**Target Customers:** Single/multi-chair dental clinics in Karnataka

#### **Required APIs**
- ✅ Sarvam AI (Kannada polite)
- ✅ Gemini Flash (healthcare guardrails - dental specific)
- ✅ Exotel (appointment scheduling)
- ✅ WhatsApp (appointment reminders, before/after photos)

#### **Domain-Specific Knowledge Required**
```json
{
  "industry": "HEALTHCARE_DENTAL",
  "dialect": "KANNADA_STANDARD_POLITE",
  "knowledge": {
    "services": [
      "Root Canal Treatment (RCT)",
      "Dental Implants",
      "Teeth Cleaning (Scaling)",
      "Braces/Aligners",
      "Teeth Whitening",
      "Extractions"
    ],
    "doctors": [
      {
        "name": "Dr. Sneha Rao",
        "specialty": "Root Canal Specialist",
        "experience": "12 years",
        "fee": "₹500 - ₹3,000"
      }
    ],
    "timings": "Mon-Sat 10 AM - 8 PM, Sunday Emergency Only",
    "facilities": ["Digital X-Ray", "Root Canal Microscope", "Painless Extraction"]
  },
  "faqs": [
    "Root canal cost eshtu?",
    "Implants safe na?",
    "Teeth cleaning pain barutha?",
    "Sunday open idya?"
  ]
}
```

#### **Conversation Flow**
```
1. Greeting: "Namaskara! Kavya Dental Clinic inda mathadtha iddini."
2. Problem Identification: "Yav dental problem ideya sir? Tooth pain athva cleaning beka?"
3. Doctor Assignment: "Dr. Sneha Rao avaru RCT specialist. Naale 4 PM slot ide."
4. Cost Transparency: "RCT charge ₹2,500 - ₹3,500. Insurance cashless siguththe."
5. WhatsApp: Send appointment + clinic photos + doctor profile
```

#### **Cost Estimate (Monthly)**
- Telephony: 80 calls × 3 min × ₹0.85 = ₹204
- STT/TTS: 240 minutes × ₹50/min = ₹12,000
- LLM: 0.8M tokens = ₹2,000
- **Total: ~₹14,500/month for 80 calls**

---

### **Industry 5: IVF & Fertility Centers** 👶

**Target Customers:** Morpheus, Milann, Nova IVF clinics in Karnataka

#### **Required APIs**
- ✅ Sarvam AI (Kannada sensitive/empathetic tone)
- ✅ Gemini Flash (healthcare guardrails - fertility specific)
- ✅ Exotel (appointment scheduling)
- ✅ WhatsApp (treatment info, success stories)

#### **Critical Sensitivity Requirements**
- Must use empathetic, non-judgmental language
- Cannot guarantee pregnancy success
- Must encourage in-person consultation
- Privacy protection for patient data
- Emotional support tone in conversations

#### **Conversation Flow**
```
1. Greeting: "Namaskara. Milann IVF Center ge nimage swagatha."
2. Empathetic Listening: "Nimage yav support bekodu heli, help madthini."
3. Information Sharing: "IVF treatment details WhatsApp madli? Doctor consultation booking help madla?"
4. Privacy: "Nim personal details confidentialagi maintain aaguththe."
5. Appointment: "Dr. Priya avaru next week slot ide. Consultation ₹1,500."
```

---

### **Industry 6: Hospitality & Resorts** 🏨

**Target Customers:** Coorg, Chikmagalur, Gokarna resorts

#### **Required APIs**
- ✅ Sarvam AI (Kannada welcoming tone)
- ✅ Gemini Flash (hospitality guardrails)
- ✅ Exotel (booking inquiries, confirmations)
- ✅ WhatsApp (room photos, menu, activities)
- ✅ Cal.com (availability calendar)

#### **Domain-Specific Knowledge Required**
```json
{
  "industry": "HOSPITALITY_RESORT",
  "dialect": "KANNADA_WELCOMING",
  "knowledge": {
    "roomTypes": ["Deluxe", "Suite", "Cottage", "Treehouse"],
    "priceRange": {
      "weekdays": "₹3,500 - ₹8,000",
      "weekends": "₹5,000 - ₹12,000"
    },
    "amenities": ["Pool", "Spa", "Restaurant", "Bonfire", "Trekking"],
    "cuisine": ["Kannada Thali", "Coorg Pandi Curry", "Continental"],
    "activities": ["Coffee Plantation Tour", "River Rafting", "Bird Watching"],
    "policies": {
      "checkIn": "2:00 PM",
      "checkOut": "11:00 AM",
      "cancellation": "48 hours before"
    }
  }
}
```

---

### **Industry 7: PU & NEET Coaching Institutes** 📚

**Target Customers:** Deeksha, Allen, Aakash institutes

#### **Required APIs**
- ✅ Sarvam AI (Kannada encouraging tone)
- ✅ Gemini Flash (education guardrails)
- ✅ Exotel (enrollment inquiries, demo class scheduling)
- ✅ WhatsApp (brochure, fee structure, success stories)

---

### **Industry 8: Co-operative Banks** 🏦

**Target Customers:** District co-operative banks in Karnataka

#### **Required APIs**
- ✅ Sarvam AI (Kannada formal banking tone)
- ✅ Gemini Flash (banking guardrails - RBI compliance)
- ✅ Exotel (account inquiries, loan queries)
- ✅ WhatsApp (loan application forms, branch info)

#### **Critical Compliance Requirements**
- RBI data localization
- KYC verification
- Secure transaction handling
- Audit logging

---

## 💰 Complete Cost Breakdown by Industry

| Industry | Calls/Month | Telephony | STT/TTS | LLM | WhatsApp | **Total** |
|----------|-------------|-----------|---------|-----|----------|-----------|
| Real Estate | 100 | ₹255 | ₹15,000 | ₹2,500 | ₹100 | **₹17,855** |
| Hospital | 200 | ₹680 | ₹40,000 | ₹5,000 | ₹200 | **₹45,880** |
| Automobile | 150 | ₹637 | ₹37,500 | ₹3,750 | ₹150 | **₹42,037** |
| Dental | 80 | ₹204 | ₹12,000 | ₹2,000 | ₹80 | **₹14,284** |
| IVF | 50 | ₹127 | ₹7,500 | ₹1,250 | ₹50 | **₹8,927** |
| Hospitality | 120 | ₹306 | ₹18,000 | ₹3,000 | ₹120 | **₹21,426** |
| Education | 100 | ₹255 | ₹15,000 | ₹2,500 | ₹100 | **₹17,855** |
| Banking | 150 | ₹637 | ₹22,500 | ₹3,750 | ₹150 | **₹27,037** |

**Average Monthly Cost:** ~₹25,000 per client for 100-150 calls/month

---

## 🚀 Minimum Viable Demo Setup

### **For Quick Demo (FREE)**
1. **Sarvam AI:** Free tier (1 hour/month STT/TTS)
2. **Gemini Flash:** Free tier (60 requests/minute)
3. **Supabase:** Free tier (500MB database)
4. **Voice Test:** Browser Web Speech (no API needed)

**Total Cost:** ₹0/month (demo only, no real calls)

### **For Production Pilot (1 Client)**
1. **Sarvam AI:** ₹15,000/month (2M characters)
2. **Gemini Flash:** ₹2,500/month (1M tokens)
3. **Exotel:** ₹999/month + ₹0.85/minute
4. **Supabase:** $25/month (Pro tier)
5. **WhatsApp:** ₹500/month (lead delivery)

**Total Cost:** ~₹20,000/month for first client

---

## 📝 Environment Variables Template

```bash
# ============================================
# TIER 1: ESSENTIAL (Must Have)
# ============================================

# Sarvam AI - Kannada STT/TTS
SARVAM_API_KEY="sarvam_live_xxxxxxxxxxxxxxxxxxxx"

# Google Gemini - LLM Dialogue
GEMINI_API_KEY="AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Supabase - Database & Auth
SUPABASE_URL="https://xxxxxx.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Cookie Secret (generate: openssl rand -base64 32)
COOKIE_SECRET="your-256-bit-secret-here"

# ============================================
# TIER 2: PRODUCTION TELEPHONY
# ============================================

# Exotel - Indian Telephony
EXOTEL_ACCOUNT_SID="youraccount"
EXOTEL_API_KEY="your_api_key"
EXOTEL_API_TOKEN="your_api_token"
EXOTEL_CALLER_ID="+918047192000"

# ============================================
# TIER 3: OPTIONAL ENHANCEMENTS
# ============================================

# WhatsApp Business API
WHATSAPP_API_TOKEN="EAAxxxxxxxxxxxxxxxxxxxxxxxxx"
WHATSAPP_PHONE_ID="103xxxxxxxxxxxx"

# Razorpay - Subscriptions
RAZORPAY_KEY_ID="rzp_live_xxxxxxxxxx"
RAZORPAY_KEY_SECRET="xxxxxxxxxxxxxxxxxxxx"

# Alternative LLMs (Optional)
GROQ_API_KEY="gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
OPENAI_API_KEY="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# ============================================
# APP CONFIGURATION
# ============================================
NODE_ENV="production"
PORT="4000"
VOICE_PORT="4200"
LOG_LEVEL="info"
HOST="0.0.0.0"
```

---

## ✅ API Key Acquisition Guide

### **1. Sarvam AI**
- **Website:** https://sarvam.ai
- **Signup:** https://api.sarvam.ai
- **Free Tier:** 1 hour STT/TTS per month
- **Production:** Contact sales@sarvam.ai
- **Setup Time:** 2-3 business days

### **2. Google Gemini**
- **Website:** https://ai.google.dev
- **Console:** https://aistudio.google.com/app/apikey
- **Free Tier:** 60 requests/minute, 1M tokens/day
- **Production:** Enable billing in Google Cloud Console
- **Setup Time:** Immediate

### **3. Exotel**
- **Website:** https://exotel.com
- **Signup:** https://exotel.com/pricing
- **Minimum Plan:** ₹999/month + usage
- **Documentation:** https://developer.exotel.com
- **Setup Time:** 5-7 business days (KYC required)

### **4. Supabase**
- **Website:** https://supabase.com
- **Free Tier:** 500MB database, 50K monthly active users
- **Production:** $25/month for 8GB
- **Setup Time:** Immediate
- **Migrations:** Already created in `packages/database/supabase/migrations/`

### **5. WhatsApp Business API**
- **Website:** https://business.facebook.com
- **Requirements:** Business verification, GST certificate
- **Cost:** ₹0.0065 per conversation
- **Setup Time:** 7-14 days (Meta approval required)

---

## 🎯 Recommended Deployment Strategy

### **Phase 1: Demo (Week 1)**
- Use free tiers only
- Test with browser Web Speech
- No real phone calls
- Cost: ₹0

### **Phase 2: Pilot (Weeks 2-4)**
- 1 client (Real Estate recommended)
- Sarvam + Gemini + Exotel
- 50-100 calls/month
- Cost: ~₹20,000/month

### **Phase 3: Production (Month 2+)**
- 3-5 clients across industries
- WhatsApp integration
- Multi-tenant isolation
- Cost: ~₹60,000-1,00,000/month

---

## 📊 ROI Calculation

### **For Real Estate Client**
- **Monthly Cost:** ₹18,000
- **Calls Handled:** 100 calls
- **Avg. Deal Size:** ₹25 Lakhs (plot)
- **Conversion Rate:** 5% (5 leads)
- **Revenue Generated:** 5 × ₹25L = ₹1.25 Cr
- **Commission:** 2% = ₹2.5 Lakhs
- **ROI:** (₹2,50,000 - ₹18,000) / ₹18,000 = **1,288%**

### **For Hospital Client**
- **Monthly Cost:** ₹46,000
- **Calls Handled:** 200 calls
- **Avg. Consultation Fee:** ₹750
- **Conversion Rate:** 40% (80 appointments)
- **Revenue Generated:** 80 × ₹750 = ₹60,000
- **Additional Revenue:** Lab tests, procedures
- **ROI:** Variable, but patient retention value is high

---

## 🔐 Security & Compliance

### **Data Protection**
- All API keys stored in environment variables
- Database encrypted at rest (Supabase default)
- Row-Level Security (RLS) for multi-tenant isolation
- Session cookies encrypted with `COOKIE_SECRET`

### **Compliance Requirements by Industry**
- **Healthcare:** HIPAA compliance (US), ABDM compliance (India)
- **Banking:** RBI data localization, PCI-DSS
- **Education:** COPPA (children's data)
- **General:** GDPR (EU customers), DPDP Act (India)

---

## 📞 Support & Documentation

### **API Documentation**
- Sarvam AI: https://docs.sarvam.ai
- Gemini Flash: https://ai.google.dev/docs
- Exotel: https://developer.exotel.com/api
- Supabase: https://supabase.com/docs

### **Project Documentation**
- Architecture: `docs/architecture/`
- API Reference: `docs/api/`
- Deployment Guide: `DEPLOYMENT_GUIDE.md`
- Project Status: `PROJECT_STATUS.md`

---

**Last Updated:** October 6, 2026  
**Document Owner:** Dhwani SI Engineering Team  
**Next Review:** January 2027
