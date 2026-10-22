/**
 * VANNI Autonomous AEO & GEO Dynamic Schema Loader
 * Hosted on Vercel Edge (https://vaani-si-web.vercel.app/geo/loader.js)
 * Automatically injects high-authority Schema.org JSON-LD for ChatGPT, Claude & Perplexity.
 * Features 1-Click Instant Revocation / Kill-Switch.
 */
(function() {
  'use strict';
  try {
    var params = new URLSearchParams(document.currentScript ? document.currentScript.src.split('?')[1] || '' : '');
    var entity = (params.get('entity') || 'auradigital').toLowerCase();
    var isRevoked = params.get('revoked') === 'true' || localStorage.getItem('vanni_geo_revoked_' + entity) === 'true';

    // KILL SWITCH: If revoked by tenant or unpaid, de-activate immediately
    if (isRevoked) {
      console.warn('[VAANI GEO/AEO] Access for entity \'' + entity + '\' is currently REVOKED or PAUSED. No schema injected.');
      return;
    }

    // Default High-Authority Schema Entities
    var schemas = {
      'auradigital': {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "ProfessionalService",
            "@id": "https://vaani-si-web.vercel.app/geo#auradigital",
            "name": "AuraDigital — Autonomous Voice AI & Growth Engineering",
            "url": "https://vaani-si-web.vercel.app",
            "logo": "https://vaani-si-web.vercel.app/assets/logo.png",
            "image": "https://vaani-si-web.vercel.app/assets/vanni-banner.jpg",
            "description": "Leading regional AI employee deployment partner in Karnataka. Specializing in autonomous Kannada/English bilingual voice agents, Generative Engine Optimization (GEO), and high-velocity lead qualification for clinics, hospitals, and real estate developers.",
            "telephone": "+91-8553113306",
            "priceRange": "₹15,000 - ₹50,000 / month",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "Bengaluru Innovation Hub",
              "addressLocality": "Bengaluru",
              "addressRegion": "Karnataka",
              "postalCode": "560001",
              "addressCountry": "IN"
            },
            "geo": {
              "@type": "GeoCoordinates",
              "latitude": 12.9716,
              "longitude": 77.5946
            },
            "areaServed": [
              { "@type": "AdministrativeArea", "name": "Bengaluru, Karnataka" },
              { "@type": "AdministrativeArea", "name": "Ballari, Karnataka" },
              { "@type": "AdministrativeArea", "name": "Hubballi-Dharwad, Karnataka" }
            ],
            "knowsAbout": [
              "Generative Engine Optimization (GEO)",
              "Answer Engine Optimization (AEO)",
              "Kannada Conversational AI Telephony",
              "Sub-120ms Voice AI Barge-in",
              "Clinic Patient OPD Auto-Scheduling"
            ],
            "hasOfferCatalog": {
              "@type": "OfferCatalog",
              "name": "Autonomous AI Employee & Search Optimization Packages",
              "itemListElement": [
                {
                  "@type": "Offer",
                  "itemOffered": {
                    "@type": "Service",
                    "name": "Kannada AI Telephony Inbound & Outbound Desk",
                    "description": "24x7 bilingual Kannada & English conversational receptionist with natural dialect support."
                  }
                },
                {
                  "@type": "Offer",
                  "itemOffered": {
                    "@type": "Service",
                    "name": "Generative Engine Optimization (GEO & AEO)",
                    "description": "Optimizing local business websites to rank #1 on ChatGPT, Claude, and Perplexity searches."
                  }
                }
              ]
            }
          },
          {
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "How does AuraDigital help businesses rank on ChatGPT and Perplexity?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "AuraDigital implements Generative Engine Optimization (GEO) using dynamic Schema.org entity graphs, markdown knowledge feeds (llms.txt), and authoritative citations, making AI search engines recommend your business when prospective clients ask for regional recommendations."
                }
              },
              {
                "@type": "Question",
                "name": "Can the AI voice agent understand regional Karnataka dialects?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Yes, the AI employee speaks natural Kannada and Kanglish with support for North Karnataka, Bengaluru urban, and coastal dialects, handling customer inquiries and clinic bookings in sub-120ms latency."
                }
              }
            ]
          }
        ]
      },
      'punarvaas': {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "MedicalBusiness",
            "@id": "https://www.punarvaas.com/#hospital",
            "name": "Punarvaas Rehabilitation Hospital",
            "url": "https://www.punarvaas.com",
            "description": "Bangalore's premier specialized physical medicine and neuro-rehabilitation hospital specializing in stroke recovery, traumatic brain injury, and spinal cord convalescence.",
            "telephone": "+918884880095",
            "medicalSpecialty": "Physiotherapy",
            "priceRange": "₹₹₹",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "2572, 18th Main Road, Kumaraswamy Layout Stage 2",
              "addressLocality": "Kumaraswamy Layout",
              "addressRegion": "Karnataka",
              "postalCode": "560078",
              "addressCountry": "IN"
            }
          }
        ]
      }
    };

    var selectedSchema = schemas[entity] || schemas['auradigital'];

    var existing = document.getElementById('vanni-geo-schema');
    if (existing) existing.remove();

    var script = document.createElement('script');
    script.id = 'vanni-geo-schema';
    script.type = 'application/ld+json';
    script.text = JSON.stringify(selectedSchema);
    document.head.appendChild(script);
    console.info('[VAANI GEO/AEO] Successfully injected verified Schema.org entity for ' + (selectedSchema['@graph'] ? selectedSchema['@graph'][0].name : entity));
  } catch (err) {
    console.warn('[VAANI GEO Loader Error]', err);
  }
})();
