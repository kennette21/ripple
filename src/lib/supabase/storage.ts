import { supabase } from './client';

// Storage bucket names
export const BUCKETS = {
  AVATARS: 'avatars',
  POST_IMAGES: 'post-images',
} as const;

// Convert image URI to base64 using fetch (works in Expo Go)
async function uriToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = base64String.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Decode base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Upload an image to a bucket using base64 (React Native compatible)
export async function uploadImage(
  bucket: string,
  path: string,
  uri: string,
  contentType: string = 'image/jpeg'
): Promise<{ path: string | null; error: Error | null }> {
  try {
    // Convert URI to base64
    const base64 = await uriToBase64(uri);

    // Decode base64 to ArrayBuffer
    const arrayBuffer = base64ToArrayBuffer(base64);

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
): Promise<{ url: string | null; error: Error | null }> {
  const path = `${userId}/avatar.jpg`;
  const { path: uploadedPath, error } = await uploadImage(
    BUCKETS.AVATARS,
    path,
    uri
  );

  if (error || !uploadedPath) {
    return { url: null, error };
  }

  const url = getPublicUrl(BUCKETS.AVATARS, uploadedPath);
  return { url, error: null };
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
