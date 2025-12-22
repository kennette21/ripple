import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Button, Avatar } from '@components/ui';
import { useAuth } from '@providers/AuthProvider';
import { useCreatePost } from '@/hooks/posts/useCreatePost';
import { colors, spacing, typography, borderRadius } from '@constants/theme';
import { LIMITS } from '@constants/config';

type ContentType = 'caption' | 'reflection';

interface SelectedImage {
  uri: string;
  width: number;
  height: number;
}

export default function ComposeScreen() {
  const { profile, user } = useAuth();
  const createPost = useCreatePost();

  const [contentType, setContentType] = useState<ContentType>('caption');
  const [caption, setCaption] = useState('');
  const [reflection, setReflection] = useState('');
  const [images, setImages] = useState<SelectedImage[]>([]);

  const content = contentType === 'caption' ? caption : reflection;
  const maxLength = contentType === 'caption' ? LIMITS.captionMaxLength : LIMITS.reflectionMaxLength;
  const canPost = content.trim().length > 0 && content.length <= maxLength;

  const pickImages = async () => {
    if (images.length >= LIMITS.maxImagesPerPost) {
      Alert.alert('Limit reached', `You can only add up to ${LIMITS.maxImagesPerPost} images`);
      return;
    }

    const remaining = LIMITS.maxImagesPerPost - images.length;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const newImages = result.assets.map((asset) => ({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
      }));
      setImages((prev) => [...prev, ...newImages].slice(0, LIMITS.maxImagesPerPost));
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setCaption('');
    setReflection('');
    setImages([]);
    setContentType('caption');
  };

  const handlePost = async () => {
    if (!canPost || !user) return;

    try {
      await createPost.mutateAsync({
        input: {
          caption: contentType === 'caption' ? caption : (caption || undefined),
          reflection: contentType === 'reflection' ? reflection : undefined,
          contentType,
          images,
        },
        userId: user.id,
      });

      // Clear the form after successful post
      resetForm();

      Alert.alert('Success', 'Your post has been shared!', [
        { text: 'OK', onPress: () => router.navigate('/(main)/(feed)') }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create post');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
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

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
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
            value={caption}
            onChangeText={setCaption}
            maxLength={100}
          />
        )}

        <TextInput
          style={[
            styles.input,
            contentType === 'reflection' && styles.inputReflection,
          ]}
          placeholder={
            contentType === 'caption'
              ? "What's on your mind?"
              : 'Share your thoughts in detail...'
          }
          placeholderTextColor={colors.gray[400]}
          value={contentType === 'caption' ? caption : reflection}
          onChangeText={contentType === 'caption' ? setCaption : setReflection}
          multiline
          autoFocus
        />

        <Text style={[styles.charCount, content.length > maxLength && styles.charCountOver]}>
          {content.length}/{maxLength}
        </Text>

        {/* Selected images */}
        {images.length > 0 && (
          <ScrollView horizontal style={styles.imagePreview} showsHorizontalScrollIndicator={false}>
            {images.map((img, index) => (
              <View key={index} style={styles.imageContainer}>
                <Image source={{ uri: img.uri }} style={styles.previewImage} />
                <Pressable style={styles.removeImage} onPress={() => removeImage(index)}>
                  <Ionicons name="close-circle" size={24} color="#fff" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}
      </ScrollView>

      {/* Bottom toolbar */}
      <View style={styles.toolbar}>
        <Pressable style={styles.toolButton} onPress={pickImages}>
          <Ionicons name="image-outline" size={24} color={colors.primary[500]} />
          {images.length > 0 && (
            <Text style={styles.imageCount}>{images.length}/{LIMITS.maxImagesPerPost}</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
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
    minHeight: 200,
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
    marginTop: spacing.md,
  },
  imageContainer: {
    marginRight: spacing.sm,
    position: 'relative',
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
