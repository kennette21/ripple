import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Button } from '@components/ui';
import { useAuth } from '@providers/AuthProvider';
import { useProfile } from '@/hooks/profile/useProfile';
import { useUserPosts } from '@/hooks/profile/useUserPosts';
import { useFollowStatus, useFollow } from '@/hooks/social/useFollow';
import { PostCard } from '@/components/post/PostCard';
import { EmptyState, LoadingScreen } from '@components/common';
import { colors, spacing, typography } from '@constants/theme';
import type { FeedPost } from '@/hooks/feed/useFeed';

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const { data: profile, isLoading: profileLoading } = useProfile(id);
  const { data: followStatus, isLoading: statusLoading } = useFollowStatus(user?.id, id);
  const {
    data: postsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: postsLoading,
  } = useUserPosts(id, user?.id);

  const followMutation = useFollow();

  const posts = postsData?.pages.flatMap((page) => page.posts) ?? [];
  const isOwnProfile = user?.id === id;

  const handleFollow = () => {
    if (!user || !followStatus) return;
    followMutation.mutate({
      followerId: user.id,
      followingId: id!,
      isFollowing: followStatus.isFollowing,
    });
  };

  const handleRipple = useCallback((post: FeedPost) => {
    Alert.alert(
      'Coming Soon',
      'Ripple messaging will let you connect directly with this person. Stay tuned!'
    );
  }, []);

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.avatarRow}>
        <Avatar
          uri={profile?.avatar_url}
          name={profile?.display_name || profile?.username}
          size="xl"
        />
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{posts.length}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <Pressable style={styles.statItem}>
            <Text style={styles.statNumber}>{followStatus?.followersCount || 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </Pressable>
          <Pressable style={styles.statItem}>
            <Text style={styles.statNumber}>{followStatus?.followingCount || 0}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.info}>
        <Text style={styles.displayName}>
          {profile?.display_name || profile?.username}
        </Text>
        <Text style={styles.username}>@{profile?.username}</Text>
        {profile?.bio && (
          <Text style={styles.bio}>{profile.bio}</Text>
        )}
      </View>

      {!isOwnProfile && (
        <View style={styles.actions}>
          <Button
            title={followStatus?.isFollowing ? 'Following' : 'Follow'}
            variant={followStatus?.isFollowing ? 'outline' : 'primary'}
            onPress={handleFollow}
            loading={followMutation.isPending}
            disabled={statusLoading}
            style={styles.followButton}
          />
        </View>
      )}

      {isOwnProfile && (
        <View style={styles.actions}>
          <Button
            title="Edit Profile"
            variant="outline"
            onPress={() => router.push('/(main)/(profile)/settings')}
            style={styles.followButton}
          />
        </View>
      )}

      <View style={styles.divider} />
      <Text style={styles.postsTitle}>Posts</Text>
    </View>
  );

  const renderPost = useCallback(({ item }: { item: FeedPost }) => (
    <PostCard
      post={item}
      currentUserId={user?.id}
      onRipple={() => handleRipple(item)}
    />
  ), [user?.id, handleRipple]);

  const renderFooter = () => {
    if (isFetchingNextPage) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator color={colors.primary[500]} />
        </View>
      );
    }
    return null;
  };

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  if (profileLoading) {
    return <LoadingScreen />;
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="person-outline"
          title="User not found"
          description="This user doesn't exist or has been removed"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navbar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.gray[900]} />
        </Pressable>
        <Text style={styles.navTitle}>{profile.username}</Text>
        <View style={styles.placeholder} />
      </View>

      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          !postsLoading ? (
            <EmptyState
              icon="document-text-outline"
              title="No posts yet"
              description={isOwnProfile
                ? "You haven't posted anything yet. Share your first post!"
                : "This user hasn't posted anything yet."
              }
            />
          ) : null
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  backButton: {
    padding: spacing.xs,
  },
  navTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  placeholder: {
    width: 32,
  },
  header: {
    padding: spacing.md,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginLeft: spacing.md,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.gray[900],
  },
  statLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.gray[500],
  },
  info: {
    marginTop: spacing.md,
  },
  displayName: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.gray[900],
  },
  username: {
    fontSize: typography.fontSizes.md,
    color: colors.gray[500],
  },
  bio: {
    fontSize: typography.fontSizes.md,
    color: colors.gray[700],
    marginTop: spacing.xs,
    lineHeight: 22,
  },
  actions: {
    marginTop: spacing.md,
  },
  followButton: {
    width: '100%',
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray[100],
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  postsTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  footer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
});
