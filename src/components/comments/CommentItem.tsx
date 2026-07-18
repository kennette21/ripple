import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Avatar } from '@/components/ui/Avatar';
import { borderRadius, colors, shadows, spacing } from '@/constants/theme';
import type { CommentWithAuthor } from '@/hooks/comments/useComments';

const DELETE_MENU_MAX_WIDTH = 220;
const DELETE_MENU_HEIGHT = 54;
const DELETE_MENU_GAP = 8;
const SCREEN_MARGIN = 16;
const DEFAULT_VISIBLE_REPLY_COUNT = 2;

interface MenuPosition {
  top: number;
  left: number;
  width: number;
}

interface CommentItemProps {
  comment: CommentWithAuthor;
  currentUserId?: string;
  onReply?: (comment: CommentWithAuthor) => void;
  onEdit?: (comment: CommentWithAuthor) => void;
  onDelete?: (commentId: string) => void;
  onProfilePress?: (userId: string) => void;
  isThreadActive?: boolean;
  onThreadInteraction?: () => void;
  isReply?: boolean;
}

export function CommentItem({
  comment,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  onProfilePress,
  isThreadActive = false,
  onThreadInteraction,
  isReply = false,
}: CommentItemProps) {
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const commentBodyRef = useRef<View>(null);
  const [showAllReplies, setShowAllReplies] = useState(false);
  const [deleteMenuPosition, setDeleteMenuPosition] = useState<MenuPosition | null>(null);

  // created_at is nullable in the schema but always set by the DB default
  const timeAgo = formatDistanceToNow(new Date(comment.created_at!), { addSuffix: true });
  const commentAuthorId = (comment as any).author_id;
  const isOwnComment = commentAuthorId === currentUserId;
  const replies = comment.replies ?? [];
  const hasReplies = replies.length > 0;
  const remainingReplyCount = Math.max(
    replies.length - DEFAULT_VISIBLE_REPLY_COUNT,
    0
  );
  const areAllRepliesVisible = showAllReplies && isThreadActive;
  const visibleReplies = areAllRepliesVisible
    ? replies
    : replies.slice(0, DEFAULT_VISIBLE_REPLY_COUNT);

  useEffect(() => {
    if (!isThreadActive && showAllReplies) {
      setShowAllReplies(false);
    }
  }, [isThreadActive, showAllReplies]);

  const handleProfilePress = () => {
    if (onProfilePress) {
      onProfilePress(commentAuthorId);
    } else {
      router.push(`/user/${commentAuthorId}`);
    }
  };

  const handleLongPress = () => {
    if (!isOwnComment || !onDelete) return;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    commentBodyRef.current?.measureInWindow((_x, y, _width, height) => {
      const menuWidth = Math.min(
        DELETE_MENU_MAX_WIDTH,
        windowWidth - SCREEN_MARGIN * 2
      );
      const preferredTop = y + height + DELETE_MENU_GAP;
      const latestVisibleTop = windowHeight - DELETE_MENU_HEIGHT - SCREEN_MARGIN;

      setDeleteMenuPosition({
        top: Math.min(preferredTop, latestVisibleTop),
        left: (windowWidth - menuWidth) / 2,
        width: menuWidth,
      });
    });
  };

  const handleDeletePress = () => {
    setDeleteMenuPosition(null);
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Warning
    ).catch(() => {});
    onDelete?.(comment.id);
  };

  return (
    <View style={[styles.container, isReply && styles.replyContainer]}>
      <Pressable onPress={handleProfilePress}>
        <Avatar
          uri={comment.author.avatar_url}
          name={comment.author.display_name || comment.author.username}
          size={isReply ? 'sm' : 'md'}
        />
      </Pressable>

      <View style={styles.content}>
        <View ref={commentBodyRef} collapsable={false}>
          <Pressable
            onLongPress={handleLongPress}
            delayLongPress={450}
            accessibilityHint={isOwnComment ? 'Long press to show comment actions' : undefined}
            style={({ pressed }) => [
              styles.commentBody,
              pressed && isOwnComment && styles.commentBodyPressed,
              deleteMenuPosition && styles.commentBodySelected,
            ]}
          >
            <View style={styles.header}>
              <Pressable onPress={handleProfilePress}>
                <Text style={styles.username}>
                  {comment.author.display_name || comment.author.username}
                </Text>
              </Pressable>
              <Text style={styles.time}>{timeAgo}</Text>
            </View>

            <Text style={styles.text}>
              {comment.replyToAuthor && (
                <Text style={styles.replyMention}>
                  @{comment.replyToAuthor.username}{' '}
                </Text>
              )}
              {comment.content}
            </Text>

            {(onReply || (isOwnComment && onEdit)) && (
              <View style={styles.actions}>
                {onReply && (
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => onReply(comment)}
                    testID={`comment-reply-${comment.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Reply to ${comment.author.display_name || comment.author.username}`}
                    hitSlop={8}
                  >
                    <Ionicons name="chatbubble-outline" size={14} color={colors.gray[500]} />
                    <Text style={styles.actionText}>Reply</Text>
                  </Pressable>
                )}
                {isOwnComment && onEdit && (
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => onEdit(comment)}
                    testID={`comment-edit-${comment.id}`}
                    accessibilityRole="button"
                    accessibilityLabel="Edit comment"
                    hitSlop={8}
                  >
                    <Text style={styles.actionText}>Edit</Text>
                  </Pressable>
                )}
              </View>
            )}
          </Pressable>
        </View>

        {/* Replies */}
        {hasReplies && (
          <View style={styles.repliesSection}>
            {visibleReplies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUserId={currentUserId}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                onProfilePress={onProfilePress}
                isThreadActive={isThreadActive}
                onThreadInteraction={onThreadInteraction}
                isReply
              />
            ))}

            {remainingReplyCount > 0 && (
              <Pressable
                onPress={() => {
                  if (!areAllRepliesVisible) {
                    onThreadInteraction?.();
                  }
                  setShowAllReplies(!areAllRepliesVisible);
                }}
                accessibilityRole="button"
                accessibilityLabel={areAllRepliesVisible
                  ? 'Show fewer replies'
                  : `View ${remainingReplyCount} more ${remainingReplyCount === 1 ? 'reply' : 'replies'}`
                }
                accessibilityState={{ expanded: areAllRepliesVisible }}
              >
                <Text style={styles.showReplies}>
                  {areAllRepliesVisible
                    ? 'Show fewer replies'
                    : `View ${remainingReplyCount} more ${remainingReplyCount === 1 ? 'reply' : 'replies'}`
                  }
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      <Modal
        visible={deleteMenuPosition !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setDeleteMenuPosition(null)}
      >
        <View style={styles.menuLayer} accessibilityViewIsModal>
          <Pressable
            style={[StyleSheet.absoluteFill, styles.menuBackdrop]}
            onPress={() => setDeleteMenuPosition(null)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss comment actions"
          />
          {deleteMenuPosition && (
            <View style={[styles.deleteMenuShadow, deleteMenuPosition]}>
              <BlurView intensity={65} tint="light" style={styles.deleteMenu}>
                <Pressable
                  style={({ pressed }) => [
                    styles.deleteMenuAction,
                    pressed && styles.deleteMenuActionPressed,
                  ]}
                  onPress={handleDeletePress}
                  accessibilityRole="button"
                  accessibilityLabel="Delete comment"
                >
                  <Ionicons name="trash-outline" size={22} color={colors.error.main} />
                  <Text style={styles.deleteMenuText}>Delete</Text>
                </Pressable>
              </BlurView>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
  },
  replyContainer: {
    marginLeft: spacing.xs,
    paddingTop: spacing.sm,
  },
  content: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  commentBody: {
    marginHorizontal: -spacing.xs,
    marginVertical: -2,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.md,
  },
  commentBodyPressed: {
    opacity: 0.65,
  },
  commentBodySelected: {
    backgroundColor: colors.gray[100],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray[900],
  },
  time: {
    fontSize: 12,
    color: colors.gray[500],
  },
  text: {
    fontSize: 14,
    color: colors.gray[900],
    lineHeight: 20,
    marginTop: 2,
  },
  replyMention: {
    color: colors.primary[600],
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    gap: spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  actionText: {
    fontSize: 12,
    color: colors.gray[500],
  },
  repliesSection: {
    marginTop: spacing.xs,
  },
  showReplies: {
    fontSize: 13,
    color: colors.primary[500],
    fontWeight: '500',
    paddingVertical: spacing.xs,
  },
  menuLayer: {
    flex: 1,
  },
  menuBackdrop: {
    backgroundColor: 'rgba(17, 24, 39, 0.08)',
  },
  deleteMenuShadow: {
    position: 'absolute',
    borderRadius: 18,
    ...shadows.lg,
  },
  deleteMenu: {
    minHeight: DELETE_MENU_HEIGHT,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  deleteMenuAction: {
    minHeight: DELETE_MENU_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
  },
  deleteMenuActionPressed: {
    backgroundColor: 'rgba(254, 226, 226, 0.84)',
  },
  deleteMenuText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.error.main,
  },
});
