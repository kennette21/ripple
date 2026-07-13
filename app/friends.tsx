import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  SectionList,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, Button } from '@components/ui';
import { useAuth } from '@providers/AuthProvider';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';
import { useContactsOnRipple, useRequestContactsPermission, type ContactMatch } from '@/hooks/social/useContacts';
import {
  useFriends,
  useIncomingFriendRequests,
  useSendFriendRequest,
  useRespondToFriendRequest,
  type FriendRequestWithProfile,
} from '@/hooks/social/useFriends';
import { colors, spacing, typography, borderRadius } from '@constants/theme';
import type { Profile } from '@/types/database';

type Tab = 'contacts' | 'all';

type SectionData = {
  title: string;
  data: any[];
  type: 'requests' | 'contacts' | 'friends';
};

export default function FriendsScreen() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('all');

  // --- Contacts tab state ---
  const { hasPermission, requestPermission, checkPermission } = useRequestContactsPermission();
  const { data: contactMatches, isLoading: contactsLoading, refetch: refetchContacts } = useContactsOnRipple(user?.id);
  const { data: friends, isLoading: friendsLoading } = useFriends(user?.id);
  const { data: incomingRequests, isLoading: requestsLoading } = useIncomingFriendRequests(user?.id);
  const sendRequest = useSendFriendRequest();
  const respondToRequest = useRespondToFriendRequest();
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  // --- All People tab state ---
  const [allUsers, setAllUsers] = useState<(Profile & { isFollowing: boolean })[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [allUsersLoading, setAllUsersLoading] = useState(false);

  useEffect(() => {
    checkPermission();
  }, []);

  useEffect(() => {
    if (activeTab === 'all') loadAllUsers();
  }, [activeTab, user?.id]);

  const loadAllUsers = async () => {
    if (!user?.id) return;
    setAllUsersLoading(true);
    try {
      const [{ data: profiles }, { data: follows }] = await Promise.all([
        (supabase.from('profiles') as any)
          .select('*')
          .neq('id', user.id)
          .order('created_at', { ascending: false }),
        (supabase.from('follows') as any)
          .select('following_id')
          .eq('follower_id', user.id),
      ]);

      const followingSet = new Set<string>(follows?.map((f: any) => f.following_id) || []);
      setFollowingIds(followingSet);
      setAllUsers(
        (profiles || []).map((p: Profile) => ({ ...p, isFollowing: followingSet.has(p.id) }))
      );
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setAllUsersLoading(false);
    }
  };

  const handleToggleFollow = async (targetUserId: string) => {
    if (!user?.id) return;
    const isCurrentlyFollowing = followingIds.has(targetUserId);

    // Optimistic update
    setFollowingIds((prev) => {
      const next = new Set(prev);
      isCurrentlyFollowing ? next.delete(targetUserId) : next.add(targetUserId);
      return next;
    });
    setAllUsers((prev) =>
      prev.map((u) => u.id === targetUserId ? { ...u, isFollowing: !isCurrentlyFollowing } : u)
    );

    try {
      if (isCurrentlyFollowing) {
        await (supabase.from('follows') as any)
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId);
      } else {
        await (supabase.from('follows') as any)
          .insert({ follower_id: user.id, following_id: targetUserId });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.all });
    } catch {
      loadAllUsers();
    }
  };

  // --- Contacts tab helpers ---
  const friendIds = new Set(friends?.map((f) => f.id) || []);
  const pendingReceiverIds = new Set(incomingRequests?.map((r) => r.sender.id) || []);
  const contactsToShow = (contactMatches || []).filter(
    (c) => !friendIds.has(c.id) && !pendingReceiverIds.has(c.id)
  );

  const handleSendRequest = async (receiverId: string) => {
    if (!user?.id) return;
    try {
      await sendRequest.mutateAsync({ senderId: user.id, receiverId });
      setSentRequests((prev) => new Set(prev).add(receiverId));
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send friend request');
    }
  };

  const handleAcceptRequest = (requestId: string) => {
    respondToRequest.mutate({ requestId, status: 'accepted' });
  };

  const handleDeclineRequest = (requestId: string) => {
    respondToRequest.mutate({ requestId, status: 'declined' });
  };

  // --- Contacts tab sections ---
  const sections: SectionData[] = [];
  if (incomingRequests && incomingRequests.length > 0) {
    sections.push({ title: 'Friend Requests', data: incomingRequests, type: 'requests' });
  }
  if (contactsToShow.length > 0) {
    sections.push({ title: 'Your Contacts on Ripple', data: contactsToShow, type: 'contacts' });
  }
  if (friends && friends.length > 0) {
    sections.push({ title: 'Friends', data: friends, type: 'friends' });
  }

  const contactsTabLoading = contactsLoading || friendsLoading || requestsLoading;

  // --- Renderers ---
  const renderRequest = (item: FriendRequestWithProfile) => (
    <View style={styles.userRow}>
      <Avatar uri={item.sender.avatar_url} name={item.sender.display_name || item.sender.username} size="md" />
      <View style={styles.userInfo}>
        <Text style={styles.displayName}>{item.sender.display_name || item.sender.username}</Text>
        <Text style={styles.username}>@{item.sender.username}</Text>
      </View>
      <View style={styles.requestActions}>
        <Pressable style={styles.acceptButton} onPress={() => handleAcceptRequest(item.id)}>
          <Ionicons name="checkmark" size={18} color={colors.white} />
        </Pressable>
        <Pressable style={styles.declineButton} onPress={() => handleDeclineRequest(item.id)}>
          <Ionicons name="close" size={18} color={colors.gray[600]} />
        </Pressable>
      </View>
    </View>
  );

  const renderContact = (item: ContactMatch) => {
    const isSent = sentRequests.has(item.id);
    return (
      <View style={styles.userRow}>
        <Avatar uri={item.avatar_url} name={item.display_name || item.username} size="md" />
        <View style={styles.userInfo}>
          <Text style={styles.displayName}>{item.display_name || item.username}</Text>
          <Text style={styles.username}>@{item.username}</Text>
          <Text style={styles.contactName}>{item.contactName} in your contacts</Text>
        </View>
        <Pressable
          style={[styles.addButton, isSent && styles.sentButton]}
          onPress={() => !isSent && handleSendRequest(item.id)}
          disabled={isSent}
        >
          <Text style={[styles.addButtonText, isSent && styles.sentButtonText]}>
            {isSent ? 'Sent' : 'Add Friend'}
          </Text>
        </Pressable>
      </View>
    );
  };

  const renderFriend = (item: Profile) => (
    <Pressable style={styles.userRow} onPress={() => router.push(`/user/${item.id}`)}>
      <Avatar uri={item.avatar_url} name={item.display_name || item.username} size="md" />
      <View style={styles.userInfo}>
        <Text style={styles.displayName}>{item.display_name || item.username}</Text>
        <Text style={styles.username}>@{item.username}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
    </Pressable>
  );

  const renderSectionItem = ({ item, section }: { item: any; section: SectionData }) => {
    switch (section.type) {
      case 'requests': return renderRequest(item);
      case 'contacts': return renderContact(item);
      case 'friends': return renderFriend(item);
      default: return null;
    }
  };

  const renderAllUser = ({ item }: { item: Profile & { isFollowing: boolean } }) => {
    const isFollowing = followingIds.has(item.id);
    return (
      <View style={styles.userRow}>
        <Avatar uri={item.avatar_url} name={item.display_name || item.username} size="md" />
        <View style={styles.userInfo}>
          <Text style={styles.displayName}>{item.display_name || item.username}</Text>
          <Text style={styles.username}>@{item.username}</Text>
        </View>
        <Pressable
          style={[styles.addButton, isFollowing && styles.sentButton]}
          onPress={() => handleToggleFollow(item.id)}
        >
          <Text style={[styles.addButtonText, isFollowing && styles.sentButtonText]}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </Pressable>
      </View>
    );
  };

  // --- Contacts tab content ---
  const renderContactsTab = () => {
    if (contactsTabLoading) {
      return (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      );
    }

    if (!profile?.phone_number) {
      return (
        <View style={styles.promptContainer}>
          <Ionicons name="call-outline" size={48} color={colors.gray[300]} />
          <Text style={styles.promptTitle}>Add your phone number</Text>
          <Text style={styles.promptText}>
            Add your phone number so your friends can find you on Ripple.
          </Text>
          <Button
            title="Add Phone Number"
            onPress={() => {
              router.back();
              setTimeout(() => router.push('/(main)/(profile)/settings/phone-number' as any), 100);
            }}
            style={styles.promptButton}
          />
        </View>
      );
    }

    if (hasPermission === false) {
      return (
        <View style={styles.promptContainer}>
          <Ionicons name="people-outline" size={48} color={colors.gray[300]} />
          <Text style={styles.promptTitle}>Find your friends</Text>
          <Text style={styles.promptText}>
            Allow access to your contacts to see which of your friends are already on Ripple.
          </Text>
          <Button
            title="Allow Contacts Access"
            onPress={async () => {
              const granted = await requestPermission();
              if (granted) refetchContacts();
            }}
            style={styles.promptButton}
          />
        </View>
      );
    }

    if (sections.length === 0) {
      return (
        <View style={styles.promptContainer}>
          <Ionicons name="search-outline" size={48} color={colors.gray[300]} />
          <Text style={styles.promptTitle}>No contacts found on Ripple</Text>
          <Text style={styles.promptText}>
            Invite your friends to join Ripple so you can connect!
          </Text>
        </View>
      );
    }

    return (
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderSectionItem}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.type === 'requests' && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{section.data.length}</Text>
              </View>
            )}
          </View>
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
      />
    );
  };

  // --- All People tab content ---
  const renderAllPeopleTab = () => {
    if (allUsersLoading) {
      return (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      );
    }

    if (allUsers.length === 0) {
      return (
        <View style={styles.promptContainer}>
          <Ionicons name="people-outline" size={48} color={colors.gray[300]} />
          <Text style={styles.promptTitle}>No other users yet</Text>
          <Text style={styles.promptText}>Invite your friends to join Ripple!</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={allUsers}
        renderItem={renderAllUser}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.gray[600]} />
        </TouchableOpacity>
        <Text style={styles.title}>Find Friends</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tab toggle */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === 'contacts' && styles.tabActive]}
          onPress={() => setActiveTab('contacts')}
        >
          <Ionicons
            name="call-outline"
            size={16}
            color={activeTab === 'contacts' ? colors.primary[500] : colors.gray[500]}
          />
          <Text style={[styles.tabText, activeTab === 'contacts' && styles.tabTextActive]}>
            Contacts
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'all' && styles.tabActive]}
          onPress={() => setActiveTab('all')}
        >
          <Ionicons
            name="globe-outline"
            size={16}
            color={activeTab === 'all' ? colors.primary[500] : colors.gray[500]}
          />
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
            All People
          </Text>
        </Pressable>
      </View>

      {activeTab === 'contacts' ? renderContactsTab() : renderAllPeopleTab()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  title: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary[500],
  },
  tabText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.gray[500],
  },
  tabTextActive: {
    color: colors.primary[500],
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.white,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  badge: {
    backgroundColor: colors.error.main,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  badgeText: {
    color: colors.white,
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  userInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  displayName: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  username: {
    fontSize: typography.fontSizes.sm,
    color: colors.gray[500],
  },
  contactName: {
    fontSize: typography.fontSizes.xs,
    color: colors.primary[500],
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  acceptButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[500],
  },
  sentButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray[300],
  },
  addButtonText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.white,
  },
  sentButtonText: {
    color: colors.gray[500],
  },
  promptContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  promptTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[700],
    marginTop: spacing.md,
  },
  promptText: {
    fontSize: typography.fontSizes.md,
    color: colors.gray[500],
    textAlign: 'center',
    lineHeight: 22,
  },
  promptButton: {
    marginTop: spacing.md,
    minWidth: 200,
  },
});
