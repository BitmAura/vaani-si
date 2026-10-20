-- ==============================================================================
-- 026: Billing Ledger, Payment Idempotency & Webhook Hardening
-- Dhwani SI / Vaani-Si Multi-Tenant Voice Platform (Prompt 08)
-- ==============================================================================
-- STATUS: PROPOSED FOR REVIEW ONLY — DO NOT APPLY TO LIVE DATABASE WITHOUT REVIEW

DO $$
BEGIN
    -- Ensure status column on subscriptions supports INCOMPLETE
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscriptions') THEN
        ALTER TABLE public.subscriptions
            ALTER COLUMN status SET DEFAULT 'TRIALING';
    END IF;

    -- Ensure provider_payment_id unique index on payment_records for financial idempotency
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_records') THEN
        CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_records_provider_id
            ON public.payment_records (provider, provider_payment_id)
            WHERE provider_payment_id IS NOT NULL;
    END IF;

    -- Ensure provider_event_id unique index on billing_provider_events
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'billing_provider_events') THEN
        CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_provider_events_idempotency
            ON public.billing_provider_events (provider, provider_event_id);
    END IF;

    -- Ensure client_workspace_id on billing_invoices if missing
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'billing_invoices') THEN
        ALTER TABLE public.billing_invoices
            ADD COLUMN IF NOT EXISTS client_workspace_id UUID REFERENCES public.client_workspaces(id) ON DELETE SET NULL;
    END IF;
END $$;

-- RLS Hardening for billing provider events: service role only
ALTER TABLE public.billing_provider_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_provider_events_service_only ON public.billing_provider_events;
CREATE POLICY billing_provider_events_service_only ON public.billing_provider_events
    FOR ALL USING (
        current_setting('request.jwt.claim.role', true) = 'service_role'
    );

-- ROLLBACK SCRIPT (IF EVER APPLIED):
-- DROP INDEX IF EXISTS public.uq_payment_records_provider_id;
-- DROP POLICY IF EXISTS billing_provider_events_service_only ON public.billing_provider_events;
