import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Modal,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [showAvatarModal, setShowAvatarModal] = useState(false);

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

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.profileHeader}>
        <Pressable onPress={() => profile?.avatar_url && setShowAvatarModal(true)}>
          <Avatar
            uri={profile?.avatar_url}
            name={profile?.display_name || profile?.username}
            size="xxl"
          />
        </Pressable>
        <View style={styles.profileInfo}>
          <Text style={styles.displayName}>
            {profile?.display_name || profile?.username}
          </Text>
          <Text style={styles.username}>@{profile?.username}</Text>
          {profile?.bio && (
            <Text style={styles.bio}>{profile.bio}</Text>
          )}
          {!isOwnProfile && (
            <Button
              title={followStatus?.isFollowing ? 'Following' : 'Follow'}
              variant={followStatus?.isFollowing ? 'outline' : 'primary'}
              onPress={handleFollow}
              loading={followMutation.isPending}
              disabled={statusLoading}
              style={styles.followButton}
            />
          )}
        </View>
      </View>

      <View style={styles.divider} />
      <Text style={styles.postsTitle}>Posts</Text>
    </View>
  );

  const renderPost = useCallback(({ item }: { item: FeedPost }) => (
    <PostCard
      post={item}
      currentUserId={user?.id}
    />
  ), [user?.id]);

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

      {/* Avatar fullscreen modal */}
      <Modal
        visible={showAvatarModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAvatarModal(false)}
      >
        <Pressable
          style={styles.avatarModalOverlay}
          onPress={() => setShowAvatarModal(false)}
        >
          <View style={styles.avatarModalContent}>
            {profile?.avatar_url && (
              <Image
                source={{ uri: profile.avatar_url }}
                style={styles.avatarModalImage}
                contentFit="cover"
              />
            )}
          </View>
          <TouchableOpacity
            style={styles.avatarModalClose}
            onPress={() => setShowAvatarModal(false)}
          >
            <Ionicons name="close" size={28} color={colors.white} />
          </TouchableOpacity>
        </Pressable>
      </Modal>
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
    padding: spacing.lg,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.lg,
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
  followButton: {
    marginTop: spacing.sm,
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
  avatarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarModalContent: {
    width: SCREEN_WIDTH * 0.85,
    height: SCREEN_WIDTH * 0.85,
    borderRadius: SCREEN_WIDTH * 0.425,
    overflow: 'hidden',
  },
  avatarModalImage: {
    width: '100%',
    height: '100%',
  },
  avatarModalClose: {
    position: 'absolute',
    top: 60,
    right: 20,
    padding: spacing.sm,
  },
});
