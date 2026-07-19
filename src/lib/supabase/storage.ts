import { supabase } from './client';

// Storage bucket names
export const BUCKETS = {
  AVATARS: 'avatars',
  POST_IMAGES: 'post-images',
} as const;

const IMAGE_TYPES_BY_EXTENSION: Record<string, string> = {
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  webp: 'image/webp',
};

const IMAGE_EXTENSIONS_BY_TYPE: Record<string, string> = {
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/tiff': 'tif',
  'image/webp': 'webp',
};

interface PostImageUploadMetadata {
  mimeType?: string | null;
  fileName?: string | null;
}

function resolveImageType({
  mimeType,
  fileName,
}: PostImageUploadMetadata): { contentType: string; extension: string } {
  const normalizedMimeType = mimeType?.split(';')[0].trim().toLowerCase();
  const fileExtension = fileName
    ?.split(/[?#]/)[0]
    .match(/\.([a-z\d]{1,10})$/i)?.[1]
    .toLowerCase();

  if (normalizedMimeType?.startsWith('image/')) {
    const fallbackExtension = normalizedMimeType
      .slice('image/'.length)
      .replace('+xml', '')
      .replace(/[^a-z\d]/g, '');

    return {
      contentType: normalizedMimeType,
      extension:
        IMAGE_EXTENSIONS_BY_TYPE[normalizedMimeType] ||
        fileExtension ||
        fallbackExtension ||
        'jpg',
    };
  }

  if (fileExtension && IMAGE_TYPES_BY_EXTENSION[fileExtension]) {
    return {
      contentType: IMAGE_TYPES_BY_EXTENSION[fileExtension],
      extension: fileExtension === 'jpeg' ? 'jpg' : fileExtension,
    };
  }

  return { contentType: 'image/jpeg', extension: 'jpg' };
}

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
  uri: string,
  metadata: PostImageUploadMetadata = {}
): Promise<{ path: string | null; error: Error | null }> {
  const { contentType, extension } = resolveImageType(metadata);
  const storagePath = `${userId}/${postId}/${position}.${extension}`;
  return uploadImage(BUCKETS.POST_IMAGES, storagePath, uri, contentType);
}
