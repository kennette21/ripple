import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';

const CONNECTIONS_PAGE_SIZE = 25;

export type ConnectionKind = 'following' | 'followers';

export interface ConnectionCounts {
  followers: number;
  following: number;
}

export interface ConnectionPerson {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isFollowing: boolean;
}

interface ConnectionProfile {
  avatar_url: string | null;
  display_name: string;
  id: string;
  username: string;
}

interface ConnectionRow {
  profile: ConnectionProfile | null;
}

interface ConnectionPage {
  people: ConnectionPerson[];
  nextOffset?: number;
}

async function fetchConnectionCounts(userId: string): Promise<ConnectionCounts> {
  const [followersResult, followingResult] = await Promise.all([
    supabase
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', userId),
    supabase
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('follower_id', userId),
  ]);

  if (followersResult.error) throw followersResult.error;
  if (followingResult.error) throw followingResult.error;

  return {
    followers: followersResult.count ?? 0,
    following: followingResult.count ?? 0,
  };
}

async function fetchConnections(
  userId: string,
  kind: ConnectionKind,
  offset: number
): Promise<ConnectionPage> {
  const profileJoin = kind === 'following'
    ? 'profile:profiles!follows_following_id_fkey(id, username, display_name, avatar_url)'
    : 'profile:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url)';
  const ownerColumn = kind === 'following' ? 'follower_id' : 'following_id';

  const { data, error } = await supabase
    .from('follows')
    .select(profileJoin)
    .eq(ownerColumn, userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + CONNECTIONS_PAGE_SIZE - 1);

  if (error) throw error;

  const rows = (data ?? []) as unknown as ConnectionRow[];
  const profiles = rows.flatMap((row) => row.profile ? [row.profile] : []);
  let followingIds = new Set<string>();

  if (kind === 'followers' && profiles.length > 0) {
    const followingResult = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId)
      .in('following_id', profiles.map((profile) => profile.id));

    if (followingResult.error) throw followingResult.error;
    followingIds = new Set(
      (followingResult.data ?? []).map((follow) => follow.following_id)
    );
  }

  return {
    people: profiles.map((profile) => ({
      id: profile.id,
      username: profile.username,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      isFollowing:
        kind === 'following' || followingIds.has(profile.id),
    })),
    nextOffset:
      rows.length === CONNECTIONS_PAGE_SIZE
        ? offset + rows.length
        : undefined,
  };
}

export function useConnectionCounts(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.social.connectionCounts(userId ?? ''),
    queryFn: () => fetchConnectionCounts(userId!),
    enabled: !!userId,
  });
}

export function useConnections(
  userId: string | undefined,
  kind: ConnectionKind
) {
  return useInfiniteQuery({
    queryKey: kind === 'following'
      ? queryKeys.social.following(userId ?? '')
      : queryKeys.social.followers(userId ?? ''),
    queryFn: ({ pageParam }) => fetchConnections(userId!, kind, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    enabled: !!userId,
  });
}
