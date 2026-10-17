-- =========================================================================
-- VANNI — seed.sql
-- High-Fidelity Karnataka Enterprise Seed Data (Organizations & Agents)
-- =========================================================================

-- 1. Insert Organizations (The fundamental multi-tenant boundary)
INSERT INTO public.organizations (id, name, slug, industry_type, is_active) VALUES
('a0000000-0000-0000-0000-000000000001', 'Ballari Residential Layouts', 'ballari-plots', 'REAL_ESTATE', TRUE),
('a0000000-0000-0000-0000-000000000002', 'Apollo Specialty Clinic', 'apollo-clinic', 'HEALTHCARE_HOSPITAL', TRUE),
('a0000000-0000-0000-0000-000000000003', 'Dr. Sneha Multispecialty Dental', 'sneha-dental', 'DENTAL', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 2. Insert AI Employees (Agents)
INSERT INTO public.agents (id, organization_id, name, role, primary_dialect, is_active) VALUES
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Sahana', 'Lead Qualifier & Site Visit Booking Executive', 'KANGLISH_BUSINESS', TRUE),
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Kavya', 'Hospital Front-Desk OPD Receptionist', 'KANNADA_STANDARD_POLITE', TRUE)
ON CONFLICT (id) DO NOTHING;
