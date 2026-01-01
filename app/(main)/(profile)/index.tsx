import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@components/ui';
import { EmptyState } from '@components/common';
import { PostCard } from '@/components/post/PostCard';
import { useAuth } from '@providers/AuthProvider';
import { useUserPosts } from '@/hooks/profile/useUserPosts';
import { colors, spacing, typography } from '@constants/theme';
import type { FeedPost } from '@/hooks/feed/useFeed';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ProfileScreen() {
  const { profile, user } = useAuth();
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  const {
    data: postsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: postsLoading,
  } = useUserPosts(user?.id, user?.id);

  const posts = postsData?.pages.flatMap((page) => page.posts) ?? [];

  const renderHeader = () => (
    <>
      <View style={styles.profileSection}>
        <View style={styles.profileHeader}>
          <Pressable onPress={() => profile?.avatar_url && setShowAvatarModal(true)}>
            <Avatar
              uri={profile?.avatar_url}
              name={profile?.display_name}
              size="xxl"
            />
          </Pressable>
          <View style={styles.profileInfo}>
            <Text style={styles.displayName}>{profile?.display_name}</Text>
            <Text style={styles.username}>@{profile?.username}</Text>
            {profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
          </View>
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
    padding: spacing.md,
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
