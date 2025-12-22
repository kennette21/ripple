import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Button } from '@components/ui';
import { EmptyState } from '@components/common';
import { PostCard } from '@/components/post/PostCard';
import { useAuth } from '@providers/AuthProvider';
import { useSignOut } from '@hooks/auth';
import { useUserPosts } from '@/hooks/profile/useUserPosts';
import { useFollowStatus } from '@/hooks/social/useFollow';
import { colors, spacing, typography } from '@constants/theme';
import type { FeedPost } from '@/hooks/feed/useFeed';

export default function ProfileScreen() {
  const { profile, user } = useAuth();
  const { signOut, isLoading: signOutLoading } = useSignOut();

  const { data: followStatus } = useFollowStatus(user?.id, user?.id);
  const {
    data: postsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: postsLoading,
  } = useUserPosts(user?.id, user?.id);

  const posts = postsData?.pages.flatMap((page) => page.posts) ?? [];

  const handleRipple = useCallback((post: FeedPost) => {
    Alert.alert(
      'Coming Soon',
      'Ripple messaging will let you connect directly with this person. Stay tuned!'
    );
  }, []);

  const renderHeader = () => (
    <>
      <View style={styles.profileSection}>
        <View style={styles.avatarRow}>
          <Avatar
            uri={profile?.avatar_url}
            name={profile?.display_name}
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
          <Text style={styles.displayName}>{profile?.display_name}</Text>
          <Text style={styles.username}>@{profile?.username}</Text>
          {profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
        </View>

        <View style={styles.actions}>
          <Button
            title="Edit Profile"
            variant="outline"
            onPress={() => router.push('/(main)/(profile)/settings')}
            style={styles.editButton}
          />
          <Button
            title="Sign Out"
            variant="ghost"
            onPress={signOut}
            loading={signOutLoading}
            style={styles.signOutButton}
          />
        </View>
      </View>

      <View style={styles.divider} />
      <Text style={styles.postsTitle}>Posts</Text>
    </>
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <TouchableOpacity onPress={() => router.push('/(main)/(profile)/settings')}>
          <Ionicons name="settings-outline" size={24} color={colors.gray[600]} />
        </TouchableOpacity>
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
              description="Share your first post!"
            />
          ) : (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.primary[500]} />
            </View>
          )
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
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
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.gray[900],
  },
  listContent: {
    flexGrow: 1,
  },
  profileSection: {
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
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  editButton: {
    flex: 1,
  },
  signOutButton: {
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray[100],
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
  },
  postsTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
    padding: spacing.md,
  },
  footer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
});
