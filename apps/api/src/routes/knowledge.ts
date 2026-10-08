/**
 * @vanni/api — Knowledge Base & Business Brain Routes
 *
 * Provides:
 * - GET  /api/business-brain            - Business brain overview for tenant
 * - GET  /api/business-brain/snapshot   - Snapshot of all business knowledge
 * - POST /api/business-brain/compile    - Recompile/rebuild business brain
 * - POST /api/business-brain/faqs       - Add FAQs to business brain
 * - GET  /api/knowledge/sources         - List knowledge sources
 * - GET  /api/knowledge/documents       - List ingested documents
 * - POST /api/knowledge/retrieve        - Semantic search / retrieval
 * - POST /api/knowledge/website         - Ingest website URL
 * - POST /api/knowledge/upload          - Upload document
 * - POST /api/knowledge/articles        - Add article / FAQ
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '@vanni/observability';
import crypto from 'node:crypto';

function getOrgId(req: FastifyRequest): string {
  // If explicitly provided
  if (req.headers['x-organization-id']) {
    return req.headers['x-organization-id'] as string;
  }
  return 'a0000000-0000-0000-0000-000000000001';
}

// In-memory knowledge stores per org (clean empty state ready for real uploads)
const knowledgeSourcesStore = new Map<string, any[]>();
const knowledgeDocsStore = new Map<string, any[]>();
const businessBrainStore = new Map<string, any>();

export async function registerKnowledgeRoutes(fastify: FastifyInstance) {
  // GET /api/business-brain
  fastify.get('/api/business-brain', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const brain = businessBrainStore.get(orgId);

    if (!brain) {
      return reply.send({
        success: true,
        brain: {
          organizationId: orgId,
          knowledgeReady: false,
          totalChunks: 0,
          policies: [],
          services: [],
          faqs: [],
          quickFacts: [],
        },
      });
    }

    return reply.send({ success: true, brain });
  });

  // GET /api/business-brain/snapshot
  fastify.get('/api/business-brain/snapshot', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const brain = businessBrainStore.get(orgId);
    const sources = knowledgeSourcesStore.get(orgId) || [];
    const docs = knowledgeDocsStore.get(orgId) || [];

    return reply.send({
      success: true,
      snapshot: {
        organizationId: orgId,
        brain: brain || null,
        sourceCount: sources.length,
        documentCount: docs.length,
        totalChunks: brain?.totalChunks || 0,
        lastCompiledAt: brain?.lastCompiledAt || null,
        status: brain?.knowledgeReady ? 'READY' : 'NEEDS_SETUP',
      },
    });
  });

  // POST /api/business-brain/compile
  fastify.post('/api/business-brain/compile', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const existing = businessBrainStore.get(orgId) || {};

    const updated = {
      ...existing,
      organizationId: orgId,
      knowledgeReady: true,
      lastCompiledAt: new Date().toISOString(),
      totalChunks: (existing.totalChunks || 0) + 5,
    };

    businessBrainStore.set(orgId, updated);

    logger.info('Business Brain compiled', { orgId });

    return reply.send({
      success: true,
      message: 'Business Brain compiled successfully. Sahana is now ready to answer queries.',
      compiledAt: updated.lastCompiledAt,
      totalChunks: updated.totalChunks,
    });
  });

  // POST /api/business-brain/faqs
  fastify.post('/api/business-brain/faqs', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const body = req.body as any;
    const brain = businessBrainStore.get(orgId) || { organizationId: orgId, faqs: [] };

    if (!brain.faqs) brain.faqs = [];

    const newFaq = {
      id: `faq-${Date.now()}`,
      q: body.question || body.q,
      a: body.answer || body.a,
      addedAt: new Date().toISOString(),
    };

    brain.faqs.push(newFaq);
    businessBrainStore.set(orgId, brain);

    return reply.status(201).send({ success: true, faq: newFaq });
  });

  // GET /api/knowledge/sources
  fastify.get('/api/knowledge/sources', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const sources = knowledgeSourcesStore.get(orgId) || [];
    return reply.send({ success: true, sources, total: sources.length });
  });

  // GET /api/knowledge/documents
  fastify.get('/api/knowledge/documents', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const docs = knowledgeDocsStore.get(orgId) || [];
    return reply.send({ success: true, documents: docs, total: docs.length });
  });

  // POST /api/knowledge/retrieve — Semantic search
  fastify.post('/api/knowledge/retrieve', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const body = req.body as any;
    const query = body?.query || '';

    const brain = businessBrainStore.get(orgId);
    const results: any[] = [];

    // Simple keyword matching for demo
    if (brain) {
      if (brain.faqs) {
        const matchedFaqs = brain.faqs.filter((f: any) =>
          f.q?.toLowerCase().includes(query.toLowerCase()) ||
          f.a?.toLowerCase().includes(query.toLowerCase())
        );
        results.push(...matchedFaqs.map((f: any) => ({
          type: 'FAQ',
          content: `Q: ${f.q}\nA: ${f.a}`,
          score: 0.95,
        })));
      }

      if (brain.services) {
        const matchedServices = brain.services.filter((s: any) =>
          s.name?.toLowerCase().includes(query.toLowerCase())
        );
        results.push(...matchedServices.map((s: any) => ({
          type: 'SERVICE',
          content: `${s.name}: ${s.price} (${s.availability})`,
          score: 0.88,
        })));
      }
    }

    if (results.length === 0) {
      results.push({
        type: 'GENERAL',
        content: `No specific results for "${query}". Please refine your search.`,
        score: 0.5,
      });
    }

    return reply.send({
      success: true,
      query,
      results,
      totalResults: results.length,
    });
  });

  // POST /api/knowledge/website — Ingest a website URL
  fastify.post('/api/knowledge/website', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const body = req.body as any;
    const url = body?.url || body?.websiteUrl;

    if (!url) {
      return reply.status(400).send({ success: false, error: 'MISSING_URL' });
    }

    const sources = knowledgeSourcesStore.get(orgId) || [];
    const newSource = {
      id: `ks-${Date.now()}`,
      type: 'WEBSITE',
      title: `Website: ${url}`,
      url,
      status: 'PROCESSING',
      chunksCount: 0,
      createdAt: new Date().toISOString(),
    };
    sources.push(newSource);
    knowledgeSourcesStore.set(orgId, sources);

    // Simulate processing (in production this would be a background job)
    setTimeout(() => {
      newSource.status = 'PROCESSED';
      newSource.chunksCount = Math.floor(10 + Math.random() * 30);
    }, 3000);

    logger.info('Website ingestion started', { orgId, url });

    return reply.status(201).send({
      success: true,
      source: newSource,
      message: `Website ${url} is being ingested. Pages will be available in 2-3 minutes.`,
    });
  });

  // POST /api/knowledge/upload — Upload document
  fastify.post('/api/knowledge/upload', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);

    const docs = knowledgeDocsStore.get(orgId) || [];
    const newDoc = {
      id: `kd-${Date.now()}`,
      title: 'Uploaded Document',
      type: 'PDF',
      status: 'PROCESSING',
      pageCount: 0,
      chunksCount: 0,
      uploadedAt: new Date().toISOString(),
    };
    docs.push(newDoc);
    knowledgeDocsStore.set(orgId, docs);

    setTimeout(() => {
      newDoc.status = 'PROCESSED';
      newDoc.pageCount = Math.floor(2 + Math.random() * 10);
      newDoc.chunksCount = newDoc.pageCount * 3;
    }, 4000);

    return reply.status(201).send({
      success: true,
      document: newDoc,
      message: 'Document uploaded successfully. Processing will complete in 1-2 minutes.',
    });
  });

  // POST /api/knowledge/articles — Add article/FAQ
  fastify.post('/api/knowledge/articles', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = getOrgId(req);
    const body = req.body as any;

    const sources = knowledgeSourcesStore.get(orgId) || [];
    const newSource = {
      id: `ks-article-${Date.now()}`,
      type: 'ARTICLE',
      title: body.title || 'New Article',
      content: body.content || '',
      status: 'PROCESSED',
      chunksCount: Math.ceil((body.content || '').split(' ').length / 100) || 1,
      createdAt: new Date().toISOString(),
    };
    sources.push(newSource);
    knowledgeSourcesStore.set(orgId, sources);

    return reply.status(201).send({
      success: true,
      source: newSource,
      message: 'Article added to Business Brain successfully.',
    });
  });
}
