import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EmptyState, LoadingScreen } from '@components/common';
import { PostCard } from '@/components/post/PostCard';
import { usePost } from '@/hooks/posts';
import { useAuth } from '@providers/AuthProvider';
import { useImageZoomActive } from '@/providers/ImageZoomProvider';
import { colors, spacing, typography } from '@constants/theme';

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

interface MeasurableScrollView {
  measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void
  ) => void;
}

export default function PostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string | string[];
    commentId?: string | string[];
  }>();
  const postId = firstParam(params.id);
  const focusedCommentId = firstParam(params.commentId);
  const { user } = useAuth();
  const isZoomActive = useImageZoomActive();
  const { data: post, isError, isLoading, refetch } = usePost(postId, user?.id);
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const positionedCommentRef = useRef<string | null>(null);
  const [isCommentThreadActive, setIsCommentThreadActive] = useState(
    !!focusedCommentId
  );

  useEffect(() => {
    positionedCommentRef.current = null;
    setIsCommentThreadActive(!!focusedCommentId);
  }, [focusedCommentId, postId]);

  const revealView = useCallback((
    view: View,
    alignToTop: boolean,
    onPositioned?: () => void
  ) => {
    requestAnimationFrame(() => {
      view.measureInWindow((_x, viewY, _width, viewHeight) => {
        const nativeScrollView = scrollRef.current?.getNativeScrollRef() as
          | MeasurableScrollView
          | undefined;

        nativeScrollView?.measureInWindow(
          (_scrollX, scrollY, _scrollWidth, scrollHeight) => {
            const visibleTop = scrollY + spacing.md;
            const visibleBottom = scrollY + scrollHeight - spacing.md;
            const viewBottom = viewY + viewHeight;
            let offsetDelta = 0;

            if (alignToTop || viewY < visibleTop) {
              offsetDelta = viewY - visibleTop;
            } else if (viewBottom > visibleBottom) {
              offsetDelta = viewBottom - visibleBottom;
            }

            if (Math.abs(offsetDelta) >= 1) {
              scrollRef.current?.scrollTo({
                y: Math.max(0, scrollOffsetRef.current + offsetDelta),
                animated: true,
              });
            }

            if (onPositioned) {
              requestAnimationFrame(onPositioned);
            }
          }
        );
      });
    });
  }, []);

  const handleFocusedCommentPositioned = useCallback((comment: View) => {
    if (
      !focusedCommentId
      || positionedCommentRef.current === focusedCommentId
    ) {
      return;
    }

    positionedCommentRef.current = focusedCommentId;
    revealView(comment, true);
  }, [focusedCommentId, revealView]);

  const handleCommentComposerActivated = useCallback((
    composer: View,
    onPositioned?: () => void
  ) => {
    revealView(composer, false, onPositioned);
  }, [revealView]);

  const handleScroll = useCallback((
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          style={styles.headerButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color={colors.gray[700]} />
        </Pressable>
        <Text style={styles.headerTitle}>Post</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {isLoading ? (
        <LoadingScreen />
      ) : !post || isError ? (
        <EmptyState
          icon="document-text-outline"
          title="Post unavailable"
          description="It may have been removed or is no longer visible to you."
          actionLabel="Try Again"
          onAction={() => void refetch()}
        />
      ) : (
        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            ref={scrollRef}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            scrollEnabled={!isZoomActive}
          >
            <PostCard
              post={post}
              currentUserId={user?.id}
              commentsInitiallyVisible={!!focusedCommentId}
              focusedCommentId={focusedCommentId}
              isCommentThreadActive={isCommentThreadActive}
              onCommentComposerActivated={handleCommentComposerActivated}
              onCommentThreadActiveChange={(activePostId) =>
                setIsCommentThreadActive(activePostId === post.id)
              }
              onFocusedCommentPositioned={handleFocusedCommentPositioned}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
    backgroundColor: colors.white,
  },
  headerButton: {
    width: 32,
    alignItems: 'flex-start',
  },
  headerPlaceholder: {
    width: 32,
  },
  headerTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
});
