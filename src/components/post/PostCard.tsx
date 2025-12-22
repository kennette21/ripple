import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { Avatar } from '@/components/ui/Avatar';
import { ImageGallery } from './ImageGallery';
import { colors, spacing } from '@/constants/theme';
import type { FeedPost } from '@/hooks/feed/useFeed';

interface PostCardProps {
  post: FeedPost;
  onRipple?: () => void;
  currentUserId?: string;
}

export function PostCard({
  post,
  onRipple,
  currentUserId,
}: PostCardProps) {
  const router = useRouter();
  const [showFullReflection, setShowFullReflection] = useState(false);

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });
  const postAuthorId = (post as any).author_id;
  const isOwnPost = postAuthorId === currentUserId;

  const handleProfilePress = () => {
    router.push(`/user/${postAuthorId}`);
  };

  const handlePostPress = () => {
    router.push(`/post/${post.id}`);
  };

  const renderContent = () => {
    if (post.content_type === 'caption') {
      return (
        <Text style={styles.caption}>{post.caption}</Text>
      );
    }

    // Reflection type
    const reflection = post.reflection || '';
    const isLong = reflection.length > 500;
    const displayText = isLong && !showFullReflection
      ? reflection.slice(0, 500) + '...'
      : reflection;

    return (
      <View>
        {post.caption && (
          <Text style={styles.reflectionTitle}>{post.caption}</Text>
        )}
        <Text style={styles.reflection}>{displayText}</Text>
        {isLong && (
          <Pressable onPress={() => setShowFullReflection(!showFullReflection)}>
            <Text style={styles.readMore}>
              {showFullReflection ? 'Show less' : 'Read more'}
            </Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <Pressable style={styles.container} onPress={handlePostPress}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.authorInfo} onPress={handleProfilePress}>
          <Avatar
            uri={post.author.avatar_url}
            name={post.author.display_name || post.author.username}
            size="md"
          />
          <View style={styles.authorText}>
            <Text style={styles.displayName}>
              {post.author.display_name || post.author.username}
            </Text>
            <Text style={styles.username}>@{post.author.username}</Text>
          </View>
        </Pressable>
        <Text style={styles.time}>{timeAgo}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {renderContent()}
      </View>

      {/* Images */}
      {post.images && post.images.length > 0 && (
        <ImageGallery images={post.images} />
      )}

      {/* Actions - Simplified for beta */}
      <View style={styles.actions}>
        <Pressable style={styles.actionButton} onPress={onRipple}>
          <Ionicons name="water-outline" size={22} color={colors.primary[500]} />
          <Text style={styles.rippleText}>Ripple</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.gray[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
    paddingVertical: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  authorText: {
    marginLeft: spacing.sm,
  },
  displayName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray[900],
  },
  username: {
    fontSize: 14,
    color: colors.gray[500],
  },
  time: {
    fontSize: 13,
    color: colors.gray[500],
  },
  content: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  caption: {
    fontSize: 16,
    color: colors.gray[900],
    lineHeight: 22,
  },
  reflectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray[900],
    marginBottom: spacing.xs,
  },
  reflection: {
    fontSize: 16,
    color: colors.gray[900],
    lineHeight: 24,
  },
  readMore: {
    fontSize: 14,
    color: colors.primary[500],
    marginTop: spacing.xs,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.xs,
  },
  rippleText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary[500],
  },
});
