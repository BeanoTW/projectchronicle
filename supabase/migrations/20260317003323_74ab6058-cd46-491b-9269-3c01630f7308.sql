
-- Timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ==================== INCIDENTS ====================
CREATE TABLE public.incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  incident_date DATE NOT NULL,
  incident_time TEXT,
  location TEXT,
  people_involved TEXT[] NOT NULL DEFAULT '{}',
  witnesses TEXT[] NOT NULL DEFAULT '{}',
  category TEXT,
  severity TEXT,
  impact_note TEXT,
  raw_narrative TEXT NOT NULL,
  ai_summary TEXT,
  exact_words TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'Open',
  locked BOOLEAN NOT NULL DEFAULT false,
  excluded_from_rep BOOLEAN NOT NULL DEFAULT false,
  record_method TEXT DEFAULT 'text',
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own incidents" ON public.incidents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own incidents" ON public.incidents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own incidents" ON public.incidents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own incidents" ON public.incidents FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON public.incidents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==================== EDIT HISTORY ====================
CREATE TABLE public.edit_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.edit_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own edit history" ON public.edit_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own edit history" ON public.edit_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ==================== FOLLOW-UP NOTES ====================
CREATE TABLE public.follow_up_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'Update',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.follow_up_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notes" ON public.follow_up_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own notes" ON public.follow_up_notes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ==================== EVIDENCE FILES ====================
CREATE TABLE public.evidence_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_path TEXT NOT NULL,
  file_hash TEXT,
  mime_type TEXT,
  file_size BIGINT,
  upload_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  capture_date TIMESTAMPTZ,
  description TEXT
);

ALTER TABLE public.evidence_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own evidence" ON public.evidence_files FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can upload own evidence" ON public.evidence_files FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own evidence" ON public.evidence_files FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own evidence" ON public.evidence_files FOR DELETE USING (auth.uid() = user_id);

-- ==================== RIGHTS GUIDANCE ====================
CREATE TABLE public.rights_guidance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rights_guidance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active guidance" ON public.rights_guidance FOR SELECT USING (active = true);

-- ==================== STORAGE BUCKET ====================
INSERT INTO storage.buckets (id, name, public) VALUES ('evidence', 'evidence', false);

CREATE POLICY "Users can upload own evidence files" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own evidence files" ON storage.objects FOR SELECT
USING (bucket_id = 'evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own evidence files" ON storage.objects FOR DELETE
USING (bucket_id = 'evidence' AND auth.uid()::text = (storage.foldername(name))[1]);
