import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';

interface CaughtUpStatus {
  isCaughtUp: boolean;
  lastSeenAt: string | null;
  newPostsCount: number;
}

async function checkCaughtUp(userId: string): Promise<CaughtUpStatus> {
  // Get user's feed watermark (last time they saw the feed)
  const { data: watermark } = await (supabase
    .from('feed_watermarks') as any)
    .select('last_seen_at')
    .eq('user_id', userId)
    .maybeSingle();

  const lastSeenAt = watermark?.last_seen_at || null;

  if (!lastSeenAt) {
    // First time user, show all posts
    return {
      isCaughtUp: false,
      lastSeenAt: null,
      newPostsCount: 0,
    };
  }

  // Get users the current user follows
  const { data: follows } = await (supabase
    .from('follows') as any)
    .select('following_id')
    .eq('follower_id', userId);

  const followingIds = follows?.map((f: any) => f.following_id) || [];
  followingIds.push(userId);

  // Count posts since last seen
  const { count } = await (supabase
    .from('posts') as any)
    .select('id', { count: 'exact', head: true })
    .in('author_id', followingIds)
    .gt('created_at', lastSeenAt);

  return {
    isCaughtUp: (count || 0) === 0,
    lastSeenAt,
    newPostsCount: count || 0,
  };
}

async function updateWatermark(userId: string) {
  const { error } = await (supabase
    .from('feed_watermarks') as any)
    .upsert({
      user_id: userId,
      last_seen_at: new Date().toISOString(),
    });

  if (error) throw error;
}

export function useCaughtUp(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.feed.caughtUp(userId || ''),
    queryFn: () => checkCaughtUp(userId!),
    enabled: !!userId,
    refetchInterval: 30000, // Check every 30 seconds
  });
}

export function useMarkAsSeen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateWatermark,
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.caughtUp(userId) });
    },
  });
}
