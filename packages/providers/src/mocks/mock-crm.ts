import {
  ICRMProvider,
  CRMLead,
  CRMLeadResult,
  CRMTask,
  CRMNote,
  CRMSearchResult,
  ProviderError,
  ProviderErrorCode,
} from '@vanni/provider-sdk';

export interface MockCRMConfig {
  simulatedLatencyMs?: number;
  failureErrorCode?: ProviderErrorCode;
}

export class MockCRMProvider implements ICRMProvider {
  public readonly providerName = 'mock-crm';
  private latencyMs: number;
  private failureCode?: ProviderErrorCode;
  private leads = new Map<string, CRMLead>();
  private tasks = new Map<string, CRMTask>();
  private notes = new Map<string, CRMNote>();

  constructor(config: MockCRMConfig = {}) {
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_MOCK_PROVIDERS) {
      throw new Error('MockCRMProvider must NOT be instantiated in production environments');
    }
    this.latencyMs = config.simulatedLatencyMs || 10;
    this.failureCode = config.failureErrorCode;
  }

  simulateFailure(code?: ProviderErrorCode): void {
    this.failureCode = code;
  }

  private async delay(): Promise<void> {
    if (this.latencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.latencyMs));
    }
  }

  async createLead(lead: CRMLead): Promise<CRMLeadResult> {
    await this.delay();

    if (this.failureCode) {
      throw new ProviderError(this.failureCode, `Simulated CRM failure: ${this.failureCode}`, {
        providerName: this.providerName,
      });
    }

    const leadId = `lead_mock_${Date.now()}`;
    this.leads.set(leadId, { ...lead, id: leadId });

    return {
      success: true,
      leadId,
      provider: this.providerName,
    };
  }

  async updateLead(leadId: string, updates: Partial<CRMLead>): Promise<CRMLeadResult> {
    await this.delay();

    const existing = this.leads.get(leadId);
    if (!existing) {
      return { success: false, leadId, provider: this.providerName, errorMessage: 'Not found' };
    }

    this.leads.set(leadId, { ...existing, ...updates });
    return { success: true, leadId, provider: this.providerName };
  }

  async getLead(leadId: string, organizationId: string): Promise<CRMLead | null> {
    await this.delay();
    const lead = this.leads.get(leadId);
    if (lead && lead.organizationId === organizationId) {
      return lead;
    }
    return null;
  }

  async searchLeads(organizationId: string, query: string, limit = 10): Promise<CRMSearchResult> {
    await this.delay();

    const matches: CRMLead[] = [];
    for (const lead of this.leads.values()) {
      if (lead.organizationId === organizationId) {
        if (
          lead.callerPhone.includes(query) ||
          lead.callerName.toLowerCase().includes(query.toLowerCase())
        ) {
          matches.push(lead);
          if (matches.length >= limit) break;
        }
      }
    }

    return { leads: matches, total: matches.length };
  }

  async createTask(task: CRMTask): Promise<{ success: boolean; taskId: string; errorMessage?: string }> {
    await this.delay();
    const taskId = `task_mock_${Date.now()}`;
    this.tasks.set(taskId, task);
    return { success: true, taskId };
  }

  async addNote(note: CRMNote): Promise<{ success: boolean; noteId: string; errorMessage?: string }> {
    await this.delay();
    const noteId = `note_mock_${Date.now()}`;
    this.notes.set(noteId, note);
    return { success: true, noteId };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
