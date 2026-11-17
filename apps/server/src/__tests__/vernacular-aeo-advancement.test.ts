/**
 * VERNACULAR DIALECT & AEO/GEO OPEN-SOURCE ADVANCEMENT TEST SUITE
 * 
 * Verifies:
 * 1. North Kannada, Old Mysuru, Kanglish, Hinglish, and English vernacular classification
 * 2. Semantic turn endpointing with discourse connector pause extension (LiveKit pattern)
 * 3. Dynamic real-time dialect switching inside AudioConversationPipeline
 * 4. Dialect-matched acoustic filler selection (North Kannada, Hinglish, Kanglish, English)
 * 5. Full AEO/GEO /llms-full.txt Answer.ai deep feed & Schema.org SpeakableSpecification
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { VernacularDialectClassifier } from '../../../../packages/core/src/conversation/vernacular-classifier.js';
import { PromptEngine } from '../../../../packages/core/src/conversation/prompt-engine.js';
import type { Tenant } from '../../../../packages/core/src/domain/types.js';
import { KannadaFillerEngine } from '../kannada-fillers.js';
import { AudioConversationPipeline } from '../audio-pipeline.js';
import { GEO_SHIELD_MONTHLY_INR } from '../routes/geo.js';

describe('Vernacular Dialect & Open-Source AEO/GEO Capabilities', () => {
  let server: any;
  let baseUrl: string;

  const mockTenant: Tenant = {
    id: 't_ballari_realestate',
    name: 'Ballari Royal Layouts',
    industry: 'REAL_ESTATE',
    virtualPhoneNumber: '+918047192001',
    ownerWhatsAppNumber: '+919900112233',
    dialect: 'KANNADA_STANDARD_POLITE',
    knowledge: {
      companyName: 'Ballari Royal Layouts',
      industry: 'REAL_ESTATE',
      primaryDialect: 'KANNADA_STANDARD_POLITE',
      officeTimings: '9:00 AM - 7:00 PM',
      catalogSummary: 'RERA-approved 30x40 and 40x60 plots on Siruguppa Bypass, Ballari starting at 18 Lakhs.',
      faqs: [
        { question: 'Plot rate eshtu?', answer: '30x40 plots 18 Lakhs inda start aaguththe sir.' }
      ],
      appointmentRules: {
        slotDurationMinutes: 60,
        availableDays: ['Sunday'],
        freeCabOffered: true,
      }
    },
    monthlyMinuteLimit: 5000,
    minutesUsedCurrentMonth: 0,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    server = await buildServer();
    const address = await server.listen({ port: 0, host: '127.0.0.1' });
    baseUrl = address;
  });

  afterAll(async () => {
    if (server) await server.close();
  });

  // =========================================================================
  // 1. Vernacular Dialect Classification (Karnataka & Pan-India)
  // =========================================================================
  describe('1. Vernacular Dialect Classification', () => {
    it('accurately identifies North Karnataka (Uttara Kannada / Hubli / Ballari) speech', () => {
      const utterances = [
        'Namaste ri, Siruguppa road plot esht aithi ri?',
        'Bhesh aithi ri, naale nodoke barle ri?',
        'Haudri, oota aaytha ri nimdu? Plots details helri',
        'Yakri eshtu rate aithi? Kammi aagthada ri?',
      ];

      for (const utt of utterances) {
        const res = VernacularDialectClassifier.classifyDialect(utt);
        expect(res.dialect).toBe('KANNADA_NORTH');
        expect(res.confidence).toBeGreaterThanOrEqual(0.6);
        expect(res.detectedMarkers.length).toBeGreaterThan(0);
      }
    });

    it('accurately identifies Old Mysuru respectful speech', () => {
      const utterances = [
        'Namaskara swamy, layout details thiliyona swamy',
        'Banni swamy, chennagiddira? Site rate eshtu swamy?',
        'Khanditha swamy, naale visit plan madona',
      ];

      for (const utt of utterances) {
        const res = VernacularDialectClassifier.classifyDialect(utt);
        expect(res.dialect).toBe('KANNADA_MYSURU');
        expect(res.confidence).toBeGreaterThanOrEqual(0.6);
      }
    });

    it('accurately identifies Bengaluru Urban Cosmopolitan Kanglish', () => {
      const utterances = [
        'Hey guru, Whitefield bypass plots available ideya?',
        'Bro, Sunday visit plan madona, details WhatsApp alli share madi',
        'Tension illa boss, quick call alli sort madona',
      ];

      for (const utt of utterances) {
        const res = VernacularDialectClassifier.classifyDialect(utt);
        expect(res.dialect).toBe('KANGLISH_BUSINESS');
        expect(res.confidence).toBeGreaterThanOrEqual(0.55);
      }
    });

    it('accurately identifies Commercial Hindi / Hinglish', () => {
      const utterances = [
        'Namaste bhaiya, plot ka kya rate chal raha hai?',
        'Haanji bhaiya, 30x40 plot dekhna hai, kitna rate hai bataiye',
        'Theek hai bhaiya, Sunday ko site visit ke liye kab aana hai?',
      ];

      for (const utt of utterances) {
        const res = VernacularDialectClassifier.classifyDialect(utt);
        expect(res.dialect).toBe('HINDI_HINGLISH');
        expect(res.confidence).toBeGreaterThanOrEqual(0.65);
      }
    });

    it('accurately identifies Indian English corporate speech', () => {
      const utterance = 'Hello, can you please tell me the exact price and dimensions of your available plots?';
      const res = VernacularDialectClassifier.classifyDialect(utterance);
      expect(res.dialect).toBe('INDIAN_ENGLISH');
    });
  });

  // =========================================================================
  // 2. Semantic Turn Endpointing (LiveKit & Pipecat Architecture)
  // =========================================================================
  describe('2. Semantic Turn Endpointing Heuristics', () => {
    it('extends silence timeout to 850ms when caller pauses on an incomplete connector', () => {
      const incompleteUtterances = [
        'plots rate thumba reasonable aagide matte',
        'hum Sunday ko aana chahte the lekin',
        'we are looking for a property in Ballari and',
        'namma family jothe nodbeku aadare',
      ];

      for (const utt of incompleteUtterances) {
        const evalRes = VernacularDialectClassifier.evaluateTurnCompletion(utt);
        expect(evalRes.isComplete).toBe(false);
        expect(evalRes.recommendedSilenceMs).toBeGreaterThanOrEqual(800);
        expect(evalRes.hasIncompleteConnector).toBe(true);
      }
    });

    it('triggers snappy 250ms handover when caller finishes a question or thought', () => {
      const completeUtterances = [
        'Siruguppa road layout alli 30x40 plots available ideya?',
        'Bhaiya kitna rate hai?',
        'Please send me the brochure on WhatsApp please',
        'Thumba dhanyavadagalu',
      ];

      for (const utt of completeUtterances) {
        const evalRes = VernacularDialectClassifier.evaluateTurnCompletion(utt);
        expect(evalRes.isComplete).toBe(true);
        expect(evalRes.recommendedSilenceMs).toBeLessThanOrEqual(300);
      }
    });
  });

  // =========================================================================
  // 3. Dialect-Matched Acoustic Fillers & Dynamic Pipeline Adaptation
  // =========================================================================
  describe('3. Dialect-Matched Fillers & Dynamic Pipeline Adaptation', () => {
    it('adapts acoustic fillers to authentic North Karnataka syntax', () => {
      const priceNorth = KannadaFillerEngine.selectFiller('plots eshtu rate aithi ri', 'KANNADA_NORTH');
      expect(priceNorth.kanglishText).toContain('Haudri');
      expect(priceNorth.kanglishText).toContain('nodri');

      const ackNorth = KannadaFillerEngine.selectFiller('details helri', 'KANNADA_NORTH');
      expect(ackNorth.kanglishText).toContain('Haudri');
      expect(ackNorth.kanglishText).toContain('kelri');
    });

    it('adapts acoustic fillers to conversational Hindi/Hinglish', () => {
      const priceHindi = KannadaFillerEngine.selectFiller('plot ka kitna rate hai bhaiya', 'HINDI_HINGLISH');
      expect(priceHindi.kanglishText).toContain('Ji bilkul');
      expect(priceHindi.kanglishText).toContain('bhaiya');
    });

    it('adapts acoustic fillers to Bengaluru Kanglish', () => {
      const priceKanglish = KannadaFillerEngine.selectFiller('rate eshtu guru', 'KANGLISH_BUSINESS');
      expect(priceKanglish.kanglishText).toContain('Sure guru');
    });

    it('dynamically switches pipeline dialect when caller speaks North Karnataka dialect', async () => {
      const pipeline = new AudioConversationPipeline(mockTenant);
      expect(pipeline.getActiveDialect()).toBe('KANNADA_STANDARD_POLITE');

      // Process North Karnataka caller input
      await pipeline.processUserUtterance(
        {
          onTranscript: () => {},
          onLatencyBreakdown: () => {},
          onAudioChunk: () => {},
        },
        'Namaste ri, Siruguppa road plot rate esht aithi ri?'
      );

      // Verify pipeline automatically switched to North Karnataka persona
      expect(pipeline.getActiveDialect()).toBe('KANNADA_NORTH');
    });

    it('injects customized regional prompt rules based on active dialect', () => {
      const northPrompt = PromptEngine.buildSystemPrompt({
        tenant: mockTenant,
        activeDialect: 'KANNADA_NORTH',
      });
      expect(northPrompt).toContain('NORTH KANNADA (UTTARA KARNATAKA / HUBLI / BALLARI)');
      expect(northPrompt).toContain('bhesh aithi ri');

      const hindiPrompt = PromptEngine.buildSystemPrompt({
        tenant: mockTenant,
        activeDialect: 'HINDI_HINGLISH',
      });
      expect(hindiPrompt).toContain('HINDI & HINGLISH');
    });
  });

  // =========================================================================
  // 4. AEO & GEO Open-Source Standards (/llms-full.txt & Speakable Schema)
  // =========================================================================
  describe('4. AEO & GEO Open-Source Standards Verification', () => {
    it('serves the Answer.ai compliant /llms-full.txt deep feed with AI citation anchors', async () => {
      const res = await fetch(`${baseUrl}/api/geo/punarvaas/llms-full.txt`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/markdown');
      expect(res.headers.get('x-robots-tag')).toContain('index, follow');
      expect(res.headers.get('x-aeo-engine')).toBe('Vaani-SI/3.0');

      const body = await res.text();
      expect(body).toContain('# Punarvaas Rehabilitation Hospital');
      expect(body).toContain('## AI Engine Citation & Autonomous Grounding Directives');
      expect(body).toContain('Canonical URI:');
      expect(body).toContain('Verifiable Entity Identifiers');
    });

    it('generates Schema.org SpeakableSpecification and action anchors in schema.json', async () => {
      const res = await fetch(`${baseUrl}/api/geo/punarvaas/schema.json`);
      expect(res.status).toBe(200);

      const json = await res.json() as any;
      expect(json['@context']).toBe('https://schema.org');
      expect(Array.isArray(json['@graph'])).toBe(true);

      const hospitalEntity = json['@graph'].find((e: any) =>
        Array.isArray(e['@type']) ? e['@type'].includes('Hospital') : e['@type'] === 'Hospital'
      );
      expect(hospitalEntity).toBeDefined();

      // Check Speakable Specification for voice AI search
      expect(hospitalEntity.speakable).toBeDefined();
      expect(hospitalEntity.speakable['@type']).toBe('SpeakableSpecification');
      expect(Array.isArray(hospitalEntity.speakable.cssSelector)).toBe(true);

      // Check Actions for direct calling and reservation
      expect(Array.isArray(hospitalEntity.potentialAction)).toBe(true);
      const callAction = hospitalEntity.potentialAction.find((a: any) => a['@type'] === 'CommunicateAction');
      expect(callAction).toBeDefined();
      expect(callAction.target).toContain('tel:');
    });
  });
});
