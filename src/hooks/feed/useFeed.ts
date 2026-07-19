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
  is_private: boolean;
}

interface FeedPage {
  posts: FeedPost[];
  nextCursor: string | null;
}

async function fetchFeed(userId: string, cursor?: string): Promise<FeedPage> {
  // Get friends (accepted friend requests in either direction)
  const [sentResult, receivedResult] = await Promise.all([
    supabase.from('friend_requests')
      .select('receiver_id')
      .eq('sender_id', userId)
      .eq('status', 'accepted'),
    supabase.from('friend_requests')
      .select('sender_id')
      .eq('receiver_id', userId)
      .eq('status', 'accepted'),
  ]);

  if (sentResult.error) throw sentResult.error;
  if (receivedResult.error) throw receivedResult.error;

  const sentAccepted = sentResult.data;
  const receivedAccepted = receivedResult.data;

  const friendIds = [
    ...(sentAccepted || []).map((r) => r.receiver_id),
    ...(receivedAccepted || []).map((r) => r.sender_id),
  ];
  // Include own posts in feed
  friendIds.push(userId);

  // Also include follows for backwards compatibility during transition
  const { data: follows, error: followsError } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);

  if (followsError) throw followsError;

  const followingIds = follows?.map((f) => f.following_id) || [];

  // Merge friends and follows, dedupe
  const allIds = [...new Set([...friendIds, ...followingIds])];

  // Get blocked users to exclude
  const { data: blocks, error: blocksError } = await supabase
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', userId);

  if (blocksError) throw blocksError;

  const blockedIds = blocks?.map((b) => b.blocked_id) || [];

  // Build query
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
    .in('author_id', allIds)
    .is('deleted_at', null)
    .or(`is_private.eq.false,author_id.eq.${userId}`)
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

export function useFeed(userId: string | undefined) {
  return useInfiniteQuery({
    queryKey: queryKeys.feed.list(userId || ''),
    queryFn: ({ pageParam }) => fetchFeed(userId!, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!userId,
  });
}
