import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';
import type { FeedPost } from '@/hooks/feed/useFeed';

const POSTS_PER_PAGE = 20;

interface UserPostsPage {
  posts: FeedPost[];
  nextCursor: string | null;
}

async function fetchUserPosts(
  userId: string,
  viewerId: string,
  cursor?: string
): Promise<UserPostsPage> {
  let query = (supabase
    .from('posts') as any)
    .select(`
      *,
      author:profiles!posts_author_id_fkey(*),
      images:post_images(*)
    `)
    .eq('author_id', userId)
    .order('created_at', { ascending: false })
    .limit(POSTS_PER_PAGE);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data: posts, error } = await query;

  if (error) throw error;

  // Get comment and repost counts, and bookmark status
  const postsWithCounts = await Promise.all(
    (posts || []).map(async (post: any) => {
      const [commentCount, repostCount, bookmarkStatus] = await Promise.all([
        (supabase.from('comments') as any)
          .select('id', { count: 'exact', head: true })
          .eq('post_id', post.id),
        (supabase.from('reposts') as any)
          .select('id', { count: 'exact', head: true })
          .eq('post_id', post.id),
        (supabase.from('bookmarks') as any)
          .select('id')
          .eq('post_id', post.id)
          .eq('user_id', viewerId)
          .maybeSingle(),
      ]);

      return {
        ...post,
        comment_count: commentCount.count || 0,
        repost_count: repostCount.count || 0,
        is_bookmarked: !!bookmarkStatus.data,
      };
    })
  );

  const lastPost = postsWithCounts[postsWithCounts.length - 1];
  const nextCursor = postsWithCounts.length === POSTS_PER_PAGE ? lastPost?.created_at : null;

  return {
    posts: postsWithCounts,
    nextCursor,
  };
}

export function useUserPosts(userId: string | undefined, viewerId: string | undefined) {
  return useInfiniteQuery({
    queryKey: queryKeys.posts.byUser(userId || ''),
    queryFn: ({ pageParam }) => fetchUserPosts(userId!, viewerId!, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!userId && !!viewerId,
  });
}
