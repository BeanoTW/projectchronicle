
-- Create storage policies for the evidence bucket (user-scoped paths)
-- Users can only upload files to their own folder (user_id/*)
CREATE POLICY "Users upload to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'evidence'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can only view their own files
CREATE POLICY "Users view own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'evidence'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own files
CREATE POLICY "Users delete own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'evidence'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- No UPDATE policy = no overwrite capability
