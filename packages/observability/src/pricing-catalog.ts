/**
 * @vanni/observability — Versioned Provider Pricing Catalog & Cost Calculation
 *
 * Provides deterministic, version-controlled price modeling for:
 * - Telephony (Inbound / Outbound per-minute)
 * - STT (Speech-to-Text per-second)
 * - TTS (Text-to-Speech per-character / per-second)
 * - LLM (Input tokens / Output tokens per-1k)
 * - Embeddings (per-1k tokens)
 */

import { ProviderPricingDefinitionDTO, CostCalculationType } from '@vanni/shared';

export interface CostCalculationResult {
  estimatedCost: number;
  currency: string;
  costType: CostCalculationType;
  pricingVersionId: string;
}

export class PricingCatalog {
  private static defaultPricing: ProviderPricingDefinitionDTO[] = [
    // 1. Sarvam AI (Kannada STT & TTS)
    {
      id: 'price_sarvam_stt_v1',
      provider: 'sarvam-ai',
      service: 'STT',
      model: 'saarika:v1',
      unit: 'per_second',
      price: 0.015, // ₹0.90 per minute = ₹0.015/sec
      currency: 'INR',
      effectiveFrom: '2026-01-01T00:00:00Z',
      version: 'v1.0',
    },
    {
      id: 'price_sarvam_tts_v1',
      provider: 'sarvam-ai',
      service: 'TTS',
      model: 'bulbul:v1',
      unit: 'per_character',
      price: 0.0008, // ₹0.80 per 1,000 characters
      currency: 'INR',
      effectiveFrom: '2026-01-01T00:00:00Z',
      version: 'v1.0',
    },
    // 2. OpenAI / DeepSeek (LLM Inference)
    {
      id: 'price_openai_gpt4o_input_v1',
      provider: 'openai',
      service: 'LLM',
      model: 'gpt-4o-mini',
      unit: 'per_1k_input_tokens',
      price: 0.0125, // ~$0.15/1M tokens ≈ ₹0.0125 / 1k tokens
      currency: 'INR',
      effectiveFrom: '2026-01-01T00:00:00Z',
      version: 'v1.0',
    },
    {
      id: 'price_openai_gpt4o_output_v1',
      provider: 'openai',
      service: 'LLM',
      model: 'gpt-4o-mini',
      unit: 'per_1k_output_tokens',
      price: 0.05, // ~$0.60/1M tokens ≈ ₹0.05 / 1k tokens
      currency: 'INR',
      effectiveFrom: '2026-01-01T00:00:00Z',
      version: 'v1.0',
    },
    // 3. Telephony (Exotel / Twilio PSTN)
    {
      id: 'price_telephony_inbound_v1',
      provider: 'exotel',
      service: 'TELEPHONY',
      model: 'inbound_pstn',
      unit: 'per_minute',
      price: 0.45, // ₹0.45 / minute
      currency: 'INR',
      effectiveFrom: '2026-01-01T00:00:00Z',
      version: 'v1.0',
    },
    {
      id: 'price_telephony_outbound_v1',
      provider: 'exotel',
      service: 'TELEPHONY',
      model: 'outbound_pstn',
      unit: 'per_minute',
      price: 0.65, // ₹0.65 / minute
      currency: 'INR',
      effectiveFrom: '2026-01-01T00:00:00Z',
      version: 'v1.0',
    },
    // 4. Embeddings
    {
      id: 'price_embeddings_v1',
      provider: 'openai',
      service: 'EMBEDDING',
      model: 'text-embedding-3-small',
      unit: 'per_1k_tokens',
      price: 0.0016, // ₹0.0016 / 1k tokens
      currency: 'INR',
      effectiveFrom: '2026-01-01T00:00:00Z',
      version: 'v1.0',
    },
  ];

  static getDefaultPricing(): ProviderPricingDefinitionDTO[] {
    return [...this.defaultPricing];
  }

  /**
   * Calculates estimated cost based on quantity, service, and provider
   */
  static calculateEstimatedCost(params: {
    provider: string;
    service: 'TELEPHONY' | 'STT' | 'TTS' | 'LLM' | 'EMBEDDING';
    unitType: 'seconds' | 'characters' | 'input_tokens' | 'output_tokens' | 'minutes';
    quantity: number;
    model?: string;
  }): CostCalculationResult {
    const { provider, service, unitType, quantity, model } = params;

    const matched = this.defaultPricing.find(p => {
      if (p.service !== service) return false;
      if (p.provider.toLowerCase() !== provider.toLowerCase()) return false;
      if (model && p.model && p.model.toLowerCase() !== model.toLowerCase()) {
        // Fall back to general match if specific model doesn't match
      }
      return true;
    });

    if (!matched) {
      return {
        estimatedCost: 0,
        currency: 'INR',
        costType: 'UNKNOWN',
        pricingVersionId: 'unknown',
      };
    }

    let estimatedCost = 0;
    if (unitType === 'seconds') {
      estimatedCost = quantity * matched.price;
    } else if (unitType === 'characters') {
      estimatedCost = quantity * matched.price;
    } else if (unitType === 'input_tokens' || unitType === 'output_tokens') {
      estimatedCost = (quantity / 1000) * matched.price;
    } else if (unitType === 'minutes') {
      estimatedCost = quantity * matched.price;
    }

    return {
      estimatedCost: Math.round(estimatedCost * 100000) / 100000,
      currency: matched.currency,
      costType: 'ESTIMATED',
      pricingVersionId: matched.id,
    };
  }
}
