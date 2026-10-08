/**
 * Invoice Generator
 * Produces GST-compliant BillingInvoiceDTO records for a subscription
 * billing period and persists them via the database service.
 */

import { globalDb } from '@vanni/database';
import { BillingInvoiceDTO } from '@vanni/shared';

export interface GenerateInvoiceInput {
  organizationId: string;
  billingAccountId: string;
  subscriptionId?: string;
  paymentId?: string;
  /** Plan price for the period, in INR (excluding tax). */
  subtotalInr: number;
  /** GST percent. Indian SaaS B2B standard is 18%. */
  taxPercent?: number;
  /** GSTIN of the issuing entity, if registered. */
  taxIdentifier?: string;
  periodStart: string;
  periodEnd: string;
  currency?: string;
}

export class InvoiceGenerator {
  /**
   * Generates and persists an invoice for a billing period.
   */
  async generateInvoice(input: GenerateInvoiceInput): Promise<BillingInvoiceDTO> {
    const taxPercent = input.taxPercent ?? 18;
    const subtotal = Math.round(input.subtotalInr * 100) / 100;
    const taxAmount = Math.round(subtotal * (taxPercent / 100) * 100) / 100;
    const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

    const invoice: BillingInvoiceDTO = {
      id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      organizationId: input.organizationId,
      billingAccountId: input.billingAccountId,
      subscriptionId: input.subscriptionId,
      paymentId: input.paymentId,
      invoiceNumber: await this.nextInvoiceNumber(input.organizationId),
      subtotal,
      taxAmount,
      taxIdentifier: input.taxIdentifier,
      totalAmount,
      currency: input.currency || 'INR',
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      status: input.paymentId ? 'PAID' : 'PENDING',
      issuedAt: new Date().toISOString(),
    };

    await globalDb.saveBillingInvoice(invoice);
    return invoice;
  }

  async listInvoices(organizationId: string): Promise<BillingInvoiceDTO[]> {
    return globalDb.getBillingInvoices(organizationId);
  }

  /**
   * Sequential invoice numbering per organization: INV-2026-0001
   */
  private async nextInvoiceNumber(organizationId: string): Promise<string> {
    const existing = await globalDb.getBillingInvoices(organizationId);
    const year = new Date().getFullYear();
    const yearPrefix = `INV-${year}-`;
    const maxSeq = existing.reduce((max, inv) => {
      if (!inv.invoiceNumber.startsWith(yearPrefix)) return max;
      const seq = parseInt(inv.invoiceNumber.slice(yearPrefix.length), 10);
      return Number.isFinite(seq) && seq > max ? seq : max;
    }, 0);
    return `${yearPrefix}${String(maxSeq + 1).padStart(4, '0')}`;
  }
}

export const globalInvoiceGenerator = new InvoiceGenerator();
