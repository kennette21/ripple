import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  View,
  Text,
  StyleSheet,
  Pressable,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { InlineComments } from '@/components/comments/InlineComments';
import { ImageGallery } from './ImageGallery';
import { PostActionsMenu } from './PostActionsMenu';
import { useDeletePost } from '@/hooks/posts/useDeletePost';
import { useUpdatePostPrivacy } from '@/hooks/posts/useUpdatePostPrivacy';
import { getErrorMessage } from '@/lib/errors';
import { colors, spacing } from '@/constants/theme';
import type { FeedPost } from '@/hooks/feed/useFeed';

interface PostCardProps {
  post: FeedPost;
  currentUserId?: string;
  isCommentThreadActive?: boolean;
  onCommentComposerActivated?: (
    composer: View,
    onPositioned?: () => void
  ) => void;
  onCommentThreadActiveChange?: (postId: string | null) => void;
  commentsInitiallyVisible?: boolean;
  focusedCommentId?: string;
  onFocusedCommentPositioned?: (comment: View) => void;
}

function PostCardComponent({
  post,
  currentUserId,
  isCommentThreadActive = false,
  onCommentComposerActivated,
  onCommentThreadActiveChange,
  commentsInitiallyVisible = false,
  focusedCommentId,
  onFocusedCommentPositioned,
}: PostCardProps) {
  const router = useRouter();
  const [showFullReflection, setShowFullReflection] = useState(false);
  const [showComments, setShowComments] = useState(
    commentsInitiallyVisible || !!focusedCommentId
  );
  const [isPrivate, setIsPrivate] = useState(post.is_private);
  const deletePost = useDeletePost();
  const updatePrivacy = useUpdatePostPrivacy();

  useEffect(() => {
    setIsPrivate(post.is_private);
  }, [post.is_private]);

  useEffect(() => {
    if (commentsInitiallyVisible || focusedCommentId) {
      setShowComments(true);
    }
  }, [commentsInitiallyVisible, focusedCommentId]);

  // created_at is nullable in the schema but always set by the DB default
  const timeAgo = formatDistanceToNow(new Date(post.created_at!), { addSuffix: true });
  const postAuthorId = (post).author_id;
  const isOwnPost = currentUserId === postAuthorId;
  const isPrivateReflection = post.is_private && post.content_type === 'reflection';

  const handleProfilePress = () => {
    if (isOwnPost) {
      router.push('/(main)/(profile)');
    } else {
      router.push(`/user/${postAuthorId}`);
    }
  };

  const handleCommentsToggle = () => {
    if (showComments) {
      Keyboard.dismiss();
      if (isCommentThreadActive) {
        onCommentThreadActiveChange?.(null);
      }
    }
    setShowComments((value) => !value);
  };

  const handleCommentThreadActiveChange = useCallback((active: boolean) => {
    onCommentThreadActiveChange?.(active ? post.id : null);
  }, [onCommentThreadActiveChange, post.id]);

  const handlePrivacyToggle = () => {
    if (!isOwnPost || updatePrivacy.isPending) return;

    const makePrivate = !isPrivate;
    Alert.alert(
      makePrivate ? 'Make this post private?' : 'Make this post public?',
      makePrivate
        ? 'Only you will be able to see it. It will be removed from everyone else\'s feed and your public profile.'
        : 'People in your pond will be able to see it in their feeds and on your profile.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: makePrivate ? 'Make private' : 'Make public',
          onPress: async () => {
            try {
              const updatedPost = await updatePrivacy.mutateAsync({
                postId: post.id,
                authorId: postAuthorId,
                isPrivate: makePrivate,
              });
              setIsPrivate(updatedPost.is_private);
            } catch (error) {
              Alert.alert(
                'Could not update privacy',
                getErrorMessage(error, 'Please try again.')
              );
            }
          },
        },
      ]
    );
  };

  const handleDeleteRequest = () => {
    if (!isOwnPost || deletePost.isPending) return;

    Alert.alert(
      'Delete Post?',
      'This post will move to Recently Deleted. You can restore it for 30 days.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePost.mutateAsync(post.id);
            } catch (error) {
              Alert.alert(
                'Could not delete post',
                getErrorMessage(error, 'Please try again.')
              );
            }
          },
        },
      ]
    );
  };

  const handleEditRequest = () => {
    if (!isOwnPost || deletePost.isPending) return;

    router.push({
      pathname: '/edit-post',
      params: { postId: post.id },
    });
  };

  const TEXT_LIMIT = 160;

  const renderContent = () => {
    if (post.content_type === 'caption') {
      if (!post.caption) return null;
      const isTruncated = post.caption.length > TEXT_LIMIT;
      const displayText = !showFullReflection && isTruncated
        ? post.caption.slice(0, TEXT_LIMIT) + '...'
        : post.caption;

      return (
        <View>
          <Text style={styles.caption}>{displayText}</Text>
          {isTruncated && (
            <Pressable onPress={() => setShowFullReflection(!showFullReflection)}>
              <Text style={styles.readMore}>
                {showFullReflection ? 'Show less' : 'Read more'}
              </Text>
            </Pressable>
          )}
        </View>
      );
    }

    // Private reflection from another user - show nothing
    if (isPrivateReflection && !isOwnPost) {
      return null;
    }

    const reflection = post.reflection || '';
    const isTruncated = reflection.length > TEXT_LIMIT;
    const displayText = !showFullReflection && isTruncated
      ? reflection.slice(0, TEXT_LIMIT) + '...'
      : reflection;

    return (
      <View>
        {post.caption && (
          <Text style={styles.reflectionTitle}>{post.caption}</Text>
        )}
        <Text style={styles.reflection}>{displayText}</Text>
        {isTruncated && (
          <Pressable onPress={() => setShowFullReflection(!showFullReflection)}>
            <Text style={styles.readMore}>
              {showFullReflection ? 'Show less' : 'Read more'}
            </Text>
          </Pressable>
        )}
      </View>
    );
  };

  // For private reflections from others, there's no content to show
  const hasContent = post.content_type === 'caption'
    ? !!post.caption
    : (!!post.reflection && (!isPrivateReflection || isOwnPost));
  const hasImages = post.images && post.images.length > 0;

  // Only show lock icon to the post owner
  const showLockIcon = isPrivate && isOwnPost;

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
          {showLockIcon && (
            <Ionicons name="lock-closed" size={14} color={colors.gray[400]} style={styles.lockIcon} />
          )}
          <Text style={styles.time}>{timeAgo}</Text>
          {isOwnPost && (
            <PostActionsMenu
              postId={post.id}
              isDeleting={deletePost.isPending}
              onEdit={handleEditRequest}
              onDelete={handleDeleteRequest}
            />
          )}
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

      {/* Actions bar */}
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            showComments && styles.actionButtonActive,
            pressed && styles.actionButtonPressed,
          ]}
          onPress={handleCommentsToggle}
          testID={`comments-toggle-${post.id}`}
          accessibilityRole="button"
          accessibilityLabel={showComments
            ? 'Hide comments'
            : post.comment_count > 0
              ? `View ${post.comment_count} comments`
              : 'Add a comment'
          }
          accessibilityState={{ expanded: showComments }}
          hitSlop={8}
        >
          <Ionicons
            name={showComments ? 'chatbubble' : 'chatbubble-outline'}
            size={20}
            color={showComments ? colors.primary[500] : colors.gray[500]}
          />
          {post.comment_count > 0 && (
            <Text style={[
              styles.actionCount,
              showComments && styles.actionCountActive,
            ]}>
              {post.comment_count}
            </Text>
          )}
        </Pressable>

        {isOwnPost && (
          <Pressable
            style={({ pressed }) => [
              styles.privacyButton,
              isPrivate && styles.privacyButtonPrivate,
              pressed && styles.actionButtonPressed,
            ]}
            onPress={handlePrivacyToggle}
            disabled={updatePrivacy.isPending}
            accessibilityRole="button"
            accessibilityLabel={`Post is ${isPrivate ? 'private' : 'public'}. Change privacy`}
            accessibilityState={{ busy: updatePrivacy.isPending }}
          >
            {updatePrivacy.isPending ? (
              <ActivityIndicator size="small" color={colors.gray[500]} />
            ) : (
              <Ionicons
                name={isPrivate ? 'lock-closed' : 'globe-outline'}
                size={15}
                color={isPrivate ? colors.primary[600] : colors.gray[500]}
              />
            )}
            <Text style={[
              styles.privacyButtonText,
              isPrivate && styles.privacyButtonTextPrivate,
            ]}>
              {isPrivate ? 'Private' : 'Public'}
            </Text>
          </Pressable>
        )}
      </View>

      {showComments && (
        <InlineComments
          postId={post.id}
          currentUserId={currentUserId}
          isThreadActive={isCommentThreadActive}
          onComposerActivated={onCommentComposerActivated}
          onThreadActiveChange={handleCommentThreadActiveChange}
          focusedCommentId={focusedCommentId}
          onFocusedCommentPositioned={onFocusedCommentPositioned}
        />
      )}
    </View>
  );
}

export const PostCard = React.memo(PostCardComponent);

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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: 999,
  },
  actionButtonActive: {
    backgroundColor: colors.primary[50],
  },
  actionButtonPressed: {
    opacity: 0.65,
  },
  actionCount: {
    fontSize: 13,
    color: colors.gray[500],
  },
  actionCountActive: {
    color: colors.primary[600],
    fontWeight: '600',
  },
  privacyButton: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.gray[100],
  },
  privacyButtonPrivate: {
    backgroundColor: colors.primary[50],
  },
  privacyButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.gray[600],
  },
  privacyButtonTextPrivate: {
    color: colors.primary[600],
  },
});
