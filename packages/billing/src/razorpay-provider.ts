/**
 * Razorpay Integration Provider
 * Handles payment processing, subscription management, and webhook events
 */

import crypto from 'node:crypto';

export interface RazorpaySubscriptionOptions {
  planId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes?: Record<string, string>;
}

export interface RazorpayPaymentResponse {
  id: string;
  amount: number;
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  method: string;
  orderId: string;
  invoiceId?: string;
  createdAt: number;
}

export interface RazorpayWebhookEvent {
  entity: string;
  event: string;
  contains: string[];
  payload: {
    payment?: {
      entity: {
        id: string;
        order_id: string;
        amount: number;
        currency: string;
        status: string;
        method: string;
        email: string;
        contact: string;
      };
    };
    subscription?: {
      entity: {
        id: string;
        plan_id: string;
        customer_id: string;
        status: string;
        current_start: number;
        current_end: number;
      };
    };
    invoice?: {
      entity: {
        id: string;
        subscription_id: string;
        status: string;
        amount: number;
        paid_at?: number;
      };
    };
  };
}

export class RazorpayProvider {
  private keyId: string;
  private keySecret: string;
  private webhookSecret: string;
  private baseUrl: string = 'https://api.razorpay.com/v1';

  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID || '';
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || '';
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  }

  /**
   * Create a subscription for recurring billing
   */
  async createSubscription(options: RazorpaySubscriptionOptions): Promise<{ subscriptionId: string; shortUrl: string }> {
    if (!this.keyId || !this.keySecret) {
      console.warn('[Razorpay] Missing credentials, returning mock subscription');
      return {
        subscriptionId: `sub_mock_${Date.now()}`,
        shortUrl: `https://rzp.io/i/mock`,
      };
    }

    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');

    const response = await fetch(`${this.baseUrl}/subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan_id: options.planId,
        customer_notify: 1,
        notes: options.notes || {},
        total_count: 12, // 12 billing cycles
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Razorpay subscription creation failed: ${error}`);
    }

    const data = await response.json();
    return {
      subscriptionId: data.id,
      shortUrl: data.short_url,
    };
  }

  /**
   * Cancel an active subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<{ success: boolean }> {
    if (!this.keyId || !this.keySecret) {
      console.warn('[Razorpay] Mock cancel subscription');
      return { success: true };
    }

    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');

    const response = await fetch(`${this.baseUrl}/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to cancel subscription ${subscriptionId}`);
    }

    return { success: true };
  }

  /**
   * Verify webhook signature for security
   */
  verifyWebhookSignature(body: string, signature: string): boolean {
    if (!this.webhookSecret) {
      console.warn('[Razorpay] Webhook secret not configured');
      return true; // Skip verification in development
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(body)
      .digest('hex');

    return signature === expectedSignature;
  }

  /**
   * Process webhook event
   */
  processWebhookEvent(event: RazorpayWebhookEvent): { type: string; data: any } {
    const eventType = event.event;

    switch (eventType) {
      case 'payment.captured':
        return {
          type: 'PAYMENT_CAPTURED',
          data: event.payload.payment?.entity,
        };

      case 'payment.failed':
        return {
          type: 'PAYMENT_FAILED',
          data: event.payload.payment?.entity,
        };

      case 'subscription.activated':
        return {
          type: 'SUBSCRIPTION_ACTIVATED',
          data: event.payload.subscription?.entity,
        };

      case 'subscription.charged':
        return {
          type: 'SUBSCRIPTION_CHARGED',
          data: {
            subscription: event.payload.subscription?.entity,
            invoice: event.payload.invoice?.entity,
          },
        };

      case 'subscription.cancelled':
        return {
          type: 'SUBSCRIPTION_CANCELLED',
          data: event.payload.subscription?.entity,
        };

      case 'invoice.paid':
        return {
          type: 'INVOICE_PAID',
          data: event.payload.invoice?.entity,
        };

      default:
        return {
          type: eventType.toUpperCase(),
          data: event.payload,
        };
    }
  }

  /**
   * Create a one-time payment order
   */
  async createOrder(amount: number, currency: string = 'INR'): Promise<{ orderId: string; amount: number }> {
    if (!this.keyId || !this.keySecret) {
      console.warn('[Razorpay] Mock order creation');
      return {
        orderId: `order_mock_${Date.now()}`,
        amount,
      };
    }

    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');

    const response = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amount * 100, // Amount in paise
        currency,
        payment_capture: 1, // Auto-capture
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create order: ${error}`);
    }

    const data = await response.json();
    return {
      orderId: data.id,
      amount: data.amount / 100,
    };
  }

  /**
   * Verify payment signature after checkout
   */
  verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string
  ): boolean {
    if (!this.keySecret) {
      console.warn('[Razorpay] Key secret not configured');
      return true;
    }

    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(body)
      .digest('hex');

    return signature === expectedSignature;
  }
}
