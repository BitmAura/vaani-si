/**
 * @vanni/crm — CRM Public Web Ingestion & External Adapter Interface
 */

import { z } from 'zod';
import { ContactService } from './contacts.js';
import { LeadService } from './leads.js';
import { CRMLeadDTO, ContactDTO } from '@vanni/shared';

export const PublicWebLeadSchema = z.object({
  name: z.string().min(2, 'Name is required').max(100),
  phone: z.string().min(8, 'Phone number is required').max(20),
  email: z.string().email().optional(),
  interest: z.string().min(2, 'Interest or inquiry details required'),
  city: z.string().optional(),
  message: z.string().optional(),
  sourceReference: z.string().optional(),
});

export type PublicWebLeadInput = z.infer<typeof PublicWebLeadSchema>;

export class WebLeadIngestionHandler {
  constructor(
    private contactService: ContactService,
    private leadService: LeadService
  ) {}

  /**
   * Processes a public website lead submission securely
   */
  async ingestPublicLead(
    organizationId: string,
    rawInput: unknown
  ): Promise<{ success: boolean; lead: CRMLeadDTO; contact: ContactDTO }> {
    // 1. Strict schema validation
    const validated = PublicWebLeadSchema.parse(rawInput);

    // 2. Resolve or create contact
    const { contact } = await this.contactService.resolveOrCreateContact({
      organizationId,
      phone: validated.phone,
      email: validated.email,
      displayName: validated.name,
      source: 'WEBSITE',
      city: validated.city,
      notes: validated.message,
    });

    // 3. Create lead
    const { lead } = await this.leadService.createLead({
      organizationId,
      contactId: contact.id,
      interest: validated.interest,
      source: 'WEBSITE',
      sourceReference: validated.sourceReference || 'Main Website Contact Form',
      notes: validated.message,
    });

    return {
      success: true,
      lead,
      contact,
    };
  }
}
