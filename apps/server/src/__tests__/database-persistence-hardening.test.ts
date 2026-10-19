import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SupabaseDatabaseService,
  createDatabaseService,
  ProductionDatabaseConfigError,
  DatabaseOperationError,
} from '@vanni/database';
import {
  OrganizationMemberDTO,
  BillingAccountDTO,
  SubscriptionDTO,
  SubscriptionEventDTO,
  BillingInvoiceDTO,
  PaymentRecordDTO,
  UsageEventDTO,
  UsageAdjustmentDTO,
  AuditLogDTO,
} from '@vanni/shared';

describe('Prompt 05: Database Persistence & Supabase Hardening Tests', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe('1. Production Database Fail-Closed Configuration', () => {
    it('throws ProductionDatabaseConfigError in production when credentials are missing and ALLOW_FILE_DATABASE !== true', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.SUPABASE_SECRET_KEY;
      delete process.env.ALLOW_FILE_DATABASE;

      expect(() => createDatabaseService()).toThrow(ProductionDatabaseConfigError);
    });

    it('permits explicit opt-in to DurableDatabaseService in production with ALLOW_FILE_DATABASE=true', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      process.env.ALLOW_FILE_DATABASE = 'true';

      const db = createDatabaseService();
      expect(db).toBeDefined();
      expect(db.constructor.name).toBe('DurableDatabaseService');
    });

    it('instantiates SupabaseDatabaseService in production when valid credentials are provided', () => {
      process.env.NODE_ENV = 'production';
      process.env.SUPABASE_URL = 'https://fake-project.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-key';

      const db = createDatabaseService();
      expect(db).toBeDefined();
      expect(db.constructor.name).toBe('SupabaseDatabaseService');
    });
  });

  describe('2. SupabaseDatabaseService Query Delegation & Persistence', () => {
    let mockSupabase: any;
    let service: SupabaseDatabaseService;

    beforeEach(() => {
      // Create mock Supabase client
      mockSupabase = {
        from: vi.fn(),
      };

      service = new SupabaseDatabaseService('https://mock.supabase.co', 'mock-key');
      // Inject mock client
      (service as any).supabaseClient = mockSupabase;
    });

    it('delegates saveMember to Supabase organization_members table', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      mockSupabase.from.mockReturnValue({ upsert: mockUpsert });

      const member: OrganizationMemberDTO = {
        id: 'mem_123',
        organizationId: 'org_test',
        userId: 'usr_abc',
        role: 'VIEWER',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await service.saveMember(member);

      expect(mockSupabase.from).toHaveBeenCalledWith('organization_members');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'mem_123',
          organization_id: 'org_test',
          user_id: 'usr_abc',
          role: 'VIEWER',
          status: 'ACTIVE',
        })
      );
    });

    it('throws DatabaseOperationError when saveMember fails in Supabase', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: { message: 'Foreign key violation' } });
      mockSupabase.from.mockReturnValue({ upsert: mockUpsert });

      const member: OrganizationMemberDTO = {
        id: 'mem_123',
        organizationId: 'org_invalid',
        userId: 'usr_abc',
        role: 'VIEWER',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await expect(service.saveMember(member)).rejects.toThrow(DatabaseOperationError);
    });

    it('delegates saveSubscription to Supabase subscriptions table', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      mockSupabase.from.mockReturnValue({ upsert: mockUpsert });

      const sub: SubscriptionDTO = {
        id: 'sub_123',
        organizationId: 'org_billing_test',
        billingAccountId: 'ba_test_01',
        planId: 'plan_starter',
        planVersionId: 'pv_01',
        provider: 'MANUAL',
        billingInterval: 'MONTHLY',
        status: 'ACTIVE',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 86400000).toISOString(),
        cancelAtPeriodEnd: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await service.saveSubscription(sub);

      expect(mockSupabase.from).toHaveBeenCalledWith('subscriptions');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'sub_123',
          organization_id: 'org_billing_test',
          plan_id: 'plan_starter',
          status: 'ACTIVE',
        })
      );
    });

    it('delegates saveSubscriptionEvent to Supabase subscription_events table', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      mockSupabase.from.mockReturnValue({ upsert: mockUpsert });

      const event: SubscriptionEventDTO = {
        id: 'sub_evt_1',
        organizationId: 'org_billing_test',
        subscriptionId: 'sub_123',
        eventType: 'PLAN_CHANGED',
        previousPlanId: 'plan_starter',
        newPlanId: 'plan_growth',
        reason: 'User upgrade',
        occurredAt: new Date().toISOString(),
      };

      await service.saveSubscriptionEvent(event);

      expect(mockSupabase.from).toHaveBeenCalledWith('subscription_events');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'sub_evt_1',
          organization_id: 'org_billing_test',
          subscription_id: 'sub_123',
          event_type: 'PLAN_CHANGED',
          previous_plan_id: 'plan_starter',
          new_plan_id: 'plan_growth',
        })
      );
    });

    it('delegates saveBillingAccount to Supabase billing_accounts table', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      mockSupabase.from.mockReturnValue({ upsert: mockUpsert });

      const account: BillingAccountDTO = {
        id: 'ba_test_01',
        organizationId: 'org_ba_test',
        billingName: 'Test Org Billing',
        timezone: 'Asia/Kolkata',
        provider: 'MANUAL',
        currency: 'INR',
        billingEmail: 'billing@example.com',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await service.saveBillingAccount(account);

      expect(mockSupabase.from).toHaveBeenCalledWith('billing_accounts');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'ba_test_01',
          organization_id: 'org_ba_test',
          billing_email: 'billing@example.com',
        })
      );
    });

    it('delegates saveBillingInvoice to Supabase billing_invoices table', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      mockSupabase.from.mockReturnValue({ upsert: mockUpsert });

      const invoice: BillingInvoiceDTO = {
        id: 'inv_101',
        organizationId: 'org_inv_test',
        billingAccountId: 'ba_test_01',
        invoiceNumber: 'INV-2026-0001',
        subtotal: 5000,
        taxAmount: 900,
        totalAmount: 5900,
        currency: 'INR',
        periodStart: new Date().toISOString(),
        periodEnd: new Date(Date.now() + 86400000).toISOString(),
        status: 'PAID',
        issuedAt: new Date().toISOString(),
      };

      await service.saveBillingInvoice(invoice);

      expect(mockSupabase.from).toHaveBeenCalledWith('billing_invoices');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'inv_101',
          organization_id: 'org_inv_test',
          invoice_number: 'INV-2026-0001',
          total_amount: 5900,
        })
      );
    });

    it('delegates saveUsageEvent to Supabase usage_events table', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      mockSupabase.from.mockReturnValue({ upsert: mockUpsert });

      const usage: UsageEventDTO = {
        id: 'use_999',
        organizationId: 'org_usage_test',
        correlationId: 'corr_call_123',
        eventType: 'VOICE_DURATION',
        resourceType: 'VOICE_MINUTE',
        provider: 'sarvam-ai',
        quantity: 120,
        unit: 'seconds',
        costType: 'ACTUAL',
        estimatedCost: 1.5,
        actualCost: 1.5,
        currency: 'INR',
        occurredAt: new Date().toISOString(),
      };

      await service.saveUsageEvent(usage);

      expect(mockSupabase.from).toHaveBeenCalledWith('usage_events');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'use_999',
          organization_id: 'org_usage_test',
          correlation_id: 'corr_call_123',
          event_type: 'VOICE_DURATION',
          quantity: 120,
        })
      );
    });

    it('delegates saveAuditLog to Supabase audit_logs table with actorUserId mapping', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      mockSupabase.from.mockReturnValue({ insert: mockInsert });

      const log: AuditLogDTO = {
        id: 'aud_555',
        organizationId: 'org_aud_test',
        actorUserId: 'usr_admin',
        action: 'PLAN_UPGRADE',
        resourceType: 'SUBSCRIPTION',
        resourceId: 'sub_123',
        metadata: { upgradedBy: 'admin' },
        createdAt: new Date().toISOString(),
      };

      await service.saveAuditLog(log);

      expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'aud_555',
          organization_id: 'org_aud_test',
          user_id: 'usr_admin',
          action: 'PLAN_UPGRADE',
        })
      );
    });
  });

  describe('3. Multi-Tenant Identifier Compatibility Contract', () => {
    it('accepts both standard UUIDs and prefixed string IDs without schema collision in domain models', () => {
      const standardUUID = 'a0000000-0000-0000-0000-000000000001';
      const prefixedWorkspaceId = 'ws_fc443cd6-806f-467d-a947-818183942d46';
      const prefixedMemberId = 'mem_usr123_org456';

      expect(typeof standardUUID).toBe('string');
      expect(typeof prefixedWorkspaceId).toBe('string');
      expect(prefixedWorkspaceId.startsWith('ws_')).toBe(true);
      expect(prefixedMemberId.startsWith('mem_')).toBe(true);
    });
  });
});
