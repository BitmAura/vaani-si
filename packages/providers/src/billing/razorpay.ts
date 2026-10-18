/**
 * @vanni/providers — Razorpay Billing Adapter
 *
 * Implements IBillingProvider contract using official maintained Razorpay subscription APIs:
 * - Customer registration
 * - Subscription initialization (plan linkage)
 * - Cryptographic HMAC SHA256 Webhook signature validation
 * - Standardized event normalization
 */

import crypto from 'node:crypto';
import {
  IBillingProvider,
  CreateCustomerRequest,
  CustomerResult,
  CreateSubscriptionRequest,
  SubscriptionResult,
  CancelSubscriptionRequest,
  WebhookVerificationPayload,
} from '@vanni/provider-sdk';

export interface RazorpayConfig {
  keyId?: string;
  keySecret?: string;
  webhookSecret?: string;
}

export class RazorpayBillingProvider implements IBillingProvider {
  readonly providerName = 'RAZORPAY';

  constructor(private config: RazorpayConfig = {}) {}

  /**
   * Registers a customer on Razorpay
   */
  async createCustomer(req: CreateCustomerRequest): Promise<CustomerResult> {
    if (!this.config.keyId || !this.config.keySecret) {
      if (process.env.NODE_ENV === 'production') {
        return {
          success: false,
          providerCustomerId: '',
          error: 'CRITICAL BILLING CONFIGURATION ERROR: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be configured in production mode.',
        };
      }
      return {
        success: true,
        providerCustomerId: `cust_rzp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      };
    }

    try {
      const auth = Buffer.from(`${this.config.keyId}:${this.config.keySecret}`).toString('base64');
      const response = await fetch('https://api.razorpay.com/v1/customers', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: req.name,
          email: req.email,
          contact: req.phone,
          notes: {
            organization_id: req.organizationId,
            company_name: req.companyName || '',
            gstin: req.gstin || '',
          },
        }),
      });

      const data = (await response.json()) as any;
      if (!response.ok) {
        return {
          success: false,
          providerCustomerId: '',
          error: data.error?.description || 'Razorpay customer creation failed',
        };
      }

      return {
        success: true,
        providerCustomerId: data.id,
      };
    } catch (err: any) {
      return {
        success: false,
        providerCustomerId: '',
        error: err.message,
      };
    }
  }

  /**
   * Initializes a recurring subscription on Razorpay
   */
  async createSubscription(req: CreateSubscriptionRequest): Promise<SubscriptionResult> {
    if (!this.config.keyId || !this.config.keySecret) {
      if (process.env.NODE_ENV === 'production') {
        return {
          success: false,
          providerSubscriptionId: '',
          status: 'failed',
          error: 'CRITICAL BILLING CONFIGURATION ERROR: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be configured in production mode. Silent simulated subscriptions are prohibited.',
        };
      }
      const mockSubId = `sub_rzp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      return {
        success: true,
        providerSubscriptionId: mockSubId,
        status: 'created',
        shortUrl: `https://rzp.io/i/${mockSubId}`,
      };
    }

    try {
      const auth = Buffer.from(`${this.config.keyId}:${this.config.keySecret}`).toString('base64');
      const response = await fetch('https://api.razorpay.com/v1/subscriptions', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan_id: req.planId,
          total_count: req.totalCount || 12,
          customer_notify: 1,
          customer_id: req.customerId,
          notes: {
            organization_id: req.organizationId,
            plan_version: req.planVersionId,
          },
        }),
      });

      const data = (await response.json()) as any;
      if (!response.ok) {
        return {
          success: false,
          providerSubscriptionId: '',
          status: 'failed',
          error: data.error?.description || 'Razorpay subscription creation failed',
        };
      }

      return {
        success: true,
        providerSubscriptionId: data.id,
        status: data.status,
        shortUrl: data.short_url,
      };
    } catch (err: any) {
      return {
        success: false,
        providerSubscriptionId: '',
        status: 'failed',
        error: err.message,
      };
    }
  }

  /**
   * Cancels subscription
   */
  async cancelSubscription(req: CancelSubscriptionRequest): Promise<{ success: boolean; error?: string }> {
    if (!this.config.keyId || !this.config.keySecret) {
      return { success: true };
    }

    try {
      const auth = Buffer.from(`${this.config.keyId}:${this.config.keySecret}`).toString('base64');
      const response = await fetch(
        `https://api.razorpay.com/v1/subscriptions/${req.providerSubscriptionId}/cancel`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cancel_at_cycle_end: req.cancelAtPeriodEnd ? 1 : 0,
          }),
        }
      );

      const data = (await response.json()) as any;
      if (!response.ok) {
        return { success: false, error: data.error?.description };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Verifies Razorpay HMAC SHA256 webhook signature
   */
  verifyWebhookSignature(payload: WebhookVerificationPayload): boolean {
    const secret = payload.webhookSecret || this.config.webhookSecret;
    if (!secret) return false;

    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload.rawBody)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(payload.signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  /**
   * Normalizes incoming raw Razorpay webhook payload
   */
  normalizeWebhookEvent(rawEvent: Record<string, any>): {
    providerEventId: string;
    eventType: string;
    subscriptionId?: string;
    paymentId?: string;
    amount?: number;
    currency?: string;
    status?: string;
  } {
    const eventType = rawEvent.event || 'unknown';
    const payload = rawEvent.payload || {};
    const subscription = payload.subscription?.entity;
    const payment = payload.payment?.entity;

    return {
      providerEventId: rawEvent.id || `evt_${Date.now()}`,
      eventType,
      subscriptionId: subscription?.id,
      paymentId: payment?.id,
      amount: payment ? payment.amount / 100 : undefined, // Razorpay amounts in paise
      currency: payment?.currency || 'INR',
      status: subscription?.status || payment?.status,
    };
  }
}
