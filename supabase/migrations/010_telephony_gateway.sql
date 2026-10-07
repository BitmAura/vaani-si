-- 010_telephony_gateway.sql
-- Database Migration for VANNI Telephony Gateway & Inbound Call Engine

-- Business Phone Numbers managed by Organization
CREATE TABLE IF NOT EXISTS business_phone_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    phone_number VARCHAR(32) UNIQUE NOT NULL, -- e.g. '+918047192001' or '08047192001'
    country_code VARCHAR(8) NOT NULL DEFAULT '+91',
    provider VARCHAR(32) NOT NULL DEFAULT 'exotel', -- 'exotel', 'mock', 'twilio'
    provider_number_id VARCHAR(128),
    assigned_agent_id VARCHAR(64), -- ID of the assigned published AI Employee
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE', 'PROVISIONING', 'SUSPENDED'
    capabilities JSONB NOT NULL DEFAULT '["INBOUND_CALLS", "MEDIA_STREAMING"]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_numbers_org ON business_phone_numbers(organization_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_number ON business_phone_numbers(phone_number);

-- Telephony Call Sessions (Phone-level tracking linking to voice_sessions and conversations)
CREATE TABLE IF NOT EXISTS telephony_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telephony_session_id VARCHAR(64) UNIQUE NOT NULL,
    provider_call_sid VARCHAR(128) NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    phone_number_id UUID REFERENCES business_phone_numbers(id) ON DELETE SET NULL,
    assigned_agent_id VARCHAR(64) NOT NULL,
    conversation_id VARCHAR(64) NOT NULL,
    voice_session_id VARCHAR(64) NOT NULL,
    direction VARCHAR(16) NOT NULL DEFAULT 'INBOUND', -- 'INBOUND', 'OUTBOUND'
    caller_phone_number VARCHAR(32) NOT NULL,
    destination_phone_number VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'RECEIVED', -- 'RECEIVED', 'RINGING', 'ANSWERED', 'ACTIVE', 'TRANSFER_PENDING', 'TRANSFERRED', 'ENDED', 'FAILED'
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    answered_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0,
    end_reason VARCHAR(64), -- 'CALLER_HANGUP', 'AI_HANGUP', 'TRANSFERRED', 'TIMEOUT', 'FAILED'
    call_outcome VARCHAR(64) DEFAULT 'UNKNOWN', -- 'INFORMATION_PROVIDED', 'LEAD_CAPTURED', 'APPOINTMENT_CONFIRMED', 'TRANSFERRED_TO_HUMAN', 'UNKNOWN'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telephony_sessions_org ON telephony_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_telephony_sessions_provider_sid ON telephony_sessions(provider_call_sid);
CREATE INDEX IF NOT EXISTS idx_telephony_sessions_conv ON telephony_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_telephony_sessions_voice ON telephony_sessions(voice_session_id);

-- Telephony Events Log (Idempotency and Timeline)
CREATE TABLE IF NOT EXISTS telephony_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_event_id VARCHAR(128) UNIQUE NOT NULL, -- Idempotency key from provider
    telephony_session_id VARCHAR(64) NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    sequence_number INTEGER NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_telephony_events_session ON telephony_events(telephony_session_id);
CREATE INDEX IF NOT EXISTS idx_telephony_events_org ON telephony_events(organization_id);

-- Organization Telephony Settings
CREATE TABLE IF NOT EXISTS organization_telephony_settings (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    default_agent_id VARCHAR(64),
    initial_silence_timeout_seconds INTEGER NOT NULL DEFAULT 6,
    conversation_silence_timeout_seconds INTEGER NOT NULL DEFAULT 8,
    max_call_duration_seconds INTEGER NOT NULL DEFAULT 600, -- 10 mins max
    default_transfer_phone_number VARCHAR(32),
    enable_recording BOOLEAN NOT NULL DEFAULT FALSE,
    ai_disclosure_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE business_phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE telephony_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE telephony_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_telephony_settings ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
CREATE POLICY "Tenant isolation for business_phone_numbers"
    ON business_phone_numbers FOR ALL
    USING (organization_id = (current_setting('app.current_organization_id', true))::uuid)
    WITH CHECK (organization_id = (current_setting('app.current_organization_id', true))::uuid);

CREATE POLICY "Tenant isolation for telephony_sessions"
    ON telephony_sessions FOR ALL
    USING (organization_id = (current_setting('app.current_organization_id', true))::uuid)
    WITH CHECK (organization_id = (current_setting('app.current_organization_id', true))::uuid);

CREATE POLICY "Tenant isolation for telephony_events"
    ON telephony_events FOR ALL
    USING (organization_id = (current_setting('app.current_organization_id', true))::uuid)
    WITH CHECK (organization_id = (current_setting('app.current_organization_id', true))::uuid);

CREATE POLICY "Tenant isolation for organization_telephony_settings"
    ON organization_telephony_settings FOR ALL
    USING (organization_id = (current_setting('app.current_organization_id', true))::uuid)
    WITH CHECK (organization_id = (current_setting('app.current_organization_id', true))::uuid);
