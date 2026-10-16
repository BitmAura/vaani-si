/**
 * Layer 4 & 5: LLM Conversational Turn Generator & Structured CRM Extractor
 * Dhwani SI — Sub-400ms Spoken Kannada Response Engine
 * Supports Open Source Models from crazy-ai-stack (Qwen 2.5, Ollama, vLLM) & Gemini Cloud
 */

export interface MessageTurn {
  role: 'user' | 'model' | 'system';
  content: string;
}

export interface CallerDossier {
  phone: string;
  name?: string;
  isRepeatCaller: boolean;
  callCount: number;
  lastInquiry?: string;
  lastOutcome?: string;
  leadRating?: 'HOT' | 'WARM' | 'COLD';
}

export interface ExtractedLeadProfile {
  callerName: string;
  leadRating: 'HOT' | 'WARM' | 'COLD' | 'DISQUALIFIED';
  city: string;
  requirement: string;
  budget: string;
  confirmedOutcome: string;
}

export class LLMConversationalService {
  private geminiApiKey: string;
  private localModelUrl: string;
  private localModelName: string;
  private preferredEngine: 'local_qwen' | 'gemini' | 'heuristic';
  private localQwenAvailable: boolean = true;
  private localQwenDisabledUntil: number = 0;

  constructor(apiKey?: string) {
    this.geminiApiKey = apiKey || process.env.GEMINI_API_KEY || '';
    this.localModelUrl = process.env.LOCAL_LLM_URL || 'http://localhost:11434';
    this.localModelName = process.env.LOCAL_LLM_MODEL || 'qwen2.5:7b-instruct';

    // 1. Explicit LLM_ENGINE override
    // 2. GEMINI_API_KEY -> 'gemini'
    // 3. OPENAI_API_KEY -> 'gemini' (cloud flow)
    // 4. Explicit LOCAL_LLM_URL -> 'local_qwen'
    // 5. Otherwise -> 'heuristic' (instant <5ms response without waiting 600ms on dead local socket)
    if (process.env.LLM_ENGINE) {
      this.preferredEngine = process.env.LLM_ENGINE as any;
    } else if (this.geminiApiKey) {
      this.preferredEngine = 'gemini';
    } else if (process.env.OPENAI_API_KEY) {
      this.preferredEngine = 'gemini';
    } else if (process.env.LOCAL_LLM_URL) {
      this.preferredEngine = 'local_qwen';
    } else {
      this.preferredEngine = 'heuristic';
    }
  }

  public getConfig() {
    return {
      preferredEngine: this.preferredEngine,
      localModelUrl: this.localModelUrl,
      localModelName: this.localModelName,
      geminiConfigured: !!this.geminiApiKey,
    };
  }

  public setConfig(config: { preferredEngine?: 'local_qwen' | 'gemini' | 'heuristic'; localModelUrl?: string; localModelName?: string }) {
    if (config.preferredEngine) this.preferredEngine = config.preferredEngine;
    if (config.localModelUrl) this.localModelUrl = config.localModelUrl;
    if (config.localModelName) this.localModelName = config.localModelName;
  }

  /**
   * Fast Indian Vernacular & English Code-Switching Language Detector
   */
  public detectLanguage(text: string): 'en-IN' | 'kn-IN' | 'hi-IN' | 'te-IN' {
    const t = (text || '').toLowerCase();
    // 1. Kannada script or natural Kannada/Kanglish phonemes
    if (/[\u0C80-\u0CFF]/.test(t) || /\b(namaskara|namaskar|eshtu|beku|ide|barthini|illa|madla|madtini|hegiddira|yavaga|sari sir|nodbeku|khanditha|dayavittu|haudu)\b/i.test(t)) {
      return 'kn-IN';
    }
    // 2. Hindi / Devanagari script or Hinglish markers
    if (/[\u0900-\u097F]/.test(t) || /\b(namaste|kya|hai|chahiye|kitna|hoga|batao|aapka|humara|kaise|kahan|mil sakta|kripya|accha|shukriya|shuru|karein|theek)\b/i.test(t)) {
      return 'hi-IN';
    }
    // 3. Telugu script or Tenglish markers
    if (/[\u0C00-\u0C7F]/.test(t) || /\b(namaskaram|entha|kavali|andi|vastanu|ledu|eppudu|unnaya|cheppandi|bagunnara|cheyandi)\b/i.test(t)) {
      return 'te-IN';
    }
    // 4. Default to Indian English
    return 'en-IN';
  }


  /**
   * Generates the next conversational response in natural spoken Kannada / Kanglish.
   * Target execution time: < 350ms.
   * Ingests optional RAG knowledge context from the Business Brain for 100% factual accuracy.
   * Recognizes repeat callers via CallerDossier (L6 Episodic Memory).
   */
  public async generateTurn(
    systemPrompt: string,
    history: MessageTurn[],
    userAudioTranscript: string,
    ragContext?: string,
    callerDossier?: CallerDossier
  ): Promise<string> {
    // If authoritative RAG context is supplied, enrich system prompt with grounding instructions
    let effectiveSystemPrompt = systemPrompt;
    if (ragContext && ragContext.trim()) {
      effectiveSystemPrompt += `\n\n=== AUTHORITATIVE BUSINESS BRAIN KNOWLEDGE (RAG GROUND TRUTH) ===\n${ragContext}\n\nSTRICT NO-HALLUCINATION RULE: You must answer strictly according to the authoritative facts above. If the customer asks for services, timings, prices, or policies not present in this Business Brain, do not guess or invent facts. Politely inform them that you will confirm with the management and share details over WhatsApp.`;
    }

    // If caller dossier exists (Repeat VIP recognition)
    if (callerDossier) {
      effectiveSystemPrompt += `\n\n=== CALLER DOSSIER & RECOGNITION (EPISODIC MEMORY) ===\nPhone: ${callerDossier.phone}\nName: ${callerDossier.name || 'Valued Caller'}\nRelationship: ${callerDossier.isRepeatCaller ? `REPEAT CALLER (Call #${callerDossier.callCount})` : 'FIRST TIME CALLER'}\nPrevious Inquiry: ${callerDossier.lastInquiry || 'None'}\nPrevious Outcome: ${callerDossier.lastOutcome || 'None'}\nLead Rating: ${callerDossier.leadRating || 'WARM'}\n\nSTRICT RULE: If this is a repeat caller, greet them warmly by their name (${callerDossier.name || 'sir'}), acknowledge their past inquiry, and make them feel recognized.`;
    }

    // 1. If configured to use Local Open Source Qwen (03-llms-rag-search/Qwen)
    if (this.preferredEngine === 'local_qwen' && process.env.NODE_ENV !== 'test') {
      try {
        const localReply = await this.callLocalQwen(effectiveSystemPrompt, history, userAudioTranscript);
        if (localReply) return localReply;
      } catch {
        // Fall back gracefully
      }
    }

    // 2. If Gemini Cloud API key is configured
    if (this.geminiApiKey && process.env.NODE_ENV !== 'test') {
      try {
        const contents = [
          ...history.map(h => ({
            role: h.role === 'model' ? 'model' : 'user',
            parts: [{ text: h.content }],
          })),
          {
            role: 'user',
            parts: [{ text: userAudioTranscript }],
          },
        ];

        const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiApiKey}`;

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: effectiveSystemPrompt }],
            },
            contents,
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 150, // 150 tokens prevents Kannada Unicode truncation
            },
          }),
        });

        if (res.ok) {
          const data = await res.json() as any;
          const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (reply) return reply;
        }
      } catch (err) {
        console.warn('[LLM Service] Gemini error, trying alternate engines:', err);
      }
    }

    // 2b. If OpenAI Cloud API key is configured (alternative cloud brain)
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (openaiApiKey && process.env.NODE_ENV !== 'test') {
      try {
        const messages = [
          { role: 'system', content: effectiveSystemPrompt },
          ...history.map(h => ({
            role: h.role === 'model' ? 'assistant' : 'user',
            content: h.content,
          })),
          { role: 'user', content: userAudioTranscript },
        ];

        const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: openaiModel,
            messages,
            temperature: 0.3,
            max_tokens: 150,
          }),
        });

        if (res.ok) {
          const data = await res.json() as any;
          const reply = data.choices?.[0]?.message?.content?.trim();
          if (reply) return reply;
        }
      } catch (err) {
        console.warn('[LLM Service] OpenAI error, falling back to heuristic engine:', err);
      }
    }

    // 3. Fallback to sub-10ms Contextual Spoken Kanglish Heuristics
    return this.generateSimulatedKanglishResponse(userAudioTranscript, effectiveSystemPrompt, ragContext, callerDossier, history);
  }

  /**
   * Calls local open source Qwen 2.5 (from crazy-ai-stack / Ollama / vLLM)
   */
  private async callLocalQwen(
    systemPrompt: string,
    history: MessageTurn[],
    transcript: string
  ): Promise<string | null> {
    // If local Qwen failed (timeout or ECONNREFUSED), skip for 60 seconds
    if (!this.localQwenAvailable && Date.now() < this.localQwenDisabledUntil) {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 600); // 600ms strict timeout for voice interactivity

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.content })),
        { role: 'user', content: transcript },
      ];

      const res = await fetch(`${this.localModelUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.localModelName,
          messages,
          stream: false,
          options: {
            temperature: 0.3,
            num_predict: 50,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      if (res.ok) {
        this.localQwenAvailable = true;
        this.localQwenDisabledUntil = 0;
        const data = await res.json() as any;
        return data.message?.content?.trim() || null;
      }
      this.localQwenAvailable = false;
      this.localQwenDisabledUntil = Date.now() + 60000;
      return null;
    } catch {
      clearTimeout(timeout);
      this.localQwenAvailable = false;
      this.localQwenDisabledUntil = Date.now() + 60000;
      return null;
    }
  }

  /**
   * Extracts structured CRM Lead Dossier from raw bilingual conversation
   * Formats into Twenty CRM / Chatwoot object schema
   */
  public extractCRMLeadData(transcript: string, tenantName: string, callerPhone?: string, callerName?: string): ExtractedLeadProfile {
    const text = transcript.toLowerCase();

    const isHot =
      text.includes('visit') ||
      text.includes('sunday') ||
      text.includes('confirm') ||
      text.includes('barthini') ||
      text.includes('appointment') ||
      text.includes('book');

    const budgetMatch = transcript.match(/(₹?\s?\d+(\.\d+)?\s?(lakhs?|lakh|cr|crores?|k))/i);
    const budget = budgetMatch ? budgetMatch[0] : (tenantName.includes('Ballari') ? '₹18 Lakhs - 35 Lakhs' : '₹750 OPD Fee');

    // Use actual caller identity from episodic memory / dossier; never hardcode names
    const resolvedName = callerName ||
      (callerPhone ? `Caller ${callerPhone.slice(-4).padStart(10, '+91 XXXXXX')}` : 'Prospective Buyer');

    return {
      callerName: resolvedName,
      leadRating: isHot ? 'HOT' : 'WARM',
      city: text.includes('siruguppa') ? 'Siruguppa' : (text.includes('hubli') ? 'Hubli' : 'Ballari'),
      requirement: tenantName.includes('Ballari') ? '30x40 Residential Plot Inquiry' : 'Specialist Consultation',
      budget,
      confirmedOutcome: isHot ? 'Confirmed Site Visit for Sunday 11:00 AM' : 'Brochure and Location Shared',
    };
  }

  /**
   * Industry-specific system prompts for Real Estate, Healthcare, and Digital Agency clients
   */
  public static INDUSTRY_PROMPTS = {
    REAL_ESTATE: {
      system: `You are a regional Kannada-speaking AI voice employee for a plotted layout developer in Karnataka.
      
CRITICAL RULES:
1. Speak in natural Kanglish (Kannada + English mix) as used in business conversations
2. NEVER translate English loanwords like "plot", "site", "layout", "booking", "advance", "token" - keep them phonetically
3. Qualify leads by asking: Budget, Preferred dimensions, Location preference, Timeline for purchase
4. Offer Sunday site visits with free cab pickup - this is your strongest conversion tool
5. Always mention clear title and DC conversion status

CONVERSATION FLOW:
- Greeting → Ask requirements → Check budget → Offer site visit → Take confirmation → Share WhatsApp details

EXAMPLE RESPONSES:
- Rate query: "Sir, 30x40 plots 18 Lakhs inda start aaguththe. Nimma budget range yaavudhu sir?"
- Location: "Sir, layout Ballari bypass hatthira ide. Ee Sunday site visit arrange madla? Free cab pickup ide."
- Confirmation: "Khanditha sir! Sunday 11 AM ge cab pickup confirm maadiddini."`,
      
      greet: "Namaskara sir, Ballari Layout Developers inda hegira help madbodu? Residential plot beka athva commercial investment ga?",
    },
    
    HEALTHCARE_HOSPITAL: {
      system: `You are a regional Kannada-speaking AI voice employee for a multi-specialty hospital in Karnataka.
      
CRITICAL RULES:
1. Speak in natural Kanglish with medical terminology in English
2. NEVER translate: "doctor", "appointment", "OPD", "scan", "surgery", "pharmacy"
3. Route calls by specialization: Cardiology, Orthopedics, Pediatrics, Gynecology, General Medicine
4. Always ask: Symptoms/duration, Preferred doctor, Preferred time slot, Insurance status
5. EMERGENCY DETECTION: If caller mentions chest pain, breathing difficulty, severe bleeding, or unconsciousness - immediately say "Sir/Madam, this sounds like emergency. Please rush to nearest hospital or call 108 ambulance right now."

CONVERSATION FLOW:
- Greeting → Check emergency → Ask symptoms → Recommend specialist → Check availability → Book appointment → Confirm details

EXAMPLE RESPONSES:
- Appointment: "Haudu sir, Dr. Ramesh Patil avaru Cardiology specialist, naale beligge 11:30 AM ge slot available ide."
- Fee inquiry: "Sir, initial consultation OPD fee ₹750 aaguththe. Insurance card ittiya?"
- Emergency: "Sir, chest pain emergency aaguththe. Please immediately 108 ambulance call madi or hospital ge rush madi."`,
      
      greet: "Namaskara sir, Apollo Specialty Clinic inda hegi help madbodu? Yaava department consultation beku sir?",
    },
    
    HEALTHCARE_DENTAL: {
      system: `You are a regional Kannada-speaking AI voice employee for a dental clinic in Karnataka.
      
CRITICAL RULES:
1. Speak in natural Kanglish with dental terminology in English
2. Common procedures to handle: Root canal, teeth cleaning, braces, extraction, implants, whitening
3. Ask: Nature of dental issue, Pain level (mild/moderate/severe), Previous dental work, Insurance coverage
4. Always mention: Clinic timing, Doctor availability, Procedure duration estimate

CONVERSATION FLOW:
- Greeting → Ask dental concern → Check pain severity → Recommend treatment → Check preferred time → Book appointment

EXAMPLE RESPONSES:
- Tooth pain: "Sir, severe pain ittu? Root canal treatment beka athva simple extraction saaku? Doctor examination madi appudu decide aaguththe."
- Teeth cleaning: "Madam, professional teeth cleaning ₹2,000 aaguththe, 45 minutes duration. Saturday morning slot available ide."`,
      
      greet: "Namaskara, Dental Care Clinic inda hegi help madbodu? Enu dental problem ittu heli sir?",
    },
    
    AUTOMOTIVE_DEALER: {
      system: `You are a regional Kannada-speaking AI voice employee for a car dealership in Karnataka.
      
CRITICAL RULES:
1. Speak in natural Kanglish with car models and features in English
2. NEVER translate: "test drive", "on-road price", "EMI", "exchange bonus", "waiting period"
3. Handle inquiries for: New cars, Used cars, Service booking, Finance options, Insurance renewal
4. Always collect: Preferred model, Budget range, Current vehicle (for exchange), Timeline for purchase
5. Aggressively push test drives - this is your primary conversion tool

CONVERSATION FLOW:
- Greeting → Ask preferred model → Check budget → Offer test drive → Discuss finance → Take appointment

EXAMPLE RESPONSES:
- Model inquiry: "Sir, Maruti Creta on-road price ₹14.5 Lakhs aaguththe. Test drive beka? Ee Saturday morning slot available ide."
- EMI query: "Madam, ₹2 Lakhs down payment, 5 years EMI ₹25,000 barutte. Pre-approval nimma WhatsApp ge send madla?"`,
      
      greet: "Namaskara sir, Maruti Suzuki Showroom inda hegira help madbodu? Yaava model interested ide sir?",
    },
    
    EDUCATION_COLLEGE: {
      system: `You are a regional Kannada-speaking AI voice employee for a PU/NEET coaching institute in Karnataka.
      
CRITICAL RULES:
1. Speak in natural Kanglish with academic terms in English
2. NEVER translate: "NEET", "JEE", "CET", "PU", "batch", "tuition fee"
3. Handle: Course inquiry, Batch timing, Faculty details, Fee structure, Admission process
4. Always ask: Student's current class (10th/PU 1st/PU 2nd), Target exam, Current performance level
5. Mention: Success rate, Top rankers, Demo class availability

EXAMPLE RESPONSES:
- Course inquiry: "Sir, NEET coaching 2-year integrated batch June start aaguththe. Annual fee ₹1.2 Lakhs. Demo class this Sunday available ide."
- Faculty: "Madam, our Physics faculty IIT Madras graduated, 15 years experience. Biology faculty Mysore Medical College doctor."`,
      
      greet: "Namaskara, Achievers Academy inda hegira help madbodu? NEET/JEE/CET coaching information beka sir?",
    },
    
    AGENCY: {
      system: `You are a regional Kannada-speaking AI voice employee for a digital marketing agency's client.
      
CRITICAL RULES:
1. Speak in natural Kanglish - you represent the agency's client business
2. This is a WHITE-LABEL call - do NOT mention the agency name
3. Adapt to the client's industry: Real Estate, Healthcare, Automotive, Education, Hospitality
4. Handle inquiries professionally as if you're the client's own employee
5. Transfer to human agent if caller specifically asks to speak with manager

EXAMPLE RESPONSES:
- Adapt based on client industry type using corresponding prompts above`,
      
      greet: "Namaskara, hegira help madbodu? Enu information beku sir?",
    },
    
    HOSPITALITY_RESORT: {
      system: `You are a regional Kannada-speaking AI voice employee for a resort in Karnataka.
      
CRITICAL RULES:
1. Speak in natural Kanglish with hospitality terms in English
2. NEVER translate: "check-in", "checkout", "AC room", "swimming pool", "package", "buffet"
3. Handle: Room booking, Package inquiry, Amenities, Weekend offers, Event hosting
4. Always ask: Number of guests, Check-in date, Room preference (AC/Non-AC), Budget range
5. Push weekend packages and group discounts

EXAMPLE RESPONSES:
- Room inquiry: "Madam, AC deluxe room ₹3,500 per night, breakfast buffet included. Weekend package 2 nights ₹6,000 offer ide."
- Amenities: "Sir, swimming pool, indoor games, children's play area, multi-cuisine restaurant - everything available ide."`,
      
      greet: "Namaskara, Green Valley Resort inda hegi help madbodu? Room booking athva package information beka?",
    },
  };

  /**
   * Ultra-fast contextual heuristic engine with Deep Situational Human Intelligence.
   * Handles price objections, emergency triage, scheduling, technical details,
   * language switching, and edge cases like an authentic human team member.
   */
  private generateSimulatedKanglishResponse(
    transcript: string,
    systemPrompt: string,
    ragContext?: string,
    callerDossier?: CallerDossier,
    history: MessageTurn[] = []
  ): string {
    const text = transcript.toLowerCase();
    const lang = this.detectLanguage(transcript);

    // Multi-turn context inspection
    const lastAssistantTurn = history && history.length > 0
      ? [...history].reverse().find(t => t.role === 'model')
      : undefined;
    const lastAssistantMsg = lastAssistantTurn?.content || '';
    const hasAlreadyGreeted = Boolean(
      lastAssistantMsg &&
      (lastAssistantMsg.includes('Sahana') ||
       lastAssistantMsg.includes('Namaskara') ||
       lastAssistantMsg.includes('Hello') ||
       lastAssistantMsg.includes('Namaste') ||
       lastAssistantMsg.includes('Namaskaram'))
    );

    // =========================================================================
    // 0. HIGHEST SAFETY & CRITICAL CALLER EDGES (EMERGENCY & ANGRY CALLERS)
    // =========================================================================

    // 0.1 Emergency Triage (Highest Priority — Safety First!)
    if (/\b(emergency|chest pain|heart attack|severe bleeding|unconscious|breathlessness|stroke|accident)\b/i.test(text)) {
      if (lang === 'en-IN') {
        return 'Sir, this sounds like an urgent medical emergency! Please immediately dial 108 for an ambulance or rush to the nearest emergency ward. Duty doctors are available 24/7.';
      }
      if (lang === 'hi-IN') {
        return 'Sir, ye critical emergency lag rahi hai! Kripya turant 108 ambulance ko call karein ya paas ke hospital rush karein. Casualty doctors 24/7 available hain.';
      }
      return 'Sir, idhu emergency aaguththe! Dayavittu immediately 108 ambulance call madi athva casualty emergency ward ge rush madi sir. Casualty duty doctor 24/7 ready irthare!';
    }

    // 0.2 Angry / Frustrated Caller (Immediate De-escalation)
    if (text.includes('kopa') || text.includes('waste') || text.includes('useless') || text.includes('worst') || text.includes('fraud') || text.includes('cheat') || text.includes('complaint') || text.includes('bad service') || text.includes('time waste')) {
      if (lang === 'en-IN') {
        return 'I sincerely apologize, sir. I completely understand your frustration. Let me personally escalate this to our senior management right now to resolve this for you. May I know what happened?';
      }
      return 'Kshamisee sir, nimma concern 100% understand aaythu. Dayavittu kshame irli. Nanu eegale idanna senior management attention ge thagond solve maadistheeni. Enu problem aaythu heli sir?';
    }

    // 0.3 "Are you a robot / AI?" (Checked with strict word boundary)
    if (/\b(robot|bot|ai|human|manushya|machine|real person|nijavaglu)\b/i.test(text) || text.includes('artificial intelligence')) {
      if (lang === 'en-IN') {
        return 'Yes, sir! I am Sahana, the 24/7 AI Voice Executive. I help our customers with real-time project details, transparent pricing, and instant booking with zero waiting time. How may I help you today?';
      }
      if (lang === 'hi-IN') {
        return 'Haan ji sir! Main 24/7 AI Voice Executive Sahana hoon. Main aapko real-time plot details, transparent rates aur booking mein bina kisi wait time ke assist karti hoon. Aapki kya requirement hai ji?';
      }
      return 'Haudu sir! Nanu 24/7 AI staff member Sahana mathadtha iddini. Human staff thara calls miss madalla, polite Kannada mathu English nalli 24 gante assist madtini. Enu inquiry itthu heli sir?';
    }

    // 0.4 Unclear Speech / Background Noise
    if (text.includes('voice cut') || text.includes('kellalla') || text.includes('repeat') || text.includes('clearly') || text.includes('innomme') || text.includes('sound cut') || text.includes('pardon')) {
      if (lang === 'en-IN') {
        return 'Pardon me, sir, there was a bit of background noise on the line. Could you please repeat that for me?';
      }
      return 'Kshamisee sir, background noise swalpa jaasti itthu voice cut aaythu. Dayavittu innomme repeat madtheera sir?';
    }

    // =========================================================================
    // 1. DOMAIN SPECIFIC CORE INTENTS (DISTANCE, RATE, DOCTOR, SITE VISIT)
    // =========================================================================

    // Real Estate: Distance & Free Cab
    if ((systemPrompt.includes('Ballari') || systemPrompt.includes('REAL_ESTATE')) && (text.includes('doora') || text.includes('distance') || text.includes('elli') || text.includes('where') || text.includes('dc office') || text.includes('bypass') || text.includes('cab') || text.includes('location'))) {
      if (text.includes('sunday') || text.includes('cab') || text.includes('free')) {
        if (lang === 'en-IN') {
          return 'Sir, the layout is right on the Siruguppa main bypass road, just 10 minutes drive from the new DC office! We can arrange a complimentary AC cab pickup for your family this Sunday at 11 AM. Shall I lock in your pickup address?';
        }
        if (lang === 'hi-IN') {
          return 'Sir, layout Siruguppa bypass road par hai, new DC office se sirf 10 minutes drive! Is Sunday 11 AM par hum aapke liye free AC cab pickup arrange kar denge. Pickup location confirm karein ji?';
        }
        return 'Sir, layout Siruguppa bypass hatthira ide, new DC office inda just 10 minutes drive! Ee Sunday 11 AM ge nimge direct Free AC cab pickup arrange maadthini. Pickup location confirm maadla sir?';
      }
      if (lang === 'en-IN') {
        return 'Sir, the layout is right on the Siruguppa main bypass road, just 10 minutes drive from the new DC office. City bus and auto connectivity are very convenient.';
      }
      if (lang === 'hi-IN') {
        return 'Sir, layout Siruguppa main bypass road par hai, new DC office se sirf 10 minutes drive. City bus aur auto connectivity bahut achhi hai.';
      }
      return 'Sir, layout Siruguppa main bypass road hatthira ide, new DC office inda just 10 minutes drive. City bus mathu auto connectivity thumba convenient ide sir.';
    }

    // Real Estate: Rate Objection
    if ((systemPrompt.includes('Ballari') || systemPrompt.includes('REAL_ESTATE')) && (text.includes('jasti') || text.includes('costly') || text.includes('expensive') || text.includes('kammi madi') || text.includes('discount') || text.includes('high rate') || text.includes('rate swalpa') || text.includes('too much') || text.includes('negotiable'))) {
      if (lang === 'en-IN') {
        return 'I completely understand budget is a key priority for you, sir. Our layout is 100% DC converted, A-Khata, and RERA approved with 80% SBI bank loan clearance. Why not visit the site this Sunday to experience the location first-hand? We arrange a complimentary AC cab pickup for your family.';
      }
      if (lang === 'hi-IN') {
        return 'Aapki baat bilkul samajh sakti hoon sir. Ye layout 100% DC converted, A-Khata aur RERA approved hai, aur SBI se 80% loan clearance hai. Kya is Sunday hum aapke liye ek free cab pickup arrange karein taaki aap location dekh sakein?';
      }
      if (lang === 'te-IN') {
        return 'Nijame andi, kani layout 100% DC converted, A-Khata mariyu RERA approved. SBI nundi 80% loan facility kuda undi. Ee Sunday meeku family tho paatu free cab pickup arrange cheyyamantara andi?';
      }
      return 'Nodi sir, layout 100% DC converted, A-Khata mathu RERA registered ide. Underground drainage, 40 feet tar roads mathu SBI inda 80% loan approval ide. Siruguppa bypass hatthira 2 years nalli double appreciation expect madbahudu sir. Ee Sunday visit madi nodi sir.';
    }

    // =========================================================================
    // 2. BUSINESS BRAIN / RAG FACT MATCHING (GROUNDED TRUTH)
    // =========================================================================
    if (ragContext && ragContext.trim()) {
      const lowerRag = ragContext.toLowerCase();
      // If user is asking about specific timing/hours and RAG has hours
      if ((text.includes('timing') || text.includes('office hour') || text.includes('operating hour') || text.includes('yaavaga open')) && lowerRag.includes('timings:')) {
        const match = ragContext.match(/(?:office|operating)?\s*timings?:?\s*([^\n.]+)/i);
        if (match) {
          return `Sir, namma office timings ${match[1].trim()} aaguththe. Ee time nalli nimge directly assist madtivi.`;
        }
      }
      // If user asks about fee/pricing and RAG has specific fee/catalog
      if ((text.includes('fee') || text.includes('rate') || text.includes('price') || text.includes('cost') || text.includes('eshtu')) && lowerRag.includes('catalog:')) {
        const match = ragContext.match(/catalog(?:\s*summary)?:?\s*([^\n.]+)/i);
        if (match) {
          return `Sir, namma catalog details: ${match[1].trim()}. Nimma exact requirements heli sir?`;
        }
      }
    }

    // =========================================================================
    // 3. SMALL TALK & GREETINGS (WITH REPEAT CALLER MEMORY RECOGNITION)
    // =========================================================================
    if (/\b(namaskara|namaste|hello|shubhodaya)\b/i.test(text) || /^\s*(hi|hey)\b/i.test(text)) {
      if (hasAlreadyGreeted) {
        if (lang === 'en-IN') return 'Yes sir, I am listening! How else may I assist you with details?';
        if (lang === 'hi-IN') return 'Haan ji sir, batayein, aur kis cheez mein madad karoon?';
        return 'Haudu sir, keltha iddini. Innu enu details beku heli sir?';
      }

      if (callerDossier?.isRepeatCaller) {
        const callerName = callerDossier.name || 'sir';
        if (lang === 'en-IN') {
          return `Hello ${callerName}! Welcome back to Ballari Residential Layouts. Last time we discussed our ${callerDossier.lastInquiry || 'residential plots'}. Shall I confirm a complimentary site visit for you this Sunday?`;
        }
        if (lang === 'hi-IN') {
          return `Namaste ${callerName}! Ballari Layouts mein aapka swagat hai. Pichli baar humne ${callerDossier.lastInquiry || 'residential plots'} ke baare mein baat ki thi. Kya is Sunday site visit confirm karein?`;
        }
        return `Namaskara ${callerName}! Welcome back to Ballari Layouts. Last time namma ${callerDossier.lastInquiry || '30 40 residential plots'} bagge mathadidri alva? Ee Sunday site visit confirm madla sir?`;
      }

      if (lang === 'en-IN') {
        if (systemPrompt.includes('Apollo') || systemPrompt.includes('HEALTHCARE') || systemPrompt.includes('Hospital') || systemPrompt.includes('Manipal')) {
          return 'Hello sir! This is Sahana from Apollo Specialty Clinic. Which department or doctor consultation may I assist you with today?';
        }
        return 'Hello sir! Warm greetings from Ballari Residential Layouts. This is Sahana. How may I assist you with our residential plots today?';
      }
      if (lang === 'hi-IN') {
        return 'Namaste sir! Ballari Residential Layouts se Sahana baat kar rahi hoon. Residential plots ke baare mein aapki kya inquiry hai ji?';
      }
      if (lang === 'te-IN') {
        return 'Namaskaram andi! Ballari Residential Layouts nundi Sahana matladuthunnanu. Plots gurinchi elanti details kavali andi?';
      }

      return 'Namaskara sir! Ballari Residential Layouts inda Sahana mathadtha iddini. 30 40 residential plots inquiry bagge hege help madli sir?';
    }

    // E. Gratitude / Closure
    if (text.includes('thank you') || text.includes('thanks') || text.includes('dhanyavada') || text.includes('bye') || text.includes('saaku') || text.includes('ok thank') || text.includes('shukriya')) {
      if (lang === 'en-IN') {
        return 'You are most welcome, sir! I have dispatched the summary, brochure, and Google Maps location directly to your WhatsApp. Have a wonderful day!';
      }
      if (lang === 'hi-IN') {
        return 'Aapka bahut bahut shukriya sir! Saari details maine aapke WhatsApp par share kar di hain. Shubh din sir!';
      }
      if (lang === 'te-IN') {
        return 'Chala dhanyavadalu andi! Details anni mee WhatsApp ki share chesamu. Have a wonderful day andi!';
      }
      return 'Thumbha dhanyavadagalu sir! Nimma WhatsApp ge summary details eegale share maadiddini. Shubhadina sir!';
    }

    // =========================================================================
    // 2. REAL ESTATE & PLOTTED DEVELOPER SITUATIONAL INTELLIGENCE
    // =========================================================================
    if (systemPrompt.includes('Industry: REAL_ESTATE') || systemPrompt.includes('REAL_ESTATE') || systemPrompt.includes('Ballari Residential Layouts')) {
      // Objection: Rate is too high / costly
      if (text.includes('jasti') || text.includes('costly') || text.includes('expensive') || text.includes('kammi madi') || text.includes('discount') || text.includes('high rate') || text.includes('rate swalpa')) {
        if (lang === 'en-IN') {
          return 'I completely understand budget is a key priority for you, sir. Our layout is 100% DC converted, A-Khata, and RERA approved with 80% SBI bank loan clearance. Why not visit the site this Sunday to experience the location first-hand? We offer a free AC cab pickup.';
        }
        return 'Nodi sir, layout 100% DC converted, A-Khata mathu RERA registered ide. Underground drainage, 40 feet tar roads mathu SBI inda 80% loan approval ide. Siruguppa bypass hatthira 2 years nalli double appreciation expect madbahudu sir. Ee Sunday visit madi nodi sir.';
      }

      // Location / Distance Doubts
      if (text.includes('doora') || text.includes('station') || text.includes('bus stand') || text.includes('elli') || text.includes('where') || text.includes('bypass') || text.includes('distance') || text.includes('city inda')) {
        if (lang === 'en-IN') {
          return 'Sir, the layout is right on the Siruguppa main bypass road, just 10 minutes drive from the new DC office. City bus and auto connectivity are very convenient.';
        }
        return 'Sir, layout Siruguppa main bypass road hatthira ide, new DC office inda just 10 minutes drive. City bus mathu auto connectivity thumba convenient ide sir.';
      }

      // Legal Clearances & Bank Loans
      if (text.includes('a-khata') || text.includes('a khata') || text.includes('dc converted') || text.includes('rera') || text.includes('document') || text.includes('clear title') || text.includes('loan') || text.includes('bank') || text.includes('sbi') || text.includes('hdfc')) {
        if (lang === 'en-IN') {
          return 'It is a 100% clear title A-Khata layout, sir. DC conversion orders, RERA certificates, and parent deeds are all available for direct verification, with up to 80% loan approval from SBI and HDFC.';
        }
        if (lang === 'hi-IN') {
          return 'Ye 100% clear title A-Khata layout hai sir. DC conversion, RERA certificates aur legal documents office mein directly verify kar sakte hain, aur SBI & HDFC se 80% loan available hai.';
        }
        return '100% clear title A-Khata layout sir. DC conversion order, RERA approved certificate mathu parent deed yellanu office nalli direct agi verify madbahudu. SBI mathu HDFC bank inda 80% loan approval aaguththe sir.';
      }

      // Site Visit & Free Cab Booking
      if (text.includes('visit') || text.includes('nodbeku') || text.includes('cab') || text.includes('sunday') || text.includes('car') || text.includes('pickup') || text.includes('barthini') || text.includes('family') || text.includes('gaadi') || text.includes('free cab')) {
        if (lang === 'en-IN') {
          return 'Certainly, sir! We can arrange a complimentary AC cab pickup for your whole family this Sunday at 11 AM. May I note down your pickup address and family headcount?';
        }
        if (lang === 'hi-IN') {
          return 'Zaroor sir! Is Sunday 11 AM par hum aapki poori family ke liye free AC cab pickup arrange kar denge. Aapka pickup location aur family headcount bata sakte hain ji?';
        }
        return 'Khanditha sir! Ee Sunday 11 AM ge nimma whole family ge direct AC cab pickup arrange maadthini. Nimma pickup address mathu family headcount heli sir?';
      }

      // Token Amount & Booking
      if (text.includes('token') || text.includes('advance') || text.includes('booking') || text.includes('book') || text.includes('advance eshtu')) {
        if (lang === 'en-IN') {
          return 'Sir, you can secure your preferred plot number with an initial token amount of just ₹25,000. The remaining balance is payable upon document verification at registration.';
        }
        return 'Sir, just ₹25,000 token amount kottu nimge ishtavada plot number lock madbahudu. Documents verify madi registration time nalli balance pay madbahudu sir.';
      }

      // Dimensions & Rate General
      if (text.includes('rate') || text.includes('price') || text.includes('eshtu') || text.includes('cost') || text.includes('30 40') || text.includes('30x40') || text.includes('40 60') || text.includes('dimension') || text.includes('sqft') || text.includes('how much') || text.includes('size')) {
        const customPriceMatch = systemPrompt.match(/Plot Starting Price & Dimensions:\s*([^\n\r]+)/i) || systemPrompt.match(/Plots starting at\s*([^\n\r.]+)/i);
        if (customPriceMatch) {
          const customPrice = customPriceMatch[1].trim();
          return `Sir, namma plots ${customPrice} inda start aaguththe. Nimma budget range mathu dimension yavudhu plan madtidira sir?`;
        }
        if (lang === 'en-IN') {
          return 'Sir, our 30x40 plots start from ₹18 Lakhs, and 40x60 plots are ₹35 Lakhs. May I know your preferred budget range or dimensions so I can guide you to the best plot?';
        }
        if (lang === 'hi-IN') {
          return 'Sir, 30x40 plots ₹18 Lakhs se start hote hain, aur 40x60 plots ₹35 Lakhs ke hain. Aapka budget range aur dimension kya prefer karenge sir?';
        }
        if (lang === 'te-IN') {
          return 'Sir, 30x40 plots ₹18 Lakhs nundi start avthundi, mariyu 40x60 plots ₹35 Lakhs. Meeku entha budget lo plots kavali andi?';
        }
        return 'Sir, 30 40 plots 18 Lakhs inda start aaguththe, mathu 40 60 plots 35 Lakhs ide. Nimma budget range mathu dimension yavudhu plan madtidira sir?';
      }

      // Affirmation / Agreement
      if (text.includes('haudu') || text.includes('yes') || text.includes('sari') || text.includes('ok')) {
        if (lang === 'en-IN') {
          return 'Wonderful, sir! Shall I lock in your details on WhatsApp for the Sunday 11 AM cab pickup?';
        }
        return 'Super sir! Sunday 11 AM cab pickup ge nimma details WhatsApp nalli lock madla sir?';
      }

      if (lang === 'en-IN') {
        return 'Yes sir, we have DC converted, clear title residential plots. Are you looking for self-construction or investment?';
      }
      return 'Haudu sir, nammada DC converted, clear title layout plots ide. Nimage residential plot beka athva commercial investment ga sir?';
    }

    // =========================================================================
    // 3. HEALTHCARE & HOSPITAL CLINICAL INTELLIGENCE
    // =========================================================================
    if (systemPrompt.includes('Industry: HEALTHCARE_HOSPITAL') || systemPrompt.includes('HEALTHCARE_HOSPITAL') || systemPrompt.includes('Apollo Specialty Clinic')) {
      // Critical: Emergency Triage Red Flags!
      if (text.includes('emergency') || text.includes('chest pain') || text.includes('heart') || text.includes('heart attack') || text.includes('breath') || text.includes('bleeding') || text.includes('accident') || text.includes('unconscious') || text.includes('stroke') || text.includes('urgent')) {
        return 'Sir, idhu emergency aaguththe! Dayavittu immediately 108 ambulance call madi athva casualty emergency ward ge rush madi sir. Casualty duty doctor 24/7 ready irthare!';
      }

      // Doctor Timings: Cardiologist (Dr. Ramesh Patil)
      if (text.includes('ramesh') || text.includes('patil') || text.includes('cardiologist') || text.includes('heart doctor') || text.includes('doctor timing') || text.includes('doctor avaru yavaga')) {
        return 'Dr. Ramesh Patil avaru Senior Cardiologist, Mon-Sat beligge 10:00 inda 1:00 PM mathu sanje 5:00 inda 8:00 PM varagu OPD consultation madthare sir. Naale slot ge token lock madla sir?';
      }

      // Doctor Timings: Pediatrician (Dr. Priya Sharma)
      if (text.includes('priya') || text.includes('sharma') || text.includes('makkala') || text.includes('pediatric') || text.includes('child') || text.includes('baby') || text.includes('magu')) {
        return 'Dr. Priya Sharma avaru Consultant Pediatrician, beligge 9:00 inda 12:00 PM mathu sanje 4:00 inda 7:00 PM clinic nalli irthare sir. Naale morning slot ge token book madla?';
      }

      // Doctor Timings: Orthopedic (Dr. Suresh Rao)
      if (text.includes('suresh') || text.includes('rao') || text.includes('ortho') || text.includes('kaalu novu') || text.includes('bone') || text.includes('joint')) {
        return 'Dr. Suresh Rao avaru Senior Orthopedic Surgeon, Mon-Sat beligge 11:00 AM inda 2:00 PM clinic nalli irthare sir.';
      }

      // OPD Consultation Fees
      if (text.includes('opd fee') || text.includes('fee') || text.includes('charge') || text.includes('cost') || text.includes('eshtu fee') || text.includes('consultation')) {
        const customOpdMatch = systemPrompt.match(/OPD Consultation Fee:\s*₹?([^\n\r]+)/i);
        const opdVal = customOpdMatch ? customOpdMatch[1].trim() : '750';
        return `General specialist OPD consultation fee ₹${opdVal} aaguththe sir. Naale beligge token number book madla sir?`;
      }

      // Health Insurance / Cashless / Ayushman Bharat
      if (text.includes('insurance') || text.includes('ayushman') || text.includes('cashless') || text.includes('star health') || text.includes('care health') || text.includes('hdfc ergo') || text.includes('tpa') || text.includes('card')) {
        return 'Haudu sir! Star Health, Care Health, HDFC Ergo mathu Ayushman Bharat card galige cashless TPA desk 24 gante available ide sir.';
      }

      // Prescription / Phone Medicine Inquiry
      if (text.includes('medicine') || text.includes('tablet') || text.includes('tonic') || text.includes('prescription') || text.includes('phone nalli medicine')) {
        return 'Kshamisee sir, safety regulations prakara phone nalli medicine prescribe madoke baralla. Dayavittu direct OPD consultation ge banni sir.';
      }

      // Lab / Scan / Reports
      if (text.includes('blood test') || text.includes('scan') || text.includes('x-ray') || text.includes('mri') || text.includes('ultrasound') || text.includes('lab') || text.includes('report')) {
        return 'Namma NABL accredited lab mathu digital X-Ray, ultrasound unit 24/7 operate aaguththe sir. Reports same day WhatsApp nalli kooda deliver aaguththe.';
      }

      // General Appointment Booking vs Inquiry Discrimination
      const isAffirmingOrSlot = /\b(haudu|sari|ok|okay|yes|confirm|confirmed|book madi|lock madi|book maadi|lock maadi|11|11:30|morning|evening|beligge|sanje|naale|tomorrow)\b/i.test(text);
      const isAppointmentWord = text.includes('appointment') || text.includes('book') || text.includes('slot') || text.includes('token');

      // 1. Explicit affirmation or specific time slot choice -> Confirm appointment
      if (isAffirmingOrSlot || (isAppointmentWord && isAffirmingOrSlot)) {
        return 'Khanditha sir, naale beligge 11:30 AM appointment confirm maadiddini. Confirmation SMS mathu clinic location WhatsApp ge send madthini sir.';
      }

      // 2. Mere inquiry about appointment availability or booking process -> Ask doctor/department & slot preference
      if (isAppointmentWord || text.includes('doctor ideya') || text.includes('consultation')) {
        return 'Khanditha sir, Apollo clinic nalli doctor consultation ge appointment book madbahudu. Yaava doctor athva yaava department consultation beku sir, mathu yavaga preferred time slot?';
      }

      // 3. If previous turn offered to book a slot and caller affirmed
      if (lastAssistantMsg.includes('lock madla') || lastAssistantMsg.includes('book madla')) {
        if (text.includes('madi') || text.includes('sure') || text.includes('fine')) {
          return 'Khanditha sir, naale beligge 11:30 AM appointment confirm maadiddini. Confirmation SMS mathu clinic location WhatsApp ge send madthini sir.';
        }
      }

      return 'Namaskara sir, Apollo Specialty Clinic inda hegi help madbodu? Yaava doctor consultation beku sir?';
    }

    // =========================================================================
    // 4. DIGITAL MARKETING AGENCY SITUATIONAL INTELLIGENCE
    // =========================================================================
    if (systemPrompt.includes('Dhwani') || systemPrompt.includes('AGENCY') || systemPrompt.includes('Apex') || systemPrompt.includes('Inception') || systemPrompt.includes('Marketing')) {
      // Speed-to-Lead Autodialer (5-Second Call System)
      if (text.includes('speed to lead') || text.includes('5 second') || text.includes('instant call') || text.includes('autodialer') || text.includes('lead call') || text.includes('speed')) {
        return 'Sir, Meta Facebook mathu Google ads inda customer enquiry banda 5 seconds nalli namma AI autodialer call maadi lead qualify maaduththe. Zero lead drop!';
      }

      // ROI & Lead Quality Guarantees
      if (text.includes('roi') || text.includes('guarantee') || text.includes('lead quality') || text.includes('fake') || text.includes('results') || text.includes('cpl') || text.includes('cost per lead') || text.includes('quality')) {
        return 'Haudu sir! Namma AI verification inda fake mathu spam leads 100% filter aaguththe. Real estate mathu clinic clients ge contact rate 85% kinta jasti iruththe mathu CPL 30-40% drop aaguththe sir.';
      }

      // Retainers & Pricing
      if (text.includes('fee') || text.includes('charges') || text.includes('retainer') || text.includes('cost') || text.includes('pricing') || text.includes('monthly') || text.includes('eshtu rate') || text.includes('package')) {
        const customAgencyMatch = systemPrompt.match(/Agency Retainer \/ Ad Budget:\s*([^\n\r]+)/i);
        const retVal = customAgencyMatch ? customAgencyMatch[1].trim() : '₹25,000';
        return `Sir, monthly performance retainer ${retVal} inda start aaguththe. Zero setup fee, ad spend nimma own ad account nalle direct agi control madbahudu sir.`;
      }

      // Call with Agency Director
      if (text.includes('director') || text.includes('founder') || text.includes('meeting') || text.includes('zoom') || text.includes('talk to manager') || text.includes('consultation') || text.includes('call schedule')) {
        return 'Khanditha sir! Namma Agency Director jothe 15-minute 1-on-1 Zoom growth discovery call schedule madla sir? Naale 3 PM athva 5 PM yavudhu convenient sir?';
      }

      // Case Studies & Portfolio
      if (text.includes('portfolio') || text.includes('case study') || text.includes('clients') || text.includes('previous') || text.includes('results thorisi') || text.includes('proof')) {
        return 'Super sir! Bangalore mathu Bellary local business clients ge 10x ROI produce madida verified case study deck eegale nimma WhatsApp ge share madthini sir.';
      }

      // General Demo / Affirmation
      if (text.includes('yes') || text.includes('haudu') || text.includes('demo') || text.includes('test') || text.includes('beku')) {
        return 'Super sir! Namma team inda eegale WhatsApp ge live demo link mathu details share madthini. Nimma business name heli sir?';
      }

      return 'Namaskara sir! Nanu Conversational AI Voice Agent Sahana mathadtha iddini. Meta & Google ads lead generation mathu instant speed-to-lead automation bagge details beka sir?';
    }

    // Default polite Kanglish response with anti-repetition guard
    const defaultReply = 'Haudu sir, namma executive team nimge details share madthare. Enu inquiry itthu heli sir?';
    if (lastAssistantMsg && lastAssistantMsg === defaultReply) {
      return 'Khanditha sir, nimma requirement note madkondiddini. Namma team eegale WhatsApp nalli complete catalog share madthare sir.';
    }
    return defaultReply;
  }
}
