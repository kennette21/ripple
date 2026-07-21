import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/ui';
import { EmptyState } from '@/components/common';
import { useAuth } from '@/providers/AuthProvider';
import {
  useConnectionCounts,
  useConnections,
  useFollow,
  type ConnectionKind,
  type ConnectionPerson,
} from '@/hooks/social';
import { getErrorMessage } from '@/lib/errors';
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from '@/constants/theme';

export default function ConnectionsScreen() {
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { user } = useAuth();
  const [kind, setKind] = useState<ConnectionKind>(
    tab === 'followers' ? 'followers' : 'following'
  );
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isLoading,
    isRefetching,
    refetch,
  } = useConnections(user?.id, kind);
  const { data: counts } = useConnectionCounts(user?.id);
  const followMutation = useFollow();

  const people = useMemo(
    () => data?.pages.flatMap((page) => page.people) ?? [],
    [data]
  );

  const performFollowToggle = useCallback(async (
    person: ConnectionPerson
  ) => {
    if (!user) return;

    try {
      await followMutation.mutateAsync({
        followerId: user.id,
        followingId: person.id,
        isFollowing: person.isFollowing,
      });
    } catch (error) {
      Alert.alert(
        'Could not update follow',
        getErrorMessage(error, 'Please try again.')
      );
    }
  }, [followMutation, user]);

  const handleFollowToggle = useCallback((person: ConnectionPerson) => {
    if (!person.isFollowing) {
      performFollowToggle(person);
      return;
    }

    Alert.alert(
      `Unfollow ${person.displayName}?`,
      'Their posts will no longer appear in your feed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfollow',
          style: 'destructive',
          onPress: () => performFollowToggle(person),
        },
      ]
    );
  }, [performFollowToggle]);

  const renderPerson = useCallback(({ item }: {
    item: ConnectionPerson;
  }) => {
    const isUpdating =
      followMutation.isPending &&
      followMutation.variables?.followingId === item.id;

    return (
      <View style={styles.personRow}>
        <Pressable
          style={({ pressed }) => [
            styles.personLink,
            pressed && styles.personLinkPressed,
          ]}
          onPress={() => router.push(`/user/${item.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${item.displayName}'s profile`}
        >
          <Avatar
            uri={item.avatarUrl}
            name={item.displayName || item.username}
            size="lg"
          />
          <View style={styles.personInfo}>
            <Text style={styles.personName} numberOfLines={1}>
              {item.displayName || item.username}
            </Text>
            <Text style={styles.personUsername} numberOfLines={1}>
              @{item.username}
              {kind === 'followers' ? ' · follows you' : ''}
            </Text>
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.followButton,
            !item.isFollowing && styles.followButtonPrimary,
            pressed && styles.followButtonPressed,
            isUpdating && styles.followButtonDisabled,
          ]}
          onPress={() => handleFollowToggle(item)}
          disabled={isUpdating}
          accessibilityRole="button"
          accessibilityLabel={
            item.isFollowing
              ? `Unfollow ${item.displayName}`
              : `Follow ${item.displayName} back`
          }
        >
          {isUpdating ? (
            <ActivityIndicator
              size="small"
              color={item.isFollowing ? colors.primary[500] : colors.white}
            />
          ) : (
            <Text
              style={[
                styles.followButtonText,
                !item.isFollowing && styles.followButtonTextPrimary,
              ]}
            >
              {item.isFollowing ? 'Following' : 'Follow back'}
            </Text>
          )}
        </Pressable>
      </View>
    );
  }, [
    followMutation.isPending,
    followMutation.variables,
    handleFollowToggle,
    kind,
    router,
  ]);

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const emptyState = isError ? (
    <EmptyState
      icon="cloud-offline-outline"
      title="Could not load connections"
      description="Check your connection and try again."
      actionLabel="Try Again"
      onAction={refetch}
    />
  ) : (
    <EmptyState
      icon="people-outline"
      title={
        kind === 'following'
          ? 'Not following anyone yet'
          : 'No followers yet'
      }
      description={
        kind === 'following'
          ? 'People you follow will appear here.'
          : 'People who follow you will appear here.'
      }
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to profile"
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color={colors.gray[900]} />
        </Pressable>
        <Text style={styles.title}>Connections</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabs} accessibilityRole="tablist">
        <Pressable
          style={[
            styles.tab,
            kind === 'following' && styles.activeTab,
          ]}
          onPress={() => setKind('following')}
          accessibilityRole="tab"
          accessibilityState={{ selected: kind === 'following' }}
        >
          <Text
            style={[
              styles.tabText,
              kind === 'following' && styles.activeTabText,
            ]}
          >
            Following · {counts?.following ?? '…'}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.tab,
            kind === 'followers' && styles.activeTab,
          ]}
          onPress={() => setKind('followers')}
          accessibilityRole="tab"
          accessibilityState={{ selected: kind === 'followers' }}
        >
          <Text
            style={[
              styles.tabText,
              kind === 'followers' && styles.activeTabText,
            ]}
          >
            Followers · {counts?.followers ?? '…'}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.listDescription}>
        {kind === 'following'
          ? 'People whose posts you receive'
          : 'People who chose to follow you'}
      </Text>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary[500]} />
        </View>
      ) : (
        <FlatList
          data={people}
          renderItem={renderPerson}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isFetchingNextPage}
              onRefresh={refetch}
              tintColor={colors.primary[500]}
            />
          }
          ListEmptyComponent={emptyState}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.footer}>
                <ActivityIndicator color={colors.primary[500]} />
              </View>
            ) : null
          }
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          contentContainerStyle={
            people.length === 0 ? styles.emptyList : undefined
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  backButton: {
    width: 72,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  headerSpacer: {
    width: 72,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.xs,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.gray[100],
  },
  tab: {
    minHeight: 40,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
  },
  activeTab: {
    backgroundColor: colors.white,
  },
  tabText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[500],
  },
  activeTabText: {
    color: colors.gray[900],
  },
  listDescription: {
    minHeight: 38,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    fontSize: typography.fontSizes.xs,
    color: colors.gray[500],
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  personLink: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  personLinkPressed: {
    opacity: 0.65,
  },
  personInfo: {
    minWidth: 0,
    flex: 1,
  },
  personName: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  personUsername: {
    marginTop: 2,
    fontSize: typography.fontSizes.xs,
    color: colors.gray[500],
  },
  followButton: {
    minWidth: 88,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
  },
  followButtonPrimary: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[500],
  },
  followButtonPressed: {
    opacity: 0.7,
  },
  followButtonDisabled: {
    opacity: 0.55,
  },
  followButtonText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  followButtonTextPrimary: {
    color: colors.white,
  },
  emptyList: {
    flexGrow: 1,
  },
  footer: {
    padding: spacing.lg,
  },
});
