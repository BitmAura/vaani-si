/**
 * @vanni/tool-engine — Domain Models & Memory / Repositories
 */

export interface CustomerDTO {
  id: string;
  organizationId: string;
  phone: string;
  name: string;
  email?: string;
  city?: string;
  preferredLanguage?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'UNQUALIFIED'
  | 'CONVERTED'
  | 'LOST'
  | 'DO_NOT_CONTACT';

export type LeadSource =
  | 'PHONE'
  | 'WEBSITE'
  | 'META'
  | 'GOOGLE'
  | 'WHATSAPP'
  | 'MANUAL'
  | 'OTHER';

export type LeadQualification =
  | 'UNQUALIFIED'
  | 'PARTIALLY_QUALIFIED'
  | 'QUALIFIED'
  | 'DISQUALIFIED';

export interface BusinessLeadDTO {
  id: string;
  organizationId: string;
  customerId: string;
  source: LeadSource;
  campaignId?: string;
  conversationId?: string;
  status: LeadStatus;
  stage: string;
  interest: string;
  budget?: string;
  location?: string;
  preferredTimeline?: string;
  notes?: string;
  qualificationStatus: LeadQualification;
  qualificationData: Record<string, any>;
  assignedTo?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export type AppointmentStatus =
  | 'REQUESTED'
  | 'CONFIRMED'
  | 'RESCHEDULED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'EXPIRED';

export interface BusinessAppointmentDTO {
  id: string;
  organizationId: string;
  customerId: string;
  serviceId?: string;
  staffId?: string;
  locationId?: string;
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
  timezone: string;
  status: AppointmentStatus;
  source: string;
  conversationId?: string;
  cancellationReason?: string;
  rescheduledFromId?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CallbackRequestDTO {
  id: string;
  organizationId: string;
  customerId: string;
  conversationId?: string;
  preferredTime: string;
  reason: string;
  status: 'REQUESTED' | 'PENDING' | 'COMPLETED' | 'CANCELLED';
  assignedTeam?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FollowUpTaskDTO {
  id: string;
  organizationId: string;
  customerId: string;
  leadId?: string;
  appointmentId?: string;
  title: string;
  description?: string;
  dueDate: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assignedTo?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IBusinessDataStore {
  // Customers
  findCustomerByPhone(orgId: string, phone: string): Promise<CustomerDTO | null>;
  findCustomerById(orgId: string, customerId: string): Promise<CustomerDTO | null>;
  createCustomer(customer: CustomerDTO): Promise<CustomerDTO>;
  updateCustomer(orgId: string, customerId: string, updates: Partial<CustomerDTO>): Promise<CustomerDTO>;

  // Leads
  createLead(lead: BusinessLeadDTO): Promise<BusinessLeadDTO>;
  updateLead(orgId: string, leadId: string, updates: Partial<BusinessLeadDTO>): Promise<BusinessLeadDTO>;
  getLeadById(orgId: string, leadId: string): Promise<BusinessLeadDTO | null>;
  getLeadByIdempotencyKey(orgId: string, idempotencyKey: string): Promise<BusinessLeadDTO | null>;
  listLeads(orgId: string): Promise<BusinessLeadDTO[]>;

  // Appointments
  checkSlotConflict(orgId: string, staffId: string | undefined, startTime: string, endTime: string, excludeId?: string): Promise<boolean>;
  createAppointment(apt: BusinessAppointmentDTO): Promise<BusinessAppointmentDTO>;
  updateAppointment(orgId: string, appointmentId: string, updates: Partial<BusinessAppointmentDTO>): Promise<BusinessAppointmentDTO>;
  getAppointmentById(orgId: string, appointmentId: string): Promise<BusinessAppointmentDTO | null>;
  getAppointmentByIdempotencyKey(orgId: string, idempotencyKey: string): Promise<BusinessAppointmentDTO | null>;
  listAppointments(orgId: string, dateStr?: string): Promise<BusinessAppointmentDTO[]>;

  // Callbacks
  createCallback(cb: CallbackRequestDTO): Promise<CallbackRequestDTO>;
  getCallbackByIdempotencyKey(orgId: string, idempotencyKey: string): Promise<CallbackRequestDTO | null>;

  // Follow-ups
  createFollowUp(task: FollowUpTaskDTO): Promise<FollowUpTaskDTO>;
  getFollowUpByIdempotencyKey(orgId: string, idempotencyKey: string): Promise<FollowUpTaskDTO | null>;

  // Audit Events
  recordToolEvent(event: any): Promise<void>;
  listToolEvents(orgId: string, conversationId?: string): Promise<any[]>;
}

/**
 * High-performance In-Memory Data Store with Strict Tenant Isolation
 */
export class InMemoryBusinessDataStore implements IBusinessDataStore {
  private customers = new Map<string, CustomerDTO>();
  private leads = new Map<string, BusinessLeadDTO>();
  private appointments = new Map<string, BusinessAppointmentDTO>();
  private callbacks = new Map<string, CallbackRequestDTO>();
  private followUps = new Map<string, FollowUpTaskDTO>();
  private toolEvents: any[] = [];

  // ================= Customer Methods =================
  async findCustomerByPhone(orgId: string, phone: string): Promise<CustomerDTO | null> {
    for (const cust of this.customers.values()) {
      if (cust.organizationId === orgId && cust.phone === phone) {
        return { ...cust };
      }
    }
    return null;
  }

  async findCustomerById(orgId: string, customerId: string): Promise<CustomerDTO | null> {
    const cust = this.customers.get(customerId);
    if (cust && cust.organizationId === orgId) {
      return { ...cust };
    }
    return null;
  }

  async createCustomer(customer: CustomerDTO): Promise<CustomerDTO> {
    this.customers.set(customer.id, { ...customer });
    return { ...customer };
  }

  async updateCustomer(orgId: string, customerId: string, updates: Partial<CustomerDTO>): Promise<CustomerDTO> {
    const existing = await this.findCustomerById(orgId, customerId);
    if (!existing) {
      throw new Error(`Customer ${customerId} not found for organization ${orgId}`);
    }
    const updated = {
      ...existing,
      ...updates,
      id: existing.id,
      organizationId: existing.organizationId,
      updatedAt: new Date().toISOString(),
    };
    this.customers.set(customerId, updated);
    return { ...updated };
  }

  // ================= Lead Methods =================
  async createLead(lead: BusinessLeadDTO): Promise<BusinessLeadDTO> {
    if (lead.idempotencyKey) {
      const existing = await this.getLeadByIdempotencyKey(lead.organizationId, lead.idempotencyKey);
      if (existing) return existing;
    }
    this.leads.set(lead.id, { ...lead });
    return { ...lead };
  }

  async updateLead(orgId: string, leadId: string, updates: Partial<BusinessLeadDTO>): Promise<BusinessLeadDTO> {
    const existing = await this.getLeadById(orgId, leadId);
    if (!existing) {
      throw new Error(`Lead ${leadId} not found for organization ${orgId}`);
    }
    const updated = {
      ...existing,
      ...updates,
      id: existing.id,
      organizationId: existing.organizationId,
      updatedAt: new Date().toISOString(),
    };
    this.leads.set(leadId, updated);
    return { ...updated };
  }

  async getLeadById(orgId: string, leadId: string): Promise<BusinessLeadDTO | null> {
    const lead = this.leads.get(leadId);
    if (lead && lead.organizationId === orgId) return { ...lead };
    return null;
  }

  async getLeadByIdempotencyKey(orgId: string, idempotencyKey: string): Promise<BusinessLeadDTO | null> {
    for (const lead of this.leads.values()) {
      if (lead.organizationId === orgId && lead.idempotencyKey === idempotencyKey) {
        return { ...lead };
      }
    }
    return null;
  }

  async listLeads(orgId: string): Promise<BusinessLeadDTO[]> {
    return Array.from(this.leads.values())
      .filter(l => l.organizationId === orgId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // ================= Appointment Methods =================
  async checkSlotConflict(
    orgId: string,
    staffId: string | undefined,
    startTime: string,
    endTime: string,
    excludeId?: string
  ): Promise<boolean> {
    const reqStart = new Date(startTime).getTime();
    const reqEnd = new Date(endTime).getTime();

    for (const apt of this.appointments.values()) {
      if (apt.organizationId !== orgId) continue;
      if (excludeId && apt.id === excludeId) continue;
      if (apt.status !== 'CONFIRMED' && apt.status !== 'REQUESTED') continue;

      // If staffId is specified, check against that specific staff. If not, check global overlap.
      if (staffId && apt.staffId && apt.staffId !== staffId) continue;

      const existStart = new Date(apt.startTime).getTime();
      const existEnd = new Date(apt.endTime).getTime();

      // Overlap condition: StartA < EndB and EndA > StartB
      if (reqStart < existEnd && reqEnd > existStart) {
        return true; // Conflict detected!
      }
    }
    return false;
  }

  async createAppointment(apt: BusinessAppointmentDTO): Promise<BusinessAppointmentDTO> {
    if (apt.idempotencyKey) {
      const existing = await this.getAppointmentByIdempotencyKey(apt.organizationId, apt.idempotencyKey);
      if (existing) return existing;
    }

    const hasConflict = await this.checkSlotConflict(
      apt.organizationId,
      apt.staffId,
      apt.startTime,
      apt.endTime
    );
    if (hasConflict) {
      throw new Error(`SLOT_CONFLICT: The selected appointment slot is already reserved.`);
    }

    this.appointments.set(apt.id, { ...apt });
    return { ...apt };
  }

  async updateAppointment(
    orgId: string,
    appointmentId: string,
    updates: Partial<BusinessAppointmentDTO>
  ): Promise<BusinessAppointmentDTO> {
    const existing = await this.getAppointmentById(orgId, appointmentId);
    if (!existing) {
      throw new Error(`Appointment ${appointmentId} not found for organization ${orgId}`);
    }

    // If rescheduling, check conflict for the new start and end time
    if (updates.startTime && updates.endTime) {
      const conflict = await this.checkSlotConflict(
        orgId,
        updates.staffId || existing.staffId,
        updates.startTime,
        updates.endTime,
        appointmentId
      );
      if (conflict) {
        throw new Error(`SLOT_CONFLICT: The new appointment slot is already reserved.`);
      }
    }

    const updated = {
      ...existing,
      ...updates,
      id: existing.id,
      organizationId: existing.organizationId,
      updatedAt: new Date().toISOString(),
    };
    this.appointments.set(appointmentId, updated);
    return { ...updated };
  }

  async getAppointmentById(orgId: string, appointmentId: string): Promise<BusinessAppointmentDTO | null> {
    const apt = this.appointments.get(appointmentId);
    if (apt && apt.organizationId === orgId) return { ...apt };
    return null;
  }

  async getAppointmentByIdempotencyKey(orgId: string, idempotencyKey: string): Promise<BusinessAppointmentDTO | null> {
    for (const apt of this.appointments.values()) {
      if (apt.organizationId === orgId && apt.idempotencyKey === idempotencyKey) {
        return { ...apt };
      }
    }
    return null;
  }

  async listAppointments(orgId: string, dateStr?: string): Promise<BusinessAppointmentDTO[]> {
    return Array.from(this.appointments.values())
      .filter(a => {
        if (a.organizationId !== orgId) return false;
        if (dateStr && !a.startTime.startsWith(dateStr)) return false;
        return true;
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  // ================= Callback Methods =================
  async createCallback(cb: CallbackRequestDTO): Promise<CallbackRequestDTO> {
    if (cb.idempotencyKey) {
      const existing = await this.getCallbackByIdempotencyKey(cb.organizationId, cb.idempotencyKey);
      if (existing) return existing;
    }
    this.callbacks.set(cb.id, { ...cb });
    return { ...cb };
  }

  async getCallbackByIdempotencyKey(orgId: string, idempotencyKey: string): Promise<CallbackRequestDTO | null> {
    for (const cb of this.callbacks.values()) {
      if (cb.organizationId === orgId && cb.idempotencyKey === idempotencyKey) {
        return { ...cb };
      }
    }
    return null;
  }

  // ================= Follow-up Methods =================
  async createFollowUp(task: FollowUpTaskDTO): Promise<FollowUpTaskDTO> {
    if (task.idempotencyKey) {
      const existing = await this.getFollowUpByIdempotencyKey(task.organizationId, task.idempotencyKey);
      if (existing) return existing;
    }
    this.followUps.set(task.id, { ...task });
    return { ...task };
  }

  async getFollowUpByIdempotencyKey(orgId: string, idempotencyKey: string): Promise<FollowUpTaskDTO | null> {
    for (const f of this.followUps.values()) {
      if (f.organizationId === orgId && f.idempotencyKey === idempotencyKey) {
        return { ...f };
      }
    }
    return null;
  }

  // ================= Audit Events =================
  async recordToolEvent(event: any): Promise<void> {
    this.toolEvents.push({ ...event });
  }

  async listToolEvents(orgId: string, conversationId?: string): Promise<any[]> {
    return this.toolEvents.filter(e => {
      if (e.organizationId !== orgId) return false;
      if (conversationId && e.conversationId !== conversationId) return false;
      return true;
    });
  }
}

export const defaultBusinessStore = new InMemoryBusinessDataStore();
