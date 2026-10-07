-- ==============================================================================
-- Migration 007: VANNI Conversation Orchestration Engine
-- Channel-independent conversation lifecycle, state transitions, message stream,
-- server-enforced tool calls, human handoffs, and multi-tenant RLS isolation.
-- ==============================================================================

-- 1. Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
    id TEXT PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL,
    agent_version INTEGER NOT NULL DEFAULT 1,
    channel VARCHAR(30) NOT NULL DEFAULT 'WEB_CHAT',
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    current_state VARCHAR(30) NOT NULL DEFAULT 'IDLE',
    detected_language VARCHAR(20) NOT NULL DEFAULT 'en',
    customer_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    active_tool_name VARCHAR(100),
    pending_confirmation_tool JSONB,
    summary_id TEXT,
    handoff_id TEXT,
    end_reason VARCHAR(50),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_org ON public.conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_conversations_agent ON public.conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_state ON public.conversations(current_state);

-- 2. Conversation Messages Table
CREATE TABLE IF NOT EXISTS public.conversation_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    speaker VARCHAR(20) NOT NULL,
    message_type VARCHAR(30) NOT NULL DEFAULT 'TEXT',
    content TEXT NOT NULL,
    language VARCHAR(20),
    sequence_number INTEGER NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_messages_conv ON public.conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_messages_org ON public.conversation_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_conv_messages_seq ON public.conversation_messages(conversation_id, sequence_number);

-- 3. Conversation Events Table (Idempotent Event Log)
CREATE TABLE IF NOT EXISTS public.conversation_events (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    idempotency_key VARCHAR(150),
    previous_state VARCHAR(30) NOT NULL,
    new_state VARCHAR(30) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_events_conv ON public.conversation_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_events_idemp ON public.conversation_events(conversation_id, idempotency_key);

-- 4. Conversation Tool Calls Table
CREATE TABLE IF NOT EXISTS public.conversation_tool_calls (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    tool_name VARCHAR(100) NOT NULL,
    arguments JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_PERMISSION',
    requires_confirmation BOOLEAN NOT NULL DEFAULT false,
    is_confirmed BOOLEAN NOT NULL DEFAULT false,
    result JSONB,
    error_message TEXT,
    execution_duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_conv_tool_calls_conv ON public.conversation_tool_calls(conversation_id);

-- 5. Conversation Handoffs Table
CREATE TABLE IF NOT EXISTS public.conversation_handoffs (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    reason VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    destination_type VARCHAR(50) NOT NULL DEFAULT 'RECEPTION',
    destination_target TEXT NOT NULL,
    handoff_summary TEXT NOT NULL,
    customer_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_emergency_casualty BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_handoffs_conv ON public.conversation_handoffs(conversation_id);

-- 6. Conversation Summaries Table
CREATE TABLE IF NOT EXISTS public.conversation_summaries (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    customer_goal TEXT NOT NULL,
    important_details JSONB NOT NULL DEFAULT '[]'::jsonb,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    open_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    actions_completed JSONB NOT NULL DEFAULT '[]'::jsonb,
    actions_pending JSONB NOT NULL DEFAULT '[]'::jsonb,
    escalation_status VARCHAR(50) NOT NULL DEFAULT 'NONE',
    turn_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_summaries_conv ON public.conversation_summaries(conversation_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_tool_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;

-- 1. Conversations RLS
CREATE POLICY conversations_tenant_select ON public.conversations
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY conversations_tenant_all ON public.conversations
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

-- 2. Conversation Messages RLS
CREATE POLICY conv_messages_tenant_select ON public.conversation_messages
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY conv_messages_tenant_all ON public.conversation_messages
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

-- 3. Conversation Events RLS
CREATE POLICY conv_events_tenant_select ON public.conversation_events
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY conv_events_tenant_all ON public.conversation_events
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

-- 4. Conversation Tool Calls RLS
CREATE POLICY conv_tools_tenant_select ON public.conversation_tool_calls
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY conv_tools_tenant_all ON public.conversation_tool_calls
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

-- 5. Conversation Handoffs RLS
CREATE POLICY conv_handoffs_tenant_select ON public.conversation_handoffs
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY conv_handoffs_tenant_all ON public.conversation_handoffs
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

-- 6. Conversation Summaries RLS
CREATE POLICY conv_summaries_tenant_select ON public.conversation_summaries
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY conv_summaries_tenant_all ON public.conversation_summaries
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );
