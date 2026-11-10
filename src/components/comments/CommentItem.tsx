import React, { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewInstance,
} from 'react-native';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Avatar } from '@/components/ui/Avatar';
import { borderRadius, colors, shadows, spacing } from '@/constants/theme';
import { useCommentReplies, type CommentWithAuthor } from '@/hooks/comments/useComments';

const COMMENT_MENU_MAX_WIDTH = 220;
const COMMENT_MENU_ROW_HEIGHT = 54;
const COMMENT_MENU_GAP = 8;
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
  focusedCommentId?: string;
  revealedCommentId?: string;
  onFocusedCommentPositioned?: (comment: ViewInstance) => void;
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
  focusedCommentId,
  revealedCommentId,
  onFocusedCommentPositioned,
}: CommentItemProps) {
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const commentBodyRef = useRef<ViewInstance>(null);
  const [showAllReplies, setShowAllReplies] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  // created_at is nullable in the schema but always set by the DB default
  const timeAgo = formatDistanceToNow(new Date(comment.created_at!), { addSuffix: true });
  const commentAuthorId = (comment).author_id;
  const isOwnComment = commentAuthorId === currentUserId;
  const hasOwnActions = isOwnComment && !!(onEdit || onDelete);
  const previewReplies = comment.replies ?? [];
  const containsRevealedReply = previewReplies.some(
    (reply) => reply.id === revealedCommentId || reply.id === focusedCommentId
  );
  const repliesQuery = useCommentReplies(comment, !isReply);
  const loadedReplies = repliesQuery.data?.pages.flatMap((page) => page.replies);
  const replies = loadedReplies ? [
    ...loadedReplies,
    ...previewReplies.filter((reply) => !loadedReplies.some((loaded) => loaded.id === reply.id)),
  ] : previewReplies;
  const isFocused = comment.id === focusedCommentId;
  const containsFocusedReply = replies.some(
    (reply) => reply.id === focusedCommentId
  );
  const isReferenceConversation = !isReply && (isFocused || containsFocusedReply);
  const hasReplies = (repliesQuery.data?.pages[0]?.total ?? replies.length) > 0;
  const remainingReplyCount = Math.max(
    (repliesQuery.data?.pages[0]?.total ?? replies.length) - DEFAULT_VISIBLE_REPLY_COUNT,
    0
  );
  const areAllRepliesVisible = (showAllReplies || containsFocusedReply || containsRevealedReply)
    && isThreadActive;
  const visibleReplies = areAllRepliesVisible
    ? replies
    : replies.slice(0, DEFAULT_VISIBLE_REPLY_COUNT);
  const repliesDisclosureLabel = repliesQuery.isFetching
    ? 'Loading replies…'
    : repliesQuery.isError
      ? 'Could not load replies. Tap to retry.'
      : areAllRepliesVisible
        ? repliesQuery.hasNextPage ? 'Load more replies' : 'Show fewer replies'
        : `View ${remainingReplyCount} more ${remainingReplyCount === 1 ? 'reply' : 'replies'}`;

  if (!isThreadActive && showAllReplies) {
    setShowAllReplies(false);
  }

  const handleCommentLayout = () => {
    if (isFocused && commentBodyRef.current) {
      onFocusedCommentPositioned?.(commentBodyRef.current);
    }
  };

  const handleProfilePress = () => {
    if (onProfilePress) {
      onProfilePress(commentAuthorId);
    } else {
      router.push(`/user/${commentAuthorId}`);
    }
  };

  const showCommentActions = () => {
    if (!hasOwnActions) return;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    commentBodyRef.current?.measureInWindow((x, y, width, height) => {
      const menuWidth = Math.min(
        COMMENT_MENU_MAX_WIDTH,
        windowWidth - SCREEN_MARGIN * 2
      );
      const menuHeight = COMMENT_MENU_ROW_HEIGHT * (Number(!!onEdit) + Number(!!onDelete));
      const preferredTop = y + height + COMMENT_MENU_GAP;
      const latestVisibleTop = windowHeight - menuHeight - SCREEN_MARGIN;

      setMenuPosition({
        top: Math.max(SCREEN_MARGIN, Math.min(preferredTop, latestVisibleTop)),
        left: Math.max(SCREEN_MARGIN, Math.min(x + width - menuWidth, windowWidth - menuWidth - SCREEN_MARGIN)),
        width: menuWidth,
      });
    });
  };

  const handleEditPress = () => {
    setMenuPosition(null);
    onEdit?.(comment);
  };

  const handleDeletePress = () => {
    setMenuPosition(null);
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Warning
    ).catch(() => {});
    onDelete?.(comment.id);
  };

  return (
    <View
      style={[
        styles.container,
        isReply && styles.replyContainer,
      ]}
      onLayout={handleCommentLayout}
    >
      {isReferenceConversation && (
        <View style={styles.referenceThreadRail} pointerEvents="none" />
      )}
      <Pressable onPress={handleProfilePress} accessibilityRole="button" accessibilityLabel={`View ${comment.author.display_name || comment.author.username}'s profile`}>
        <Avatar
          uri={comment.author.avatar_url}
          name={comment.author.display_name || comment.author.username}
          size={isReply ? 'sm' : 'md'}
        />
      </Pressable>

      <View style={styles.content}>
        <View ref={commentBodyRef} collapsable={false}>
          <Pressable
            onLongPress={showCommentActions}
            delayLongPress={450}
            accessible={false}
            accessibilityHint={isFocused
              ? 'Referenced from the notification'
              : isOwnComment
                ? 'Long press to show comment actions'
                : undefined
            }
            style={({ pressed }) => [
              styles.commentBody,
              pressed && isOwnComment && styles.commentBodyPressed,
              menuPosition && styles.commentBodySelected,
            ]}
          >
            <View style={styles.header}>
              <Pressable onPress={handleProfilePress} accessibilityRole="button" accessibilityLabel={`View ${comment.author.display_name || comment.author.username}'s profile`}>
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

            {((currentUserId && onReply) || hasOwnActions) && (
              <View style={styles.actions}>
                {currentUserId && onReply && (
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => onReply(comment)}
                    testID={`comment-reply-${comment.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Reply to ${comment.author.display_name || comment.author.username}`}
                    hitSlop={6}
                  >
                    <Text style={styles.actionText}>Reply</Text>
                  </Pressable>
                )}
                {hasOwnActions && (
                  <Pressable
                    style={styles.moreActionsButton}
                    onPress={showCommentActions}
                    testID={`comment-actions-${comment.id}`}
                    accessibilityRole="button"
                    accessibilityLabel="Comment actions"
                    accessibilityHint="Edit or delete your comment."
                    accessibilityState={{ expanded: menuPosition !== null }}
                    hitSlop={6}
                  >
                    <Ionicons name="ellipsis-horizontal" size={18} color={colors.gray[500]} />
                  </Pressable>
                )}
              </View>
            )}
          </Pressable>
        </View>

        {/* Replies */}
        {(hasReplies || (!isReply && repliesQuery.isError)) && (
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
                focusedCommentId={focusedCommentId}
                revealedCommentId={revealedCommentId}
                onFocusedCommentPositioned={onFocusedCommentPositioned}
              />
            ))}

            {(remainingReplyCount > 0 || repliesQuery.isError) && (
              <Pressable
                onPress={() => {
                  if (repliesQuery.isError) {
                    void repliesQuery.refetch();
                    return;
                  }
                  if (areAllRepliesVisible && repliesQuery.hasNextPage) {
                    if (!repliesQuery.isFetching) void repliesQuery.fetchNextPage();
                    return;
                  }
                  if (!areAllRepliesVisible) {
                    onThreadInteraction?.();
                  }
                  if (!areAllRepliesVisible && repliesQuery.hasNextPage && !repliesQuery.isFetching) {
                    void repliesQuery.fetchNextPage();
                  }
                  setShowAllReplies(!areAllRepliesVisible);
                }}
                disabled={repliesQuery.isFetching}
                accessibilityRole="button"
                accessibilityLabel={repliesDisclosureLabel}
                accessibilityState={{ expanded: areAllRepliesVisible }}
              >
                <Text style={styles.showReplies}>
                  {repliesDisclosureLabel}
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      <Modal
        visible={menuPosition !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setMenuPosition(null)}
      >
        <View style={styles.menuLayer} accessibilityViewIsModal>
          <Pressable
            style={[StyleSheet.absoluteFill, styles.menuBackdrop]}
            onPress={() => setMenuPosition(null)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss comment actions"
          />
          {menuPosition && (
            <View style={[styles.deleteMenuShadow, menuPosition]}>
              <BlurView intensity={65} tint="light" style={styles.deleteMenu}>
                {onEdit && (
                  <Pressable
                    style={({ pressed }) => [styles.deleteMenuAction, pressed && styles.menuEditPressed]}
                    onPress={handleEditPress}
                    testID={`comment-edit-${comment.id}`}
                    accessibilityRole="button"
                    accessibilityLabel="Edit comment"
                  >
                    <Ionicons name="create-outline" size={22} color={colors.gray[900]} />
                    <Text style={styles.menuEditText}>Edit</Text>
                  </Pressable>
                )}
                {onEdit && onDelete && <View style={styles.menuDivider} />}
                {onDelete && (
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
                )}
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
    position: 'relative',
    flexDirection: 'row',
    paddingVertical: spacing.sm,
  },
  replyContainer: {
    marginLeft: spacing.xs,
    paddingTop: spacing.sm,
  },
  referenceThreadRail: {
    position: 'absolute',
    top: spacing.xs,
    bottom: spacing.xs,
    left: -8,
    width: 2,
    borderRadius: 1,
    backgroundColor: colors.primary[500],
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
    flexWrap: 'wrap',
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
    minHeight: 32,
    minWidth: 44,
    paddingHorizontal: spacing.xs,
    marginLeft: -spacing.xs,
  },
  moreActionsButton: {
    minHeight: 32,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.gray[600],
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
    minHeight: COMMENT_MENU_ROW_HEIGHT,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  deleteMenuAction: {
    minHeight: COMMENT_MENU_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
  },
  deleteMenuActionPressed: {
    backgroundColor: 'rgba(254, 226, 226, 0.84)',
  },
  menuEditPressed: {
    backgroundColor: colors.gray[100],
  },
  menuEditText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray[900],
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.gray[200],
  },
  deleteMenuText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.error.main,
  },
});
