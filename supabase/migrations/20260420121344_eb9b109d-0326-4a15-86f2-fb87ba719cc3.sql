
-- 1. Add UPDATE/DELETE RLS policies on follow_up_notes scoped to owner
CREATE POLICY "Users can update own notes"
ON public.follow_up_notes
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
ON public.follow_up_notes
FOR DELETE
USING (auth.uid() = user_id);

-- 2. Drop duplicate public-role storage policies on the evidence bucket,
--    keeping only the authenticated-role versions.
DROP POLICY IF EXISTS "Users can upload own evidence files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own evidence files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own evidence files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own evidence files" ON storage.objects;

-- Recreate strictly scoped to authenticated role
CREATE POLICY "Authenticated users can upload own evidence files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'evidence'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Authenticated users can view own evidence files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'evidence'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Authenticated users can update own evidence files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'evidence'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Authenticated users can delete own evidence files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'evidence'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
