import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { ImageGallery } from './ImageGallery';
import { colors, spacing } from '@/constants/theme';
import type { FeedPost } from '@/hooks/feed/useFeed';

interface PostCardProps {
  post: FeedPost;
  currentUserId?: string;
}

export function PostCard({
  post,
  currentUserId,
}: PostCardProps) {
  const router = useRouter();
  const [showFullReflection, setShowFullReflection] = useState(false);

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });
  const postAuthorId = (post as any).author_id;
  const isOwnPost = currentUserId === postAuthorId;
  const isPrivateReflection = post.is_private && post.content_type === 'reflection';

  const handleProfilePress = () => {
    router.push(`/user/${postAuthorId}`);
  };

  const renderContent = () => {
    if (post.content_type === 'caption') {
      if (!post.caption) return null;
      return (
        <Text style={styles.caption}>{post.caption}</Text>
      );
    }

    // Reflection type - check if private and not own post
    if (isPrivateReflection && !isOwnPost) {
      return (
        <View style={styles.privateReflection}>
          <Ionicons name="lock-closed" size={20} color={colors.gray[400]} />
          <Text style={styles.privateReflectionText}>
            This reflection is private
          </Text>
        </View>
      );
    }

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

  // For private reflections from others, we still show content (the "private" message)
  const hasContent = post.content_type === 'caption'
    ? !!post.caption
    : (!!post.reflection || isPrivateReflection);
  const hasImages = post.images && post.images.length > 0;

  return (
    <View style={styles.container}>
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
        <View style={styles.headerRight}>
          {post.is_private && (
            <Ionicons name="lock-closed" size={14} color={colors.gray[400]} style={styles.lockIcon} />
          )}
          <Text style={styles.time}>{timeAgo}</Text>
        </View>
      </View>

      {/* Images - carousel is scrollable */}
      {hasImages && (
        <ImageGallery images={post.images!} />
      )}

      {/* Content below images */}
      {hasContent && (
        <View style={styles.content}>
          {renderContent()}
        </View>
      )}
    </View>
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lockIcon: {
    marginRight: 2,
  },
  time: {
    fontSize: 13,
    color: colors.gray[500],
  },
  content: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
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
  privateReflection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.gray[100],
    borderRadius: 8,
  },
  privateReflectionText: {
    fontSize: 14,
    color: colors.gray[500],
    fontStyle: 'italic',
  },
});
