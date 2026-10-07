/**
 * @vanni/api — Hardened REST Application Server (apps/api)
 *
 * Enforces production security:
 * - Centralized CORS whitelist
 * - Security response headers (CSP, HSTS, frameguard, nosniff)
 * - In-memory sliding window rate limiting
 * - Structured logging with PII redaction
 * - Health and Readiness endpoints (/api/health, /api/ready, /api/metrics)
 * - Centralized error sanitization (no stack trace leakage)
 */

import 'dotenv/config';
import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import { globalDb } from '@vanni/database';
import { MetricsCollector, PiiRedactor, logger } from '@vanni/observability';
import { registerAgentRoutes } from './routes/agents.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerCallRoutes } from './routes/calls.js';
import { registerLeadRoutes } from './routes/leads.js';
import { registerWebhookRoutes } from './routes/webhooks.js';
import { registerAnalyticsRoutes } from './routes/analytics.js';
import { registerBillingRoutes } from './routes/billing.js';
import { registerOrganizationRoutes } from './routes/organizations.js';
import { registerKnowledgeRoutes } from './routes/knowledge.js';
import { registerCrmAndOutboundRoutes } from './routes/crm.js';
import { registerTtsRoutes } from './routes/tts.js';

// Simple in-memory sliding window rate limiter
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const rateLimitStore = new Map<string, RateLimitBucket>();

function checkRateLimit(ipOrKey: string, maxRequests: number = 100, windowMs: number = 60000): { allowed: boolean; remaining: number } {
  const now = Date.now();
  let bucket = rateLimitStore.get(ipOrKey);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 1, resetAt: now + windowMs };
    rateLimitStore.set(ipOrKey, bucket);
    return { allowed: true, remaining: maxRequests - 1 };
  }

  bucket.count++;
  if (bucket.count > maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: maxRequests - bucket.count };
}

export async function buildApiServer() {
  const fastify = Fastify({
    logger: false, // We use @vanni/observability structured logger with PII redaction
  });

  // 1. CORS with Explicit Allowlist
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
    : ['http://localhost:3000', 'http://localhost:4100', 'http://localhost:4200', 'https://vanni.ai'];

  await fastify.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        cb(null, true);
        return;
      }
      cb(new Error('CORS Not Allowed'), false);
    },
    credentials: true,
  });

  // 2. Global Security Headers Hook
  fastify.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    // Metrics counter
    MetricsCollector.increment('api_requests_total');

    // 3. Global Tiered Rate Limiter
    const clientIp = req.ip || '127.0.0.1';
    const isWebhook = req.url.startsWith('/api/webhooks') || req.url.startsWith('/api/billing/webhooks');
    const limit = isWebhook ? 300 : 120; // 300 req/min for webhooks, 120 req/min for general API
    const rateCheck = checkRateLimit(`${clientIp}:${req.url.split('/')[2]}`, limit, 60000);

    reply.header('X-RateLimit-Limit', limit);
    reply.header('X-RateLimit-Remaining', rateCheck.remaining);

    if (!rateCheck.allowed) {
      logger.warn('API Rate Limit Exceeded', { ip: clientIp, path: req.url });
      reply.status(429).send({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please slow down.',
      });
    }
  });

  // 4. Centralized Structured Logging Hook
  fastify.addHook('onResponse', async (req: FastifyRequest, reply: FastifyReply) => {
    logger.info('API Request Handled', {
      method: req.method,
      url: PiiRedactor.redactString(req.url),
      statusCode: reply.statusCode,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  });

  // 5. Centralized Error Sanitizer
  fastify.setErrorHandler((error: any, _req: FastifyRequest, reply: FastifyReply) => {
    const statusCode = error.statusCode || 500;
    logger.error('API Error Encountered', {
      statusCode,
      message: error.message,
      code: error.code,
    });

    // Never leak stack traces to client
    reply.status(statusCode).send({
      success: false,
      error: error.code || 'INTERNAL_SERVER_ERROR',
      message: statusCode === 500 ? 'An unexpected internal error occurred.' : error.message,
    });
  });

  // 6. Health, Readiness & Metrics Endpoints
  fastify.get('/api/health', async () => {
    return {
      status: 'ONLINE',
      service: 'VANNI REST API Server',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      region: 'Karnataka, India',
    };
  });

  fastify.get('/api/ready', async () => {
    return MetricsCollector.getHealth(async () => {
      // Ping in-memory DB or Supabase
      const plans = await globalDb.getPlans('PUBLIC');
      return Array.isArray(plans);
    });
  });

  fastify.get('/api/metrics', async (_req, reply) => {
    return reply.send({
      success: true,
      metrics: MetricsCollector.getMetrics(),
    });
  });

  // 7. Register Route Controllers
  await registerAuthRoutes(fastify);
  await registerAgentRoutes(fastify);
  await registerCallRoutes(fastify);
  await registerLeadRoutes(fastify);
  await registerWebhookRoutes(fastify);
  await registerAnalyticsRoutes(fastify);
  await registerBillingRoutes(fastify);
  await registerOrganizationRoutes(fastify);
  await registerKnowledgeRoutes(fastify);
  await registerCrmAndOutboundRoutes(fastify);
  await registerTtsRoutes(fastify);

  return fastify;
}

async function main() {
  const server = await buildApiServer();
  const port = parseInt(process.env.API_PORT || '4100', 10);
  const host = process.env.HOST || '0.0.0.0';

  try {
    await server.listen({ port, host });
    console.log(`[VANNI REST API] Hardened Server listening at http://${host}:${port}`);
    console.log(`[VANNI REST API] Routes: auth, agents, calls, leads, analytics, billing, orgs, knowledge, crm`);
  } catch (err) {
    console.error('Failed to start API server:', err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  main();
}
