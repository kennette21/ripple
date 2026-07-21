import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';

interface FollowStatus {
  isFollowing: boolean;
}

async function getFollowStatus(userId: string, targetUserId: string): Promise<FollowStatus> {
  const { data, error } = await supabase.from('follows')
    .select('id')
    .eq('follower_id', userId)
    .eq('following_id', targetUserId)
    .maybeSingle();

  if (error) throw error;

  return {
    isFollowing: !!data,
  };
}

async function toggleFollow(followerId: string, followingId: string, isFollowing: boolean) {
  if (isFollowing) {
    // Unfollow
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId);

    if (error) throw error;
  } else {
    // Follow
    const { error } = await supabase
      .from('follows')
      .insert({
        follower_id: followerId,
        following_id: followingId,
      });

    if (error) throw error;
  }

  return !isFollowing;
}

export function useFollowStatus(userId: string | undefined, targetUserId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.social.followStatus(userId || '', targetUserId || ''),
    queryFn: () => getFollowStatus(userId!, targetUserId!),
    enabled: !!userId && !!targetUserId && userId !== targetUserId,
  });
}

export function useFollow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ followerId, followingId, isFollowing }: {
      followerId: string;
      followingId: string;
      isFollowing: boolean;
    }) => toggleFollow(followerId, followingId, isFollowing),
    onSuccess: (_, variables) => {
      // Invalidate follow status and feed
      queryClient.invalidateQueries({
        queryKey: queryKeys.social.followStatus(variables.followerId, variables.followingId)
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.social.connectionCounts(variables.followerId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.social.following(variables.followerId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.preferences(variables.followerId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.search.all });
    },
  });
}
