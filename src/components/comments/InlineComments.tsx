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
  currentUserId?: string;
  isThreadActive: boolean;
  onComposerActivated?: (
    composer: View,
    onPositioned?: () => void
  ) => void;
  onThreadActiveChange: (active: boolean) => void;
}

export function InlineComments({
  postId,
  currentUserId,
  isThreadActive,
  onComposerActivated,
  onThreadActiveChange,
}: InlineCommentsProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const composerRef = useRef<View>(null);
  const inputRef = useRef<TextInput>(null);
  const [commentText, setCommentText] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [editingComment, setEditingComment] = useState<CommentWithAuthor | null>(null);
  const [replyingTo, setReplyingTo] = useState<CommentWithAuthor | null>(null);
  const [showAll, setShowAll] = useState(false);

  const { data: comments, isLoading } = useComments(postId);
  const createComment = useCreateComment();
  const updateComment = useUpdateComment();
  const deleteComment = useDeleteComment();
  const flatComments = useMemo(() => comments ?? [], [comments]);
  const totalCommentCount = useMemo(() => {
    const countThread = (comment: CommentWithAuthor): number =>
      1 + (comment.replies ?? []).reduce(
        (total, reply) => total + countThread(reply),
        0
      );

    return flatComments.reduce(
      (total, comment) => total + countThread(comment),
      0
    );
  }, [flatComments]);
  const isComposerVisible = isComposing && isThreadActive;
  const isShowingAll = showAll && isThreadActive;
  const visibleComments = isShowingAll
    ? flatComments
    : flatComments.slice(0, PREVIEW_COMMENT_COUNT);
  const hiddenCommentCount = Math.max(
    flatComments.length - PREVIEW_COMMENT_COUNT,
    0
  );
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
    if (isThreadActive) return;

    setCommentText('');
    setEditingComment(null);
    setReplyingTo(null);
    setIsComposing(false);
    setShowAll(false);
  }, [isThreadActive]);

  const handleStartComposing = useCallback(() => {
    onThreadActiveChange(true);
    setEditingComment(null);
    setReplyingTo(null);
    setCommentText('');
    setIsComposing(true);
  }, [onThreadActiveChange]);

  const handleStartReplying = useCallback((comment: CommentWithAuthor) => {
    if (!currentUserId) return;

    onThreadActiveChange(true);
    setEditingComment(null);
    setReplyingTo(comment);
    setCommentText('');
    setIsComposing(true);
    setShowAll(true);
  }, [currentUserId, onThreadActiveChange]);

  const handleStartEditing = useCallback((comment: CommentWithAuthor) => {
    if (comment.author_id !== currentUserId) return;

    onThreadActiveChange(true);
    setReplyingTo(null);
    setEditingComment(comment);
    setCommentText(comment.content);
    setIsComposing(true);
    setShowAll(true);
  }, [currentUserId, onThreadActiveChange]);

  const handleCancel = useCallback(() => {
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
  }, [handleCancel, isComposing, onThreadActiveChange, showAll]);

  const handleSubmit = useCallback(async () => {
    const content = normalizeCommentContent(commentText);
    if (!content || !currentUserId) return;

    try {
      if (editingComment) {
        await updateComment.mutateAsync({
          commentId: editingComment.id,
          postId,
          content,
        });
      } else {
        await createComment.mutateAsync({
          postId,
          content,
          parentId: replyingTo?.id,
        });
      }
      Keyboard.dismiss();
      setCommentText('');
      setEditingComment(null);
      setReplyingTo(null);
      setIsComposing(false);
      setShowAll(true);
    } catch (error: any) {
      Alert.alert(
        editingComment
          ? 'Could not update comment'
          : replyingTo
            ? 'Could not add reply'
            : 'Could not add comment',
        error.message || 'Please try again.'
      );
    }
  }, [commentText, createComment, currentUserId, editingComment, postId, replyingTo, updateComment]);

  const handleDelete = useCallback((commentId: string) => {
    Alert.alert('Delete Comment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteComment.mutate(commentId),
      },
    ]);
  }, [deleteComment]);

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
  const canSubmit = !!commentText.trim() && hasChanged && !isSubmitting;

  return (
    <View style={styles.container}>
      {isComposerVisible && (
        <View
          ref={composerRef}
          style={styles.composer}
          collapsable={false}
          onLayout={activateComposer}
          testID={`comment-composer-${postId}`}
        >
          <View style={styles.composerHeader}>
            {editingComment || replyingTo ? (
              <Text style={styles.composerContextLabel} numberOfLines={1}>
                {editingComment
                  ? 'Editing comment'
                  : 'Reply'
                }
              </Text>
            ) : (
              <Pressable
                onPress={handleCancel}
                accessibilityRole="button"
                accessibilityLabel="Cancel comment"
                hitSlop={8}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            )}

            <View style={styles.composerHeaderActions}>
              {(editingComment || replyingTo) && (
                <Pressable
                  style={({ pressed }) => [
                    styles.closeButton,
                    pressed && styles.closeButtonPressed,
                  ]}
                  onPress={handleCancel}
                  accessibilityRole="button"
                  accessibilityLabel={editingComment ? 'Cancel editing comment' : 'Cancel reply'}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={20} color={colors.gray[500]} />
                </Pressable>
              )}

              <Pressable
                onPress={handleSubmit}
                disabled={!canSubmit}
                style={({ pressed }) => [
                  styles.postButton,
                  !canSubmit && styles.postButtonDisabled,
                  pressed && canSubmit && styles.postButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={editingComment
                  ? 'Save comment'
                  : replyingTo
                    ? 'Send reply'
                    : 'Post comment'
                }
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.postButtonText}>
                    {editingComment ? 'Save' : replyingTo ? 'Send' : 'Post'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>

          <View style={styles.composerBody}>
            <Avatar
              uri={profile?.avatar_url}
              name={profile?.display_name || profile?.username}
              size="md"
            />
            <View style={[
              styles.composerInputColumn,
              replyingTo && styles.replyComposer,
            ]}>
              {replyingTo && (
                <View
                  style={styles.replyQuote}
                  accessible
                  accessibilityLabel={`Replying to ${replyingTo.author.display_name || replyingTo.author.username}: ${replyingTo.content}`}
                >
                  <View style={styles.replyQuoteHeader}>
                    <Ionicons
                      name="return-down-forward-outline"
                      size={15}
                      color={colors.primary[500]}
                    />
                    <Text style={styles.replyQuoteAuthor} numberOfLines={1}>
                      {replyingTo.author.display_name || replyingTo.author.username}
                    </Text>
                  </View>
                  <Text style={styles.replyQuoteText} numberOfLines={4}>
                    {replyingTo.content}
                  </Text>
                </View>
              )}
              <TextInput
                key={composerModeKey}
                ref={inputRef}
                testID={`comment-composer-input-${postId}`}
                style={[
                  styles.composerInput,
                  replyingTo && styles.replyComposerInput,
                ]}
                placeholder={editingComment
                  ? 'Edit your comment'
                  : replyingTo
                    ? `Reply to ${replyingTo.author.display_name || replyingTo.author.username}`
                    : 'Write a comment'
                }
                placeholderTextColor={colors.gray[400]}
                value={commentText}
                onChangeText={setCommentText}
                onFocus={activateComposer}
                multiline
                maxLength={LIMITS.commentMaxLength}
                textAlignVertical="top"
                returnKeyType="default"
                accessibilityLabel={replyingTo
                  ? `Reply to ${replyingTo.author.display_name || replyingTo.author.username}`
                  : 'Comment draft'
                }
              />
              {commentText.length >= COMMENT_COUNT_WARNING_AT && (
                <Text style={[
                  styles.characterCount,
                  replyingTo && styles.replyCharacterCount,
                ]}>
                  {commentText.length}/{LIMITS.commentMaxLength}
                </Text>
              )}
            </View>
          </View>
        </View>
      )}

      <View style={styles.threadHeader}>
        <Text style={styles.threadTitle}>Comments</Text>
        {totalCommentCount > 0 && (
          <Text style={styles.threadCount}>{totalCommentCount}</Text>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={colors.primary[500]} />
        </View>
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
            />
          ))}

          {hiddenCommentCount > 0 && (
            <Pressable
              style={({ pressed }) => [
                styles.moreButton,
                pressed && styles.moreButtonPressed,
              ]}
              onPress={handleCommentsDisclosurePress}
              accessibilityRole="button"
              accessibilityLabel={isShowingAll
                ? 'Show fewer comments'
                : `View ${hiddenCommentCount} more ${hiddenCommentCount === 1 ? 'comment' : 'comments'}`
              }
            >
              <Text style={styles.moreLabel}>
                {isShowingAll
                  ? 'Show fewer comments'
                  : `View ${hiddenCommentCount} more ${hiddenCommentCount === 1 ? 'comment' : 'comments'}`
                }
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
    marginHorizontal: -spacing.md,
    marginTop: -spacing.md,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
    backgroundColor: colors.white,
  },
  composerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  composerHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  composerContextLabel: {
    flex: 1,
    marginRight: spacing.sm,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.gray[500],
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
  },
  closeButtonPressed: {
    backgroundColor: colors.gray[100],
  },
  replyComposer: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.xl,
    backgroundColor: colors.white,
  },
  replyQuote: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary[100],
    backgroundColor: colors.primary[50],
  },
  replyQuoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  replyQuoteAuthor: {
    flex: 1,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  replyQuoteText: {
    fontSize: typography.fontSizes.sm,
    lineHeight: 20,
    color: colors.gray[700],
  },
  composerBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  composerInputColumn: {
    flex: 1,
  },
  composerInput: {
    minHeight: 96,
    maxHeight: 180,
    paddingHorizontal: 0,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    color: colors.gray[900],
    fontSize: typography.fontSizes.lg,
    lineHeight: 24,
  },
  replyComposerInput: {
    minHeight: 84,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  cancelText: {
    minHeight: 36,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSizes.md,
    color: colors.gray[900],
  },
  characterCount: {
    alignSelf: 'flex-end',
    fontSize: typography.fontSizes.xs,
    color: colors.gray[400],
  },
  replyCharacterCount: {
    marginRight: spacing.md,
    marginBottom: spacing.sm,
  },
  postButton: {
    minWidth: 68,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[500],
  },
  postButtonDisabled: {
    backgroundColor: colors.primary[200],
  },
  postButtonPressed: {
    opacity: 0.8,
  },
  postButtonText: {
    color: colors.white,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
  },
  threadHeader: {
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
