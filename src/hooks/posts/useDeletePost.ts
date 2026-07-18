import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';
import { BUCKETS } from '@/lib/supabase/storage';

async function softDeletePost(postId: string) {
  const { data, error } = await supabase.rpc('soft_delete_post', {
    p_post_id: postId,
  });

  if (error) throw error;
  if (data !== true) throw new Error('The post could not be deleted.');
}

async function restoreDeletedPost(postId: string) {
  const { data, error } = await supabase.rpc(
    'restore_deleted_post',
    { p_post_id: postId }
  );

  if (error) throw error;
  if (data !== true) {
    throw new Error('This post can no longer be restored.');
  }
}

async function permanentlyDeletePost(postId: string) {
  const { data: post, error: postQueryError } = await supabase
    .from('posts')
    .select('images:post_images(storage_path, thumbnail_path)')
    .eq('id', postId)
    .not('deleted_at', 'is', null)
    .maybeSingle();

  if (postQueryError) throw postQueryError;
  if (!post) return;

  const storagePaths = post.images.flatMap((image) =>
    [image.storage_path, image.thumbnail_path].filter(Boolean) as string[]
  );

  // Remove media first. A retry is safe if the database request fails after
  // Storage succeeds, and no orphaned objects are left behind.
  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(BUCKETS.POST_IMAGES)
      .remove(storagePaths);

    if (storageError) throw storageError;
  }

  const { data: deletedPost, error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId)
    .not('deleted_at', 'is', null)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!deletedPost) {
    throw new Error('The post could not be permanently deleted.');
  }
}

function invalidatePostQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.feed.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
}

export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: softDeletePost,
    onSuccess: () => invalidatePostQueries(queryClient),
  });
}

export function useRestoreDeletedPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: restoreDeletedPost,
    onSuccess: () => invalidatePostQueries(queryClient),
  });
}

export function usePermanentlyDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: permanentlyDeletePost,
    onSuccess: () => invalidatePostQueries(queryClient),
  });
}
