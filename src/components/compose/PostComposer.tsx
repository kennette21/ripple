import React, { useEffect, useLayoutEffect, useState, useRef } from 'react';
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
  Keyboard,
  Image as NativeImage,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import { Button, Avatar } from '@components/ui';
import { PostAudiencePicker } from '@/components/post/PostAudiencePicker';
import { useAuth } from '@providers/AuthProvider';
import { getErrorMessage } from '@/lib/errors';
import { hasPostContent } from '@/lib/postContent';
import { PostAlbumGrid } from '@/components/compose/PostAlbumGrid';
import { PostPhotoEditor } from '@/components/compose/PostPhotoEditor';
import type { SelectedPostPhoto } from '@/types/postPhoto';
import {
  clearPostImagePreparation,
  preparePostImage,
} from '@/lib/postImageUpload';
import { colors, spacing, typography, borderRadius } from '@constants/theme';
import { LIMITS } from '@constants/config';

export interface PostDraft {
  contentType: 'caption' | 'reflection';
  body: string;
  reflectionTitle: string;
  images: SelectedPostPhoto[];
  isPrivate: boolean;
}

interface PostComposerProps {
  initialDraft?: PostDraft;
  editing?: boolean;
  saving: boolean;
  onSubmit: (draft: PostDraft) => Promise<void>;
  onClose: () => void;
}

const EMPTY_DRAFT: PostDraft = {
  contentType: 'caption', body: '', reflectionTitle: '', images: [], isPrivate: false,
};
const CAPTION_INPUT_MIN_HEIGHT = 56;
const REFLECTION_INPUT_MIN_HEIGHT = 120;

function clearSelectedPostPhotoPreparation(image: SelectedPostPhoto) {
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

export function PostComposer({ initialDraft = EMPTY_DRAFT, editing = false, saving, onSubmit, onClose }: PostComposerProps) {
  const { profile } = useAuth();
  // Keep the draft's baseline stable when the query refreshes in the background.
  const [initial] = useState(initialDraft);
  const submitting = useRef(false);
  const mediaBusy = useRef(false);
  const mounted = useRef(true);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const imagesRef = useRef<SelectedPostPhoto[]>([]);
  const composerScrollRef = useAnimatedRef<ScrollView>();

  const [contentType, setContentType] = useState<PostDraft['contentType']>(initial.contentType);
  const [body, setBody] = useState(initial.body);
  const [reflectionTitle, setReflectionTitle] = useState(initial.reflectionTitle);
  const [images, setImages] = useState<SelectedPostPhoto[]>(initial.images);
  const [isPrivate, setIsPrivate] = useState(initial.isPrivate);
  const [editingPhoto, setEditingPhoto] = useState<{ id: string; startWithCrop: boolean } | null>(null);
  const photoToEdit = images.find((photo) => photo.id === editingPhoto?.id);

  const maxLength = contentType === 'caption' ? LIMITS.captionMaxLength : LIMITS.reflectionMaxLength;
  const draft: PostDraft = { contentType, body, reflectionTitle, images, isPrivate };
  const hasChanges = contentType !== initial.contentType || body !== initial.body
    || reflectionTitle !== initial.reflectionTitle || isPrivate !== initial.isPrivate
    || images.length !== initial.images.length
    || images.some((photo, index) => photo.id !== initial.images[index]?.id || photo.uri !== initial.images[index]?.uri);
  const disabled = saving || loadingMedia;
  const canPost = hasPostContent(contentType, body, images.length) && body.length <= maxLength
    && (contentType !== 'reflection' || reflectionTitle.length <= 100) && (!editing || hasChanges);

  useLayoutEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      imagesRef.current.forEach(clearSelectedPostPhotoPreparation);
    };
  }, []);

  const startPreparingImage = (image: SelectedPostPhoto) => {
    // Published assets can be kept without downloading or encoding them again.
    if (/^https?:/i.test(image.uri)) return;
    // The global preparation queue yields before doing native work, so this
    // warms the upload artifact without blocking the selection UI.
    void preparePostImage({
      uri: image.uri,
      width: image.width,
      height: image.height,
      alreadyJpeg: image.isCropped,
    }).catch(() => {});
  };

  const openPhotoEditor = async (photo: SelectedPostPhoto, startWithCrop = false) => {
    if (disabled || mediaBusy.current) return;
    Keyboard.dismiss();
    mediaBusy.current = true;
    setLoadingMedia(true);
    try {
      // Older published images may predate stored dimensions. Resolve their
      // real size before opening the editor rather than guessing crop bounds.
      if (!(photo.width > 0 && photo.height > 0)) {
        const size = await NativeImage.getSize(photo.uri);
        if (!mounted.current) return;
        photo = { ...photo, width: size.width, height: size.height, sourceWidth: size.width, sourceHeight: size.height };
        setImages(current => current.map(image => image.id === photo.id ? photo : image));
      }
      setEditingPhoto({ id: photo.id, startWithCrop });
    } catch (error) {
      Alert.alert('Could not open photo', getErrorMessage(error, 'Please try again.'));
    } finally {
      mediaBusy.current = false;
      if (mounted.current) setLoadingMedia(false);
    }
  };

  const applyPhotoEdit = (photo: SelectedPostPhoto) => {
    const previous = images.find((image) => image.id === photo.id);
    if (previous && previous.uri !== photo.uri) {
      clearSelectedPostPhotoPreparation(previous);
      startPreparingImage(photo);
    }
    setImages((current) => current.map((image) => image.id === photo.id ? photo : image));
    setEditingPhoto(null);
  };

  const pickImages = async () => {
    if (disabled || mediaBusy.current) return;
    if (images.length >= LIMITS.maxImagesPerPost) {
      Alert.alert('Limit reached', `You can only add up to ${LIMITS.maxImagesPerPost} images`);
      return;
    }
    Keyboard.dismiss();
    mediaBusy.current = true;
    setLoadingMedia(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsMultipleSelection: true, orderedSelection: true,
        selectionLimit: LIMITS.maxImagesPerPost - images.length, quality: 1,
      });
      if (!mounted.current || result.canceled || !result.assets) return;
      const selectionId = Date.now();
      const newImages = result.assets.slice(0, LIMITS.maxImagesPerPost - images.length).map((asset, index) => ({
        id: `${asset.assetId ?? asset.uri}-${selectionId}-${index}`,
        uri: asset.uri, width: asset.width, height: asset.height, isCropped: false,
        sourceUri: asset.uri, sourceWidth: asset.width, sourceHeight: asset.height,
      }));
      setImages(prev => [...prev, ...newImages]);
      newImages.forEach(startPreparingImage);
    } catch (error) {
      Alert.alert('Could not add photos', getErrorMessage(error, 'Please try again.'));
    } finally {
      mediaBusy.current = false;
      if (mounted.current) setLoadingMedia(false);
    }
  };

  const removeImage = (photo: SelectedPostPhoto) => {
    clearSelectedPostPhotoPreparation(photo);
    setImages((current) => current.filter((image) => image.id !== photo.id));
  };

  const handleClose = () => {
    if (disabled || submitting.current) return;
    if (editing && hasChanges) {
      Alert.alert('Discard changes?', 'Your edits will not be saved.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onClose },
      ]);
    } else onClose();
  };

  const handlePost = async () => {
    if (!canPost || disabled || submitting.current) return;
    submitting.current = true;
    try {
      await onSubmit(draft);
      if (!editing && mounted.current) {
        images.forEach(clearSelectedPostPhotoPreparation);
        setBody(''); setReflectionTitle(''); setImages([]);
        setContentType('caption'); setIsPrivate(false);
      }
    } catch (error) {
      Alert.alert(editing ? 'Could not update post' : 'Could not create post', getErrorMessage(error, 'Please try again.'));
    } finally {
      submitting.current = false;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel={editing ? "Cancel editing post" : "Close composer"}
          hitSlop={8}
          disabled={disabled}
        >
          <Ionicons name="close" size={24} color={colors.gray[600]} />
        </TouchableOpacity>
        <Text style={styles.title}>{editing ? 'Edit Post' : 'New Post'}</Text>
        <Button
          title={editing ? 'Save' : 'Post'}
          onPress={handlePost}
          disabled={!canPost || disabled}
          loading={saving}
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
          disabled={disabled}
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
          disabled={disabled}
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
        <Animated.ScrollView
          ref={composerScrollRef}
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          testID="post-composer-scroll"
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
              <View style={styles.audience}>
                <PostAudiencePicker
                  isPrivate={isPrivate}
                  onChange={setIsPrivate}
                  disabled={disabled}
                  testID={editing ? "edit-audience-picker" : "compose-audience-picker"}
                />
              </View>
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
              editable={!disabled}
            />
          )}

          {/* Native multiline sizing grows this field; only the page scrolls. */}
          <TextInput
            style={[
              styles.input,
              contentType === 'reflection' && styles.inputReflection,
              {
                minHeight: contentType === 'reflection'
                  ? REFLECTION_INPUT_MIN_HEIGHT
                  : CAPTION_INPUT_MIN_HEIGHT,
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
            accessibilityLabel={contentType === 'caption' ? 'Post caption' : 'Post reflection'}
            testID="post-body-input"
            editable={!disabled}
            autoFocus={!editing}
            scrollEnabled={false}
          />

          <Text style={[styles.charCount, body.length > maxLength && styles.charCountOver]}>
            {body.length}/{maxLength}
          </Text>

          <PostAlbumGrid
            scrollableRef={composerScrollRef}
            photos={images}
            onAdd={() => void pickImages()}
            onEdit={(photo, crop) => void openPhotoEditor(photo, crop)}
            onRemove={removeImage}
            onReorder={setImages}
            disabled={disabled}
          />

        </Animated.ScrollView>

        {/* Bottom toolbar - inside KeyboardAvoidingView so it stays visible */}
        <View style={styles.toolbar}>
          <Pressable
            style={styles.toolButton}
            onPress={pickImages}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Add photos"
          >
            <Ionicons name="image-outline" size={24} color={colors.primary[500]} />
            {images.length > 0 && (
              <Text style={styles.imageCount}>{images.length}/{LIMITS.maxImagesPerPost}</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      {photoToEdit && editingPhoto && (
        <PostPhotoEditor
          key={photoToEdit.id}
          photo={photoToEdit}
          startWithCrop={editingPhoto.startWithCrop}
          onApply={applyPhotoEdit}
          onClose={() => setEditingPhoto(null)}
        />
      )}
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
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  authorInfo: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  audience: {
    marginTop: spacing.xs,
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
    minHeight: CAPTION_INPUT_MIN_HEIGHT,
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
});
