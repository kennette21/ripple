import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  SectionList,
  ScrollView,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Button, Input } from '@components/ui';
import { FollowButton } from '@/components/ui/FollowButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState } from '@components/common';
import { useAuth } from '@providers/AuthProvider';
import { useFollow } from '@/hooks/social/useFollow';
import {
  normalizePeopleSearch,
  useCommunityPeople,
  type CommunityPerson,
} from '@/hooks/social/useCommunityPeople';
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
import { getErrorMessage } from '@/lib/errors';

type Tab = 'contacts' | 'all';

type SectionItem = FriendRequestWithProfile | ContactMatch | Profile;
type SectionData = {
  title: string;
  data: SectionItem[];
  type: 'requests' | 'contacts' | 'friends';
};

function CommunityPersonRow({ person, userId }: { person: CommunityPerson; userId: string }) {
  const follow = useFollow();
  const name = person.display_name || person.username;

  return (
    <View style={styles.userRow}>
      <Pressable
        style={styles.personProfile}
        onPress={() => router.push(`/user/${person.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`Open ${name}'s profile`}
      >
        <Avatar uri={person.avatar_url} name={name} size="md" />
        <View style={styles.userInfo}>
          <Text style={styles.displayName} numberOfLines={1}>{name}</Text>
          <Text style={styles.username} numberOfLines={1}>@{person.username}</Text>
        </View>
      </Pressable>
      <FollowButton
        name={name}
        following={person.isFollowing}
        loading={follow.isPending}
        onPress={() => follow.mutate({
          followerId: userId,
          followingId: person.id,
          isFollowing: person.isFollowing,
        }, {
          onError: (error) => Alert.alert('Could not update follow', getErrorMessage(error, 'Please try again.')),
        })}
      />
    </View>
  );
}

function ContactsPrompt({
  icon, title, description, actionLabel, onAction, onSearch, onSettings, loading, privacyNote,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  onSearch?: () => void;
  onSettings?: () => void;
  loading?: boolean;
  privacyNote?: boolean;
}) {
  return (
    <ScrollView contentContainerStyle={styles.contactsPrompt}>
      <View style={styles.contactsIcon}>
        <Ionicons name={icon} size={26} color={colors.primary[500]} />
      </View>
      <Text style={styles.contactsTitle} accessibilityRole="header">{title}</Text>
      <Text style={styles.contactsDescription}>{description}</Text>
      <View style={styles.contactsActions}>
        <Button title={actionLabel} onPress={onAction} loading={loading} />
        {onSettings ? (
          <Button title="Open Settings" variant="ghost" onPress={onSettings} />
        ) : onSearch ? (
          <Button title="Use search instead" variant="ghost" onPress={onSearch} />
        ) : null}
        {privacyNote && (
          <Text style={styles.contactsNote}>
            Matching happens on your device.{'\n'}You choose who to connect with.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

export default function FriendsScreen() {
  const { user, profile } = useAuth();
  const userId = user?.id;
  const [activeTab, setActiveTab] = useState<Tab>('all');

  // --- Contacts tab state ---
  const { permission, isChecking, isRequesting, error: permissionError, requestPermission, checkPermission } = useRequestContactsPermission();
  const contactsQuery = useContactsOnRipple(
    userId,
    activeTab === 'contacts' && !!profile?.phone_number && permission?.status === 'granted'
  );
  const { data: contactMatches, isLoading: contactsLoading } = contactsQuery;
  const { data: friends, isLoading: friendsLoading } = useFriends(user?.id);
  const { data: incomingRequests, isLoading: requestsLoading } = useIncomingFriendRequests(user?.id);
  const sendRequest = useSendFriendRequest();
  const respondToRequest = useRespondToFriendRequest();
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  // --- All People tab state ---
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const normalizedQuery = normalizePeopleSearch(searchQuery);
  const isSearchPending = normalizedQuery !== debouncedQuery;
  const peopleQuery = useCommunityPeople(debouncedQuery, userId, activeTab === 'all');
  const allUsers = peopleQuery.data?.pages.flatMap((page) => page.people) ?? [];

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(normalizedQuery), 250);
    return () => clearTimeout(timeout);
  }, [normalizedQuery]);

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
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error, 'Failed to send friend request'));
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

  const renderSectionItem = ({ item }: { item: SectionItem }) => {
    if ('sender' in item) return renderRequest(item);
    if ('contactName' in item) return renderContact(item);
    return renderFriend(item);
  };

  // --- Contacts tab content ---
  const renderContactsTab = () => {
    if (!profile?.phone_number) {
      return (
        <ContactsPrompt
          icon="call-outline"
          title="Add your phone number"
          description="Add your number so friends can find you on Ripple."
          actionLabel="Add Phone Number"
          onAction={() => router.push('/(main)/(profile)/settings/phone-number')}
          onSearch={() => setActiveTab('all')}
        />
      );
    }

    if (isChecking) {
      return <View style={styles.loading}><ActivityIndicator color={colors.primary[500]} /></View>;
    }

    if (permissionError) {
      return (
        <ContactsPrompt
          icon="alert-circle-outline"
          title="Couldn't check contacts access"
          description={getErrorMessage(permissionError, 'Please try again.')}
          actionLabel="Try Again"
          onAction={() => void checkPermission()}
          onSearch={() => setActiveTab('all')}
        />
      );
    }

    if (permission?.status !== 'granted') {
      const declined = permission?.status === 'denied';
      return (
        <ContactsPrompt
          icon="people-outline"
          title={declined ? 'Contacts are off' : 'Find people you know'}
          description={declined
            ? 'You can still find people by name or username. Contacts can be enabled later in Settings.'
            : 'Look for friends who are already on Ripple using the contacts you choose to share.'}
          actionLabel={declined ? 'Search All People' : 'Continue with Contacts'}
          onAction={declined ? () => setActiveTab('all') : () => void requestPermission()}
          loading={isRequesting}
          onSearch={() => setActiveTab('all')}
          onSettings={declined ? () => {
            void Linking.openSettings().catch((error) => {
              Alert.alert('Could not open Settings', getErrorMessage(error, 'Please try again.'));
            });
          } : undefined}
          privacyNote={!declined}
        />
      );
    }

    if (contactsTabLoading) {
      return <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary[500]} /></View>;
    }

    if (contactsQuery.isError) {
      return (
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load contacts"
          description="Please try again."
          actionLabel="Try Again"
          onAction={() => void contactsQuery.refetch()}
        />
      );
    }

    if (sections.length === 0) {
      return (
        <ContactsPrompt
          icon="search-outline"
          title="No matches yet"
          description="None of the contacts you shared are on Ripple yet. You can still find people in the community."
          actionLabel="Search All People"
          onAction={() => setActiveTab('all')}
        />
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
    if (peopleQuery.isLoading || isSearchPending) {
      return (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      );
    }

    if (peopleQuery.isError && allUsers.length === 0) {
      return (
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load people"
          description="Please try again."
          actionLabel="Try Again"
          onAction={() => void peopleQuery.refetch()}
        />
      );
    }

    if (allUsers.length === 0) {
      return (
        <View style={styles.promptContainer}>
          <Ionicons name="people-outline" size={48} color={colors.gray[300]} />
          <Text style={styles.promptTitle}>{debouncedQuery ? 'No people found' : 'No other users yet'}</Text>
          <Text style={styles.promptText}>
            {debouncedQuery
              ? `No names or usernames match “${debouncedQuery}”.`
              : 'Invite your friends to join Ripple!'}
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        key={debouncedQuery}
        data={allUsers}
        renderItem={({ item }) => <CommunityPersonRow person={item} userId={userId!} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReached={() => {
          if (peopleQuery.hasNextPage && !peopleQuery.isFetching && !peopleQuery.isError) {
            void peopleQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={peopleQuery.isFetchingNextPage
          ? <ActivityIndicator style={styles.listFooter} color={colors.primary[500]} />
          : peopleQuery.isError
            ? <Button title="Try Again" variant="ghost" onPress={() => void peopleQuery.fetchNextPage()} />
            : undefined}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title="Find Friends" onBack={() => router.back()} />
      <SegmentedControl<Tab>
        variant="tabs"
        label="Find Friends sections"
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { value: 'contacts', label: 'Contacts', icon: 'call-outline' },
          { value: 'all', label: 'All People', icon: 'globe-outline' },
        ]}
      />

      {activeTab === 'all' && (
        <View style={styles.searchContainer}>
          <Input
            placeholder="Search by name or username"
            accessibilityLabel="Search All People"
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon="search-outline"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
            containerStyle={styles.searchInput}
          />
        </View>
      )}
      {activeTab === 'contacts' ? renderContactsTab() : renderAllPeopleTab()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  searchContainer: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  searchInput: {
    marginBottom: 0,
  },
  personProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  listFooter: {
    padding: spacing.md,
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
  contactsPrompt: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  contactsIcon: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  contactsTitle: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.gray[900],
  },
  contactsDescription: {
    fontSize: typography.fontSizes.sm,
    color: colors.gray[500],
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  contactsActions: {
    marginTop: 'auto',
    paddingTop: spacing.xl,
  },
  contactsNote: {
    fontSize: typography.fontSizes.xs,
    color: colors.gray[500],
    lineHeight: 18,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
