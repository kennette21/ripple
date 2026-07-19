import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { Avatar, Button } from '@components/ui';
import { useAuth } from '@/providers/AuthProvider';
import { usePost, useUpdatePost } from '@/hooks/posts';
import { getErrorMessage } from '@/lib/errors';
import { BUCKETS, getPublicUrl } from '@/lib/supabase/storage';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { LIMITS } from '@/constants/config';
import type { PostImage } from '@/types/database';

const REFLECTION_TITLE_MAX_LENGTH = 100;
const REFLECTION_INPUT_MIN_HEIGHT = 120;

export default function EditPostScreen() {
  return (
    <SafeAreaProvider style={styles.safeAreaProvider}>
      <EditPostContent />
    </SafeAreaProvider>
  );
}

function EditPostContent() {
  const router = useRouter();
  const params = useLocalSearchParams<{ postId?: string | string[] }>();
  const { profile, user } = useAuth();
  const rawPostId = params.postId;
  const postId = Array.isArray(rawPostId) ? rawPostId[0] : rawPostId;
  const postQuery = usePost(postId, user?.id);
  const updatePost = useUpdatePost();
  const initializedPostId = useRef<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const [caption, setCaption] = useState('');
  const [reflection, setReflection] = useState('');
  const [images, setImages] = useState<PostImage[]>([]);
  const [inputHeight, setInputHeight] = useState(100);
  const [isReordering, setIsReordering] = useState(false);

  const post = postQuery.data;
  const isOwner = Boolean(post && user?.id === post.author_id);
  const isReflection = Boolean(post && post.content_type !== 'caption');
  const primaryContent = isReflection ? reflection : caption;
  const maxLength = isReflection
    ? LIMITS.reflectionMaxLength
    : LIMITS.captionMaxLength;
  const originalImages = post
    ? [...post.images].sort((a, b) => a.position - b.position)
    : [];
  const imagesHaveChanged = Boolean(
    post &&
      (images.length !== originalImages.length ||
        images.some((image, index) => image.id !== originalImages[index]?.id))
  );
  const hasChanges = Boolean(
    post &&
      initializedPostId.current === post.id &&
      (caption !== (post.caption ?? '') ||
        reflection !== (post.reflection ?? '') ||
        imagesHaveChanged)
  );
  const hasRequiredContent = isReflection
    ? reflection.trim().length > 0
    : caption.trim().length > 0;
  const canSave =
    isOwner &&
    hasChanges &&
    hasRequiredContent &&
    primaryContent.length <= maxLength &&
    caption.length <= (isReflection
      ? REFLECTION_TITLE_MAX_LENGTH
      : LIMITS.captionMaxLength);

  useEffect(() => {
    if (!post || initializedPostId.current === post.id) return;

    initializedPostId.current = post.id;
    setCaption(post.caption ?? '');
    setReflection(post.reflection ?? '');
    setImages([...post.images].sort((a, b) => a.position - b.position));
  }, [post]);

  const moveImage = (fromIndex: number, direction: 'left' | 'right') => {
    const toIndex = direction === 'left' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= images.length) return;

    setImages((currentImages) => {
      const nextImages = [...currentImages];
      [nextImages[fromIndex], nextImages[toIndex]] = [
        nextImages[toIndex],
        nextImages[fromIndex],
      ];
      return nextImages;
    });
    void Haptics.selectionAsync().catch(() => {});
  };

  const handleRemoveImage = (image: PostImage, index: number) => {
    Alert.alert(
      'Remove photo?',
      `Photo ${index + 1} will be removed from this post when you save.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setImages((currentImages) =>
              currentImages.filter((currentImage) => currentImage.id !== image.id)
            );
            void Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Warning
            ).catch(() => {});
          },
        },
      ]
    );
  };

  const renderImage = ({
    item,
    getIndex,
    drag,
    isActive,
  }: RenderItemParams<PostImage>) => {
    const index = getIndex() ?? 0;
    const accessibilityActions = [
      ...(index > 0
        ? [{ name: 'decrement' as const, label: 'Move photo left' }]
        : []),
      ...(index < images.length - 1
        ? [{ name: 'increment' as const, label: 'Move photo right' }]
        : []),
    ];

    const startDrag = () => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
        () => {}
      );
      drag();
    };

    return (
      <ScaleDecorator activeScale={1.06}>
        <View
          style={[
            styles.imageContainer,
            isActive && styles.imageContainerActive,
          ]}
        >
          <Pressable
            onLongPress={images.length > 1 ? startDrag : undefined}
            delayLongPress={200}
            disabled={isActive}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Photo ${index + 1} of ${images.length}`}
            accessibilityHint={
              images.length > 1
                ? 'Long press and drag to change its position.'
                : undefined
            }
            accessibilityActions={accessibilityActions}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'decrement') {
                moveImage(index, 'left');
              }
              if (event.nativeEvent.actionName === 'increment') {
                moveImage(index, 'right');
              }
            }}
          >
            <Image
              source={{ uri: getPublicUrl(BUCKETS.POST_IMAGES, item.storage_path) }}
              style={styles.previewImage}
              placeholder={item.blurhash || undefined}
              contentFit="cover"
              transition={150}
            />
          </Pressable>
          <Pressable
            style={styles.removeImage}
            onPress={() => handleRemoveImage(item, index)}
            disabled={updatePost.isPending || isActive}
            accessibilityRole="button"
            accessibilityLabel={`Remove photo ${index + 1}`}
          >
            <Ionicons name="close-circle" size={24} color={colors.white} />
          </Pressable>
          <View style={styles.positionBadge} pointerEvents="none">
            <Text style={styles.positionText}>{index + 1}</Text>
          </View>
        </View>
      </ScaleDecorator>
    );
  };

  const handleClose = () => {
    if (!hasChanges) {
      router.back();
      return;
    }

    Alert.alert(
      'Discard changes?',
      'Your edits will not be saved.',
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]
    );
  };

  const handleSave = async () => {
    if (!post || !user || !canSave) return;

    try {
      await updatePost.mutateAsync({
        postId: post.id,
        authorId: user.id,
        contentType: post.content_type,
        caption: caption.trim(),
        reflection: reflection.trim(),
        imageIds: images.map((image) => image.id),
      });
      router.back();
    } catch (error) {
      Alert.alert(
        'Could not update post',
        getErrorMessage(error, 'Please try again.')
      );
    }
  };

  const renderStatus = (
    icon: React.ComponentProps<typeof Ionicons>['name'],
    title: string,
    message: string
  ) => (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Cancel editing post"
          hitSlop={8}
        >
          <Ionicons name="close" size={24} color={colors.gray[600]} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Post</Text>
        <View style={styles.headerActionSpacer} />
      </View>
      <View style={styles.statusContainer}>
        <Ionicons name={icon} size={36} color={colors.gray[400]} />
        <Text style={styles.statusTitle}>{title}</Text>
        <Text style={styles.statusMessage}>{message}</Text>
      </View>
    </SafeAreaView>
  );

  if (!postId) {
    return renderStatus(
      'alert-circle-outline',
      'Post unavailable',
      'No post was selected for editing.'
    );
  }

  if (postQuery.isLoading || !user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={styles.loadingText}>Loading post…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (postQuery.isError || !post) {
    return renderStatus(
      'alert-circle-outline',
      'Couldn’t load post',
      'It may have been deleted or is no longer available.'
    );
  }

  if (!isOwner) {
    return renderStatus(
      'lock-closed-outline',
      'This post can’t be edited',
      'Only the post’s author can make changes.'
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={handleClose}
          disabled={updatePost.isPending}
          accessibilityRole="button"
          accessibilityLabel="Cancel editing post"
          hitSlop={8}
        >
          <Ionicons name="close" size={24} color={colors.gray[600]} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Post</Text>
        <Button
          title="Save"
          onPress={handleSave}
          disabled={!canSave || updatePost.isPending}
          loading={updatePost.isPending}
          size="sm"
        />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          scrollEnabled={!isReordering}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.authorRow}>
            <Avatar
              uri={profile?.avatar_url}
              name={profile?.display_name}
              size="md"
            />
            <View style={styles.authorInfo}>
              <Text style={styles.authorName}>{profile?.display_name}</Text>
              <Text style={styles.authorUsername}>@{profile?.username}</Text>
            </View>
          </View>

          {isReflection && (
            <TextInput
              style={styles.titleInput}
              value={caption}
              onChangeText={setCaption}
              placeholder="Title (optional)"
              placeholderTextColor={colors.gray[400]}
              maxLength={REFLECTION_TITLE_MAX_LENGTH}
              editable={!updatePost.isPending}
              testID="edit-post-title-input"
            />
          )}

          <TextInput
            style={[
              styles.input,
              isReflection && styles.inputReflection,
              {
                minHeight: isReflection
                  ? Math.max(REFLECTION_INPUT_MIN_HEIGHT, inputHeight)
                  : 100,
              },
            ]}
            value={primaryContent}
            onChangeText={isReflection ? setReflection : setCaption}
            placeholder={
              isReflection
                ? 'Share your thoughts in detail...'
                : 'Write a caption (optional)'
            }
            placeholderTextColor={colors.gray[400]}
            multiline
            textAlignVertical="top"
            scrollEnabled={false}
            maxLength={maxLength}
            editable={!updatePost.isPending}
            testID="edit-post-content-input"
            onContentSizeChange={(event) => {
              const newHeight = event.nativeEvent.contentSize.height;
              setInputHeight(newHeight);
              if (isReflection && newHeight > REFLECTION_INPUT_MIN_HEIGHT) {
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 100);
              }
            }}
          />

          <Text style={styles.charCount}>
            {primaryContent.length}/{maxLength}
          </Text>

          {post.images.length > 0 && (
            <View style={styles.imageOrderSection}>
              {images.length > 0 ? (
                <>
                  {images.length > 1 && (
                    <View style={styles.reorderHint}>
                      <Ionicons
                        name="reorder-three-outline"
                        size={16}
                        color={colors.gray[500]}
                      />
                      <Text style={styles.reorderHintText}>
                        Hold and drag · Photo 1 appears first
                      </Text>
                    </View>
                  )}
                  <DraggableFlatList
                    horizontal
                    data={images}
                    keyExtractor={(item) => item.id}
                    renderItem={renderImage}
                    onDragBegin={() => setIsReordering(true)}
                    onRelease={() => setIsReordering(false)}
                    onDragEnd={({ data }) => {
                      setImages(data);
                      setIsReordering(false);
                      void Haptics.selectionAsync().catch(() => {});
                    }}
                    autoscrollThreshold={60}
                    autoscrollSpeed={120}
                    dragItemOverflow
                    showsHorizontalScrollIndicator={false}
                    removeClippedSubviews={false}
                    style={styles.imagePreview}
                    contentContainerStyle={styles.imagePreviewContent}
                    testID="edit-post-image-list"
                  />
                </>
              ) : (
                <Text style={styles.emptyPhotosText}>
                  No photos will remain on this post.
                </Text>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeAreaProvider: {
    flex: 1,
    backgroundColor: colors.white,
  },
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  headerIconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -10,
    borderRadius: borderRadius.full,
  },
  title: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  headerActionSpacer: {
    width: 64,
    height: 36,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  authorInfo: {
    marginLeft: spacing.sm,
  },
  authorName: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  authorUsername: {
    fontSize: typography.fontSizes.sm,
    color: colors.gray[500],
  },
  titleInput: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  input: {
    fontSize: typography.fontSizes.lg,
    color: colors.gray[900],
    lineHeight: 26,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputReflection: {
    minHeight: REFLECTION_INPUT_MIN_HEIGHT,
    fontSize: typography.fontSizes.md,
    lineHeight: 24,
  },
  charCount: {
    alignSelf: 'flex-end',
    fontSize: typography.fontSizes.sm,
    color: colors.gray[400],
    marginTop: spacing.md,
  },
  imagePreview: {
    height: 116,
    flexGrow: 0,
  },
  imagePreviewContent: {
    paddingTop: spacing.sm,
    paddingRight: spacing.sm,
  },
  imageOrderSection: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  reorderHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  reorderHintText: {
    color: colors.gray[500],
    fontSize: typography.fontSizes.xs,
  },
  imageContainer: {
    marginRight: spacing.sm,
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: borderRadius.md,
  },
  imageContainerActive: {
    opacity: 0.92,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.md,
  },
  removeImage: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
  },
  positionBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: borderRadius.full,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  positionText: {
    color: colors.white,
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
  },
  emptyPhotosText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSizes.sm,
    color: colors.gray[500],
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.fontSizes.sm,
    color: colors.gray[500],
  },
  statusContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  statusTitle: {
    marginTop: spacing.md,
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  statusMessage: {
    marginTop: spacing.sm,
    textAlign: 'center',
    fontSize: typography.fontSizes.sm,
    lineHeight: 20,
    color: colors.gray[500],
  },
});
