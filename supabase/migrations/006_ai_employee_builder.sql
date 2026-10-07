-- ==============================================================================
-- VANNI AI Employee / Agent Builder Migration (Prompt 08)
-- Tables: ai_employees, ai_employee_versions, ai_employee_test_sessions
-- Features: Strict Tenant Isolation, RLS Policies, Version Snapshots, Auditability
-- ==============================================================================

-- 1. AI Employees Core Table
CREATE TABLE IF NOT EXISTS public.ai_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    description TEXT,
    role VARCHAR(50) NOT NULL DEFAULT 'AI_RECEPTIONIST',
    industry VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT', -- DRAFT, TESTING, ACTIVE, PAUSED, ARCHIVED
    active_version INT NOT NULL DEFAULT 1,
    active_version_id UUID,

    -- Structured Configuration JSONBs
    identity_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    objective_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    personality_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    language_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    capabilities_config JSONB NOT NULL DEFAULT '[]'::jsonb,
    knowledge_access_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    tools_config JSONB NOT NULL DEFAULT '[]'::jsonb,
    escalation_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    policy_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    conversation_rules_config JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_employees_org ON public.ai_employees(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_employees_status ON public.ai_employees(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_employees_role ON public.ai_employees(organization_id, role);

-- 2. AI Employee Versions (Immutable Snapshots & Rollback History)
CREATE TABLE IF NOT EXISTS public.ai_employee_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.ai_employees(id) ON DELETE CASCADE,
    version INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT', -- DRAFT, PUBLISHED, ACTIVE, ARCHIVED
    changelog TEXT,
    snapshot JSONB NOT NULL, -- Complete AgentRuntimeConfig snapshot
    published_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(agent_id, version)
);

CREATE INDEX IF NOT EXISTS idx_ai_emp_versions_agent ON public.ai_employee_versions(agent_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_ai_emp_versions_org ON public.ai_employee_versions(organization_id);

-- 3. AI Employee Test Sessions (Simulation & QA Logs)
CREATE TABLE IF NOT EXISTS public.ai_employee_test_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.ai_employees(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 1,
    session_title VARCHAR(255) NOT NULL DEFAULT 'Interactive Simulation',
    turns JSONB NOT NULL DEFAULT '[]'::jsonb,
    evaluation_summary JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_emp_tests_agent ON public.ai_employee_test_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_emp_tests_org ON public.ai_employee_test_sessions(organization_id);

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.ai_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_employee_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_employee_test_sessions ENABLE ROW LEVEL SECURITY;

-- 4.1 AI Employees RLS
CREATE POLICY "ai_employees_select_policy" ON public.ai_employees
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_memberships
            WHERE user_id = auth.uid() AND status = 'ACTIVE'
        )
    );

CREATE POLICY "ai_employees_insert_policy" ON public.ai_employees
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_memberships
            WHERE user_id = auth.uid() 
              AND status = 'ACTIVE' 
              AND role IN ('OWNER', 'ADMIN', 'MANAGER')
        )
    );

CREATE POLICY "ai_employees_update_policy" ON public.ai_employees
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_memberships
            WHERE user_id = auth.uid() 
              AND status = 'ACTIVE' 
              AND role IN ('OWNER', 'ADMIN', 'MANAGER')
        )
    );

CREATE POLICY "ai_employees_delete_policy" ON public.ai_employees
    FOR DELETE USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_memberships
            WHERE user_id = auth.uid() 
              AND status = 'ACTIVE' 
              AND role IN ('OWNER', 'ADMIN')
        )
    );

-- 4.2 AI Employee Versions RLS
CREATE POLICY "ai_employee_versions_select_policy" ON public.ai_employee_versions
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_memberships
            WHERE user_id = auth.uid() AND status = 'ACTIVE'
        )
    );

CREATE POLICY "ai_employee_versions_mutation_policy" ON public.ai_employee_versions
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_memberships
            WHERE user_id = auth.uid() 
              AND status = 'ACTIVE' 
              AND role IN ('OWNER', 'ADMIN', 'MANAGER')
        )
    );

-- 4.3 AI Employee Test Sessions RLS
CREATE POLICY "ai_employee_test_sessions_policy" ON public.ai_employee_test_sessions
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_memberships
            WHERE user_id = auth.uid() AND status = 'ACTIVE'
        )
    );
