
-- Add evidence_ref_number column with auto-incrementing per user
ALTER TABLE public.evidence_files ADD COLUMN IF NOT EXISTS evidence_ref_number integer;

-- Create a function to auto-assign evidence reference numbers per user
CREATE OR REPLACE FUNCTION public.assign_evidence_ref_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(evidence_ref_number), 0) + 1 INTO next_num
  FROM public.evidence_files
  WHERE user_id = NEW.user_id;
  
  NEW.evidence_ref_number := next_num;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-assign on insert
CREATE TRIGGER set_evidence_ref_number
  BEFORE INSERT ON public.evidence_files
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_evidence_ref_number();

-- Backfill existing evidence files
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY upload_date ASC) as rn
  FROM public.evidence_files
  WHERE evidence_ref_number IS NULL
)
UPDATE public.evidence_files ef
SET evidence_ref_number = n.rn
FROM numbered n
WHERE ef.id = n.id;
