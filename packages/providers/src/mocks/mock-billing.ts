/**
 * @vanni/providers — Mock Billing Provider for Unit & Integration Testing
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

export class MockBillingProvider implements IBillingProvider {
  readonly providerName = 'MOCK_RAZORPAY';

  public customers: Map<string, CreateCustomerRequest> = new Map();
  public subscriptions: Map<string, any> = new Map();

  async createCustomer(req: CreateCustomerRequest): Promise<CustomerResult> {
    const id = `cust_mock_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    this.customers.set(id, req);
    return { success: true, providerCustomerId: id };
  }

  async createSubscription(req: CreateSubscriptionRequest): Promise<SubscriptionResult> {
    const id = `sub_mock_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    this.subscriptions.set(id, { ...req, status: 'active' });
    return {
      success: true,
      providerSubscriptionId: id,
      status: 'active',
      shortUrl: `https://rzp.io/i/${id}`,
    };
  }

  async cancelSubscription(req: CancelSubscriptionRequest): Promise<{ success: boolean; error?: string }> {
    const sub = this.subscriptions.get(req.providerSubscriptionId);
    if (sub) {
      sub.status = req.cancelAtPeriodEnd ? 'cancel_at_period_end' : 'cancelled';
      this.subscriptions.set(req.providerSubscriptionId, sub);
    }
    return { success: true };
  }

  verifyWebhookSignature(payload: WebhookVerificationPayload): boolean {
    if (payload.signature === 'valid_mock_signature') return true;
    const secret = payload.webhookSecret;
    if (!secret || !payload.signature) return false;
    try {
      const expected = crypto.createHmac('sha256', secret).update(payload.rawBody).digest('hex');
      const a = Buffer.from(payload.signature);
      const b = Buffer.from(expected);
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  normalizeWebhookEvent(rawEvent: Record<string, any>): {
    providerEventId: string;
    eventType: string;
    subscriptionId?: string;
    paymentId?: string;
    amount?: number;
    currency?: string;
    status?: string;
  } {
    const eventType = rawEvent.event || 'subscription.charged';
    const payload = rawEvent.payload || {};
    const subscription = payload.subscription?.entity;
    const payment = payload.payment?.entity;

    return {
      providerEventId: rawEvent.id || `evt_${Date.now()}`,
      eventType,
      subscriptionId: subscription?.id || rawEvent.subscriptionId || 'sub_mock_123',
      paymentId: payment?.id || rawEvent.paymentId || 'pay_mock_123',
      amount: payment ? payment.amount / 100 : (rawEvent.amount || 4999),
      currency: payment?.currency || rawEvent.currency || 'INR',
      status: subscription?.status || payment?.status || 'captured',
    };
  }
}
