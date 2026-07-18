import React, { useCallback, useMemo } from 'react';
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '@/components/common';
import { DeletedPostItem } from '@/components/post/DeletedPostItem';
import { useAuth } from '@/providers/AuthProvider';
import {
  useDeletedPosts,
  usePermanentlyDeletePost,
  useRestoreDeletedPost,
  type DeletedPost,
} from '@/hooks/posts';
import { colors, spacing, typography } from '@/constants/theme';

export default function RecentlyDeletedScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isRefetching,
    refetch,
  } = useDeletedPosts(user?.id);
  const restorePost = useRestoreDeletedPost();
  const permanentlyDeletePost = usePermanentlyDeletePost();

  const posts = useMemo(
    () => data?.pages.flatMap((page) => page.posts) ?? [],
    [data]
  );

  const handleRestore = useCallback(async (postId: string) => {
    try {
      await restorePost.mutateAsync(postId);
    } catch (error: any) {
      Alert.alert(
        'Could not restore post',
        error.message || 'Please try again.'
      );
    }
  }, [restorePost]);

  const handlePermanentDelete = useCallback((postId: string) => {
    Alert.alert(
      'Delete permanently?',
      'This post and its images will be erased now. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              await permanentlyDeletePost.mutateAsync(postId);
            } catch (error: any) {
              Alert.alert(
                'Could not delete post',
                error.message || 'Please try again.'
              );
            }
          },
        },
      ]
    );
  }, [permanentlyDeletePost]);

  const renderPost = useCallback(({ item }: { item: DeletedPost }) => (
    <DeletedPostItem
      post={item}
      isRestoring={restorePost.isPending && restorePost.variables === item.id}
      isDeleting={
        permanentlyDeletePost.isPending &&
        permanentlyDeletePost.variables === item.id
      }
      onRestore={handleRestore}
      onDeletePermanently={handlePermanentDelete}
    />
  ), [
    handlePermanentDelete,
    handleRestore,
    permanentlyDeletePost.isPending,
    permanentlyDeletePost.variables,
    restorePost.isPending,
    restorePost.variables,
  ]);

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

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
        <Text style={styles.title}>Recently Deleted</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.notice}>
        <Ionicons name="time-outline" size={19} color={colors.gray[600]} />
        <Text style={styles.noticeText}>
          Posts are permanently deleted 30 days after removal.
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary[500]} />
        </View>
      ) : (
        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary[500]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="time-outline"
              title="Nothing recently deleted"
              description="Deleted posts will stay here for 30 days before being permanently removed."
            />
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.footer}>
                <ActivityIndicator color={colors.primary[500]} />
              </View>
            ) : null
          }
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          contentContainerStyle={posts.length === 0 && styles.emptyList}
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
    width: 32,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 32,
  },
  title: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
    backgroundColor: colors.gray[50],
  },
  noticeText: {
    flex: 1,
    fontSize: typography.fontSizes.sm,
    lineHeight: 19,
    color: colors.gray[600],
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyList: {
    flexGrow: 1,
  },
  footer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
});
