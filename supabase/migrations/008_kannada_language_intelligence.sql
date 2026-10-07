-- ==============================================================================
-- VANNI Migration 008: Kannada + Kanglish Conversation Intelligence Layer
-- ==============================================================================

-- 1. Business Language Profiles
CREATE TABLE IF NOT EXISTS public.business_language_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  primary_language TEXT NOT NULL DEFAULT 'kn-en', -- 'en', 'kn', 'kn-en'
  allowed_languages TEXT[] NOT NULL DEFAULT ARRAY['en', 'kn', 'kn-en'],
  auto_detect_enabled BOOLEAN NOT NULL DEFAULT true,
  code_switching_allowed BOOLEAN NOT NULL DEFAULT true,
  preferred_register TEXT NOT NULL DEFAULT 'PROFESSIONAL', -- 'FORMAL', 'PROFESSIONAL', 'NEUTRAL', 'FRIENDLY', 'CASUAL'
  honorific_preference TEXT NOT NULL DEFAULT 'NIMMA', -- 'AVARU', 'NIMMA', 'SIR_MADAM', 'NONE'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_business_language_profile UNIQUE (organization_id)
);

-- 2. Business Terminology & Aliases (Tenant-Isolated with Global Platform Fallbacks)
CREATE TABLE IF NOT EXISTS public.terminology_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE, -- NULL indicates global platform terminology
  canonical_term TEXT NOT NULL,
  entity_type TEXT NOT NULL, -- 'SERVICE', 'STAFF', 'LOCATION', 'APPOINTMENT', 'POLICY', 'PROPERTY'
  entity_id TEXT, -- Foreign reference to Business Brain entity (e.g. service UUID)
  english_aliases TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  kannada_aliases TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  kanglish_aliases TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Pronunciation & TTS Spoken Hints
CREATE TABLE IF NOT EXISTS public.pronunciation_hints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  display_text TEXT NOT NULL,
  spoken_text_kannada TEXT NOT NULL,
  spoken_text_english TEXT NOT NULL,
  phonetic_hint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_lang_prof_org ON public.business_language_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_term_alias_org ON public.terminology_aliases(organization_id);
CREATE INDEX IF NOT EXISTS idx_term_alias_term ON public.terminology_aliases(canonical_term);
CREATE INDEX IF NOT EXISTS idx_pronunc_org ON public.pronunciation_hints(organization_id);

-- Enable Row-Level Security (RLS)
ALTER TABLE public.business_language_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminology_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pronunciation_hints ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Business Language Profiles
CREATE POLICY "Language profiles viewable by organization members"
  ON public.business_language_profiles
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'ACTIVE'
    )
  );

CREATE POLICY "Language profiles manageable by organization admins"
  ON public.business_language_profiles
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'ACTIVE' AND role IN ('OWNER', 'ADMIN')
    )
  );

-- RLS Policies for Terminology Aliases (Tenant-isolated or Global NULL)
CREATE POLICY "Terminology aliases viewable by org members or global"
  ON public.terminology_aliases
  FOR SELECT
  USING (
    organization_id IS NULL OR
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'ACTIVE'
    )
  );

CREATE POLICY "Terminology aliases manageable by org admins"
  ON public.terminology_aliases
  FOR ALL
  USING (
    organization_id IS NOT NULL AND
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'ACTIVE' AND role IN ('OWNER', 'ADMIN')
    )
  );

-- RLS Policies for Pronunciation Hints
CREATE POLICY "Pronunciation hints viewable by org members or global"
  ON public.pronunciation_hints
  FOR SELECT
  USING (
    organization_id IS NULL OR
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'ACTIVE'
    )
  );

CREATE POLICY "Pronunciation hints manageable by org admins"
  ON public.pronunciation_hints
  FOR ALL
  USING (
    organization_id IS NOT NULL AND
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'ACTIVE' AND role IN ('OWNER', 'ADMIN')
    )
  );
