import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';
import type { Post, Profile, PostImage } from '@/types/database';

const POSTS_PER_PAGE = 20;

export interface FeedPost extends Post {
  author: Profile;
  images: PostImage[];
  comment_count: number;
  repost_count: number;
  is_bookmarked: boolean;
}

interface FeedPage {
  posts: FeedPost[];
  nextCursor: string | null;
}

async function fetchFeed(userId: string, cursor?: string): Promise<FeedPage> {
  // Get users the current user follows
  const { data: follows } = await (supabase
    .from('follows') as any)
    .select('following_id')
    .eq('follower_id', userId);

  const followingIds = follows?.map((f: any) => f.following_id) || [];
  // Include own posts in feed
  followingIds.push(userId);

  // Get blocked users to exclude
  const { data: blocks } = await (supabase
    .from('blocks') as any)
    .select('blocked_id')
    .eq('blocker_id', userId);

  const blockedIds = blocks?.map((b: any) => b.blocked_id) || [];

  // Build query
  let query = (supabase
    .from('posts') as any)
    .select(`
      *,
      author:profiles!posts_author_id_fkey(*),
      images:post_images(*)
    `)
    .in('author_id', followingIds)
    .order('created_at', { ascending: false })
    .limit(POSTS_PER_PAGE);

  // Filter out blocked users
  if (blockedIds.length > 0) {
    query = query.not('author_id', 'in', `(${blockedIds.join(',')})`);
  }

  // Use cursor for pagination
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
          .eq('user_id', userId)
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

export function useFeed(userId: string | undefined) {
  return useInfiniteQuery({
    queryKey: queryKeys.feed.list(userId || ''),
    queryFn: ({ pageParam }) => fetchFeed(userId!, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!userId,
  });
}
