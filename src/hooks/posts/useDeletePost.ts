import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';

async function deletePost(postId: string) {
  const { error } = await (supabase
    .from('posts') as any)
    .delete()
    .eq('id', postId);

  if (error) throw error;
}

export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
    },
  });
}
