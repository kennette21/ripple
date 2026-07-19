import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Avatar,
  Button,
  FullscreenImageViewer,
  PinchableImage,
} from '@components/ui';
import { useAuth } from '@providers/AuthProvider';
import { useProfile } from '@/hooks/profile/useProfile';
import { useUserPosts } from '@/hooks/profile/useUserPosts';
import { useCommentThreadController } from '@/hooks/comments/useCommentThreadController';
import { useFollowStatus, useFollow } from '@/hooks/social/useFollow';
import { getAvatarUrl } from '@/lib/supabase/storage';
import { useImageZoomActive } from '@/providers/ImageZoomProvider';
import { PostCard } from '@/components/post/PostCard';
import { EmptyState, LoadingScreen } from '@components/common';
import { colors, spacing, typography } from '@constants/theme';
import type { FeedPost } from '@/hooks/feed/useFeed';

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const isZoomActive = useImageZoomActive();
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const {
    activeCommentThreadId,
    handleCommentListScroll,
    listRef,
    scrollToCommentComposer,
    setActiveCommentThreadId,
  } = useCommentThreadController<FeedPost>();

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
  const avatarImageUri = getAvatarUrl(profile?.avatar_url);

  const handleFollow = () => {
    if (!user || !followStatus) return;
    followMutation.mutate({
      followerId: user.id,
      followingId: id!,
      isFollowing: followStatus.isFollowing,
    });
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.profileHeader}>
        {avatarImageUri ? (
          <PinchableImage
            uri={avatarImageUri}
            borderRadius={60}
            style={styles.profilePicture}
            onPress={() => setShowAvatarModal(true)}
            accessibilityLabel={`${profile?.display_name || profile?.username}'s profile picture`}
            testID="profile-picture"
          >
            <Avatar
              uri={profile?.avatar_url}
              name={profile?.display_name || profile?.username}
              size="xxl"
            />
          </PinchableImage>
        ) : (
          <Avatar
            name={profile?.display_name || profile?.username}
            size="xxl"
          />
        )}
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
      isCommentThreadActive={activeCommentThreadId === item.id}
      onCommentComposerActivated={scrollToCommentComposer}
      onCommentThreadActiveChange={setActiveCommentThreadId}
    />
  ), [
    activeCommentThreadId,
    scrollToCommentComposer,
    setActiveCommentThreadId,
    user?.id,
  ]);

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

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={listRef}
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={header}
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
          onScroll={handleCommentListScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          scrollEnabled={!isZoomActive}
        />
      </KeyboardAvoidingView>

      <FullscreenImageViewer
        images={avatarImageUri ? [{ uri: avatarImageUri }] : []}
        imageIndex={0}
        visible={showAvatarModal && !!avatarImageUri}
        onRequestClose={() => setShowAvatarModal(false)}
        closeAccessibilityLabel="Close profile picture"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    flex: 1,
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
  profilePicture: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
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
});
