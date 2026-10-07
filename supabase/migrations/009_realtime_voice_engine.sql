-- 009_realtime_voice_engine.sql
-- Database Migration for VANNI Real-Time Voice Engine

CREATE TABLE IF NOT EXISTS voice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voice_session_id VARCHAR(64) UNIQUE NOT NULL,
    conversation_id VARCHAR(64) NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id VARCHAR(64) NOT NULL,
    agent_version_id VARCHAR(64),
    channel VARCHAR(32) NOT NULL DEFAULT 'BROWSER', -- 'BROWSER', 'TELEPHONY', 'WEBRTC'
    direction VARCHAR(16) NOT NULL DEFAULT 'INBOUND', -- 'INBOUND', 'OUTBOUND'
    participant_phone VARCHAR(32),
    language VARCHAR(16) NOT NULL DEFAULT 'kn-IN', -- 'kn-IN', 'en-IN', 'kn-en'
    codec VARCHAR(16) NOT NULL DEFAULT 'pcm16', -- 'pcm16', 'mulaw', 'opus'
    sample_rate INTEGER NOT NULL DEFAULT 16000,
    session_state VARCHAR(32) NOT NULL DEFAULT 'CREATED', -- 'CREATED', 'CONNECTING', 'CONNECTED', 'LISTENING', 'PROCESSING', 'SPEAKING', 'INTERRUPTED', 'RECONNECTING', 'ENDING', 'ENDED', 'FAILED'
    connection_state VARCHAR(32) NOT NULL DEFAULT 'DISCONNECTED', -- 'CONNECTED', 'DISCONNECTED', 'RECONNECTING'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    connected_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    failure_reason TEXT,
    correlation_id VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_voice_sessions_org ON voice_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_conv ON voice_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_session_id ON voice_sessions(voice_session_id);

-- Operational and Diagnostic Events
CREATE TABLE IF NOT EXISTS voice_session_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voice_session_id VARCHAR(64) NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    sequence_number INTEGER NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_voice_events_session ON voice_session_events(voice_session_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_voice_events_org ON voice_session_events(organization_id);

-- Performance & Latency Metrics per Turn
CREATE TABLE IF NOT EXISTS voice_session_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voice_session_id VARCHAR(64) NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    turn_id VARCHAR(64),
    stt_latency_ms INTEGER,
    first_token_latency_ms INTEGER,
    tts_latency_ms INTEGER,
    turn_duration_ms INTEGER,
    total_audio_duration_seconds NUMERIC(10, 2) DEFAULT 0,
    was_interrupted BOOLEAN DEFAULT FALSE,
    reconnect_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_metrics_session ON voice_session_metrics(voice_session_id);
CREATE INDEX IF NOT EXISTS idx_voice_metrics_org ON voice_session_metrics(organization_id);

-- Enable RLS
ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_session_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_session_metrics ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
CREATE POLICY "Tenant isolation for voice_sessions"
    ON voice_sessions FOR ALL
    USING (organization_id = (current_setting('app.current_organization_id', true))::uuid)
    WITH CHECK (organization_id = (current_setting('app.current_organization_id', true))::uuid);

CREATE POLICY "Tenant isolation for voice_session_events"
    ON voice_session_events FOR ALL
    USING (organization_id = (current_setting('app.current_organization_id', true))::uuid)
    WITH CHECK (organization_id = (current_setting('app.current_organization_id', true))::uuid);

CREATE POLICY "Tenant isolation for voice_session_metrics"
    ON voice_session_metrics FOR ALL
    USING (organization_id = (current_setting('app.current_organization_id', true))::uuid)
    WITH CHECK (organization_id = (current_setting('app.current_organization_id', true))::uuid);
