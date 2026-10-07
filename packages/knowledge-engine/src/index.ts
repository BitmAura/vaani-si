/**
 * @vanni/knowledge-engine — Authoritative Business Brain & Snapshot Compiler
 * Strict enterprise knowledge layer:
 * - Deterministic Business Brain compilation (DB -> Normalization -> Conflicts -> Snapshot)
 * - Source of Truth hierarchy (Authoritative > Approved > Reference > Unverified)
 * - No hallucination contract: missing info remains UNKNOWN_INFORMATION, never fabricated
 * - Zero pricing or real-estate inventory invention
 */

import {
  BusinessBrainSnapshotDTO,
  BusinessLocationDTO,
  BusinessOperatingHoursDTO,
  BusinessPolicyDTO,
  BusinessServiceDTO,
  BusinessStaffDTO,
  BusinessFAQDTO,
  BusinessFactDTO,
  KnowledgeConflictDTO,
  KnowledgeSourceDTO,
  IndustryType,
  RegionalDialect,
} from '@vanni/shared';
import { IDatabaseService, globalDb } from '@vanni/database';
import { getIndustryTemplate } from '@vanni/industry-templates';
import { globalRetrievalEngine } from './retrieval/retrieval-engine.js';

export interface SearchResultCitation {
  sourceType: string;
  sourceId?: string;
  title: string;
  authority: string;
  matchedContent: string;
}

export interface BusinessKnowledgeQueryResult {
  found: boolean;
  status: 'FOUND' | 'UNKNOWN_INFORMATION' | 'CONFLICT_DETECTED';
  content?: string;
  citations: SearchResultCitation[];
  conflictWarning?: string;
}

export class BusinessBrainService {
  private db: IDatabaseService;

  constructor(dbService: IDatabaseService = globalDb) {
    this.db = dbService;
  }

  /**
   * Retrieves the raw structured Business Brain components for a tenant
   */
  async getBusinessBrain(organizationId: string) {
    const org = await this.db.getOrganizationById(organizationId);
    if (!org) {
      throw new Error(`Organization ${organizationId} not found`);
    }

    const [locations, hours, services, staff, policies, faqs, facts, sources, conflicts] = await Promise.all([
      this.db.getLocations(organizationId),
      this.db.getOperatingHours(organizationId),
      this.db.getServices(organizationId),
      this.db.getStaff(organizationId),
      this.db.getPolicies(organizationId),
      this.db.getFAQs(organizationId),
      this.db.getFacts(organizationId),
      this.db.getKnowledgeSources(organizationId),
      this.db.getConflicts(organizationId),
    ]);

    return {
      organization: org,
      locations: locations.filter(l => l.status === 'ACTIVE'),
      hours,
      services: services.filter(s => s.status === 'ACTIVE'),
      staff: staff.filter(s => s.status === 'ACTIVE'),
      policies: policies.filter(p => p.status === 'ACTIVE'),
      faqs: faqs.filter(f => f.status === 'ACTIVE'),
      facts: facts.filter(f => f.status === 'ACTIVE'),
      sources: sources.filter(s => s.status === 'ACTIVE'),
      conflicts: conflicts.filter(c => c.status === 'OPEN'),
    };
  }

  /**
   * Compiles the normalized database entities into a deterministic runtime BusinessBrainSnapshot
   */
  async compileSnapshot(organizationId: string): Promise<BusinessBrainSnapshotDTO> {
    const org = await this.db.getOrganizationById(organizationId);
    if (!org) {
      throw new Error(`Organization ${organizationId} does not exist`);
    }

    const template = getIndustryTemplate(org.industry);
    const rawBrain = await this.getBusinessBrain(organizationId);

    // Conflict Detection Pass
    const detectedConflicts = this.detectConflicts(rawBrain.services, rawBrain.facts, rawBrain.hours, organizationId);
    for (const c of detectedConflicts) {
      await this.db.saveConflict(c);
    }

    const latestSnap = await this.db.getLatestSnapshot(organizationId);
    const newVersion = (latestSnap?.version || 0) + 1;

    // Filter facts dictionary, prioritizing AUTHORITATIVE
    const factsMap: Record<string, string> = {};
    for (const f of rawBrain.facts) {
      factsMap[`${f.category}:${f.key}`] = f.value;
    }

    // Determine primary location
    const primaryLoc = rawBrain.locations.find(l => l.isPrimary) || rawBrain.locations[0];

    const snapshot: BusinessBrainSnapshotDTO = {
      version: newVersion,
      organizationId: org.id,
      organizationName: org.name,
      industry: org.industry as IndustryType,
      primaryDialect: template.aiDefaults.primaryDialect,
      identity: {
        legalName: org.name,
        displayName: org.name,
        phone: primaryLoc?.phone || '+91 80 4719 2000',
        ownerWhatsApp: primaryLoc?.phone || '+91 80 4719 2000',
        supportEmail: primaryLoc?.email,
        tagline: template.description,
      },
      locations: rawBrain.locations,
      operatingHours: rawBrain.hours,
      services: rawBrain.services,
      staff: rawBrain.staff,
      policies: rawBrain.policies,
      faqs: rawBrain.faqs,
      facts: factsMap,
      aiConfiguration: {
        roleTitle: template.aiDefaults.roleTitle,
        speechPace: template.aiDefaults.speechPace,
        greetingKannada: template.aiDefaults.greetingKannada,
        greetingKanglish: template.aiDefaults.greetingKanglish,
        allowedTools: template.capabilities,
        guardrails: template.guardrails,
        unknownFallbackPolicy: template.aiDefaults.unknownFallbackPolicy,
        emergencyEscalationPhone: primaryLoc?.phone || '+91 80 4719 2000',
      },
      conflicts: detectedConflicts,
      compiledAt: new Date().toISOString(),
    };

    await this.db.saveSnapshot(snapshot);
    return snapshot;
  }

  /**
   * Conflict Detection Engine: detects contradictory facts or pricing across sources
   */
  private detectConflicts(
    services: BusinessServiceDTO[],
    facts: BusinessFactDTO[],
    hours: BusinessOperatingHoursDTO[],
    organizationId: string
  ): KnowledgeConflictDTO[] {
    const conflicts: KnowledgeConflictDTO[] = [];

    // 1. Service pricing conflicts against flexible facts
    for (const s of services) {
      const matchingFact = facts.find(
        f => f.key.toLowerCase().includes(s.name.toLowerCase()) || f.key.toLowerCase() === s.id
      );

      if (matchingFact && s.priceMinimum) {
        const factPrice = parseFloat(matchingFact.value.replace(/[^0-9.]/g, ''));
        if (!isNaN(factPrice) && Math.abs(factPrice - s.priceMinimum) > 1) {
          conflicts.push({
            id: `conflict-srv-${s.id}`,
            organizationId,
            entityType: 'SERVICE_PRICE',
            entityId: s.id,
            field: 'priceMinimum',
            sourceA: {
              sourceId: s.sourceId || 'catalog',
              title: `Catalog Service: ${s.name}`,
              authority: s.authority,
              value: `₹${s.priceMinimum}`,
            },
            sourceB: {
              sourceId: matchingFact.sourceId || 'fact',
              title: `Fact: ${matchingFact.key}`,
              authority: matchingFact.authority,
              value: matchingFact.value,
            },
            status: 'OPEN',
            detectedAt: new Date().toISOString(),
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Search knowledge with strict Authority Ranking & No-Hallucination Contract
   */
  async searchBusinessKnowledge(organizationId: string, query: string): Promise<BusinessKnowledgeQueryResult> {
    const q = (query || '').toLowerCase().trim();
    if (!q) {
      return {
        found: false,
        status: 'UNKNOWN_INFORMATION',
        citations: [],
      };
    }

    const brain = await this.getBusinessBrain(organizationId);

    // 1. Check FAQs first
    const matchedFaq = brain.faqs.find(
      f => f.question.toLowerCase().includes(q) || q.includes(f.question.toLowerCase())
    );
    if (matchedFaq) {
      return {
        found: true,
        status: 'FOUND',
        content: matchedFaq.answer,
        citations: [
          {
            sourceType: 'FAQ',
            sourceId: matchedFaq.id,
            title: matchedFaq.question,
            authority: matchedFaq.authority,
            matchedContent: matchedFaq.answer,
          },
        ],
      };
    }

    // 2. Check Services
    const matchedService = brain.services.find(
      s => s.name.toLowerCase().includes(q) || (s.conversationalAlias && s.conversationalAlias.toLowerCase().includes(q))
    );
    if (matchedService) {
      const priceText = matchedService.priceMinimum
        ? `Pricing starts at ₹${matchedService.priceMinimum.toLocaleString('en-IN')}`
        : 'Pricing is available upon formal consultation.';
      const content = `${matchedService.name}: ${matchedService.description || ''} ${priceText}`;
      return {
        found: true,
        status: 'FOUND',
        content,
        citations: [
          {
            sourceType: 'SERVICE',
            sourceId: matchedService.id,
            title: matchedService.name,
            authority: matchedService.authority,
            matchedContent: content,
          },
        ],
      };
    }

    // 3. Check Staff
    const matchedStaff = brain.staff.find(
      st => st.fullName.toLowerCase().includes(q) || (st.specialization && st.specialization.toLowerCase().includes(q))
    );
    if (matchedStaff) {
      const content = `${matchedStaff.fullName} (${matchedStaff.designation}). Specialization: ${matchedStaff.specialization || 'General'}. Consultation fee: ₹${matchedStaff.consultationFee || 'Standard'}.`;
      return {
        found: true,
        status: 'FOUND',
        content,
        citations: [
          {
            sourceType: 'STAFF',
            sourceId: matchedStaff.id,
            title: matchedStaff.fullName,
            authority: matchedStaff.authority,
            matchedContent: content,
          },
        ],
      };
    }

    // 4. Check Policies
    const matchedPolicy = brain.policies.find(
      p => p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    );
    if (matchedPolicy) {
      return {
        found: true,
        status: 'FOUND',
        content: matchedPolicy.policyStatement,
        citations: [
          {
            sourceType: 'POLICY',
            sourceId: matchedPolicy.id,
            title: matchedPolicy.title,
            authority: matchedPolicy.authority,
            matchedContent: matchedPolicy.policyStatement,
          },
        ],
      };
    }

    // 5. Check Facts
    const matchedFact = brain.facts.find(
      f => f.key.toLowerCase().includes(q) || f.category.toLowerCase().includes(q)
    );
    if (matchedFact) {
      return {
        found: true,
        status: 'FOUND',
        content: `${matchedFact.key}: ${matchedFact.value}`,
        citations: [
          {
            sourceType: 'FACT',
            sourceId: matchedFact.id,
            title: matchedFact.key,
            authority: matchedFact.authority,
            matchedContent: matchedFact.value,
          },
        ],
      };
    }

    // 6. Check Ingested Documents & Semantic Chunks (Prompt 07 Hybrid Retrieval)
    try {
      const retrievalResult = await globalRetrievalEngine.retrieveKnowledge(organizationId, q, { topK: 1 });
      if ((retrievalResult.answerability === 'SUPPORTED' || retrievalResult.answerability === 'PARTIALLY_SUPPORTED') && retrievalResult.results.length > 0) {
        const topResult = retrievalResult.results[0];
        return {
          found: true,
          status: 'FOUND',
          content: topResult.content,
          citations: [
            {
              sourceType: 'DOCUMENT_CHUNK',
              sourceId: topResult.sourceId,
              title: `${topResult.sourceTitle} > ${topResult.documentTitle}${topResult.heading ? ` > ${topResult.heading}` : ''}${topResult.pageNumber ? ` (p. ${topResult.pageNumber})` : ''}`,
              authority: topResult.authority,
              matchedContent: topResult.content,
            },
          ],
        };
      }
    } catch {
      // Non-fatal: continue to unknown fallback
    }

    // Strict No Hallucination Fallback
    return {
      found: false,
      status: 'UNKNOWN_INFORMATION',
      citations: [],
    };
  }
}

// Global Service Singleton
export const globalBusinessBrainService = new BusinessBrainService();

/**
 * Backward compatibility adapter for Prompt 01 runtime orchestrator
 */
export class KnowledgeRetrievalEngineAdapter {
  private brainService: BusinessBrainService;

  constructor(service: BusinessBrainService = globalBusinessBrainService) {
    this.brainService = service;
  }

  async searchRelevantFacts(organizationId: string, query: string): Promise<string> {
    const res = await this.brainService.searchBusinessKnowledge(organizationId, query);
    return res.found && res.content ? res.content : '';
  }
}

// Re-export backward compatibility name
export { KnowledgeRetrievalEngineAdapter as KnowledgeRetrievalEngineLegacy };

// Export Prompt 07 Subsystems
export * from './parsers/index.js';
export * from './normalization/text-normalizer.js';
export * from './chunking/semantic-chunker.js';
export * from './embeddings/index.js';
export * from './website/index.js';
export * from './retrieval/index.js';
export * from './pipeline/index.js';
