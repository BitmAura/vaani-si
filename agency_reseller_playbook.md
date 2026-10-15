# VANNI-SI: Digital Marketing Agency Reseller Playbook
**Confidential Architecture & Brainstorming Guide for the Master Agency**

As the owner of a Digital Marketing Agency in Karnataka, your goal isn't just to use software—it's to **white-label it, resell it, and use it as a retention moat** so your clients never fire you. 

Here is the exact end-to-end architecture, pricing, and LLM configuration guide for your agency.

---

## 1. Agency Login & Business Model (How You Sell It)

### How You Login
You log in to the **Agency Master Dashboard** (Tenant ID: `Creative Digital Agency`).
From here, you have an "Agency View" where you see all your sub-clients (e.g., Apollo Dental Clinic, Ballari Layouts) in a single dropdown. You don't need 10 different passwords. You control all their billing, voice configurations, and lead flows from your master console.

### Your Joining Fee & Reseller Economics
You are acting as a SaaS reseller (Value-Added Reseller - VAR).
* **Our Cost to You (The Platform Cost):** ₹5,000/month flat base fee + ₹2 per minute of AI Voice Talktime.
* **Your Pitch to Clients:** "We now offer an *Automated AI Sales Rep* that calls every Meta lead in 5 seconds."
* **Your Upsell (Joining Fee):** You charge a ₹15,000 to ₹30,000 setup fee to "train the AI on their business."
* **Your Monthly Retainer:** You charge them ₹10,000 to ₹20,000/month for the AI automation software package. 
**ROI:** You make an 80%+ profit margin on the software, and your ad retention jumps to 100% because leads are actually being converted.

---

## 2. Configuring the Voice for Medical vs. Real Estate

You asked: *How do I configure the Kannada voice to sound different for a plot seller vs. a doctor?*

This is handled in our **Voice Tuning Lab** using the `targetLanguageCode` and `speaker` variables hitting the Sarvam API:

| Vertical | Suggested Speaker (Tone) | Dialect Configuration | Rationale |
| :--- | :--- | :--- | :--- |
| **Real Estate** | `Aditya` (Authoritative Male) | North Karnataka / Standard Kannada | Real estate buyers want to feel confident they are speaking to a senior sales manager who knows plot dimensions, DC conversion rules, and loan EMIs. |
| **Medical / Dental** | `Kavya` (Empathetic Female) | Pure Polite Bengaluru Kannada | Patients booking root canals or general checkups expect warmth, patience, and a calming, professional receptionist tone. |

---

## 3. The Brain (LLM Prompting & Knowledge Configuration)

To make the AI actually smart, we use **RAG (Retrieval-Augmented Generation) combined with strict System Prompts**. 

Here is exactly what you (the agency) need to fill in for a client during onboarding to make the LLM work flawlessly:

### A. The Core System Prompt (The AI's DNA)
You configure a hidden `system_prompt` for each sub-client. 
**Example Real Estate Prompt:**
> "You are Aditya, a senior sales executive for Ballari Residential Layouts. Speak in polite Kannada and Kanglish. Your goal is to qualify the lead by asking if they are looking for investment or immediate construction, and then push them to book a free cab for a Sunday site visit. Do not negotiate on the ₹18 Lakhs starting price."

**Example Medical Prompt:**
> "You are Kavya, the front desk receptionist for Apollo Dental Clinic in Indiranagar. Speak warmly. If a patient asks about root canal pain, show extreme empathy. Ask if they prefer a morning or evening slot. You cannot prescribe medicine. Your only goal is to confirm their appointment slot."

### B. The Knowledge Base (RAG Documents)
You upload PDF/Word documents into the **Business Brain (Knowledge)** tab. The LLM reads these before answering. You must supply:
1. **Pricing Sheets:** (e.g., Plot dimensions, Root Canal costs).
2. **Objection Handling:** (e.g., "What if the plot is not BDA approved?" -> "Sir, this is DC converted with A-Khata.")
3. **Availability / Timings:** (e.g., Clinic hours, Site visit cab timings).

---

## 4. How the CRM Shows Data (End-to-End for Agencies)

When your Facebook Ad generates a lead, here is the exact lifecycle visible on your dashboard:

1. **Meta Webhook Triggers (T = 0s):** The lead (e.g., Ramesh, +919876543210) clicks "Submit" on Facebook.
2. **AI Dispatch (T = +3s):** The Fastify backend immediately triggers the Outbound SIP Engine.
3. **The Call Occurs (T = +5s):** The AI dials Ramesh. They converse in Kannada.
4. **CRM Update (T = +2 mins):** The call ends. The audio is transcribed via STT.
5. **The Master Dashboard View:** 
   * As the Agency Owner, you open `console.html`.
   * You select `Ballari Residential Layouts` from your Tenant Dropdown.
   * You look at the **All Call Logs** tab. You see:
     `Ramesh | +919876543210 | Duration: 2m 14s | Status: HOT LEAD | Outcome: Sunday Site Visit Booked.`
   * You click on the lead and can instantly play the audio recording of the AI talking to Ramesh.
6. **WhatsApp Dispatch:** Ramesh immediately receives an automated WhatsApp on his phone: *"Namaskara Ramesh! Thanks for speaking with Aditya. Your Sunday site visit is confirmed."*

### Why this makes you unstoppable:
When your real estate client complains on a Friday, "We got no good leads this week," you simply pull up the CRM, hit play on the audio recording of their lead agreeing to a site visit, and prove your ROI instantly.
