import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';

async function checkIsBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const { data } = await (supabase
    .from('blocks') as any)
    .select('id')
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)
    .maybeSingle();

  return !!data;
}

async function toggleBlock(blockerId: string, blockedId: string, isBlocked: boolean) {
  if (isBlocked) {
    // Unblock
    const { error } = await (supabase
      .from('blocks') as any)
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId);

    if (error) throw error;
  } else {
    // Block - also unfollow in both directions
    const { error: blockError } = await (supabase
      .from('blocks') as any)
      .insert({
        blocker_id: blockerId,
        blocked_id: blockedId,
      });

    if (blockError) throw blockError;

    // Remove follows in both directions
    await Promise.all([
      (supabase.from('follows') as any)
        .delete()
        .eq('follower_id', blockerId)
        .eq('following_id', blockedId),
      (supabase.from('follows') as any)
        .delete()
        .eq('follower_id', blockedId)
        .eq('following_id', blockerId),
    ]);
  }

  return !isBlocked;
}

export function useIsBlocked(blockerId: string | undefined, blockedId: string | undefined) {
  return useQuery({
    queryKey: ['blocks', blockerId, blockedId],
    queryFn: () => checkIsBlocked(blockerId!, blockedId!),
    enabled: !!blockerId && !!blockedId && blockerId !== blockedId,
  });
}

export function useBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ blockerId, blockedId, isBlocked }: {
      blockerId: string;
      blockedId: string;
      isBlocked: boolean;
    }) => toggleBlock(blockerId, blockedId, isBlocked),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.social.followStatus(variables.blockerId, variables.blockedId) });
    },
  });
}
