-- ============================================================================
-- Migration 021: Call Lifecycle Hardening & Telephony Integration Columns
-- Vaani-Si — End-to-End Voice Call Reliability (Prompt 08)
-- ============================================================================

DO $$
BEGIN
    -- Ensure call lifecycle status column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'calls' AND column_name = 'status'
    ) THEN
        ALTER TABLE public.calls ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'INITIATED';
    END IF;

    -- Ensure answered_at timestamp exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'calls' AND column_name = 'answered_at'
    ) THEN
        ALTER TABLE public.calls ADD COLUMN answered_at TIMESTAMPTZ;
    END IF;

    -- Ensure started_at timestamp exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'calls' AND column_name = 'started_at'
    ) THEN
        ALTER TABLE public.calls ADD COLUMN started_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- Ensure ended_at timestamp exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'calls' AND column_name = 'ended_at'
    ) THEN
        ALTER TABLE public.calls ADD COLUMN ended_at TIMESTAMPTZ;
    END IF;

    -- Ensure failure_reason exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'calls' AND column_name = 'failure_reason'
    ) THEN
        ALTER TABLE public.calls ADD COLUMN failure_reason TEXT;
    END IF;

    -- Ensure cost_inr exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'calls' AND column_name = 'cost_inr'
    ) THEN
        ALTER TABLE public.calls ADD COLUMN cost_inr NUMERIC(10, 4) NOT NULL DEFAULT 0.0000;
    END IF;

    -- Ensure telephony_provider exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'calls' AND column_name = 'telephony_provider'
    ) THEN
        ALTER TABLE public.calls ADD COLUMN telephony_provider VARCHAR(50) NOT NULL DEFAULT 'EXOTEL';
    END IF;

    -- Ensure telephony_call_sid exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'calls' AND column_name = 'telephony_call_sid'
    ) THEN
        ALTER TABLE public.calls ADD COLUMN telephony_call_sid VARCHAR(100);
    END IF;
END $$;

-- Create indexes for call lifecycle queries and provider reconciliation
CREATE INDEX IF NOT EXISTS idx_calls_status ON public.calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_telephony_sid ON public.calls(telephony_call_sid);
CREATE INDEX IF NOT EXISTS idx_calls_org_status ON public.calls(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_calls_started_at ON public.calls(started_at DESC);
