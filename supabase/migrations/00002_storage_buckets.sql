-- Create storage buckets for avatars and post images

-- Create the avatars bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create the post-images bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for avatars bucket
-- Allow users to upload their own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to avatars
CREATE POLICY "Public read access for avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Policies for post-images bucket
-- Allow users to upload their own post images
CREATE POLICY "Users can upload own post images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'post-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own post images
CREATE POLICY "Users can update own post images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'post-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own post images
CREATE POLICY "Users can delete own post images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'post-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to post images
CREATE POLICY "Public read access for post images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'post-images');
