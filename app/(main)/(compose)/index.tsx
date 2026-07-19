import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { Button, Avatar } from '@components/ui';
import { useAuth } from '@providers/AuthProvider';
import { useCreatePost } from '@/hooks/posts/useCreatePost';
import { getErrorMessage } from '@/lib/errors';
import { startImageCropSession } from '@/lib/imageCropSession';
import {
  clearPostImagePreparation,
  preparePostImage,
} from '@/lib/postImageUpload';
import { colors, spacing, typography, borderRadius } from '@constants/theme';
import { LIMITS } from '@constants/config';

type ContentType = 'caption' | 'reflection';
const REFLECTION_INPUT_MIN_HEIGHT = 120;

interface SelectedImage {
  id: string;
  uri: string;
  width: number;
  height: number;
  isCropped: boolean;
  sourceUri: string;
  sourceWidth: number;
  sourceHeight: number;
}

function clearSelectedImagePreparation(image: SelectedImage) {
  clearPostImagePreparation({
    uri: image.uri,
    width: image.width,
    height: image.height,
    alreadyJpeg: image.isCropped,
  });

  if (image.uri !== image.sourceUri) {
    clearPostImagePreparation({
      uri: image.sourceUri,
      width: image.sourceWidth,
      height: image.sourceHeight,
      alreadyJpeg: false,
    });
  }
}

export default function ComposeScreen() {
  const { profile, user } = useAuth();
  const createPost = useCreatePost();
  const scrollViewRef = useRef<ScrollView>(null);
  const imagesRef = useRef<SelectedImage[]>([]);

  const [contentType, setContentType] = useState<ContentType>('caption');
  const [body, setBody] = useState('');
  const [reflectionTitle, setReflectionTitle] = useState('');
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [inputHeight, setInputHeight] = useState(100);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isReordering, setIsReordering] = useState(false);

  const maxLength = contentType === 'caption' ? LIMITS.captionMaxLength : LIMITS.reflectionMaxLength;
  const canPost = body.trim().length > 0 && body.length <= maxLength;

  imagesRef.current = images;

  useEffect(() => {
    return () => {
      imagesRef.current.forEach(clearSelectedImagePreparation);
    };
  }, []);

  const startPreparingImage = (image: SelectedImage) => {
    // The global preparation queue yields before doing native work, so this
    // warms the upload artifact without blocking the selection UI.
    void preparePostImage({
      uri: image.uri,
      width: image.width,
      height: image.height,
      alreadyJpeg: image.isCropped,
    }).catch(() => {});
  };

  const moveImage = (fromIndex: number, direction: 'left' | 'right') => {
    const toIndex = direction === 'left' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= images.length) return;
    setImages((prev) => {
      const next = [...prev];
      [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
      return next;
    });
  };

  const openCrop = (image: SelectedImage) => {
    startImageCropSession({
      imageUri: image.sourceUri,
      imageWidth: image.sourceWidth,
      imageHeight: image.sourceHeight,
      onCrop: (uri, width, height) => {
        const croppedImage = {
          ...image,
          uri,
          width,
          height,
          isCropped: true,
        };
        clearSelectedImagePreparation(image);
        setImages((currentImages) =>
          currentImages.map((currentImage) =>
            currentImage.id === image.id
              ? croppedImage
              : currentImage
          )
        );
        startPreparingImage(croppedImage);
      },
    });
    router.push('/crop');
  };

  const pickImages = async () => {
    if (images.length >= LIMITS.maxImagesPerPost) {
      Alert.alert('Limit reached', `You can only add up to ${LIMITS.maxImagesPerPost} images`);
      return;
    }

    const remaining = LIMITS.maxImagesPerPost - images.length;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      orderedSelection: true,
      selectionLimit: remaining,
      // Keep the best local source; preparePostImage performs the single
      // controlled JPEG encode before anything is uploaded.
      quality: 1,
    });

    if (!result.canceled && result.assets) {
      const selectionId = Date.now();
      const newImages = result.assets.map((asset, index) => ({
        id: `${asset.assetId ?? asset.uri}-${selectionId}-${index}`,
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        isCropped: false,
        sourceUri: asset.uri,
        sourceWidth: asset.width,
        sourceHeight: asset.height,
      }));
      setImages((prev) => [...prev, ...newImages].slice(0, LIMITS.maxImagesPerPost));
      newImages.forEach(startPreparingImage);
    }
  };

  const removeImage = (index: number) => {
    const image = images[index];
    if (image) clearSelectedImagePreparation(image);
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const renderImage = ({ item, getIndex, drag, isActive }: RenderItemParams<SelectedImage>) => {
    const index = getIndex() ?? 0;
    const accessibilityActions = [
      ...(index > 0 ? [{ name: 'decrement' as const, label: 'Move photo left' }] : []),
      ...(index < images.length - 1
        ? [{ name: 'increment' as const, label: 'Move photo right' }]
        : []),
    ];

    const startDrag = () => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      drag();
    };

    return (
      <ScaleDecorator activeScale={1.06}>
        <View style={[styles.imageContainer, isActive && styles.imageContainerActive]}>
          <Pressable
            onPress={() => openCrop(item)}
            onLongPress={images.length > 1 ? startDrag : undefined}
            delayLongPress={200}
            disabled={isActive || createPost.isPending}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Photo ${index + 1} of ${images.length}`}
            accessibilityHint={
              images.length > 1
                ? 'Tap to crop. Long press and drag to change its position.'
                : 'Tap to crop.'
            }
            accessibilityActions={accessibilityActions}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'decrement') moveImage(index, 'left');
              if (event.nativeEvent.actionName === 'increment') moveImage(index, 'right');
            }}
          >
            <Image source={{ uri: item.uri }} style={styles.previewImage} />
            <View style={styles.cropBadge} pointerEvents="none">
              <Ionicons name="crop" size={14} color={colors.white} />
            </View>
          </Pressable>
          <Pressable
            style={styles.removeImage}
            onPress={() => removeImage(index)}
            disabled={createPost.isPending}
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

  const resetForm = () => {
    images.forEach(clearSelectedImagePreparation);
    setBody('');
    setReflectionTitle('');
    setImages([]);
    setContentType('caption');
    setIsPrivate(false);
  };

  const handlePost = async () => {
    if (!canPost || !user) return;

    try {
      await createPost.mutateAsync({
        input: {
          caption: contentType === 'caption' ? body : (reflectionTitle || undefined),
          reflection: contentType === 'reflection' ? body : undefined,
          contentType,
          images,
          isPrivate,
        },
        userId: user.id,
      });

      // Clear the form after successful post
      resetForm();

      Alert.alert('Success', 'Your post has been shared!', [
        { text: 'OK', onPress: () => router.navigate('/(main)/(feed)') }
      ]);
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error, 'Failed to create post'));
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          disabled={createPost.isPending}
        >
          <Ionicons name="close" size={24} color={colors.gray[600]} />
        </TouchableOpacity>
        <Text style={styles.title}>New Post</Text>
        <Button
          title="Post"
          onPress={handlePost}
          disabled={!canPost}
          loading={createPost.isPending}
          size="sm"
        />
      </View>

      <View style={styles.typeSelector}>
        <TouchableOpacity
          style={[
            styles.typeButton,
            contentType === 'caption' && styles.typeButtonActive,
          ]}
          onPress={() => setContentType('caption')}
        >
          <Ionicons
            name="chatbubble-outline"
            size={18}
            color={contentType === 'caption' ? colors.primary[500] : colors.gray[500]}
          />
          <Text
            style={[
              styles.typeButtonText,
              contentType === 'caption' && styles.typeButtonTextActive,
            ]}
          >
            Caption
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.typeButton,
            contentType === 'reflection' && styles.typeButtonActive,
          ]}
          onPress={() => setContentType('reflection')}
        >
          <Ionicons
            name="document-text-outline"
            size={18}
            color={contentType === 'reflection' ? colors.primary[500] : colors.gray[500]}
          />
          <Text
            style={[
              styles.typeButtonText,
              contentType === 'reflection' && styles.typeButtonTextActive,
            ]}
          >
            Reflection
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
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

          {contentType === 'reflection' && (
            <TextInput
              style={styles.titleInput}
              placeholder="Title (optional)"
              placeholderTextColor={colors.gray[400]}
              value={reflectionTitle}
              onChangeText={setReflectionTitle}
              maxLength={100}
            />
          )}

          <TextInput
            style={[
              styles.input,
              contentType === 'reflection' && styles.inputReflection,
              {
                minHeight: contentType === 'reflection'
                  ? Math.max(REFLECTION_INPUT_MIN_HEIGHT, inputHeight)
                  : 100,
              },
            ]}
            placeholder={
              contentType === 'caption'
                ? 'Write a caption (optional)'
                : 'Share your thoughts in detail...'
            }
            placeholderTextColor={colors.gray[400]}
            value={body}
            onChangeText={setBody}
            multiline
            autoFocus
            scrollEnabled={false}
            onContentSizeChange={(e) => {
              const newHeight = e.nativeEvent.contentSize.height;
              setInputHeight(newHeight);
              // Auto-scroll when content grows
              if (
                contentType === 'reflection' &&
                newHeight > REFLECTION_INPUT_MIN_HEIGHT
              ) {
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 100);
              }
            }}
          />

        <Text style={[styles.charCount, body.length > maxLength && styles.charCountOver]}>
          {body.length}/{maxLength}
        </Text>

        {/* Selected images */}
        {images.length > 0 && (
          <View style={styles.imageOrderSection}>
            {images.length > 1 && (
              <View style={styles.reorderHint}>
                <Ionicons name="reorder-three-outline" size={16} color={colors.gray[500]} />
                <Text style={styles.reorderHintText}>Hold and drag · Photo 1 appears first</Text>
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
                void Haptics.selectionAsync();
              }}
              autoscrollThreshold={60}
              autoscrollSpeed={120}
              dragItemOverflow
              showsHorizontalScrollIndicator={false}
              removeClippedSubviews={false}
              style={styles.imagePreview}
              contentContainerStyle={styles.imagePreviewContent}
            />
          </View>
          )}

        </ScrollView>

        {/* Bottom toolbar - inside KeyboardAvoidingView so it stays visible */}
        <View style={styles.toolbar}>
          <Pressable
            style={styles.toolButton}
            onPress={pickImages}
            disabled={createPost.isPending}
          >
            <Ionicons name="image-outline" size={24} color={colors.primary[500]} />
            {images.length > 0 && (
              <Text style={styles.imageCount}>{images.length}/{LIMITS.maxImagesPerPost}</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.privateToggle}
            onPress={() => setIsPrivate(!isPrivate)}
          >
            <Ionicons
              name={isPrivate ? 'lock-closed' : 'globe-outline'}
              size={18}
              color={isPrivate ? colors.primary[500] : colors.gray[500]}
            />
            <Text style={[
              styles.privateText,
              isPrivate && styles.privateTextActive,
            ]}>
              {isPrivate
                ? contentType === 'reflection'
                  ? 'Private reflection'
                  : 'Private caption'
                : 'Public'}
            </Text>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ false: colors.gray[200], true: colors.primary[200] }}
              thumbColor={isPrivate ? colors.primary[500] : colors.gray[400]}
              style={styles.switch}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  title: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  typeSelector: {
    flexDirection: 'row',
    padding: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray[50],
  },
  typeButtonActive: {
    backgroundColor: colors.primary[50],
  },
  typeButtonText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.gray[500],
  },
  typeButtonTextActive: {
    color: colors.primary[500],
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
  charCountOver: {
    color: colors.error.main,
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
  cropBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: borderRadius.sm,
    padding: 2,
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
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
    backgroundColor: colors.white,
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    gap: spacing.xs,
  },
  imageCount: {
    fontSize: typography.fontSizes.sm,
    color: colors.gray[500],
  },
  privateToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  privateText: {
    fontSize: typography.fontSizes.sm,
    color: colors.gray[500],
    fontWeight: typography.fontWeights.medium,
  },
  privateTextActive: {
    color: colors.primary[500],
  },
  switch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
});
