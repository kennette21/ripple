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
  let query = supabase
    .from('posts')
    .select(`
      *,
      author:profiles!posts_author_id_fkey(*),
      images:post_images(*),
      comments(count),
      reposts(count),
      bookmarks(id)
    `)
    .eq('author_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(POSTS_PER_PAGE);

  // Private notes are visible on the author's own profile only.
  if (viewerId !== userId) {
    query = query.eq('is_private', false);
  }

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data: posts, error } = await query;

  if (error) throw error;

  const postsWithCounts: FeedPost[] = (posts || []).map((post) => {
    const { comments, reposts, bookmarks, ...postData } = post;
    return {
      ...postData,
      comment_count: comments[0]?.count || 0,
      repost_count: reposts[0]?.count || 0,
      is_bookmarked: bookmarks.length > 0,
    };
  });

  const lastPost = postsWithCounts[postsWithCounts.length - 1];
  const nextCursor = postsWithCounts.length === POSTS_PER_PAGE ? lastPost?.created_at : null;

  return {
    posts: postsWithCounts,
    nextCursor,
  };
}

export function useUserPosts(userId: string | undefined, viewerId: string | undefined) {
  return useInfiniteQuery({
    queryKey: queryKeys.posts.byUser(userId || '', viewerId || ''),
    queryFn: ({ pageParam }) => fetchUserPosts(userId!, viewerId!, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!userId && !!viewerId,
  });
}
