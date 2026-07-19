import { supabase } from './client';

// Storage bucket names
export const BUCKETS = {
  AVATARS: 'avatars',
  POST_IMAGES: 'post-images',
} as const;

async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  return response.arrayBuffer();
}

// Upload an image to a bucket using an ArrayBuffer (React Native compatible).
export async function uploadImage(
  bucket: string,
  path: string,
  uri: string,
  contentType: string = 'image/jpeg'
): Promise<{ path: string | null; error: Error | null }> {
  try {
    const arrayBuffer = await uriToArrayBuffer(uri);

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, arrayBuffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      return { path: null, error };
    }

    return { path: data.path, error: null };
  } catch (error) {
    return { path: null, error: error as Error };
  }
}

// Get public URL for an image
export function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

// // TODO: deprecated; remove URL passthrough once all environments complete
// migration `20260714120000_store_avatar_paths.sql` and `profiles.avatar_url`
// only stores object paths.
export function getAvatarUrl(value?: string | null): string | null {
  if (!value || /^[a-z][a-z\d+.-]*:/i.test(value)) return value ?? null;
  return getPublicUrl(BUCKETS.AVATARS, value);
}

// Delete an image from a bucket
export async function deleteImage(
  bucket: string,
  path: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  return { error };
}

// Upload avatar image
export async function uploadAvatar(
  userId: string,
  uri: string
): Promise<{ path: string | null; error: Error | null }> {
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const { path: uploadedPath, error } = await uploadImage(
    BUCKETS.AVATARS,
    path,
    uri
  );

  if (error || !uploadedPath) {
    return { path: null, error };
  }

  return { path: uploadedPath, error: null };
}

// Upload post image
export async function uploadPostImage(
  userId: string,
  postId: string,
  position: number,
  uri: string
): Promise<{ path: string | null; error: Error | null }> {
  const storagePath = `${userId}/${postId}/${position}.jpg`;
  return uploadImage(BUCKETS.POST_IMAGES, storagePath, uri);
}
