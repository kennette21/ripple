import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';
import type { Profile } from '@/types/database';

interface SearchResult {
  users: Profile[];
}

async function searchUsers(query: string, currentUserId: string): Promise<SearchResult> {
  if (!query.trim()) {
    return { users: [] };
  }

  const searchTerm = query.toLowerCase().trim();

  // Get blocked users to exclude
  const { data: blocks } = await (supabase
    .from('blocks') as any)
    .select('blocked_id')
    .eq('blocker_id', currentUserId);

  const blockedIds = blocks?.map((b: any) => b.blocked_id) || [];

  // Search by username or display name
  let usersQuery = (supabase
    .from('profiles') as any)
    .select('*')
    .or(`username.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%`)
    .neq('id', currentUserId)
    .limit(20);

  // Exclude blocked users
  if (blockedIds.length > 0) {
    usersQuery = usersQuery.not('id', 'in', `(${blockedIds.join(',')})`);
  }

  const { data: users, error } = await usersQuery;

  if (error) throw error;

  return { users: users || [] };
}

export function useSearch(query: string, userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.search.users(query),
    queryFn: () => searchUsers(query, userId!),
    enabled: !!userId && query.length >= 2,
    staleTime: 1000 * 60, // 1 minute
  });
}
