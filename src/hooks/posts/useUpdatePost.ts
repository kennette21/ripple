import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { BUCKETS } from '@/lib/supabase/storage';
import { queryKeys } from '@/lib/query/keys';
import type { ContentType } from '@/types/database';

interface UpdatePostInput {
  postId: string;
  authorId: string;
  contentType: ContentType;
  caption: string;
  reflection: string;
  /** IDs of existing images in their desired order. Omitted IDs are deleted. */
  imageIds: string[];
}

async function updatePost(input: UpdatePostInput) {
  const { data, error } = await supabase.rpc('update_post', {
    p_post_id: input.postId,
    p_caption: input.caption,
    p_reflection:
      input.contentType !== 'caption' ? input.reflection : '',
    p_image_ids: input.imageIds,
  });

  if (error) throw error;

  const result = data as unknown as {
    post_id: string;
    updated_at: string | null;
    deleted_storage_paths: string[];
  };

  if (!result || !Array.isArray(result.deleted_storage_paths)) {
    throw new Error('The server returned an invalid post update response.');
  }

  // The database edit is already committed at this point. A failed Storage
  // cleanup leaves only an unreachable object, so do not report the post save
  // as failed or invite a retry that can no longer recover its path.
  if (result.deleted_storage_paths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(BUCKETS.POST_IMAGES)
      .remove(result.deleted_storage_paths);

    if (storageError) {
      console.warn('Post updated, but removed image cleanup failed:', storageError);
    }
  }

  return data;
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
