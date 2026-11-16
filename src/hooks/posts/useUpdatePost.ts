import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { BUCKETS, getPublicUrl, uploadImage } from '@/lib/supabase/storage';
import { preparePostImage } from '@/lib/postImageUpload';
import { queryKeys } from '@/lib/query/keys';
import type { ContentType, Json } from '@/types/database';
import type { SelectedPostPhoto } from '@/types/postPhoto';
import type { EditablePostImage } from './useEditablePost';

interface UpdatePostInput {
  postId: string;
  userId: string;
  caption: string;
  reflection: string;
  contentType: ContentType;
  isPrivate: boolean;
  images: SelectedPostPhoto[];
  originalImages: EditablePostImage[];
  originalContentType: ContentType;
  originalIsPrivate: boolean;
}

async function removeUploadedImages(paths: string[]) {
  if (!paths.length) return;
  try {
    const { error } = await supabase.storage.from(BUCKETS.POST_IMAGES).remove(paths);
    if (error) console.warn('Post image cleanup failed:', error);
  } catch (error) {
    console.warn('Post image cleanup failed:', error);
  }
}

async function updatePost(input: UpdatePostInput) {
  const originals = new Map(input.originalImages.map(image => [image.id, image]));
  const uploadedPaths: string[] = [];
  const imageRows: Json[] = [];
  const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let canRollbackUploads = true;
  try {
    // Bounded batches settle before rollback, including when a native encoder
    // or an upload throws instead of returning a Storage error.
    for (let offset = 0; offset < input.images.length; offset += 3) {
      const batch = await Promise.allSettled(input.images.slice(offset, offset + 3).map(async (image, index) => {
        const original = originals.get(image.id);
        if (original && image.uri === getPublicUrl(BUCKETS.POST_IMAGES, original.storage_path)) {
          return { id: original.id };
        }
        const prepared = await preparePostImage({
          uri: image.uri, width: image.width, height: image.height, alreadyJpeg: image.isCropped,
        });
        // Never overwrite a published object's positional filename. Cancelled
        // or rejected edits can remove these new objects without touching it.
        const path = `${input.userId}/${input.postId}/edit-${uploadId}-${offset + index}.jpg`;
        const uploaded = await uploadImage(BUCKETS.POST_IMAGES, path, prepared.uri, 'image/jpeg', false);
        if (uploaded.error || !uploaded.path) throw uploaded.error || new Error('Could not upload photo.');
        uploadedPaths.push(uploaded.path);
        return {
          ...(original ? { id: original.id } : {}), storage_path: uploaded.path,
          width: prepared.width, height: prepared.height, blurhash: null,
        };
      }));
      const failed = batch.find(result => result.status === 'rejected');
      if (failed?.status === 'rejected') throw failed.reason;
      for (const result of batch) {
        if (result.status === 'fulfilled') imageRows.push(result.value);
      }
    }

    // A lost response can follow a committed transaction. In that case keep
    // uploaded objects rather than risk deleting a photo now used by the post.
    canRollbackUploads = false;
    let { data, error } = await supabase.rpc('update_post_composition', {
      p_post_id: input.postId, p_caption: input.caption, p_reflection: input.reflection,
      p_content_type: input.contentType, p_is_private: input.isPrivate, p_images: imageRows,
    });
    // Preserve ordinary editing while clients and the database roll out at
    // different times. Photo replacements, additions, mode/audience changes
    // still require the atomic composition function.
    if (error?.code === 'PGRST202' && uploadedPaths.length === 0
      && input.contentType === input.originalContentType && input.isPrivate === input.originalIsPrivate) {
      ({ data, error } = await supabase.rpc('update_post', {
        p_post_id: input.postId, p_caption: input.caption, p_reflection: input.reflection,
        p_image_ids: input.images.map(image => image.id),
      }));
    }
    if (error) {
      canRollbackUploads = Boolean(error.code && (/^[0-9A-Z]{5}$/.test(error.code) || error.code.startsWith('PGRST')));
      throw error;
    }
    const result = data as { post_id: string; updated_at: string | null; deleted_storage_paths: string[] } | null;
    if (!result || !Array.isArray(result.deleted_storage_paths)) {
      throw new Error('The server returned an invalid post update response.');
    }
    // The database edit is committed. Cleanup failure must not turn a successful
    // save into an error or encourage a retry against the old baseline.
    await removeUploadedImages(result.deleted_storage_paths);
    return result;
  } catch (error) {
    if (canRollbackUploads) await removeUploadedImages(uploadedPaths);
    throw error;
  }
}

export function useUpdatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updatePost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
    },
  });
}
