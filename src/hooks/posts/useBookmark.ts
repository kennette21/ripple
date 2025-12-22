import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';

async function toggleBookmark(postId: string, userId: string, isBookmarked: boolean) {
  if (isBookmarked) {
    // Remove bookmark
    const { error } = await (supabase
      .from('bookmarks') as any)
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);

    if (error) throw error;
  } else {
    // Add bookmark
    const { error } = await (supabase
      .from('bookmarks') as any)
      .insert({
        post_id: postId,
        user_id: userId,
      });

    if (error) throw error;
  }

  return !isBookmarked;
}

export function useBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, userId, isBookmarked }: {
      postId: string;
      userId: string;
      isBookmarked: boolean
    }) => toggleBookmark(postId, userId, isBookmarked),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
    },
  });
}
