-- =========================================================================
-- VANNI — seed.sql
-- High-Fidelity Karnataka Enterprise Seed Data
-- =========================================================================

-- 1. Insert Tenants
INSERT INTO tenants (id, name, slug, industry, status, settings) VALUES
('a0000000-0000-0000-0000-000000000001', 'Ballari Residential Layouts', 'ballari-plots', 'REAL_ESTATE', 'ACTIVE', '{"virtualNumber": "+918047192001", "primaryDialect": "KANGLISH_BUSINESS"}'),
('a0000000-0000-0000-0000-000000000002', 'Apollo Specialty Clinic', 'apollo-clinic', 'HEALTHCARE_HOSPITAL', 'ACTIVE', '{"virtualNumber": "+918047192002", "primaryDialect": "KANNADA_STANDARD_POLITE"}'),
('a0000000-0000-0000-0000-000000000003', 'Dr. Sneha Multispecialty Dental', 'sneha-dental', 'DENTAL', 'ACTIVE', '{"virtualNumber": "+918047192003", "primaryDialect": "KANGLISH_BUSINESS"}')
ON CONFLICT (id) DO NOTHING;

-- 2. Insert AI Employees (Agents)
INSERT INTO agents (id, tenant_id, name, role, language, status, system_prompt) VALUES
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Sahana', 'Lead Qualifier & Site Visit Booking Executive', 'KANGLISH_BUSINESS', 'LIVE', 'You are Sahana, a polite professional AI executive for Ballari Residential Layouts. Qualify plot inquiries and offer free Sunday cab pickups on Siruguppa Road.'),
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Kavya', 'Hospital Front-Desk OPD Receptionist', 'KANNADA_STANDARD_POLITE', 'LIVE', 'You are Kavya, autonomous receptionist for Apollo Specialty Clinic. Provide OPD schedules for Dr. Ramesh Patil and emergency guidance in polite Kannada.')
ON CONFLICT (id) DO NOTHING;
