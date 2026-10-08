/**
 * Usage Aggregator
 * Rolls raw usage events (per call / per token / per character) into
 * daily aggregation records used by analytics, dashboards and invoicing.
 */

import { globalDb } from '@vanni/database';
import { DailyUsageAggregationDTO, UsageEventDTO, UsageEventType, UsageResourceType } from '@vanni/shared';

function utcDateKey(iso: string): string {
  return iso.slice(0, 10); // 'YYYY-MM-DD' (UTC)
}

function sumQuantity(events: UsageEventDTO[], match: (e: UsageEventDTO) => boolean, unit?: string): number {
  return events
    .filter((e) => match(e) && (!unit || e.unit === unit))
    .reduce((sum, e) => sum + (Number.isFinite(e.quantity) ? e.quantity : 0), 0);
}

export class UsageAggregator {
  /**
   * Aggregate a list of usage events into per-UTC-day rollups and persist them.
   * Returns the saved aggregation records (one per day present in the events).
   *
   * Note: UsageEventDTO carries no inbound/outbound marker; campaign-initiated
   * calls (CAMPAIGN_CALL) are counted as outbound and all others as inbound.
   */
  async aggregateAndSave(organizationId: string, events: UsageEventDTO[]): Promise<DailyUsageAggregationDTO[]> {
    const byDay = new Map<string, UsageEventDTO[]>();
    for (const event of events) {
      const day = utcDateKey(event.occurredAt);
      const bucket = byDay.get(day);
      if (bucket) bucket.push(event);
      else byDay.set(day, [event]);
    }

    const results: DailyUsageAggregationDTO[] = [];
    for (const [day, dayEvents] of byDay) {
      const agg = this.buildDailyAggregation(organizationId, day, dayEvents);
      await globalDb.saveDailyUsageAggregation(agg);
      results.push(agg);
    }
    return results;
  }

  /**
   * Aggregate all events for an organization within an optional date range.
   */
  async aggregateRange(organizationId: string, startDate?: string, endDate?: string): Promise<DailyUsageAggregationDTO[]> {
    const events = await globalDb.getUsageEvents(organizationId, { startDate, endDate });
    return this.aggregateAndSave(organizationId, events);
  }

  /**
   * Read previously persisted daily rollups.
   */
  async getDailyRollups(organizationId: string, startDate?: string, endDate?: string): Promise<DailyUsageAggregationDTO[]> {
    return globalDb.getDailyUsageAggregations(organizationId, startDate, endDate);
  }

  private buildDailyAggregation(organizationId: string, day: string, events: UsageEventDTO[]): DailyUsageAggregationDTO {
    const isType = (t: UsageEventType) => (e: UsageEventDTO) => e.eventType === t;
    const isResource = (t: UsageResourceType) => (e: UsageEventDTO) => e.resourceType === t;

    const totalCalls = events.filter((e) => e.eventType === 'CALL_STARTED' || e.eventType === 'CAMPAIGN_CALL').length;
    const outboundCalls = events.filter(isType('CAMPAIGN_CALL')).length;
    const connectedCalls = events.filter(isType('CALL_COMPLETED')).length;

    const voiceSeconds = sumQuantity(events, isType('VOICE_DURATION'), 'seconds');
    const voiceMinutes = voiceSeconds > 0
      ? voiceSeconds / 60
      : sumQuantity(events, isType('VOICE_DURATION'), 'minutes');

    const estimatedCost = events.reduce((sum, e) => sum + (e.estimatedCost || 0), 0);
    const actualCost = events.reduce((sum, e) => sum + (e.actualCost || 0), 0);

    return {
      id: `agg_${organizationId}_${day}`,
      organizationId,
      date: day,
      totalCalls,
      inboundCalls: Math.max(0, totalCalls - outboundCalls),
      outboundCalls,
      connectedCalls,
      failedCalls: Math.max(0, totalCalls - connectedCalls),
      voiceMinutes: Math.round(voiceMinutes * 100) / 100,
      sttSeconds: sumQuantity(events, isType('STT_USAGE'), 'seconds'),
      ttsCharacters: sumQuantity(events, isType('TTS_USAGE'), 'characters'),
      llmInputTokens: sumQuantity(events, isResource('LLM_INPUT_TOKEN')),
      llmOutputTokens: sumQuantity(events, isResource('LLM_OUTPUT_TOKEN')),
      toolCalls: events.filter(isType('TOOL_EXECUTION')).length,
      leadsCreated: events.filter(isType('LEAD_CREATED')).length,
      leadsQualified: 0, // Qualification is not yet a metered usage event
      appointmentsCreated: events.filter(isType('APPOINTMENT')).length,
      handoffsCount: events.filter(isType('HANDOFF')).length,
      estimatedCostInr: Math.round(estimatedCost * 100) / 100,
      actualCostInr: Math.round(actualCost * 100) / 100,
      updatedAt: new Date().toISOString(),
    };
  }
}

export const globalUsageAggregator = new UsageAggregator();
