/**
 * VANNI Provider SDK — Billing & Payments Provider Abstraction Contract
 */

export interface CreateCustomerRequest {
  organizationId: string;
  name: string;
  email: string;
  phone?: string;
  companyName?: string;
  gstin?: string;
}

export interface CustomerResult {
  success: boolean;
  providerCustomerId: string;
  error?: string;
}

export interface CreateSubscriptionRequest {
  organizationId: string;
  customerId: string;
  planId: string;
  planVersionId: string;
  billingInterval: 'MONTHLY' | 'ANNUAL';
  totalCount?: number; // e.g. 12 billing cycles
}

export interface SubscriptionResult {
  success: boolean;
  providerSubscriptionId: string;
  status: 'created' | 'authenticated' | 'active' | 'pending' | 'failed';
  shortUrl?: string; // Razorpay payment link
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  error?: string;
}

export interface CancelSubscriptionRequest {
  providerSubscriptionId: string;
  cancelAtPeriodEnd: boolean;
}

export interface WebhookVerificationPayload {
  signature: string;
  rawBody: string;
  webhookSecret: string;
}

export interface IBillingProvider {
  readonly providerName: string;

  /**
   * Creates or registers customer in the payment gateway
   */
  createCustomer(req: CreateCustomerRequest): Promise<CustomerResult>;

  /**
   * Initializes a recurring subscription in the payment gateway
   */
  createSubscription(req: CreateSubscriptionRequest): Promise<SubscriptionResult>;

  /**
   * Cancels subscription either immediately or at period end
   */
  cancelSubscription(req: CancelSubscriptionRequest): Promise<{ success: boolean; error?: string }>;

  /**
   * Verifies cryptographic HMAC webhook signature
   */
  verifyWebhookSignature(payload: WebhookVerificationPayload): boolean;

  /**
   * Normalizes incoming raw payment gateway webhook event into standard internal types
   */
  normalizeWebhookEvent(rawEvent: Record<string, any>): {
    providerEventId: string;
    eventType: string;
    subscriptionId?: string;
    paymentId?: string;
    amount?: number;
    currency?: string;
    status?: string;
  };
}
