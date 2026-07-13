-- Allow users to delete their own storage objects.
-- These policies were in the original storage setup but never applied to
-- production, which left supabase.storage.remove() silently failing
-- (see deleteImage in src/lib/supabase/storage.ts).

CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own post images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'post-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
