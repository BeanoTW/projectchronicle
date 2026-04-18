-- Add record_type with safe default so all existing rows stay 'incident'
ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS record_type text NOT NULL DEFAULT 'incident';

-- Constrain to the two supported values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'incidents_record_type_check'
  ) THEN
    ALTER TABLE public.incidents
      ADD CONSTRAINT incidents_record_type_check
      CHECK (record_type IN ('incident', 'daily_record'));
  END IF;
END$$;

-- Optional structured interactions for daily records (nullable JSONB array)
ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS interactions jsonb;

-- Helpful index for filtering by record_type per user
CREATE INDEX IF NOT EXISTS idx_incidents_user_record_type
  ON public.incidents (user_id, record_type, incident_date DESC);