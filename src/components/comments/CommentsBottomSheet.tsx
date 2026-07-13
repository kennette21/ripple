import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { CommentItem } from './CommentItem';
import { useComments, useCreateComment, useDeleteComment } from '@/hooks/comments/useComments';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

interface CommentsBottomSheetProps {
  postId: string;
  currentUserId?: string;
  bottomSheetRef: React.RefObject<BottomSheet | null>;
}

export function CommentsBottomSheet({
  postId,
  currentUserId,
  bottomSheetRef,
}: CommentsBottomSheetProps) {
  const [commentText, setCommentText] = useState('');
  const inputRef = useRef<TextInput>(null);
  const snapPoints = useMemo(() => ['60%', '90%'], []);

  const { data: comments, isLoading } = useComments(postId);
  const createComment = useCreateComment();
  const deleteComment = useDeleteComment();

  // Flatten comments — no replies, just top-level
  const flatComments = useMemo(() => {
    if (!comments) return [];
    // Show all comments flat (top-level only, replies are ignored in this view)
    return comments;
  }, [comments]);

  const handleSubmit = useCallback(() => {
    if (!commentText.trim() || !currentUserId) return;

    createComment.mutate({
      postId,
      userId: currentUserId,
      content: commentText.trim(),
    });

    setCommentText('');
  }, [commentText, currentUserId, postId, createComment]);

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

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      <View style={styles.header}>
        <Text style={styles.title}>Comments</Text>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      ) : flatComments.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubble-outline" size={48} color={colors.gray[300]} />
          <Text style={styles.emptyText}>No comments yet</Text>
          <Text style={styles.emptySubtext}>Be the first to comment</Text>
        </View>
      ) : (
        <FlatList
          data={flatComments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.commentWrapper}>
              <CommentItem
                comment={item}
                currentUserId={currentUserId}
                onDelete={handleDelete}
              />
            </View>
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Input bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.inputBar}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Add a comment..."
            placeholderTextColor={colors.gray[400]}
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={500}
          />
          <Pressable
            onPress={handleSubmit}
            disabled={!commentText.trim() || createComment.isPending}
            style={[
              styles.sendButton,
              (!commentText.trim() || createComment.isPending) && styles.sendButtonDisabled,
            ]}
          >
            {createComment.isPending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="send" size={18} color={colors.white} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  title: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
    textAlign: 'center',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.gray[500],
  },
  emptySubtext: {
    fontSize: typography.fontSizes.sm,
    color: colors.gray[400],
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  commentWrapper: {
    paddingVertical: spacing.xs,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
    backgroundColor: colors.white,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSizes.md,
    color: colors.gray[900],
    maxHeight: 100,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.gray[300],
  },
});
