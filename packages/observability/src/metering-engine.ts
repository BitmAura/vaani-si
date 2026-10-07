/**
 * @vanni/observability — Usage Metering Engine & Aggregator
 *
 * Implements non-blocking, append-oriented measurement infrastructure for:
 * - Telephony Inbound & Outbound minutes
 * - Realtime Kannada STT & TTS seconds/characters
 * - LLM Input & Output Tokens
 * - Tool Executions
 * - Billing-ready normalized ledger entries
 * - Daily incremental rollups & alert thresholds
 */

import {
  UsageEventDTO,
  UsageEventType,
  UsageResourceType,
  MeterName,
  UsageLedgerRecordDTO,
  DailyUsageAggregationDTO,
  UsageAlertThresholdDTO,
  CostAnomalyAlertDTO,
} from '@vanni/shared';
import { IDatabaseService } from '@vanni/database';
import { PricingCatalog } from './pricing-catalog.js';

export interface RecordUsageEventInput {
  organizationId: string;
  eventType: UsageEventType;
  resourceType: UsageResourceType;
  resourceId?: string;
  provider: string;
  model?: string;
  quantity: number;
  unit: string;
  actualCost?: number;
  agentId?: string;
  agentVersionId?: string;
  conversationId?: string;
  voiceSessionId?: string;
  telephonySessionId?: string;
  campaignId?: string;
  knowledgeSourceId?: string;
  channel?: 'VOICE' | 'WEB' | 'WHATSAPP' | 'SMS';
  language?: string;
  metadata?: Record<string, any>;
  correlationId?: string;
}

export class UsageMeteringEngine {
  constructor(private db: IDatabaseService) {}

  /**
   * Records an immutable, append-only usage event with automatic price calculation and ledger tracking
   */
  async recordUsage(input: RecordUsageEventInput): Promise<UsageEventDTO> {
    const eventId = `use_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const correlationId = input.correlationId || `corr_${eventId}`;

    // Map resourceType to pricing unit type
    let service: 'TELEPHONY' | 'STT' | 'TTS' | 'LLM' | 'EMBEDDING' = 'LLM';
    let unitType: 'seconds' | 'characters' | 'input_tokens' | 'output_tokens' | 'minutes' = 'input_tokens';

    if (input.resourceType === 'VOICE_MINUTE' || input.resourceType === 'CALL') {
      service = 'TELEPHONY';
      unitType = 'minutes';
    } else if (input.resourceType === 'STT_SECOND') {
      service = 'STT';
      unitType = 'seconds';
    } else if (input.resourceType === 'TTS_CHARACTER') {
      service = 'TTS';
      unitType = 'characters';
    } else if (input.resourceType === 'TTS_SECOND') {
      service = 'TTS';
      unitType = 'seconds';
    } else if (input.resourceType === 'LLM_INPUT_TOKEN') {
      service = 'LLM';
      unitType = 'input_tokens';
    } else if (input.resourceType === 'LLM_OUTPUT_TOKEN') {
      service = 'LLM';
      unitType = 'output_tokens';
    } else if (input.resourceType === 'EMBEDDING_TOKEN') {
      service = 'EMBEDDING';
      unitType = 'input_tokens';
    }

    const costInfo = PricingCatalog.calculateEstimatedCost({
      provider: input.provider,
      service,
      unitType,
      quantity: input.quantity,
      model: input.model,
    });

    const event: UsageEventDTO = {
      id: eventId,
      organizationId: input.organizationId,
      eventType: input.eventType,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      provider: input.provider,
      model: input.model,
      quantity: input.quantity,
      unit: input.unit,
      costType: input.actualCost !== undefined ? 'ACTUAL' : costInfo.costType,
      estimatedCost: costInfo.estimatedCost,
      actualCost: input.actualCost,
      currency: costInfo.currency,
      pricingVersionId: costInfo.pricingVersionId,
      agentId: input.agentId,
      agentVersionId: input.agentVersionId,
      conversationId: input.conversationId,
      voiceSessionId: input.voiceSessionId,
      telephonySessionId: input.telephonySessionId,
      campaignId: input.campaignId,
      knowledgeSourceId: input.knowledgeSourceId,
      channel: input.channel || 'VOICE',
      language: input.language || 'kn-IN',
      occurredAt: now,
      metadata: input.metadata,
      correlationId,
    };

    // 1. Non-blocking persist of raw event
    await this.db.saveUsageEvent(event);

    // 2. Normalize into billing-ready ledger
    await this.createLedgerEntry(event);

    // 3. Rollup into daily aggregation
    await this.updateDailyAggregation(event);

    // 4. Evaluate Thresholds & Anomaly Signals
    await this.checkThresholdsAndAnomalies(event);

    return event;
  }

  /**
   * Creates a billable usage ledger entry without executing actual invoicing
   */
  private async createLedgerEntry(event: UsageEventDTO): Promise<void> {
    let meter: MeterName = 'TOOL_EXECUTIONS';
    if (event.resourceType === 'VOICE_MINUTE') meter = 'VOICE_MINUTES';
    else if (event.resourceType === 'STT_SECOND') meter = 'STT_SECONDS';
    else if (event.resourceType === 'TTS_CHARACTER') meter = 'TTS_CHARACTERS';
    else if (event.resourceType === 'LLM_INPUT_TOKEN') meter = 'LLM_INPUT_TOKENS';
    else if (event.resourceType === 'LLM_OUTPUT_TOKEN') meter = 'LLM_OUTPUT_TOKENS';
    else if (event.resourceType === 'CALL') meter = 'CALLS';
    else if (event.resourceType === 'MESSAGE') meter = 'MESSAGES';

    const period = event.occurredAt.substring(0, 7); // 'YYYY-MM'
    const ledgerRecord: UsageLedgerRecordDTO = {
      id: `ledg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      organizationId: event.organizationId,
      usageEventId: event.id,
      billingPeriod: period,
      meter,
      quantity: event.quantity,
      unit: event.unit,
      costBasis: event.actualCost !== undefined ? event.actualCost : event.estimatedCost,
      currency: event.currency,
      status: 'UNBILLED',
      createdAt: event.occurredAt,
    };

    await this.db.saveUsageLedgerRecord(ledgerRecord);
  }

  /**
   * Incrementally updates daily usage aggregations
   */
  private async updateDailyAggregation(event: UsageEventDTO): Promise<void> {
    const dateStr = event.occurredAt.split('T')[0];
    const aggId = `agg_${event.organizationId}_${dateStr}_${event.agentId || 'all'}`;

    const existingList = await this.db.getDailyUsageAggregations(event.organizationId, dateStr, dateStr);
    let agg = existingList.find(a => a.id === aggId);

    if (!agg) {
      agg = {
        id: aggId,
        organizationId: event.organizationId,
        date: dateStr,
        agentId: event.agentId,
        channel: event.channel,
        totalCalls: 0,
        inboundCalls: 0,
        outboundCalls: 0,
        connectedCalls: 0,
        failedCalls: 0,
        voiceMinutes: 0,
        sttSeconds: 0,
        ttsCharacters: 0,
        llmInputTokens: 0,
        llmOutputTokens: 0,
        toolCalls: 0,
        leadsCreated: 0,
        leadsQualified: 0,
        appointmentsCreated: 0,
        handoffsCount: 0,
        estimatedCostInr: 0,
        actualCostInr: 0,
        updatedAt: new Date().toISOString(),
      };
    }

    if (event.eventType === 'CALL_STARTED' || event.eventType === 'CALL_COMPLETED') {
      agg.totalCalls += 1;
      if (event.metadata?.direction === 'INBOUND') agg.inboundCalls += 1;
      else if (event.metadata?.direction === 'OUTBOUND') agg.outboundCalls += 1;
    }

    if (event.resourceType === 'VOICE_MINUTE') agg.voiceMinutes += event.quantity;
    if (event.resourceType === 'STT_SECOND') agg.sttSeconds += event.quantity;
    if (event.resourceType === 'TTS_CHARACTER') agg.ttsCharacters += event.quantity;
    if (event.resourceType === 'LLM_INPUT_TOKEN') agg.llmInputTokens += event.quantity;
    if (event.resourceType === 'LLM_OUTPUT_TOKEN') agg.llmOutputTokens += event.quantity;
    if (event.resourceType === 'TOOL_EXECUTION') agg.toolCalls += 1;

    if (event.eventType === 'LEAD_CREATED') agg.leadsCreated += 1;
    if (event.eventType === 'APPOINTMENT') agg.appointmentsCreated += 1;
    if (event.eventType === 'HANDOFF') agg.handoffsCount += 1;

    agg.estimatedCostInr += event.estimatedCost || 0;
    agg.actualCostInr += event.actualCost || 0;
    agg.updatedAt = new Date().toISOString();

    await this.db.saveDailyUsageAggregation(agg);
  }

  /**
   * Checks configured alert thresholds and simple deterministic cost anomalies
   */
  private async checkThresholdsAndAnomalies(event: UsageEventDTO): Promise<void> {
    const thresholds = await this.db.getUsageAlertThresholds(event.organizationId);
    let meter: MeterName | null = null;
    if (event.resourceType === 'VOICE_MINUTE') meter = 'VOICE_MINUTES';
    else if (event.resourceType === 'LLM_INPUT_TOKEN' || event.resourceType === 'LLM_OUTPUT_TOKEN') meter = 'LLM_INPUT_TOKENS';

    if (meter) {
      const match = thresholds.find(t => t.meter === meter);
      if (match) {
        // Calculate current month total
        const period = event.occurredAt.substring(0, 7);
        const ledger = await this.db.getUsageLedgerRecords(event.organizationId, period);
        const totalUsed = ledger.filter(l => l.meter === meter).reduce((acc, l) => acc + l.quantity, 0);

        const currentPct = (totalUsed / match.monthlyLimit) * 100;
        for (const targetPct of match.thresholdPercentages) {
          if (currentPct >= targetPct && !match.triggeredPercentages.includes(targetPct)) {
            match.triggeredPercentages.push(targetPct);
            match.lastTriggeredAt = new Date().toISOString();
            await this.db.saveUsageAlertThreshold(match);
            // Alert recorded without spamming
          }
        }
      }
    }

    // Anomaly Detection: Flag sudden massive bursts (e.g. 1000+ voice minutes or 100,000+ tokens in single spike)
    if (event.resourceType === 'VOICE_MINUTE' && event.quantity > 500) {
      await this.db.saveCostAnomalyAlert({
        id: `anom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        organizationId: event.organizationId,
        meter: 'VOICE_MINUTES',
        expectedDailyAverage: 50,
        actualQuantity: event.quantity,
        variancePercentage: 900,
        detectedAt: new Date().toISOString(),
        acknowledged: false,
      });
    }
  }

  /**
   * Generates a tenant-scoped CSV usage export
   */
  async exportUsageCsv(organizationId: string, startDate?: string, endDate?: string): Promise<string> {
    const events = await this.db.getUsageEvents(organizationId, { startDate, endDate });

    const headers = [
      'date',
      'organization_id',
      'event_type',
      'resource_type',
      'provider',
      'model',
      'quantity',
      'unit',
      'cost_type',
      'cost_inr',
      'agent_id',
      'conversation_id',
    ];

    const rows = events.map(e => [
      e.occurredAt,
      e.organizationId,
      e.eventType,
      e.resourceType,
      e.provider,
      e.model || 'default',
      e.quantity,
      e.unit,
      e.costType,
      e.actualCost !== undefined ? e.actualCost : e.estimatedCost,
      e.agentId || '',
      e.conversationId || '',
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
}
