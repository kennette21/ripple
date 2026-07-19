import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@providers/AuthProvider';
import { useFeed, type FeedPost } from '@/hooks/feed/useFeed';
import { useCommentThreadController } from '@/hooks/comments/useCommentThreadController';
import { useImageZoomActive } from '@/providers/ImageZoomProvider';
import { PostCard } from '@/components/post/PostCard';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/query/keys';
import { EmptyState } from '@components/common';
import { Skeleton } from '@components/ui';
import { colors, spacing, typography } from '@constants/theme';

export default function FeedScreen() {
  const { user } = useAuth();
  const isZoomActive = useImageZoomActive();
  const [isRefreshingComments, setIsRefreshingComments] = useState(false);
  const {
    activeCommentThreadId,
    handleCommentListScroll,
    listRef,
    scrollToCommentComposer,
    setActiveCommentThreadId,
  } = useCommentThreadController<FeedPost>();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isRefetching,
    refetch,
  } = useFeed(user?.id);

  const posts = useMemo(
    () => data?.pages.flatMap((page) => page.posts) ?? [],
    [data]
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

  const renderFooter = useCallback(() => {
    if (isFetchingNextPage) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator color={colors.primary[500]} />
        </View>
      );
    }

    // Show "caught up" message when no more posts
    if (!hasNextPage && posts.length > 0) {
      return (
        <View style={styles.caughtUp}>
          <View style={styles.caughtUpIcon}>
            <Ionicons name="checkmark-circle" size={48} color={colors.primary[500]} />
          </View>
          <Text style={styles.caughtUpTitle}>You're all caught up!</Text>
          <Text style={styles.caughtUpText}>
            You've seen all new posts from the people you follow.
          </Text>
        </View>
      );
    }

    return null;
  }, [isFetchingNextPage, hasNextPage, posts.length]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshingComments(true);
    try {
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({
          queryKey: queryKeys.comments.all,
          refetchType: 'active',
        }),
      ]);
    } finally {
      setIsRefreshingComments(false);
    }
  }, [refetch]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.logo}>Ripple</Text>
        </View>
        <View style={styles.loadingContainer}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonPost}>
              <View style={styles.skeletonHeader}>
                <Skeleton width={44} height={44} borderRadius={22} />
                <View style={styles.skeletonHeaderText}>
                  <Skeleton width={120} height={16} />
                  <Skeleton width={80} height={14} style={{ marginTop: 4 }} />
                </View>
              </View>
              <Skeleton width="100%" height={80} style={{ marginTop: 12 }} />
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.logo}>Ripple</Text>
        <TouchableOpacity
          style={styles.findFriendsButton}
          onPress={() => router.push('/friends')}
        >
          <Ionicons name="people-outline" size={24} color={colors.gray[600]} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {posts.length === 0 ? (
          <EmptyState
            icon="newspaper-outline"
            title="Your feed is empty"
            description="Follow some people to see their posts here. Or create your first post!"
          />
        ) : (
          <FlatList
            testID="feed-list"
            ref={listRef}
            data={posts}
            renderItem={renderPost}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching || isRefreshingComments}
                onRefresh={handleRefresh}
                tintColor={colors.primary[500]}
              />
            }
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            onScroll={handleCommentListScroll}
            scrollEventThrottle={16}
            initialNumToRender={5}
            maxToRenderPerBatch={5}
            windowSize={7}
            updateCellsBatchingPeriod={50}
            ListFooterComponent={renderFooter}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            scrollEnabled={!isZoomActive}
          />
        )}
      </KeyboardAvoidingView>
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
  headerSpacer: {
    width: 24,
  },
  logo: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary[500],
  },
  findFriendsButton: {
    padding: spacing.xs,
  },
  loadingContainer: {
    padding: spacing.md,
  },
  skeletonPost: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skeletonHeaderText: {
    marginLeft: spacing.sm,
  },
  footer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  caughtUp: {
    padding: spacing.xl,
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  caughtUpIcon: {
    marginBottom: spacing.md,
  },
  caughtUpTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
    marginBottom: spacing.xs,
  },
  caughtUpText: {
    fontSize: typography.fontSizes.sm,
    color: colors.gray[500],
    textAlign: 'center',
  },
});
