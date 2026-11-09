import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';
import type { Profile } from '@/types/database';

const PAGE_SIZE = 30;

export type CommunityPerson = Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> & {
  isFollowing: boolean;
};

export function normalizePeopleSearch(query: string) {
  return query.trim().replace(/^@/, '').trim();
}

function searchFilter(query: string) {
  // Escape LIKE wildcards, then quote the PostgREST value so punctuation in
  // a name cannot become another filter expression.
  const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
  const value = `"${pattern.replace(/[\\"]/g, '\\$&')}"`;
  return `username.ilike.${value},display_name.ilike.${value}`;
}

async function fetchPeople(query: string, userId: string, offset: number, signal: AbortSignal) {
  const { data: blocks, error: blocksError } = await supabase
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', userId)
    .abortSignal(signal);
  if (blocksError) throw blocksError;

  let request = supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .neq('id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + PAGE_SIZE);

  if (query) request = request.or(searchFilter(query));
  const blockedIds = blocks.map((block) => block.blocked_id);
  if (blockedIds.length > 0) {
    request = request.not('id', 'in', `(${blockedIds.join(',')})`);
  }

  const { data: profiles, error } = await request.abortSignal(signal);
  if (error) throw error;

  const page = profiles.slice(0, PAGE_SIZE);
  if (page.length === 0) return { people: [], nextOffset: undefined };

  const { data: follows, error: followsError } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId)
    .in('following_id', page.map((profile) => profile.id))
    .abortSignal(signal);
  if (followsError) throw followsError;

  const followingIds = new Set(follows.map((follow) => follow.following_id));
  return {
    people: page.map((profile): CommunityPerson => ({
      ...profile,
      isFollowing: followingIds.has(profile.id),
    })),
    nextOffset: profiles.length > PAGE_SIZE ? offset + PAGE_SIZE : undefined,
  };
}

export function useCommunityPeople(query: string, userId: string | undefined, enabled = true) {
  const search = normalizePeopleSearch(query);
  return useInfiniteQuery({
    queryKey: queryKeys.search.community(search, userId ?? ''),
    queryFn: ({ pageParam, signal }) => fetchPeople(search, userId!, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (page) => page.nextOffset,
    enabled: !!userId && enabled,
  });
}
