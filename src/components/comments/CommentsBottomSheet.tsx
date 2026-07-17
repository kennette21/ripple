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
  Modal,
  useWindowDimensions,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommentItem } from './CommentItem';
import {
  useComments,
  useCreateComment,
  useDeleteComment,
  type CommentWithAuthor,
} from '@/hooks/comments/useComments';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

interface CommentsBottomSheetProps {
  postId: string;
  currentUserId?: string;
  onClose: () => void;
}

export function CommentsBottomSheet({
  postId,
  currentUserId,
  onClose,
}: CommentsBottomSheetProps) {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [commentText, setCommentText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const inputRef = useRef<TextInput>(null);

  const { data: comments, isLoading } = useComments(postId);
  const createComment = useCreateComment();
  const deleteComment = useDeleteComment();
  const flatComments = useMemo(() => comments ?? [], [comments]);

  const maximumAvailableHeight = Math.max(
    240,
    windowHeight - keyboardHeight - insets.top - spacing.sm
  );
  const minimumSheetHeight = Math.min(
    Math.round(windowHeight * 0.48),
    maximumAvailableHeight
  );
  const maximumCompactHeight = Math.min(
    Math.round(windowHeight * 0.68),
    maximumAvailableHeight
  );
  const visibleCommentCount = Math.min(Math.max(flatComments.length, 1), 5);
  const estimatedCommentsHeight = flatComments.length === 0
    ? 140
    : visibleCommentCount * 72 + spacing.md;
  const estimatedComposerHeight = keyboardHeight > 0
    ? 56
    : 64 + Math.max(insets.bottom, spacing.sm);
  const fittedContentHeight = 28 + 52 + estimatedComposerHeight + estimatedCommentsHeight;
  const compactHeight = Math.max(
    Math.min(minimumSheetHeight, maximumCompactHeight),
    Math.min(fittedContentHeight, maximumCompactHeight)
  );
  const expandedHeight = maximumAvailableHeight;
  const sheetHeight = useSharedValue(compactHeight);
  const compactHeightValue = useSharedValue(compactHeight);
  const expandedHeightValue = useSharedValue(expandedHeight);
  const gestureStartHeight = useSharedValue(compactHeight);
  const isExpandedValue = useSharedValue(false);
  const backdropOpacity = useSharedValue(0);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    height: sheetHeight.value,
  }));
  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const setSheetMode = useCallback((expanded: boolean) => {
    setIsExpanded(expanded);
    isExpandedValue.value = expanded;
    sheetHeight.value = withTiming(
      expanded ? expandedHeightValue.value : compactHeightValue.value,
      { duration: 160 }
    );
  }, [compactHeightValue, expandedHeightValue, isExpandedValue, sheetHeight]);

  const resizeGesture = useMemo(() => {
    const panGesture = Gesture.Pan()
      .minDistance(3)
      .onBegin(() => {
        gestureStartHeight.value = sheetHeight.value;
      })
      .onUpdate((event) => {
        const nextHeight = gestureStartHeight.value - event.translationY;
        sheetHeight.value = Math.max(
          compactHeightValue.value,
          Math.min(expandedHeightValue.value, nextHeight)
        );
      })
      .onEnd((event) => {
        const midpoint = (compactHeightValue.value + expandedHeightValue.value) / 2;
        const shouldExpand = event.velocityY < -500
          || (event.velocityY <= 500 && sheetHeight.value >= midpoint);
        sheetHeight.value = withTiming(
          shouldExpand ? expandedHeightValue.value : compactHeightValue.value,
          { duration: 160 }
        );
        isExpandedValue.value = shouldExpand;
        runOnJS(setIsExpanded)(shouldExpand);
      });

    const tapGesture = Gesture.Tap().onEnd(() => {
      const shouldExpand = !isExpandedValue.value;
      sheetHeight.value = withTiming(
        shouldExpand ? expandedHeightValue.value : compactHeightValue.value,
        { duration: 160 }
      );
      isExpandedValue.value = shouldExpand;
      runOnJS(setIsExpanded)(shouldExpand);
    });

    return Gesture.Race(panGesture, tapGesture);
  }, [compactHeightValue, expandedHeightValue, gestureStartHeight, isExpandedValue, sheetHeight]);

  React.useEffect(() => {
    compactHeightValue.value = compactHeight;
    expandedHeightValue.value = expandedHeight;
    sheetHeight.value = isExpandedValue.value ? expandedHeight : compactHeight;
  }, [compactHeight, compactHeightValue, expandedHeight, expandedHeightValue, isExpandedValue, sheetHeight]);

  React.useEffect(() => {
    backdropOpacity.value = withTiming(1, { duration: 240 });
  }, [backdropOpacity]);

  React.useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
      isExpandedValue.value = false;
      setIsExpanded(false);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [isExpandedValue]);

  const handleSubmit = useCallback(async () => {
    const content = commentText.trim();
    if (!content || !currentUserId) return;

    try {
      await createComment.mutateAsync({
        postId,
        userId: currentUserId,
        content,
      });
      setCommentText('');
    } catch (error: any) {
      Alert.alert('Could not add comment', error.message || 'Please try again.');
    }
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

  const handleProfilePress = useCallback((userId: string) => {
    onClose();
    requestAnimationFrame(() => {
      if (userId === currentUserId) {
        router.push('/(main)/(profile)');
      } else {
        router.push(`/user/${userId}`);
      }
    });
  }, [currentUserId, onClose, router]);

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.modal}>
        <KeyboardAvoidingView
          style={styles.modal}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Animated.View style={[styles.backdrop, backdropAnimatedStyle]}>
            <Pressable
              style={styles.backdropPressable}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close comments"
            />
          </Animated.View>

          <Animated.View style={[styles.sheet, sheetAnimatedStyle]}>
          <GestureDetector gesture={resizeGesture}>
            <View
              style={styles.resizeHandle}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel="Resize comments"
              accessibilityValue={{ text: isExpanded ? 'Expanded' : 'Compact' }}
              accessibilityActions={[
                { name: 'increment', label: 'Expand comments' },
                { name: 'decrement', label: 'Compact comments' },
              ]}
              onAccessibilityAction={({ nativeEvent }) => {
                setSheetMode(nativeEvent.actionName === 'increment');
              }}
            >
              <View style={styles.handle} />
            </View>
          </GestureDetector>

          <View style={styles.header}>
            <Text style={styles.title}>Comments</Text>
            <Pressable
              style={styles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close comments"
              hitSlop={8}
            >
              <Ionicons name="close" size={22} color={colors.gray[600]} />
            </Pressable>
          </View>

          <View style={styles.body}>
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
                keyExtractor={(item: CommentWithAuthor) => item.id}
                renderItem={({ item }: { item: CommentWithAuthor }) => (
                  <View style={styles.commentWrapper}>
                    <CommentItem
                      comment={item}
                      currentUserId={currentUserId}
                      onDelete={handleDelete}
                      onProfilePress={handleProfilePress}
                    />
                  </View>
                )}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              />
            )}
          </View>

          <View style={[
            styles.inputBar,
            {
              paddingBottom: keyboardHeight > 0
                ? 0
                : Math.max(insets.bottom, spacing.sm) + spacing.xs,
            },
          ]}>
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
              accessibilityRole="button"
              accessibilityLabel="Post comment"
            >
              {createComment.isPending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons name="send" size={18} color={colors.white} />
              )}
            </Pressable>
          </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  backdropPressable: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  resizeHandle: {
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[300],
  },
  header: {
    position: 'relative',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  title: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.xs,
    padding: spacing.xs,
  },
  body: {
    flex: 1,
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
    minHeight: 40,
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
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.gray[300],
  },
});
