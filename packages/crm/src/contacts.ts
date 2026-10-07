/**
 * @vanni/crm — Contacts Service & Identity Resolution Engine
 * Handles contact deduplication, phone normalization, DO_NOT_CONTACT suppression, and timeline activity.
 */

import { ContactDTO, ContactSource, ContactStatus } from '@vanni/shared';
import { IDatabaseService } from '@vanni/database';
import { ArgumentNormalizer } from '@vanni/tool-engine';

export type DeduplicationMatchResult =
  | { type: 'EXACT_MATCH'; contact: ContactDTO }
  | { type: 'POSSIBLE_MATCH'; candidates: ContactDTO[] }
  | { type: 'NO_MATCH' };

export interface ResolveContactParams {
  organizationId: string;
  phone?: string;
  email?: string;
  displayName?: string;
  source?: ContactSource;
  preferredLanguage?: string;
  city?: string;
  notes?: string;
}

export class ContactService {
  constructor(private db: IDatabaseService) {}

  /**
   * Resolves or creates a contact deterministically without creating duplicates.
   * Matches primarily on normalized E.164 phone number, secondarily on normalized email.
   */
  async resolveOrCreateContact(params: ResolveContactParams): Promise<{ contact: ContactDTO; isNew: boolean }> {
    const { organizationId, phone, email, displayName, source = 'PHONE', preferredLanguage = 'KANGLISH_BUSINESS', city, notes } = params;

    const normPhone = phone ? ArgumentNormalizer.normalizePhoneNumber(phone) : '';
    const normEmail = email ? email.trim().toLowerCase() : '';

    // 1. Phone Match
    if (normPhone) {
      const existingByPhone = await this.db.findContactByPhone(organizationId, normPhone);
      if (existingByPhone) {
        // Touch lastContactedAt & update details if provided
        existingByPhone.lastContactedAt = new Date().toISOString();
        existingByPhone.lastActivityAt = new Date().toISOString();
        if (displayName && existingByPhone.displayName === 'Valued Customer') {
          existingByPhone.displayName = ArgumentNormalizer.normalizeName(displayName);
        }
        if (normEmail && !existingByPhone.email) {
          existingByPhone.email = normEmail;
        }
        await this.db.saveContact(existingByPhone);
        return { contact: existingByPhone, isNew: false };
      }
    }

    // 2. Email Match (if phone was missing or different)
    if (normEmail) {
      const existingByEmail = await this.db.findContactByEmail(organizationId, normEmail);
      if (existingByEmail) {
        existingByEmail.lastContactedAt = new Date().toISOString();
        existingByEmail.lastActivityAt = new Date().toISOString();
        if (normPhone && !existingByEmail.phone) {
          existingByEmail.phone = normPhone;
        }
        await this.db.saveContact(existingByEmail);
        return { contact: existingByEmail, isNew: false };
      }
    }

    // 3. Create New Contact
    const now = new Date().toISOString();
    const newContact: ContactDTO = {
      id: `cnt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      organizationId,
      displayName: displayName ? ArgumentNormalizer.normalizeName(displayName) : 'Valued Customer',
      phone: normPhone,
      email: normEmail || undefined,
      preferredLanguage,
      city,
      source,
      status: 'ACTIVE',
      notes,
      lastContactedAt: now,
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.saveContact(newContact);

    // Record creation activity
    await this.db.saveCRMActivity({
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      organizationId,
      contactId: newContact.id,
      type: 'NOTE',
      title: 'Contact Profile Created',
      description: `Contact registered via ${source}`,
      metadata: { source, phone: normPhone },
      createdByType: 'SYSTEM',
      createdAt: now,
    });

    return { contact: newContact, isNew: true };
  }

  /**
   * Evaluates deduplication match for incoming details
   */
  async matchContact(organizationId: string, phone?: string, email?: string): Promise<DeduplicationMatchResult> {
    const normPhone = phone ? ArgumentNormalizer.normalizePhoneNumber(phone) : '';
    if (normPhone) {
      const existing = await this.db.findContactByPhone(organizationId, normPhone);
      if (existing) return { type: 'EXACT_MATCH', contact: existing };
    }

    const normEmail = email ? email.trim().toLowerCase() : '';
    if (normEmail) {
      const existing = await this.db.findContactByEmail(organizationId, normEmail);
      if (existing) return { type: 'EXACT_MATCH', contact: existing };
    }

    return { type: 'NO_MATCH' };
  }

  /**
   * Enforces strict Do-Not-Contact suppression server-side
   */
  async suppressContact(
    organizationId: string,
    contactId: string,
    reason = 'Customer requested suppression'
  ): Promise<ContactDTO> {
    const contact = await this.db.getContactById(contactId, organizationId);
    if (!contact) {
      throw new Error(`Contact ${contactId} not found`);
    }

    contact.status = 'DO_NOT_CONTACT';
    contact.doNotContactReason = reason;
    contact.doNotContactSetAt = new Date().toISOString();
    contact.updatedAt = new Date().toISOString();

    await this.db.saveContact(contact);

    // Record audit activity
    await this.db.saveCRMActivity({
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      organizationId,
      contactId: contact.id,
      type: 'STATUS_CHANGED',
      title: 'Do Not Contact Suppression Activated',
      description: `Suppressed reason: ${reason}`,
      metadata: { previousStatus: 'ACTIVE', newStatus: 'DO_NOT_CONTACT' },
      createdByType: 'AI_AGENT',
      createdAt: new Date().toISOString(),
    });

    return contact;
  }

  /**
   * Checks if contact is eligible for outbound automated outreach
   */
  async isOutreachPermitted(organizationId: string, contactId: string): Promise<boolean> {
    const contact = await this.db.getContactById(contactId, organizationId);
    if (!contact) return false;
    return contact.status === 'ACTIVE';
  }

  /**
   * Updates contact fields
   */
  async updateContact(
    organizationId: string,
    contactId: string,
    updates: Partial<ContactDTO>
  ): Promise<ContactDTO> {
    const contact = await this.db.getContactById(contactId, organizationId);
    if (!contact) {
      throw new Error(`Contact ${contactId} not found`);
    }

    if (updates.phone) {
      updates.phone = ArgumentNormalizer.normalizePhoneNumber(updates.phone);
    }
    if (updates.displayName) {
      updates.displayName = ArgumentNormalizer.normalizeName(updates.displayName);
    }

    const updated: ContactDTO = {
      ...contact,
      ...updates,
      id: contact.id,
      organizationId: contact.organizationId,
      updatedAt: new Date().toISOString(),
    };

    await this.db.saveContact(updated);
    return updated;
  }

  /**
   * List contacts with search query and pagination support
   */
  async listContacts(
    organizationId: string,
    query?: string,
    page = 1,
    pageSize = 20
  ): Promise<{ contacts: ContactDTO[]; total: number; page: number; pageSize: number }> {
    const all = await this.db.getContacts(organizationId, query);
    const start = (page - 1) * pageSize;
    const paginated = all.slice(start, start + pageSize);
    return {
      contacts: paginated,
      total: all.length,
      page,
      pageSize,
    };
  }

  /**
   * Retrieves single contact by ID
   */
  async getContact(organizationId: string, contactId: string): Promise<ContactDTO | null> {
    return this.db.getContactById(contactId, organizationId);
  }
}
