import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';

async function checkIsMuted(muterId: string, mutedId: string): Promise<boolean> {
  const { data } = await (supabase
    .from('mutes') as any)
    .select('id')
    .eq('muter_id', muterId)
    .eq('muted_id', mutedId)
    .maybeSingle();

  return !!data;
}

async function toggleMute(muterId: string, mutedId: string, isMuted: boolean) {
  if (isMuted) {
    // Unmute
    const { error } = await (supabase
      .from('mutes') as any)
      .delete()
      .eq('muter_id', muterId)
      .eq('muted_id', mutedId);

    if (error) throw error;
  } else {
    // Mute
    const { error } = await (supabase
      .from('mutes') as any)
      .insert({
        muter_id: muterId,
        muted_id: mutedId,
      });

    if (error) throw error;
  }

  return !isMuted;
}

export function useIsMuted(muterId: string | undefined, mutedId: string | undefined) {
  return useQuery({
    queryKey: ['mutes', muterId, mutedId],
    queryFn: () => checkIsMuted(muterId!, mutedId!),
    enabled: !!muterId && !!mutedId && muterId !== mutedId,
  });
}

export function useMute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ muterId, mutedId, isMuted }: {
      muterId: string;
      mutedId: string;
      isMuted: boolean;
    }) => toggleMute(muterId, mutedId, isMuted),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mutes'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.all });
    },
  });
}
