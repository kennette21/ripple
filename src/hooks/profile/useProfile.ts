import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';
import type { Profile } from '@/types/database';

async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await (supabase
    .from('profiles') as any)
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.profiles.detail(userId || ''),
    queryFn: () => fetchProfile(userId!),
    enabled: !!userId,
  });
}
