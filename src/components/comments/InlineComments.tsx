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
import {
  useComments,
  useCreateComment,
  useDeleteComment,
  type CommentWithAuthor,
} from '@/hooks/comments/useComments';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';

const PREVIEW_COMMENT_COUNT = 3;

interface InlineCommentsProps {
  postId: string;
  currentUserId?: string;
}

export function InlineComments({ postId, currentUserId }: InlineCommentsProps) {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const [commentText, setCommentText] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const { data: comments, isLoading } = useComments(postId);
  const createComment = useCreateComment();
  const deleteComment = useDeleteComment();
  const flatComments = useMemo(() => comments ?? [], [comments]);
  const visibleComments = showAll
    ? flatComments
    : flatComments.slice(0, PREVIEW_COMMENT_COUNT);
  const hiddenCommentCount = Math.max(
    flatComments.length - PREVIEW_COMMENT_COUNT,
    0
  );

  useEffect(() => {
    if (!isComposing) return;

    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [isComposing]);

  const handleStartComposing = useCallback(() => {
    setIsComposing(true);
  }, []);

  const handleCancel = useCallback(() => {
    setCommentText('');
    setIsComposing(false);
    Keyboard.dismiss();
  }, []);

  const handleSubmit = useCallback(async () => {
    const content = commentText.trim();
    if (!content || !currentUserId) return;

    try {
      await createComment.mutateAsync({
        postId,
        userId: currentUserId,
        content,
      });
      Keyboard.dismiss();
      setCommentText('');
      setIsComposing(false);
      setShowAll(true);
    } catch (error: any) {
      Alert.alert('Could not add comment', error.message || 'Please try again.');
    }
  }, [commentText, createComment, currentUserId, postId]);

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

  if (isComposing) {
    return (
      <View style={styles.container}>
        <View style={styles.composerHeader}>
          <Text style={styles.composerTitle}>Your comment</Text>
          <View style={styles.composerActions}>
            <Pressable
              onPress={handleCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel comment"
              hitSlop={8}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={!commentText.trim() || createComment.isPending}
              style={({ pressed }) => [
                styles.postButton,
                (!commentText.trim() || createComment.isPending) && styles.postButtonDisabled,
                pressed && commentText.trim() && styles.postButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Post comment"
            >
              {createComment.isPending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.postButtonText}>Post</Text>
              )}
            </Pressable>
          </View>
        </View>

        <TextInput
          ref={inputRef}
          style={styles.composerInput}
          placeholder="Add your comment..."
          placeholderTextColor={colors.gray[400]}
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={500}
          textAlignVertical="top"
          returnKeyType="default"
          accessibilityLabel="Comment draft"
        />

        <Text style={styles.characterCount}>{commentText.length}/500</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.threadHeader}>
        <Text style={styles.threadTitle}>Comments</Text>
        {flatComments.length > 0 && (
          <Text style={styles.threadCount}>{flatComments.length}</Text>
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
              onDelete={handleDelete}
              onProfilePress={handleProfilePress}
            />
          ))}

          {hiddenCommentCount > 0 && (
            <Pressable
              style={({ pressed }) => [
                styles.moreButton,
                pressed && styles.moreButtonPressed,
              ]}
              onPress={() => setShowAll((value) => !value)}
              accessibilityRole="button"
              accessibilityLabel={showAll
                ? 'Show fewer comments'
                : `Show ${hiddenCommentCount} more comments`
              }
            >
              <Text style={styles.moreText}>•••</Text>
              <Text style={styles.moreLabel}>
                {showAll ? 'Show less' : `${hiddenCommentCount} more`}
              </Text>
            </Pressable>
          )}
        </View>
      )}

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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    marginVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
  },
  moreButtonPressed: {
    backgroundColor: colors.gray[200],
  },
  moreText: {
    color: colors.gray[700],
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
    letterSpacing: 1,
    marginTop: -4,
  },
  moreLabel: {
    color: colors.gray[600],
    fontSize: typography.fontSizes.xs,
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
  composerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  composerTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  composerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cancelText: {
    paddingVertical: spacing.xs,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.gray[600],
  },
  composerInput: {
    minHeight: 104,
    maxHeight: 180,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary[300],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
    color: colors.gray[900],
    fontSize: typography.fontSizes.md,
    lineHeight: 22,
  },
  characterCount: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
    fontSize: typography.fontSizes.xs,
    color: colors.gray[400],
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
    backgroundColor: colors.gray[300],
  },
  postButtonPressed: {
    opacity: 0.8,
  },
  postButtonText: {
    color: colors.white,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
  },
});
