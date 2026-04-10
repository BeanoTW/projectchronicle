ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS context_domain text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS category_source text DEFAULT 'ai';