-- =========================================================================
-- VANNI — 002_rls_policies.sql
-- PostgreSQL Row-Level Security Policies for Strict Tenant Data Isolation
-- =========================================================================

-- Enable RLS across all operational tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- Helper function to extract tenant_id from JWT
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.tenant_id', true), '')::UUID;
$$ LANGUAGE SQL STABLE;

-- 1. Tenants Policy
CREATE POLICY tenant_isolation_tenants ON tenants
  FOR ALL
  USING (id = current_tenant_id() OR current_setting('request.jwt.claim.role', true) = 'service_role');

-- 2. Agents Policy
CREATE POLICY tenant_isolation_agents ON agents
  FOR ALL
  USING (tenant_id = current_tenant_id() OR current_setting('request.jwt.claim.role', true) = 'service_role');

-- 3. Calls Policy
CREATE POLICY tenant_isolation_calls ON calls
  FOR ALL
  USING (tenant_id = current_tenant_id() OR current_setting('request.jwt.claim.role', true) = 'service_role');

-- 4. Call Transcripts Policy
CREATE POLICY tenant_isolation_transcripts ON call_transcripts
  FOR ALL
  USING (tenant_id = current_tenant_id() OR current_setting('request.jwt.claim.role', true) = 'service_role');

-- 5. Leads Policy
CREATE POLICY tenant_isolation_leads ON leads
  FOR ALL
  USING (tenant_id = current_tenant_id() OR current_setting('request.jwt.claim.role', true) = 'service_role');

-- 6. Appointments Policy
CREATE POLICY tenant_isolation_appointments ON appointments
  FOR ALL
  USING (tenant_id = current_tenant_id() OR current_setting('request.jwt.claim.role', true) = 'service_role');

-- 7. Knowledge Bases Policy
CREATE POLICY tenant_isolation_knowledge ON knowledge_bases
  FOR ALL
  USING (tenant_id = current_tenant_id() OR current_setting('request.jwt.claim.role', true) = 'service_role');
