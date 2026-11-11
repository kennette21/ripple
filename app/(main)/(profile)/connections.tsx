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
import { Avatar } from '@/components/ui';
import { FollowButton } from '@/components/ui/FollowButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
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
          style={({ pressed }) => [styles.personLink, pressed && styles.personLinkPressed]}
          onPress={() => router.push(`/user/${item.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${item.displayName || item.username}'s profile`}
        >
          <Avatar uri={item.avatarUrl} name={item.displayName || item.username} size="lg" />
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
        <FollowButton
          name={item.displayName || item.username}
          following={item.isFollowing}
          followBack={kind === 'followers'}
          onPress={() => handleFollowToggle(item)}
          loading={isUpdating}
          style={styles.followAction}
        />
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
      <ScreenHeader title="Connections" onBack={() => router.back()} backLabel="Back to profile" />
      <SegmentedControl<ConnectionKind>
        variant="tabs"
        label="Connection type"
        value={kind}
        onChange={setKind}
        options={[
          { value: 'following', label: `Following · ${counts?.following ?? '…'}` },
          { value: 'followers', label: `Followers · ${counts?.followers ?? '…'}` },
        ]}
      />

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
              onRefresh={() => { void refetch(); }}
              tintColor={colors.primary[500]}
            />
          }
          ListEmptyComponent={emptyState}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.footer}>
                <ActivityIndicator color={colors.primary[500]} />
              </View>
            ) : undefined
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
  followAction: { marginLeft: spacing.sm },
  emptyList: {
    flexGrow: 1,
  },
  footer: {
    padding: spacing.lg,
  },
});
