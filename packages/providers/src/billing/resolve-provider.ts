/**
 * @vanni/providers — Fail-Closed Billing Provider Resolution
 *
 * Payments must never be simulated outside of an explicit local-development
 * opt-in. A deployment that is missing Razorpay credentials gets an
 * UnconfiguredBillingProvider that THROWS on every operation and REJECTS every
 * webhook, rather than a mock that reports fabricated success.
 */

import {
  IBillingProvider,
  CreateCustomerRequest,
  CustomerResult,
  CreateSubscriptionRequest,
  SubscriptionResult,
  CancelSubscriptionRequest,
  WebhookVerificationPayload,
} from '@vanni/provider-sdk';
import { areMockProvidersAllowed, ProviderNotConfiguredError } from '@vanni/shared';
import { RazorpayBillingProvider } from './razorpay.js';
import { MockBillingProvider } from '../mocks/mock-billing.js';

const REQUIRED_ENV_VARS = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'];

export interface BillingProviderConfig {
  keyId?: string;
  keySecret?: string;
  webhookSecret?: string;
}

/**
 * Used when real payment credentials are absent in production.
 *
 * Every mutating call fails loudly and webhook verification always returns
 * false, so a misconfigured deployment can never create a subscription or
 * accept a forged `payment.captured` event.
 */
export class UnconfiguredBillingProvider implements IBillingProvider {
  readonly providerName = 'UNCONFIGURED';

  async createCustomer(_req: CreateCustomerRequest): Promise<CustomerResult> {
    throw new ProviderNotConfiguredError('Razorpay', REQUIRED_ENV_VARS);
  }

  async createSubscription(_req: CreateSubscriptionRequest): Promise<SubscriptionResult> {
    throw new ProviderNotConfiguredError('Razorpay', REQUIRED_ENV_VARS);
  }

  async cancelSubscription(
    _req: CancelSubscriptionRequest
  ): Promise<{ success: boolean; error?: string }> {
    throw new ProviderNotConfiguredError('Razorpay', REQUIRED_ENV_VARS);
  }

  verifyWebhookSignature(_payload: WebhookVerificationPayload): boolean {
    return false;
  }

  normalizeWebhookEvent(_rawEvent: Record<string, any>): {
    providerEventId: string;
    eventType: string;
    subscriptionId?: string;
    paymentId?: string;
    amount?: number;
    currency?: string;
    status?: string;
  } {
    throw new ProviderNotConfiguredError('Razorpay', REQUIRED_ENV_VARS);
  }
}

/**
 * Resolves the billing provider for the current process.
 *
 * 1. Real credentials present            -> RazorpayBillingProvider (verified HMAC).
 * 2. No credentials + explicit mock flag -> MockBillingProvider (non-production only).
 * 3. No credentials in production        -> UnconfiguredBillingProvider (fail-closed).
 * 4. No credentials in development       -> MockBillingProvider, with a loud warning.
 */
export function resolveBillingProvider(config: BillingProviderConfig = {}): IBillingProvider {
  const keyId = config.keyId ?? process.env.RAZORPAY_KEY_ID ?? '';
  const keySecret = config.keySecret ?? process.env.RAZORPAY_KEY_SECRET ?? '';
  const webhookSecret = config.webhookSecret ?? process.env.RAZORPAY_WEBHOOK_SECRET ?? '';

  if (keyId && keySecret) {
    return new RazorpayBillingProvider({ keyId, keySecret, webhookSecret });
  }

  if (process.env.NODE_ENV === 'production' && !areMockProvidersAllowed()) {
    console.error(
      '[Billing] Razorpay credentials are missing in production — billing is DISABLED and every ' +
        'payment webhook will be rejected. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.'
    );
    return new UnconfiguredBillingProvider();
  }

  console.warn(
    '[Billing] Razorpay credentials are absent — serving SIMULATED billing. ' +
      'This is permitted only in non-production. Set RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET.'
  );
  return new MockBillingProvider();
}
