import {
  BusinessPhoneNumberDTO,
  TelephonySessionDTO,
  TelephonyEventDTO,
  OrganizationTelephonySettingsDTO,
} from './telephony-types.js';

export interface ITelephonyRepository {
  // Business Phone Numbers
  findPhoneNumber(phoneNumber: string): Promise<BusinessPhoneNumberDTO | null>;
  listPhoneNumbersByOrg(organizationId: string): Promise<BusinessPhoneNumberDTO[]>;
  assignAgentToPhoneNumber(phoneNumberId: string, organizationId: string, agentId: string): Promise<boolean>;
  savePhoneNumber(number: BusinessPhoneNumberDTO): Promise<void>;

  // Telephony Sessions
  saveTelephonySession(session: TelephonySessionDTO): Promise<void>;
  findTelephonySession(sessionId: string): Promise<TelephonySessionDTO | null>;
  findTelephonySessionByProviderSid(providerCallSid: string): Promise<TelephonySessionDTO | null>;
  listSessionsByOrg(organizationId: string, limit?: number): Promise<TelephonySessionDTO[]>;

  // Idempotent Telephony Events
  recordEventIfNew(event: TelephonyEventDTO): Promise<boolean>; // Returns false if duplicate providerEventId
  listEventsBySession(telephonySessionId: string): Promise<TelephonyEventDTO[]>;

  // Settings
  getOrgSettings(organizationId: string): Promise<OrganizationTelephonySettingsDTO | null>;
  saveOrgSettings(settings: OrganizationTelephonySettingsDTO): Promise<void>;
}

export class InMemoryTelephonyRepository implements ITelephonyRepository {
  private numbers = new Map<string, BusinessPhoneNumberDTO>(); // key: formatted phoneNumber
  private sessions = new Map<string, TelephonySessionDTO>(); // key: telephonySessionId
  private providerSidIndex = new Map<string, string>(); // providerCallSid -> telephonySessionId
  private processedEvents = new Map<string, TelephonyEventDTO>(); // key: providerEventId
  private sessionEvents = new Map<string, TelephonyEventDTO[]>(); // key: telephonySessionId -> events
  private settings = new Map<string, OrganizationTelephonySettingsDTO>(); // key: organizationId

  constructor() {
    // Seed standard development phone number for Ballari Real Estate
    const sampleNumber: BusinessPhoneNumberDTO = {
      id: 'num_ballari_001',
      organizationId: 'org_ballari_layouts',
      phoneNumber: '+918047192001',
      countryCode: '+91',
      provider: 'exotel',
      providerNumberId: 'exo_num_001',
      assignedAgentId: 'agent_voice_assistant',
      status: 'ACTIVE',
      capabilities: ['INBOUND_CALLS', 'MEDIA_STREAMING'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.numbers.set(this.normalizePhone(sampleNumber.phoneNumber), sampleNumber);

    const defaultSettings: OrganizationTelephonySettingsDTO = {
      organizationId: 'org_ballari_layouts',
      defaultAgentId: 'agent_voice_assistant',
      initialSilenceTimeoutSeconds: 6,
      conversationSilenceTimeoutSeconds: 8,
      maxCallDurationSeconds: 600,
      defaultTransferPhoneNumber: '+919845012345',
      enableRecording: false,
      aiDisclosureEnabled: true,
    };
    this.settings.set(defaultSettings.organizationId, defaultSettings);
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/[^\d+]/g, '');
  }

  async findPhoneNumber(phoneNumber: string): Promise<BusinessPhoneNumberDTO | null> {
    const normalized = this.normalizePhone(phoneNumber);
    // Try exact match or national format (without country code)
    for (const [key, val] of this.numbers.entries()) {
      if (key === normalized || key.endsWith(normalized) || normalized.endsWith(key.replace(/^\+91/, ''))) {
        return val;
      }
    }
    return null;
  }

  async listPhoneNumbersByOrg(organizationId: string): Promise<BusinessPhoneNumberDTO[]> {
    return Array.from(this.numbers.values()).filter((n) => n.organizationId === organizationId);
  }

  async assignAgentToPhoneNumber(phoneNumberId: string, organizationId: string, agentId: string): Promise<boolean> {
    for (const [key, val] of this.numbers.entries()) {
      if (val.id === phoneNumberId && val.organizationId === organizationId) {
        val.assignedAgentId = agentId;
        val.updatedAt = new Date().toISOString();
        return true;
      }
    }
    return false;
  }

  async savePhoneNumber(number: BusinessPhoneNumberDTO): Promise<void> {
    this.numbers.set(this.normalizePhone(number.phoneNumber), number);
  }

  async saveTelephonySession(session: TelephonySessionDTO): Promise<void> {
    this.sessions.set(session.telephonySessionId, session);
    this.providerSidIndex.set(session.providerCallSid, session.telephonySessionId);
  }

  async findTelephonySession(sessionId: string): Promise<TelephonySessionDTO | null> {
    return this.sessions.get(sessionId) || null;
  }

  async findTelephonySessionByProviderSid(providerCallSid: string): Promise<TelephonySessionDTO | null> {
    const id = this.providerSidIndex.get(providerCallSid);
    if (!id) return null;
    return this.sessions.get(id) || null;
  }

  async listSessionsByOrg(organizationId: string, limit = 50): Promise<TelephonySessionDTO[]> {
    return Array.from(this.sessions.values())
      .filter((s) => s.organizationId === organizationId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async recordEventIfNew(event: TelephonyEventDTO): Promise<boolean> {
    if (this.processedEvents.has(event.providerEventId)) {
      return false; // Idempotent duplicate
    }
    this.processedEvents.set(event.providerEventId, event);

    const list = this.sessionEvents.get(event.telephonySessionId) || [];
    list.push(event);
    this.sessionEvents.set(event.telephonySessionId, list);
    return true;
  }

  async listEventsBySession(telephonySessionId: string): Promise<TelephonyEventDTO[]> {
    return this.sessionEvents.get(telephonySessionId) || [];
  }

  async getOrgSettings(organizationId: string): Promise<OrganizationTelephonySettingsDTO | null> {
    return this.settings.get(organizationId) || null;
  }

  async saveOrgSettings(settings: OrganizationTelephonySettingsDTO): Promise<void> {
    this.settings.set(settings.organizationId, settings);
  }
}
