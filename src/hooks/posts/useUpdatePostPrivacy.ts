import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';

async function updatePostPrivacy(
  postId: string,
  authorId: string,
  isPrivate: boolean
) {
  const { data, error } = await (supabase
    .from('posts') as any)
    .update({ is_private: isPrivate })
    .eq('id', postId)
    .eq('author_id', authorId)
    .select('id, is_private')
    .single();

  if (error) throw error;
  return data as { id: string; is_private: boolean };
}

export function useUpdatePostPrivacy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, authorId, isPrivate }: {
      postId: string;
      authorId: string;
      isPrivate: boolean;
    }) => updatePostPrivacy(postId, authorId, isPrivate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
    },
  });
}
