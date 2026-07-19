import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';
import type { Profile, FriendRequest } from '@/types/database';

export interface FriendRequestWithProfile extends FriendRequest {
  sender: Profile;
  receiver: Profile;
}

// Get list of friends (accepted friend requests in either direction)
async function fetchFriends(userId: string): Promise<Profile[]> {
  // Get requests where user is sender and accepted
  const { data: sent, error: sentError } = await supabase
    .from('friend_requests')
    .select('receiver:profiles!friend_requests_receiver_id_fkey(*)')
    .eq('sender_id', userId)
    .eq('status', 'accepted');

  if (sentError) throw sentError;

  // Get requests where user is receiver and accepted
  const { data: received, error: receivedError } = await supabase
    .from('friend_requests')
    .select('sender:profiles!friend_requests_sender_id_fkey(*)')
    .eq('receiver_id', userId)
    .eq('status', 'accepted');

  if (receivedError) throw receivedError;

  const friends: Profile[] = [
    ...(sent || []).map((r) => r.receiver),
    ...(received || []).map((r) => r.sender),
  ];

  return friends;
}

// Get pending friend requests received by user
async function fetchIncomingRequests(userId: string): Promise<FriendRequestWithProfile[]> {
  const { data, error } = await supabase
    .from('friend_requests')
    .select(`
      *,
      sender:profiles!friend_requests_sender_id_fkey(*),
      receiver:profiles!friend_requests_receiver_id_fkey(*)
    `)
    .eq('receiver_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Send a friend request
async function sendFriendRequest(senderId: string, receiverId: string) {
  // Check if a request already exists in either direction
  const { data: existing, error: existingError } = await supabase
    .from('friend_requests')
    .select('id, status')
    .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    if (existing.status === 'accepted') throw new Error('Already friends');
    if (existing.status === 'pending') throw new Error('Request already pending');
    // Replace a declined request so either person can initiate a new one.
    if (existing.status === 'declined') {
      const { error } = await supabase
        .from('friend_requests')
        .delete()
        .eq('id', existing.id);
      if (error) throw error;
    }
  }

  const { error } = await supabase
    .from('friend_requests')
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      status: 'pending',
    });

  if (error) throw error;
}

// Respond to a friend request
async function respondToRequest(requestId: string, status: 'accepted' | 'declined') {
  const { error } = await supabase
    .from('friend_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', requestId);

  if (error) throw error;
}

// Remove a friendship
async function removeFriend(userId: string, friendId: string) {
  const { error } = await supabase
    .from('friend_requests')
    .delete()
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`)
    .eq('status', 'accepted');

  if (error) throw error;
}

// Check friendship status between two users
async function getFriendshipStatus(userId: string, targetId: string) {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('id, status, sender_id, receiver_id')
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${userId})`)
    .maybeSingle();

  if (error) throw error;

  if (!data) return { status: 'none' as const, requestId: null, direction: null };

  return {
    status: data.status as 'pending' | 'accepted' | 'declined',
    requestId: data.id as string,
    direction: data.sender_id === userId ? ('sent' as const) : ('received' as const),
  };
}

export function useFriends(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.friends.list(userId || ''),
    queryFn: () => fetchFriends(userId!),
    enabled: !!userId,
  });
}

export function useIncomingFriendRequests(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.friends.requests(userId || ''),
    queryFn: () => fetchIncomingRequests(userId!),
    enabled: !!userId,
  });
}

export function useFriendshipStatus(userId: string | undefined, targetId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.friends.status(userId || '', targetId || ''),
    queryFn: () => getFriendshipStatus(userId!, targetId!),
    enabled: !!userId && !!targetId && userId !== targetId,
  });
}

export function useSendFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ senderId, receiverId }: { senderId: string; receiverId: string }) =>
      sendFriendRequest(senderId, receiverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.friends.all });
    },
  });
}

export function useRespondToFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, status }: { requestId: string; status: 'accepted' | 'declined' }) =>
      respondToRequest(requestId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.friends.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.all });
    },
  });
}

export function useRemoveFriend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, friendId }: { userId: string; friendId: string }) =>
      removeFriend(userId, friendId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.friends.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.all });
    },
  });
}
