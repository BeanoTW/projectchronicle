-- Add a nullable record_date column for daily records.
-- Incidents continue to use incident_date as their event date.
-- Daily records will populate BOTH record_date (canonical) and incident_date
-- (same value, for backwards compatibility with existing chronology/calendar/export logic).
ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS record_date date NULL;

-- Helpful index for any future queries that filter daily records by their event date.
CREATE INDEX IF NOT EXISTS idx_incidents_record_date
  ON public.incidents (record_date)
  WHERE record_date IS NOT NULL;