-- =================================================================================
-- VANNI SI: Supabase Initial Schema Migration
-- =================================================================================

-- 1. Create Profiles table (maps to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    phone VARCHAR(50),
    timezone VARCHAR(100) DEFAULT 'Asia/Kolkata',
    locale VARCHAR(50) DEFAULT 'en-IN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Organizations (Accounts) table
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    industry VARCHAR(100) DEFAULT 'REAL_ESTATE',
    status VARCHAR(50) DEFAULT 'ACTIVE',
    onboarding_status VARCHAR(50) DEFAULT 'ready',
    billing_tier VARCHAR(50) DEFAULT 'STARTER',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Organization Members mapping
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'VIEWER',
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create Calls table
CREATE TABLE IF NOT EXISTS public.calls (
    id VARCHAR(50) PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    caller VARCHAR(255),
    phone VARCHAR(50),
    city VARCHAR(100),
    time VARCHAR(50),
    channel VARCHAR(100),
    duration VARCHAR(50),
    status VARCHAR(50),
    req TEXT,
    budget VARCHAR(100),
    outcome VARCHAR(255),
    transcript JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Seed Data (3 accounts)
INSERT INTO public.organizations (id, name, slug, industry, status) VALUES 
('a0000000-0000-0000-0000-000000000001', 'Ballari Residential Layouts', 'ballari-plots', 'REAL_ESTATE', 'ACTIVE'),
('a0000000-0000-0000-0000-000000000002', 'Apollo Specialty Clinic', 'apollo-clinic', 'HEALTHCARE_HOSPITAL', 'ACTIVE'),
('a0000000-0000-0000-0000-000000000003', 'Creative Digital Agency', 'creative-agency', 'AGENCY', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- 6. Insert seed call records for Real Estate
INSERT INTO public.calls (id, organization_id, caller, phone, city, time, channel, duration, status, req, budget, outcome, transcript) VALUES
('CALL-9848', 'a0000000-0000-0000-0000-000000000001', 'Anand Kulkarni', '+91 98450 88219', 'Ballari', '10:14 AM', 'SIP Inbound', '1m 24s', 'HOT', '30x40 Corner Plot', '₹18 Lakhs', 'Sunday Site Visit Confirmed', '[{"speaker":"Sahana","time":"00:02","text":"Namaskara sir!"}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 7. Insert seed call records for Hospital
INSERT INTO public.calls (id, organization_id, caller, phone, city, time, channel, duration, status, req, budget, outcome, transcript) VALUES
('CLINIC-101', 'a0000000-0000-0000-0000-000000000002', 'Ganesh Hegde', '+91 98450 12345', 'Bengaluru', '09:45 AM', '3-Ring Forward', '1m 32s', 'HOT', 'Root Canal', '₹5,000', 'OPD Slot Locked', '[{"speaker":"Sahana","time":"00:02","text":"Welcome to Apollo!"}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 8. Insert seed call records for Agency
INSERT INTO public.calls (id, organization_id, caller, phone, city, time, channel, duration, status, req, budget, outcome, transcript) VALUES
('AGENCY-201', 'a0000000-0000-0000-0000-000000000003', 'Rajesh K', '+91 99000 11223', 'Mysuru', '11:15 AM', 'Meta Leads Ads', '2m 10s', 'HOT', 'SEO & Lead Gen for Dental', '₹35,000/mo', 'Zoom Consultation Scheduled', '[{"speaker":"Sahana","time":"00:02","text":"Namaskara! Creative Digital Agency ge swagatha."}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security (RLS) but allow Service Role bypassing
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for service-role" ON public.organizations FOR ALL USING (true);
CREATE POLICY "Enable all for service-role" ON public.calls FOR ALL USING (true);
