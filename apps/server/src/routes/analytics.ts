/**
 * @vanni/server — Analytics & Usage Metering REST Endpoints
 *
 * Provides tenant-scoped analytical insights for:
 * - Overview KPI cards & conversion funnel
 * - Call metrics (inbound/outbound/connected/failed)
 * - Realtime voice minutes & token consumption
 * - Provider cost estimates vs actuals
 * - CSV usage export
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { globalDb } from '@vanni/database';
import { UsageMeteringEngine } from '@vanni/observability';

const meteringEngine = new UsageMeteringEngine(globalDb);

export async function registerAnalyticsRoutes(fastify: FastifyInstance) {
  // 1. GET /api/analytics/overview
  fastify.get('/api/analytics/overview', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = (req.headers['x-organization-id'] as string) || 'a0000000-0000-0000-0000-000000000001';
    const query = req.query as { period?: string; startDate?: string; endDate?: string };

    const overview = await globalDb.getAnalyticsOverview(
      orgId,
      query.period || '30_DAYS',
      query.startDate,
      query.endDate
    );

    return reply.send({ success: true, data: overview });
  });

  // 2. GET /api/analytics/calls
  fastify.get('/api/analytics/calls', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = (req.headers['x-organization-id'] as string) || 'a0000000-0000-0000-0000-000000000001';
    const calls = await globalDb.getCalls(orgId);

    const total = calls.length;
    const inbound = calls.filter(c => c.direction === 'INBOUND').length;
    const outbound = calls.filter(c => c.direction === 'OUTBOUND').length;
    const answered = calls.filter(c => c.durationSeconds > 0).length;
    const failed = calls.filter(c => c.durationSeconds === 0).length;
    const totalDuration = calls.reduce((acc, c) => acc + c.durationSeconds, 0);

    return reply.send({
      success: true,
      data: {
        totalCalls: total,
        inbound,
        outbound,
        answered,
        failed,
        totalDurationMinutes: Math.round((totalDuration / 60) * 10) / 10,
        averageDurationSeconds: total > 0 ? Math.round(totalDuration / total) : 0,
        recentCalls: calls.slice(0, 10),
      },
    });
  });

  // 3. GET /api/analytics/usage
  fastify.get('/api/analytics/usage', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = (req.headers['x-organization-id'] as string) || 'a0000000-0000-0000-0000-000000000001';
    const query = req.query as { billingPeriod?: string };

    const ledger = await globalDb.getUsageLedgerRecords(orgId, query.billingPeriod);
    const events = await globalDb.getUsageEvents(orgId);

    return reply.send({
      success: true,
      data: {
        totalEvents: events.length,
        ledgerRecords: ledger,
        recentEvents: events.slice(0, 20),
      },
    });
  });

  // 4. GET /api/analytics/export
  fastify.get('/api/analytics/export', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = (req.headers['x-organization-id'] as string) || 'a0000000-0000-0000-0000-000000000001';
    const query = req.query as { startDate?: string; endDate?: string };

    const csvContent = await meteringEngine.exportUsageCsv(orgId, query.startDate, query.endDate);

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="vanni_usage_${orgId}_${Date.now()}.csv"`);
    return reply.send(csvContent);
  });
}
