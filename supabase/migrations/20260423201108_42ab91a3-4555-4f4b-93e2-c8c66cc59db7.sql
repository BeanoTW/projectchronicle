-- 1. Add integrity columns to incidents
ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS original_created_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_modified_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS transcription_source_attachment_id uuid,
  ADD COLUMN IF NOT EXISTS transcription_created_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS transcription_provider text,
  ADD COLUMN IF NOT EXISTS transcription_model text;

-- Backfill existing rows
UPDATE public.incidents
  SET original_created_at = COALESCE(original_created_at, created_at),
      last_modified_at = COALESCE(last_modified_at, updated_at);

-- Default for future inserts
ALTER TABLE public.incidents
  ALTER COLUMN original_created_at SET DEFAULT now(),
  ALTER COLUMN last_modified_at SET DEFAULT now();

-- 2. Add edit_source to edit_history
ALTER TABLE public.edit_history
  ADD COLUMN IF NOT EXISTS edit_source text NOT NULL DEFAULT 'user';

-- Constrain values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'edit_history_edit_source_check'
  ) THEN
    ALTER TABLE public.edit_history
      ADD CONSTRAINT edit_history_edit_source_check
      CHECK (edit_source IN ('user', 'transcription', 'system'));
  END IF;
END$$;

-- 3. Trigger to auto-bump last_modified_at when tracked fields change
CREATE OR REPLACE FUNCTION public.bump_last_modified_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Always preserve original_created_at on update
  IF NEW.original_created_at IS DISTINCT FROM OLD.original_created_at THEN
    NEW.original_created_at := OLD.original_created_at;
  END IF;

  IF
    NEW.raw_narrative IS DISTINCT FROM OLD.raw_narrative
    OR NEW.category IS DISTINCT FROM OLD.category
    OR NEW.subtype IS DISTINCT FROM OLD.subtype
    OR NEW.location IS DISTINCT FROM OLD.location
    OR NEW.people_involved IS DISTINCT FROM OLD.people_involved
  THEN
    NEW.last_modified_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS incidents_bump_last_modified ON public.incidents;
CREATE TRIGGER incidents_bump_last_modified
  BEFORE UPDATE ON public.incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_last_modified_at();

-- 4. Trigger to set original_created_at on insert (if missing)
CREATE OR REPLACE FUNCTION public.set_original_created_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.original_created_at IS NULL THEN
    NEW.original_created_at := COALESCE(NEW.created_at, now());
  END IF;
  IF NEW.last_modified_at IS NULL THEN
    NEW.last_modified_at := NEW.original_created_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS incidents_set_original_created_at ON public.incidents;
CREATE TRIGGER incidents_set_original_created_at
  BEFORE INSERT ON public.incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_original_created_at();