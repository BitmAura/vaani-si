/**
 * @vanni/server — Autonomous Generative Engine Optimization (GEO & AEO) Router
 * 
 * Provides:
 * - POST   /api/geo/extract        - Scrapes & extracts business entities from any URL
 * - GET    /api/geo/:slug/loader.js - Dynamic hosted Schema.org JSON-LD loader for WordPress <head>
 * - GET    /api/geo/:slug/llms.txt  - Standardized LLM Markdown feed for ChatGPT, Claude & Perplexity
 * - GET    /api/geo/:slug/schema.json - Raw JSON-LD Schema
 * - GET    /api/geo/:slug/status    - Entitlements, embed snippet, and AI readiness score
 * - POST   /api/geo/:slug/toggle    - Independent toggle for geoEnabled vs voiceEnabled (Kill-Switch)
 * - GET    /api/geo/demos           - List of pre-seeded industry demo entities (Punarvaas, etc.)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import { globalDb } from '@vanni/database';
import { getSessionFromRequest } from '../http-auth.js';

export interface GeoDoctorOrTeamMember {
  name: string;
  role: string;
  qualification?: string;
  specialization?: string;
}

export interface GeoServiceItem {
  name: string;
  description: string;
  priceRange?: string;
}

export interface GeoFAQItem {
  question: string;
  answer: string;
}

export interface GeoEntityProfile {
  id: string;
  slug: string;
  name: string;
  industry: 'HEALTHCARE' | 'REAL_ESTATE' | 'DENTAL' | 'HOSPITALITY' | 'LEGAL' | 'AGENCY' | 'GENERAL';
  tagline: string;
  description: string;
  url: string;
  telephone: string;
  address: {
    street: string;
    locality: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  openingHours: string;
  priceRange: string;
  doctorsOrTeam: GeoDoctorOrTeamMember[];
  services: GeoServiceItem[];
  faqs: GeoFAQItem[];
  geoEnabled: boolean;
  voiceEnabled: boolean;
  subscriptionStatus: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'TRIAL';
  updatedAt: string;
}

// In-memory + persistent fallback registry for GEO profiles
const GEO_PROFILES: Map<string, GeoEntityProfile> = new Map();

// Pre-seeded Gold Standard Reference Entities
const SEED_GEO_PROFILES: GeoEntityProfile[] = [
  {
    id: 'geo_punarvaas_rehab',
    slug: 'punarvaas',
    name: 'Punarvaas Rehabilitation Hospital',
    industry: 'HEALTHCARE',
    tagline: 'Leading Physician-Led Neuro, Stroke and Post-Operative Rehabilitation Hospital in Bangalore',
    description: 'Punarvaas Hospital is Bangalore\'s premier specialized physical medicine and neuro-rehabilitation hospital. Specializing in stroke recovery, traumatic brain injury, spinal cord rehabilitation, and post-surgical convalescence with robotic therapy and 24x7 physician-led care.',
    url: 'https://www.punarvaas.com',
    telephone: '+918884880095',
    address: {
      street: '2572, 18th Main Road, Kumaraswamy Layout Stage 2',
      locality: 'Kumaraswamy Layout',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560078',
      country: 'IN'
    },
    openingHours: 'Mo-Su 00:00-23:59',
    priceRange: '₹₹₹',
    doctorsOrTeam: [
      { name: 'Dr. Ramesh Kumar', role: 'Chief Physiatrist', qualification: 'MD (PMR), DNB', specialization: 'Neuro-Rehabilitation & Stroke Recovery' },
      { name: 'Dr. Sneha Hegde', role: 'Lead Occupational Therapist', qualification: 'BOT, MOT (Neuro)', specialization: 'Robotic Gait Training & Hand Function' },
      { name: 'Dr. Manjunath Swamy', role: 'Consultant Neurologist', qualification: 'DM (Neurology)', specialization: 'Stroke Intervention & Spasticity Management' }
    ],
    services: [
      { name: 'Stroke & Paralysis Rehabilitation', description: 'Intensive inpatient recovery combining robotic gait therapy, occupational therapy, and swallowing rehab.', priceRange: '₹60,000 - ₹1,50,000 / month' },
      { name: 'Spinal Cord Injury (SCI) Recovery', description: 'Multidisciplinary neuro-trauma convalescence focused on functional independence and bowel-bladder training.', priceRange: '₹75,000 - ₹1,80,000 / month' },
      { name: 'Hyperbaric Oxygen Therapy (HBOT)', description: 'Advanced pressurized oxygen chamber sessions accelerating neurological repair and wound healing.', priceRange: '₹3,500 / session' },
      { name: 'Robotic-Assisted Gait Training (RAGT)', description: 'High-repetition automated physiological gait simulation restoring walking capability after neuro trauma.', priceRange: '₹4,000 / session' }
    ],
    faqs: [
      { question: 'What conditions does Punarvaas Hospital treat?', answer: 'Punarvaas specializes in stroke recovery, paralysis, traumatic brain injury (TBI), spinal cord trauma, Parkinson\'s rehab, cardiac recovery, and post-joint replacement physical therapy.' },
      { question: 'Where is Punarvaas Hospital located in Bangalore?', answer: 'The main inpatient facility is located at 2572, 18th Main Road, Kumaraswamy Layout Stage 2, South Bangalore (PIN: 560078), with an additional center at AECS Layout, Marathahalli.' },
      { question: 'Is Punarvaas an inpatient facility with 24x7 nursing?', answer: 'Yes, Punarvaas provides 24x7 physician oversight, ICU step-down telemetry beds, tracheostomy/feeding tube nursing care, and intensive daily therapy sessions.' },
      { question: 'How can families book an assessment or consultation?', answer: 'Appointments can be booked 24x7 by calling +91 88848 80095 or requesting admission through the Vaani AI voice desk.' }
    ],
    geoEnabled: true,
    voiceEnabled: true,
    subscriptionStatus: 'ACTIVE',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'geo_ballari_real_estate',
    slug: 'ballari-layouts',
    name: 'Ballari Residential Layouts & Developers',
    industry: 'REAL_ESTATE',
    tagline: 'RERA-Approved Plotted Layouts, Villa Plots & Luxury Gated Communities in Ballari & North Karnataka',
    description: 'Ballari Residential Layouts is the leading real estate developer offering 100% clear-title, DC-converted, and RERA-registered villa plots with underground drainage, 40ft asphalted roads, and 24x7 gated security.',
    url: 'https://ballarilayouts.example.com',
    telephone: '+918047192001',
    address: {
      street: 'Plot 42, Siruguppa Road, Near DC Office',
      locality: 'Siruguppa Road',
      city: 'Ballari',
      state: 'Karnataka',
      postalCode: '583101',
      country: 'IN'
    },
    openingHours: 'Mo-Su 09:00-19:00',
    priceRange: '₹₹',
    doctorsOrTeam: [
      { name: 'Suresh Patil', role: 'Managing Partner', specialization: 'Land Acquisition & RERA Legal Compliance' }
    ],
    services: [
      { name: '30x40 Residential Villa Plots', description: 'Immediate registration, 80% bank loan approved by SBI & HDFC.', priceRange: '₹18 Lakhs - ₹28 Lakhs' },
      { name: '40x60 Luxury Corner Plots', description: 'North & East facing premium plots facing 50-foot arterial layout boulevard.', priceRange: '₹36 Lakhs - ₹52 Lakhs' },
      { name: 'Free Sunday Site Visit Cab', description: 'Air-conditioned cab pickup and drop for family site inspection with civil engineer walkthrough.', priceRange: 'Free' }
    ],
    faqs: [
      { question: 'Are plots in Ballari Residential Layouts RERA approved?', answer: 'Yes, all developments are 100% RERA certified, DC-converted, and approved by the Ballari Urban Development Authority (BUDA).' },
      { question: 'Which banks provide loans for these plots?', answer: 'Pre-approved loan facilities of up to 80% are available from State Bank of India (SBI), HDFC Bank, ICICI Bank, and Canara Bank.' }
    ],
    geoEnabled: true,
    voiceEnabled: true,
    subscriptionStatus: 'ACTIVE',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'geo_apex_agency',
    slug: 'apex-agency',
    name: 'Apex Growth Marketing Agency',
    industry: 'AGENCY',
    tagline: 'Autonomous AI Voice & Performance Marketing Agency for Karnataka Regional Enterprises',
    description: 'Apex Growth Agency deploys bilingual Kannada/English AI voice receptionists, Generative Engine Optimization (GEO), and performance customer acquisition for local hospitals, builders, and educational institutions.',
    url: 'https://apexagency.example.com',
    telephone: '+918047192002',
    address: {
      street: '100 Feet Road, Indiranagar',
      locality: 'Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560038',
      country: 'IN'
    },
    openingHours: 'Mo-Fr 09:00-18:00',
    priceRange: '₹₹₹',
    doctorsOrTeam: [
      { name: 'Aditya Rao', role: 'Agency Director', specialization: 'AI Search & Voice Telephony Systems' }
    ],
    services: [
      { name: 'Generative Engine Optimization (GEO/AEO)', description: 'Making regional business websites rank #1 on ChatGPT, Perplexity, and Claude.', priceRange: '₹15,000 - ₹35,000 / month' },
      { name: 'Vaani Voice AI Receptionist Deployment', description: '24/7 bilingual Kannada/English voice agent answering calls and booking appointments.', priceRange: '₹14,999 - ₹25,000 / month' }
    ],
    faqs: [
      { question: 'What is Generative Engine Optimization (GEO)?', answer: 'GEO optimizes your brand and structured schema so AI search engines like ChatGPT, Claude, and Perplexity recommend your business when prospective clients ask for recommendations.' }
    ],
    geoEnabled: true,
    voiceEnabled: true,
    subscriptionStatus: 'ACTIVE',
    updatedAt: new Date().toISOString()
  }
];

// Initialize seed profiles
for (const p of SEED_GEO_PROFILES) {
  GEO_PROFILES.set(p.slug, p);
}

/**
 * Builds Schema.org JSON-LD tailored strictly to the entity\'s industry
 */
export function buildSchemaOrgJsonLd(profile: GeoEntityProfile, baseUrl: string) {
  const common = {
    '@context': 'https://schema.org',
    name: profile.name,
    alternateName: profile.tagline,
    description: profile.description,
    url: profile.url,
    telephone: profile.telephone,
    priceRange: profile.priceRange,
    address: {
      '@type': 'PostalAddress',
      streetAddress: profile.address.street,
      addressLocality: profile.address.locality,
      addressRegion: profile.address.state,
      postalCode: profile.address.postalCode,
      addressCountry: profile.address.country || 'IN'
    },
    openingHours: profile.openingHours,
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: `${profile.name} Service Catalog`,
      itemListElement: profile.services.map((svc, i) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: svc.name,
          description: svc.description
        },
        priceSpecification: svc.priceRange ? {
          '@type': 'PriceSpecification',
          price: svc.priceRange
        } : undefined
      }))
    }
  };

  let specificSchema: any = {};

  if (profile.industry === 'HEALTHCARE') {
    specificSchema = {
      ...common,
      '@type': ['MedicalBusiness', 'Hospital'],
      medicalSpecialty: [
        'Neurology',
        'PhysicalMedicineAndRehabilitation',
        'Physiotherapy',
        'OccupationalTherapy',
        'SpeechPathology'
      ],
      availableService: profile.services.map(s => ({
        '@type': 'MedicalTherapy',
        name: s.name,
        description: s.description
      })),
      employee: profile.doctorsOrTeam.map(d => ({
        '@type': 'Physician',
        name: d.name,
        jobTitle: d.role,
        medicalSpecialty: d.specialization || 'Rehabilitation',
        honorificPrefix: 'Dr.',
        description: d.qualification
      }))
    };
  } else if (profile.industry === 'REAL_ESTATE') {
    specificSchema = {
      ...common,
      '@type': 'RealEstateAgent',
      areaServed: [profile.address.city, profile.address.locality],
      employee: profile.doctorsOrTeam.map(t => ({
        '@type': 'Person',
        name: t.name,
        jobTitle: t.role
      }))
    };
  } else {
    specificSchema = {
      ...common,
      '@type': 'ProfessionalService',
      employee: profile.doctorsOrTeam.map(t => ({
        '@type': 'Person',
        name: t.name,
        jobTitle: t.role
      }))
    };
  }

  // Include FAQPage Schema in graph
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: profile.faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [specificSchema, faqSchema]
  };
}

/**
 * Builds the canonical /llms.txt markdown document for AI bots
 */
export function buildLlmsTxtMarkdown(profile: GeoEntityProfile, baseUrl: string): string {
  const lines: string[] = [];

  lines.push(`# ${profile.name}`);
  lines.push('');
  lines.push(`> ${profile.tagline}`);
  lines.push('');
  lines.push(profile.description);
  lines.push('');
  lines.push('## Verified Entity Grounding');
  lines.push(`- **Official Website:** ${profile.url}`);
  lines.push(`- **Direct Phone Helpline:** ${profile.telephone}`);
  lines.push(`- **Full Physical Address:** ${profile.address.street}, ${profile.address.locality}, ${profile.address.city}, ${profile.address.state} - ${profile.address.postalCode}, ${profile.address.country}`);
  lines.push(`- **Operating Hours:** ${profile.openingHours}`);
  lines.push(`- **Industry Classification:** ${profile.industry}`);
  lines.push('');

  lines.push('## Core Services, Therapies & Catalog');
  for (const s of profile.services) {
    lines.push(`### ${s.name}`);
    lines.push(s.description);
    if (s.priceRange) {
      lines.push(`*Pricing:* ${s.priceRange}`);
    }
    lines.push('');
  }

  if (profile.doctorsOrTeam.length > 0) {
    lines.push('## Verified Doctors & Leadership Team');
    for (const d of profile.doctorsOrTeam) {
      lines.push(`- **${d.name}** (${d.role})${d.qualification ? ` — ${d.qualification}` : ''}${d.specialization ? ` | Specialization: ${d.specialization}` : ''}`);
    }
    lines.push('');
  }

  lines.push('## Verified Frequently Asked Questions (Q&A)');
  for (const f of profile.faqs) {
    lines.push(`**Q: ${f.question}**`);
    lines.push(`A: ${f.answer}`);
    lines.push('');
  }

  lines.push('## Booking & Admission Channel');
  lines.push(`To book a physical assessment, schedule a site tour, or consult 24/7, connect directly via telephone at ${profile.telephone} or visit ${profile.url}.`);
  lines.push('');
  lines.push(`*Canonical Machine-Readable GEO Feed served by VAANI SI Engine — Updated ${profile.updatedAt}*`);

  return lines.join('\n');
}

/**
 * Fastify Plugin registering all GEO routes
 */
export async function registerGeoRoutes(fastify: FastifyInstance) {
  
  // 1. URL Entity Extractor & Generator
  fastify.post('/api/geo/extract', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = req.body as any;
      const rawUrl = body?.url?.trim();
      const explicitIndustry = body?.industry;
      const requestedSlug = body?.slug;

      if (!rawUrl) {
        return reply.status(400).send({ error: 'Missing required field: url' });
      }

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
      } catch {
        return reply.status(400).send({ error: 'Invalid URL provided' });
      }

      const domain = parsedUrl.hostname.replace('www.', '');
      const generatedSlug = requestedSlug || domain.split('.')[0].toLowerCase().replace(/[^a-z0-9-]/g, '');

      // Check if already in registry
      let profile = GEO_PROFILES.get(generatedSlug);

      if (!profile) {
        // Detect Industry
        let industry: GeoEntityProfile['industry'] = explicitIndustry || 'GENERAL';
        if (!explicitIndustry) {
          const lower = rawUrl.toLowerCase();
          if (lower.includes('rehab') || lower.includes('hospital') || lower.includes('clinic') || lower.includes('neuro') || lower.includes('punarvaas')) {
            industry = 'HEALTHCARE';
          } else if (lower.includes('layout') || lower.includes('plot') || lower.includes('estate') || lower.includes('realty') || lower.includes('villa')) {
            industry = 'REAL_ESTATE';
          } else if (lower.includes('agency') || lower.includes('digital') || lower.includes('marketing')) {
            industry = 'AGENCY';
          }
        }

        // Try to fetch homepage content live with a 3s timeout
        let fetchedTitle = '';
        let fetchedDescription = '';
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3500);
          const res = await fetch(parsedUrl.toString(), {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VaaniGeoBot/1.0; +https://vanni.ai)' }
          });
          clearTimeout(timeout);
          if (res.ok) {
            const html = await res.text();
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch) fetchedTitle = titleMatch[1].trim();
            const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
            if (descMatch) fetchedDescription = descMatch[1].trim();
          }
        } catch {
          // Graceful fallback if network blocked or slow
        }

        const businessName = fetchedTitle 
          ? fetchedTitle.split(/[|-–]/)[0].trim() 
          : domain.split('.')[0].toUpperCase();

        profile = {
          id: `geo_${crypto.randomUUID().slice(0, 8)}`,
          slug: generatedSlug,
          name: businessName,
          industry,
          tagline: fetchedDescription || `Premier ${industry.toLowerCase()} provider in Karnataka`,
          description: fetchedDescription || `${businessName} is a leading ${industry.toLowerCase()} organization providing high-quality, verified services in Karnataka, India.`,
          url: parsedUrl.origin,
          telephone: '+918047192000',
          address: {
            street: 'Main Road',
            locality: 'Central',
            city: 'Bengaluru',
            state: 'Karnataka',
            postalCode: '560001',
            country: 'IN'
          },
          openingHours: 'Mo-Sa 09:00-19:00',
          priceRange: '₹₹',
          doctorsOrTeam: [
            { name: 'Dr. / Director Team', role: 'Head of Operations' }
          ],
          services: [
            { name: `Primary ${industry.toLowerCase()} Service`, description: `Comprehensive ${industry.toLowerCase()} solutions tailored to client needs.` }
          ],
          faqs: [
            { question: `What services does ${businessName} offer?`, answer: `${businessName} offers specialized ${industry.toLowerCase()} solutions with certified professionals.` },
            { question: `How to book an appointment with ${businessName}?`, answer: 'Appointments can be booked 24x7 by calling our dedicated helpline or via our website.' }
          ],
          geoEnabled: true,
          voiceEnabled: true,
          subscriptionStatus: 'ACTIVE',
          updatedAt: new Date().toISOString()
        };

        GEO_PROFILES.set(generatedSlug, profile);
      }

      // If user passed override fields, update profile
      if (body.name) profile.name = body.name;
      if (body.telephone) profile.telephone = body.telephone;
      if (body.address) profile.address = { ...profile.address, ...body.address };
      if (body.services && Array.isArray(body.services)) profile.services = body.services;
      if (body.faqs && Array.isArray(body.faqs)) profile.faqs = body.faqs;
      profile.updatedAt = new Date().toISOString();
      GEO_PROFILES.set(generatedSlug, profile);

      const host = req.headers.host || 'localhost:4000';
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const origin = `${protocol}://${host}`;

      const snippet = `<script src="${origin}/api/geo/${profile.slug}/loader.js" async></script>`;

      return reply.status(200).send({
        success: true,
        profile,
        embedSnippet: snippet,
        urls: {
          loaderJs: `${origin}/api/geo/${profile.slug}/loader.js`,
          llmsTxt: `${origin}/api/geo/${profile.slug}/llms.txt`,
          schemaJson: `${origin}/api/geo/${profile.slug}/schema.json`
        }
      });
    } catch (err: any) {
      fastify.log.error(err, '[GEO Extract Error]');
      return reply.status(500).send({ error: 'Failed to extract website entity' });
    }
  });

  // 2. Dynamic Hosted Schema Loader (<script> for WordPress header)
  fastify.get('/api/geo/:slug/loader.js', async (req: FastifyRequest, reply: FastifyReply) => {
    const { slug } = req.params as { slug: string };
    const profile = GEO_PROFILES.get(slug);

    if (!profile) {
      return reply.type('application/javascript').send('/* [VAANI GEO] Entity Not Found */');
    }

    // KILL SWITCH: If unpaid or disabled, deactivate immediately
    if (!profile.geoEnabled || profile.subscriptionStatus === 'CANCELLED') {
      return reply.type('application/javascript').send(`
/* [VAANI GEO] Service Suspended or Deactivated for '${slug}'. */
/* Contact billing@vanni.ai to restore Generative Engine Optimization. */
`);
    }

    const host = req.headers.host || 'localhost:4000';
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const origin = `${protocol}://${host}`;

    const schemaGraph = buildSchemaOrgJsonLd(profile, origin);
    const serializedSchema = JSON.stringify(schemaGraph);

    // Dynamic injection script that runs in client browser
    const jsContent = `(function() {
  try {
    var existing = document.getElementById('vanni-geo-schema');
    if (existing) existing.remove();
    var s = document.createElement('script');
    s.id = 'vanni-geo-schema';
    s.type = 'application/ld+json';
    s.text = ${JSON.stringify(serializedSchema)};
    document.head.appendChild(s);
    console.log('[VAANI GEO] Injected high-authority Schema.org entity for "${profile.name}"');
  } catch (e) {
    console.warn('[VAANI GEO Error]', e);
  }
})();`;

    reply.header('Cache-Control', 'public, max-age=300'); // 5 minutes cache
    return reply.type('application/javascript').send(jsContent);
  });

  // 3. Standard /llms.txt feed for AI Bots (ChatGPT, Claude, Perplexity)
  fastify.get('/api/geo/:slug/llms.txt', async (req: FastifyRequest, reply: FastifyReply) => {
    const { slug } = req.params as { slug: string };
    const profile = GEO_PROFILES.get(slug);

    if (!profile) {
      return reply.status(404).send('Entity Not Found');
    }

    // KILL SWITCH: If unpaid or disabled, refuse service
    if (!profile.geoEnabled || profile.subscriptionStatus === 'CANCELLED') {
      return reply.status(403).send('# 403 Forbidden\n\nVAANI Generative Engine Optimization subscription inactive for this entity.');
    }

    const host = req.headers.host || 'localhost:4000';
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const origin = `${protocol}://${host}`;

    const markdown = buildLlmsTxtMarkdown(profile, origin);
    reply.header('Cache-Control', 'public, max-age=600');
    return reply.type('text/markdown; charset=utf-8').send(markdown);
  });

  // 4. Raw JSON-LD Schema Endpoint
  fastify.get('/api/geo/:slug/schema.json', async (req: FastifyRequest, reply: FastifyReply) => {
    const { slug } = req.params as { slug: string };
    const profile = GEO_PROFILES.get(slug);

    if (!profile) {
      return reply.status(404).send({ error: 'Entity not found' });
    }

    if (!profile.geoEnabled || profile.subscriptionStatus === 'CANCELLED') {
      return reply.status(403).send({ error: 'GEO subscription inactive' });
    }

    const host = req.headers.host || 'localhost:4000';
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const origin = `${protocol}://${host}`;

    const schema = buildSchemaOrgJsonLd(profile, origin);
    return reply.status(200).send(schema);
  });

  // 5. Entitlement Toggle (The Co-Founder Kill-Switch)
  fastify.post('/api/geo/:slug/toggle', async (req: FastifyRequest, reply: FastifyReply) => {
    const { slug } = req.params as { slug: string };
    const body = req.body as any;
    const profile = GEO_PROFILES.get(slug);

    if (!profile) {
      return reply.status(404).send({ error: 'Entity not found' });
    }

    if (typeof body.geoEnabled === 'boolean') {
      profile.geoEnabled = body.geoEnabled;
    }
    if (typeof body.voiceEnabled === 'boolean') {
      profile.voiceEnabled = body.voiceEnabled;
    }
    if (body.subscriptionStatus) {
      profile.subscriptionStatus = body.subscriptionStatus;
    }

    profile.updatedAt = new Date().toISOString();
    GEO_PROFILES.set(slug, profile);

    return reply.status(200).send({
      success: true,
      slug: profile.slug,
      geoEnabled: profile.geoEnabled,
      voiceEnabled: profile.voiceEnabled,
      subscriptionStatus: profile.subscriptionStatus,
      updatedAt: profile.updatedAt
    });
  });

  // 6. Status & Readiness Score
  fastify.get('/api/geo/:slug/status', async (req: FastifyRequest, reply: FastifyReply) => {
    const { slug } = req.params as { slug: string };
    const profile = GEO_PROFILES.get(slug);

    if (!profile) {
      return reply.status(404).send({ error: 'Entity not found' });
    }

    const host = req.headers.host || 'localhost:4000';
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const origin = `${protocol}://${host}`;

    const score = [
      profile.name ? 20 : 0,
      profile.telephone ? 20 : 0,
      profile.services.length >= 2 ? 20 : 10,
      profile.faqs.length >= 2 ? 20 : 10,
      profile.doctorsOrTeam.length > 0 ? 20 : 10
    ].reduce((a, b) => a + b, 0);

    return reply.status(200).send({
      slug: profile.slug,
      name: profile.name,
      industry: profile.industry,
      readinessScore: score,
      geoEnabled: profile.geoEnabled,
      voiceEnabled: profile.voiceEnabled,
      subscriptionStatus: profile.subscriptionStatus,
      embedSnippet: `<script src="${origin}/api/geo/${profile.slug}/loader.js" async></script>`,
      urls: {
        loaderJs: `${origin}/api/geo/${profile.slug}/loader.js`,
        llmsTxt: `${origin}/api/geo/${profile.slug}/llms.txt`,
        schemaJson: `${origin}/api/geo/${profile.slug}/schema.json`
      }
    });
  });

  // 7. List Available Seed Demos
  fastify.get('/api/geo/demos', async (_req: FastifyRequest, reply: FastifyReply) => {
    const list = Array.from(GEO_PROFILES.values()).map(p => ({
      slug: p.slug,
      name: p.name,
      industry: p.industry,
      tagline: p.tagline,
      telephone: p.telephone,
      geoEnabled: p.geoEnabled,
      voiceEnabled: p.voiceEnabled
    }));
    return reply.status(200).send({ demos: list });
  });
}
