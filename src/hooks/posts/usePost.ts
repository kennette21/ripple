import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';
import type { FeedPost } from '@/hooks/feed/useFeed';

async function fetchPost(postId: string, userId: string): Promise<FeedPost> {
  const { data: post, error } = await (supabase
    .from('posts') as any)
    .select(`
      *,
      author:profiles!posts_author_id_fkey(*),
      images:post_images(*)
    `)
    .eq('id', postId)
    .single();

  if (error) throw error;

  // Get counts and bookmark status
  const [commentCount, repostCount, bookmarkStatus] = await Promise.all([
    (supabase.from('comments') as any)
      .select('id', { count: 'exact', head: true })
      .eq('post_id', postId),
    (supabase.from('reposts') as any)
      .select('id', { count: 'exact', head: true })
      .eq('post_id', postId),
    (supabase.from('bookmarks') as any)
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  return {
    ...post,
    comment_count: commentCount.count || 0,
    repost_count: repostCount.count || 0,
    is_bookmarked: !!bookmarkStatus.data,
  };
}

export function usePost(postId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.posts.detail(postId || ''),
    queryFn: () => fetchPost(postId!, userId!),
    enabled: !!postId && !!userId,
  });
}
