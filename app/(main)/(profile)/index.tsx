import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Avatar,
  FullscreenImageViewer,
  PinchableImage,
} from '@components/ui';
import { EmptyState } from '@components/common';
import { PostCard } from '@/components/post/PostCard';
import { useAuth } from '@providers/AuthProvider';
import { useUserPosts } from '@/hooks/profile/useUserPosts';
import { useCommentThreadController } from '@/hooks/comments/useCommentThreadController';
import { getAvatarUrl } from '@/lib/supabase/storage';
import { useImageZoomActive } from '@/providers/ImageZoomProvider';
import { colors, spacing, typography } from '@constants/theme';
import type { FeedPost } from '@/hooks/feed/useFeed';

export default function ProfileScreen() {
  const { profile, user } = useAuth();
  const isZoomActive = useImageZoomActive();
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const {
    activeCommentThreadId,
    handleCommentListScroll,
    listRef,
    scrollToCommentComposer,
    setActiveCommentThreadId,
  } = useCommentThreadController<FeedPost>();

  const {
    data: postsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: postsLoading,
  } = useUserPosts(user?.id, user?.id);

  const posts = useMemo(
    () => postsData?.pages.flatMap((page) => page.posts) ?? [],
    [postsData]
  );
  const avatarImageUri = getAvatarUrl(profile?.avatar_url);

  const header = (
    <>
      <View style={styles.profileSection}>
        <View style={styles.profileHeader}>
          {avatarImageUri ? (
            <PinchableImage
              uri={avatarImageUri}
              borderRadius={60}
              style={styles.profilePicture}
              onPress={() => setShowAvatarModal(true)}
              accessibilityLabel={`${profile?.display_name ?? 'Your'} profile picture`}
              testID="profile-picture"
            >
              <Avatar
                uri={profile?.avatar_url}
                name={profile?.display_name}
                size="xxl"
              />
            </PinchableImage>
          ) : (
            <Avatar
              name={profile?.display_name}
              size="xxl"
            />
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.displayName}>{profile?.display_name}</Text>
            <Text style={styles.username}>@{profile?.username}</Text>
            {profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
          </View>
        </View>
      </View>

      <View style={styles.divider} />
      <View style={styles.postsHeader}>
        <Text style={styles.postsTitle}>Posts</Text>
        <Pressable
          style={({ pressed }) => [
            styles.deletedPostsLink,
            pressed && styles.deletedPostsLinkPressed,
          ]}
          onPress={() => router.push('/(main)/(profile)/recently-deleted')}
          accessibilityRole="button"
          accessibilityLabel="Recently deleted"
          hitSlop={6}
        >
          <Ionicons name="time-outline" size={16} color={colors.primary[600]} />
          <Text style={styles.deletedPostsLinkText}>Recently Deleted</Text>
        </Pressable>
      </View>
    </>
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <TouchableOpacity
          onPress={() => router.push('/(main)/(profile)/settings')}
          testID="profile-settings"
          accessibilityRole="button"
          accessibilityLabel="Open settings"
        >
          <Ionicons name="settings-outline" size={24} color={colors.gray[600]} />
        </TouchableOpacity>
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
                description="Share your first post!"
              />
            ) : (
              <View style={styles.footer}>
                <ActivityIndicator color={colors.primary[500]} />
              </View>
            )
          }
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={7}
          updateCellsBatchingPeriod={50}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          onScroll={handleCommentListScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
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
    padding: spacing.lg,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  postsHeader: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  deletedPostsLink: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
  },
  deletedPostsLinkPressed: {
    backgroundColor: colors.primary[50],
  },
  deletedPostsLinkText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.primary[600],
  },
  footer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
});
