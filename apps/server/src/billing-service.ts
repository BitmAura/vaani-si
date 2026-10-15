/**
 * Billing Engine with Razorpay Integration
 * Dhwani SI — Layer 3: Billing & Subscription Management
 * Handles subscriptions, invoicing, and payment processing
 */

import { FastifyInstance } from 'fastify';

export interface SubscriptionPlan {
  id: string;
  name: string;
  callsLimit: number;
  minutesLimit: number;
  monthlyFee: number;
  setupFee: number;
  features: string[];
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  STARTER: {
    id: 'STARTER',
    name: 'Starter',
    callsLimit: 300,
    minutesLimit: 600,
    monthlyFee: 4999, // ₹4,999/mo
    setupFee: 0,
    features: ['1 Autonomous AI Employee', '600 Included Talk Minutes', 'Kannada + Kanglish + English', 'Call Recording & Transcripts', 'WhatsApp Lead Alerts', 'Extra minutes: ₹2.50/min'],
  },
  GROWTH: {
    id: 'GROWTH',
    name: 'Growth',
    callsLimit: 1500,
    minutesLimit: 2500,
    monthlyFee: 14999, // ₹14,999/mo
    setupFee: 0,
    features: ['Up to 3 Autonomous AI Employees', '2,500 Included Talk Minutes', 'Calendar Slot Booking & WhatsApp Sync', 'Real-time Human Call Transfer', 'CRM Webhook Integrations', 'Extra minutes: ₹2.20/min'],
  },
  SCALE: {
    id: 'SCALE',
    name: 'Agency / Scale',
    callsLimit: 4000,
    minutesLimit: 6000,
    monthlyFee: 29999, // ₹29,999/mo
    setupFee: 0,
    features: ['Up to 10 Autonomous AI Employees', '6,000 Included Talk Minutes', 'Multi-tenant Client Sub-Accounts', 'Dedicated SIP Trunks & Custom Dialect Prosody', 'Full Analytics Suite & Multi-CRM Sync', 'Extra minutes: ₹1.90/min'],
  },
  AGENCY: {
    id: 'AGENCY',
    name: 'Agency / Scale',
    callsLimit: 4000,
    minutesLimit: 6000,
    monthlyFee: 29999, // ₹29,999/mo
    setupFee: 0,
    features: ['Up to 10 Autonomous AI Employees', '6,000 Included Talk Minutes', 'White-Label Agency Client Reselling', 'Custom Sub-account Branding', 'Multi-CRM Sync & Dedicated Manager', 'Extra minutes: ₹1.90/min'],
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    callsLimit: 20000,
    minutesLimit: 25000,
    monthlyFee: 99999, // ₹99,999/mo
    setupFee: 0,
    features: ['Unlimited AI Employees', 'Dedicated High-Volume SIP Trunks', 'Custom Voice & Dialect Tuning', 'Custom SLA 99.9%', 'On-Premise CRM Sync'],
  },
};

export interface BillingRecord {
  id: string;
  tenantId: string;
  subscriptionPlan: string;
  periodStart: Date;
  periodEnd: Date;
  baseAmount: number;
  usageCharges: number;
  overageCharges: number;
  taxAmount: number;
  totalAmount: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  paymentId?: string;
  invoiceNumber: string;
}

export class BillingService {
  private razorpayKeyId: string;
  private razorpayKeySecret: string;

  constructor() {
    this.razorpayKeyId = process.env.RAZORPAY_KEY_ID || '';
    this.razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || '';
  }

  /**
   * Create subscription for new tenant
   */
  async createSubscription(
    tenantId: string,
    planId: string,
    billingCycle: 'MONTHLY' | 'ANNUALLY' = 'MONTHLY'
  ): Promise<{ subscriptionId: string; paymentLink: string }> {
    const plan = SUBSCRIPTION_PLANS[planId];
    if (!plan) throw new Error('Invalid plan');

    const amount = billingCycle === 'ANNUALLY' ? plan.monthlyFee * 10 : plan.monthlyFee; // 2 months free on annual

    // In production, create Razorpay subscription
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const paymentLink = `https://api.razorpay.com/v1/checkout/${subscriptionId}`;

    console.log(`[Billing] Created subscription ${subscriptionId} for tenant ${tenantId}, plan ${planId}, amount ₹${amount}`);

    return { subscriptionId, paymentLink };
  }

  /**
   * Calculate monthly bill with usage charges
   */
  calculateBill(
    plan: SubscriptionPlan,
    usage: { calls: number; minutes: number },
    overageRates: { callRate: number; minuteRate: number } = { callRate: 2, minuteRate: 0.5 }
  ): { baseAmount: number; usageCharges: number; overageCharges: number; total: number } {
    const baseAmount = plan.monthlyFee;

    // Calculate overage
    const callOverage = Math.max(0, usage.calls - plan.callsLimit);
    const minuteOverage = Math.max(0, usage.minutes - plan.minutesLimit);

    const overageCharges = (callOverage * overageRates.callRate) + (minuteOverage * overageRates.minuteRate);

    return {
      baseAmount,
      usageCharges: 0, // Usage charges only apply to PAYG plans
      overageCharges,
      total: baseAmount + overageCharges,
    };
  }

  /**
   * Generate monthly invoice
   */
  async generateInvoice(
    tenantId: string,
    billingPeriod: { start: Date; end: Date }
  ): Promise<BillingRecord> {
    // In production, fetch subscription and usage data
    const invoice = {
      id: `inv_${Date.now()}`,
      tenantId,
      subscriptionPlan: 'GROWTH',
      periodStart: billingPeriod.start,
      periodEnd: billingPeriod.end,
      baseAmount: 35000,
      usageCharges: 0,
      overageCharges: 1200,
      taxAmount: 6516, // 18% GST
      totalAmount: 42716,
      status: 'PENDING' as const,
      invoiceNumber: `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
    };

    console.log(`[Billing] Generated invoice ${invoice.invoiceNumber} for tenant ${tenantId}`);

    return invoice;
  }

  /**
   * Process payment webhook from Razorpay
   */
  async handlePaymentWebhook(payload: any): Promise<{ success: boolean; paymentId: string }> {
    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = payload;

    // In production, verify signature and update database
    console.log(`[Billing] Payment received: ${razorpay_payment_id}`);

    return {
      success: true,
      paymentId: razorpay_payment_id,
    };
  }

  /**
   * Send invoice via email
   */
  async sendInvoiceEmail(invoice: BillingRecord, email: string): Promise<void> {
    console.log(`[Billing] Sending invoice ${invoice.invoiceNumber} to ${email}`);
    // In production, send via SendGrid/SNS
  }

  /**
   * Check if tenant has active subscription
   */
  async isSubscriptionActive(tenantId: string): Promise<boolean> {
    // In production, query database
    return true;
  }

  /**
   * Upgrade/downgrade subscription
   */
  async changePlan(
    tenantId: string,
    currentPlan: string,
    newPlan: string,
    effectiveDate: Date
  ): Promise<{ proratedAmount: number; newSubscriptionId: string }> {
    const current = SUBSCRIPTION_PLANS[currentPlan];
    const newPlanData = SUBSCRIPTION_PLANS[newPlan];

    // Calculate prorated amount
    const daysRemaining = 30 - new Date().getDate();
    const proratedAmount = Math.round((newPlanData.monthlyFee - current.monthlyFee) * (daysRemaining / 30));

    console.log(`[Billing] Plan change: ${currentPlan} → ${newPlan} for tenant ${tenantId}, prorated: ₹${proratedAmount}`);

    return {
      proratedAmount,
      newSubscriptionId: `sub_${Date.now()}`,
    };
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(tenantId: string, reason: string): Promise<void> {
    console.log(`[Billing] Subscription cancelled for tenant ${tenantId}, reason: ${reason}`);
    // In production, update subscription status and schedule access revocation
  }

  /**
   * Get billing history
   */
  async getBillingHistory(tenantId: string, limit: number = 12): Promise<BillingRecord[]> {
    // In production, query from PostgreSQL
    return [
      {
        id: `inv_${Date.now()}`,
        tenantId,
        subscriptionPlan: 'GROWTH',
        periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        periodEnd: new Date(),
        baseAmount: 35000,
        usageCharges: 0,
        overageCharges: 1200,
        taxAmount: 6516,
        totalAmount: 42716,
        status: 'PAID',
        paymentId: 'pay_123456789',
        invoiceNumber: `INV-2026-0012`,
      },
    ];
  }
}
