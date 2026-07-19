import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';
import type { Profile } from '@/types/database';

export interface SearchUser extends Profile {
  isFollowing: boolean;
}

interface SearchResult {
  users: SearchUser[];
}

async function searchUsers(query: string, currentUserId: string): Promise<SearchResult> {
  if (!query.trim()) {
    return { users: [] };
  }

  const searchTerm = query.toLowerCase().trim();

  const blocksResult = await supabase
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', currentUserId);

  if (blocksResult.error) throw blocksResult.error;

  const blockedIds = blocksResult.data.map((block) => block.blocked_id);

  // Search by username or display name
  let usersQuery = supabase
    .from('profiles')
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
  if (!users?.length) return { users: [] };

  const followsResult = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', currentUserId)
    .in('following_id', users.map((user) => user.id));

  if (followsResult.error) throw followsResult.error;

  const followingIds = new Set(
    followsResult.data.map((follow) => follow.following_id)
  );

  return {
    users: users.map((user) => ({
      ...user,
      isFollowing: followingIds.has(user.id),
    })),
  };
}

export function useSearch(query: string, userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.search.users(query, userId || ''),
    queryFn: () => searchUsers(query, userId!),
    enabled: !!userId && query.length >= 2,
    staleTime: 1000 * 60, // 1 minute
  });
}
