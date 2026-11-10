import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewInstance,
  type TextInputInstance,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CommentItem } from './CommentItem';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/providers/AuthProvider';
import {
  useComments,
  useCreateComment,
  useDeleteComment,
  useUpdateComment,
  type CommentWithAuthor,
} from '@/hooks/comments/useComments';
import { LIMITS } from '@/constants/config';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { getErrorMessage } from '@/lib/errors';

const PREVIEW_COMMENT_COUNT = 3;
const COMMENT_COUNT_WARNING_AT = Math.floor(LIMITS.commentMaxLength * 0.9);

function normalizeCommentContent(value: string) {
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim()
    .replace(/\n{3,}/g, '\n\n');
}

interface InlineCommentsProps {
  postId: string;
  commentCount: number;
  currentUserId?: string;
  isThreadActive: boolean;
  onComposerActivated?: (
    composer: ViewInstance,
    onPositioned?: () => void
  ) => void;
  onThreadActiveChange: (active: boolean) => void;
  focusedCommentId?: string;
  onFocusedCommentPositioned?: (comment: ViewInstance) => void;
}

export function InlineComments({
  postId,
  commentCount,
  currentUserId,
  isThreadActive,
  onComposerActivated,
  onThreadActiveChange,
  focusedCommentId,
  onFocusedCommentPositioned,
}: InlineCommentsProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const composerRef = useRef<ViewInstance>(null);
  const inputRef = useRef<TextInputInstance>(null);
  const submissionInFlight = useRef(false);
  const [commentText, setCommentText] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [editingComment, setEditingComment] = useState<CommentWithAuthor | null>(null);
  const [replyingTo, setReplyingTo] = useState<CommentWithAuthor | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [previousThreadActive, setPreviousThreadActive] = useState(isThreadActive);

  // Reset before rendering the collapsed thread, so reopening starts fresh.
  if (isThreadActive !== previousThreadActive) {
    setPreviousThreadActive(isThreadActive);
    if (!isThreadActive) {
      setCommentText('');
      setEditingComment(null);
      setReplyingTo(null);
      setIsComposing(false);
      setShowAll(false);
    }
  }

  const [submittedCommentId, setSubmittedCommentId] = useState<string>();
  const {
    comments, total: totalRootCount, isLoading, isError,
    hasNextPage, fetchNextPage, isFetchingNextPage, refetch,
  } = useComments(postId, focusedCommentId ?? submittedCommentId);
  const createComment = useCreateComment();
  const updateComment = useUpdateComment();
  const deleteComment = useDeleteComment();
  const flatComments = useMemo(() => comments ?? [], [comments]);
  const hasFocusedComment = !!focusedCommentId && flatComments.some(
    (comment) => comment.id === focusedCommentId
      || comment.replies?.some((reply) => reply.id === focusedCommentId)
  );
  const totalCommentCount = commentCount;
  const isComposerVisible = isComposing && isThreadActive;
  const isShowingAll = (showAll || hasFocusedComment) && isThreadActive;
  const visibleComments = isShowingAll
    ? flatComments
    : flatComments.slice(0, PREVIEW_COMMENT_COUNT);
  const hiddenCommentCount = Math.max(
    totalRootCount - PREVIEW_COMMENT_COUNT,
    0
  );
  const commentsDisclosureLabel = isFetchingNextPage
    ? 'Loading comments…'
    : isShowingAll
      ? hasNextPage ? 'Load more comments' : 'Show fewer comments'
      : `View ${hiddenCommentCount} more ${hiddenCommentCount === 1 ? 'comment' : 'comments'}`;
  const composerModeKey = editingComment
    ? `edit:${editingComment.id}`
    : replyingTo
      ? `reply:${replyingTo.id}`
      : 'comment';

  const activateComposer = useCallback(() => {
    if (composerRef.current) {
      onComposerActivated?.(composerRef.current);
    }
  }, [onComposerActivated]);

  const positionAndFocusComposer = useCallback(() => {
    const focusInput = () => inputRef.current?.focus();

    if (composerRef.current && onComposerActivated) {
      onComposerActivated(composerRef.current, focusInput);
    } else {
      focusInput();
    }
  }, [onComposerActivated]);

  useEffect(() => {
    if (!isComposerVisible) return;

    const frame = requestAnimationFrame(() => {
      positionAndFocusComposer();
    });

    return () => cancelAnimationFrame(frame);
  }, [composerModeKey, isComposerVisible, positionAndFocusComposer]);

  useEffect(() => {
    if (hasFocusedComment && !isThreadActive) {
      onThreadActiveChange(true);
    }
  }, [hasFocusedComment, isThreadActive, onThreadActiveChange]);

  const handleStartComposing = useCallback(() => {
    if (submissionInFlight.current) return;
    onThreadActiveChange(true);
    setEditingComment(null);
    setReplyingTo(null);
    setCommentText('');
    setIsComposing(true);
  }, [onThreadActiveChange]);

  const handleStartReplying = useCallback((comment: CommentWithAuthor) => {
    if (!currentUserId || submissionInFlight.current) return;

    onThreadActiveChange(true);
    setEditingComment(null);
    setReplyingTo(comment);
    setCommentText('');
    setIsComposing(true);
    setShowAll(true);
  }, [currentUserId, onThreadActiveChange]);

  const handleStartEditing = useCallback((comment: CommentWithAuthor) => {
    if (comment.author_id !== currentUserId || submissionInFlight.current) return;

    onThreadActiveChange(true);
    setReplyingTo(null);
    setEditingComment(comment);
    setCommentText(comment.content);
    setIsComposing(true);
    setShowAll(true);
  }, [currentUserId, onThreadActiveChange]);

  const handleCancel = useCallback(() => {
    if (submissionInFlight.current) return;
    setCommentText('');
    setEditingComment(null);
    setReplyingTo(null);
    setIsComposing(false);
    if (!showAll) {
      onThreadActiveChange(false);
    }
    Keyboard.dismiss();
  }, [onThreadActiveChange, showAll]);

  const handleCommentsDisclosurePress = useCallback(() => {
    if (hasNextPage) {
      onThreadActiveChange(true);
      setShowAll(true);
      if (!isFetchingNextPage) void fetchNextPage();
      return;
    }
    if (showAll) {
      if (isComposing) {
        handleCancel();
      }
      setShowAll(false);
      onThreadActiveChange(false);
      return;
    }

    onThreadActiveChange(true);
    setShowAll(true);
  }, [fetchNextPage, handleCancel, hasNextPage, isComposing, isFetchingNextPage, onThreadActiveChange, showAll]);

  const handleSubmit = useCallback(async () => {
    const content = normalizeCommentContent(commentText);
    if (!content || !currentUserId || submissionInFlight.current) return;
    submissionInFlight.current = true;

    try {
      if (editingComment) {
        await updateComment.mutateAsync({
          commentId: editingComment.id,
          postId,
          content,
        });
      } else {
        const created = await createComment.mutateAsync({
          postId,
          content,
          parentId: replyingTo?.id,
        });
        setSubmittedCommentId(created?.id);
      }
      Keyboard.dismiss();
      setCommentText('');
      setEditingComment(null);
      setReplyingTo(null);
      setIsComposing(false);
      setShowAll(true);
    } catch (error) {
      Alert.alert(
        editingComment
          ? 'Could not update comment'
          : replyingTo
            ? 'Could not add reply'
            : 'Could not add comment',
        getErrorMessage(error, 'Please try again.')
      );
    } finally {
      submissionInFlight.current = false;
    }
  }, [commentText, createComment, currentUserId, editingComment, postId, replyingTo, updateComment]);

  const handleDelete = useCallback((commentId: string) => {
    Alert.alert('Delete Comment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteComment.mutate({ commentId, postId }),
      },
    ]);
  }, [deleteComment, postId]);

  const handleProfilePress = useCallback((userId: string) => {
    if (userId === currentUserId) {
      router.push('/(main)/(profile)');
    } else {
      router.push(`/user/${userId}`);
    }
  }, [currentUserId, router]);

  const isSubmitting = createComment.isPending || updateComment.isPending;
  const hasChanged = !editingComment
    || normalizeCommentContent(commentText)
      !== normalizeCommentContent(editingComment.content);
  const canSubmit = !!currentUserId && !!commentText.trim() && hasChanged && !isSubmitting;

  return (
    <View style={styles.container}>
      <View style={styles.threadHeader}>
        <Text style={styles.threadTitle} accessibilityRole="header">Comments</Text>
        {totalCommentCount > 0 && (
          <Text style={styles.threadCount}>{totalCommentCount}</Text>
        )}
        {isComposerVisible && (
          <Pressable
            style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
            onPress={handleCancel}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel={editingComment ? 'Cancel editing comment' : replyingTo ? 'Cancel reply' : 'Cancel comment'}
            accessibilityState={{ disabled: isSubmitting }}
          >
            <Ionicons name="close" size={20} color={colors.gray[500]} />
          </Pressable>
        )}
      </View>

      {isComposerVisible && (
        <View
          ref={composerRef}
          style={styles.composer}
          collapsable={false}
          onLayout={activateComposer}
          testID={`comment-composer-${postId}`}
        >
          <Avatar
            uri={profile?.avatar_url}
            name={profile?.display_name || profile?.username}
            size="sm"
            style={styles.composerAvatar}
          />
          <View style={styles.composerInputColumn}>
            {editingComment && (
              <Text style={styles.composerContextLabel}>Editing comment</Text>
            )}
            {replyingTo && (
              <View
                style={styles.replyQuote}
                accessible
                accessibilityLabel={`Replying to ${replyingTo.author.display_name || replyingTo.author.username}: ${replyingTo.content}`}
              >
                <Text style={styles.replyQuoteAuthor} numberOfLines={1}>
                  Replying to {replyingTo.author.display_name || replyingTo.author.username}
                </Text>
                <Text style={styles.replyQuoteText} numberOfLines={2}>
                  {replyingTo.content}
                </Text>
              </View>
            )}
            <View style={styles.composerInputRow}>
              <TextInput
                key={composerModeKey}
                ref={inputRef}
                testID={`comment-composer-input-${postId}`}
                style={styles.composerInput}
                placeholder={editingComment
                  ? 'Edit your comment'
                  : replyingTo
                    ? `Reply to ${replyingTo.author.display_name || replyingTo.author.username}`
                    : 'Write a comment'
                }
                placeholderTextColor={colors.gray[500]}
                value={commentText}
                onChangeText={setCommentText}
                onFocus={activateComposer}
                multiline
                scrollEnabled={false}
                editable={!isSubmitting}
                maxLength={LIMITS.commentMaxLength}
                textAlignVertical="top"
                returnKeyType="default"
                accessibilityLabel={editingComment
                  ? 'Edit comment draft'
                  : replyingTo
                    ? `Reply to ${replyingTo.author.display_name || replyingTo.author.username}`
                    : 'Comment draft'
                }
              />
              <Pressable
                onPress={() => void handleSubmit()}
                disabled={!canSubmit}
                style={({ pressed }) => [
                  styles.postButton,
                  !canSubmit && styles.postButtonDisabled,
                  pressed && canSubmit && styles.postButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={editingComment ? 'Save comment' : replyingTo ? 'Send reply' : 'Post comment'}
                accessibilityState={{ disabled: !canSubmit, busy: isSubmitting }}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name={editingComment ? 'checkmark' : 'arrow-up'} size={20} color={canSubmit ? colors.white : colors.gray[400]} />
                )}
              </Pressable>
            </View>
            {commentText.length >= COMMENT_COUNT_WARNING_AT && (
              <Text style={styles.characterCount}>
                {commentText.length}/{LIMITS.commentMaxLength}
              </Text>
            )}
          </View>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={colors.primary[500]} />
        </View>
      ) : isError && flatComments.length === 0 ? (
        <Pressable onPress={() => void refetch()} accessibilityRole="button">
          <Text style={styles.emptyText}>Could not load comments. Tap to retry.</Text>
        </Pressable>
      ) : flatComments.length === 0 ? (
        <Text style={styles.emptyText}>No comments yet. Start the conversation.</Text>
      ) : (
        <View style={styles.commentsList}>
          {visibleComments.map((comment: CommentWithAuthor) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              onReply={handleStartReplying}
              onEdit={handleStartEditing}
              onDelete={handleDelete}
              onProfilePress={handleProfilePress}
              isThreadActive={isThreadActive}
              onThreadInteraction={() => onThreadActiveChange(true)}
              focusedCommentId={focusedCommentId}
              revealedCommentId={submittedCommentId}
              onFocusedCommentPositioned={onFocusedCommentPositioned}
            />
          ))}

          {hiddenCommentCount > 0 && (
            <Pressable
              style={({ pressed }) => [
                styles.moreButton,
                pressed && styles.moreButtonPressed,
              ]}
              onPress={handleCommentsDisclosurePress}
              disabled={isFetchingNextPage}
              accessibilityRole="button"
              accessibilityLabel={commentsDisclosureLabel}
            >
              <Text style={styles.moreLabel}>
                {commentsDisclosureLabel}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {!isComposerVisible && (
        <Pressable
          style={({ pressed }) => [
            styles.composerPrompt,
            pressed && styles.composerPromptPressed,
          ]}
          onPress={handleStartComposing}
          disabled={!currentUserId}
          accessibilityRole="button"
          accessibilityLabel="Write a comment"
        >
          <Ionicons name="create-outline" size={18} color={colors.gray[500]} />
          <Text style={styles.composerPromptText}>Add a comment...</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.white,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  composerAvatar: {
    marginTop: 6,
  },
  composerInputColumn: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.xl,
    backgroundColor: colors.gray[50],
  },
  composerInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  composerContextLabel: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.medium,
    color: colors.gray[600],
  },
  closeButton: {
    width: 44,
    height: 44,
    marginLeft: 'auto',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
  },
  closeButtonPressed: {
    backgroundColor: colors.gray[100],
  },
  replyQuote: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingLeft: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.primary[300],
  },
  replyQuoteAuthor: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary[600],
  },
  replyQuoteText: {
    marginTop: 2,
    fontSize: typography.fontSizes.sm,
    lineHeight: 20,
    color: colors.gray[600],
  },
  composerInput: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.gray[900],
    fontSize: typography.fontSizes.md,
    lineHeight: 22,
  },
  characterCount: {
    alignSelf: 'flex-end',
    marginRight: spacing.md,
    marginBottom: spacing.sm,
    fontSize: typography.fontSizes.xs,
    color: colors.gray[500],
  },
  postButton: {
    width: 44,
    height: 44,
    margin: 2,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[500],
  },
  postButtonDisabled: {
    backgroundColor: colors.gray[100],
  },
  postButtonPressed: {
    opacity: 0.8,
  },
  threadHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  threadTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  threadCount: {
    fontSize: typography.fontSizes.xs,
    color: colors.gray[500],
  },
  loading: {
    minHeight: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    paddingVertical: spacing.md,
    fontSize: typography.fontSizes.sm,
    color: colors.gray[500],
  },
  commentsList: {
    paddingBottom: spacing.xs,
  },
  moreButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    marginVertical: spacing.xs,
  },
  moreButtonPressed: {
    opacity: 0.65,
  },
  moreLabel: {
    color: colors.primary[500],
    fontSize: 13,
    fontWeight: typography.fontWeights.medium,
  },
  composerPrompt: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[50],
  },
  composerPromptPressed: {
    backgroundColor: colors.gray[100],
    borderColor: colors.gray[300],
  },
  composerPromptText: {
    fontSize: typography.fontSizes.sm,
    color: colors.gray[500],
  },
});
