import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/providers/AuthProvider';
import { useEditablePost, useUpdatePost } from '@/hooks/posts';
import type { EditablePost } from '@/hooks/posts/useEditablePost';
import { PostComposer, type PostDraft } from '@/components/compose/PostComposer';
import { BUCKETS, getPublicUrl } from '@/lib/supabase/storage';
import { colors, spacing, typography } from '@/constants/theme';

export default function EditPostScreen() {
  return <SafeAreaProvider><EditPostContent /></SafeAreaProvider>;
}

function EditPostContent() {
  const router = useRouter();
  const params = useLocalSearchParams<{ postId?: string | string[] }>();
  const { user } = useAuth();
  const postId = Array.isArray(params.postId) ? params.postId[0] : params.postId;
  const query = useEditablePost(postId, user?.id);
  if (postId && (query.isLoading || !user)) {
    return <SafeAreaView style={styles.container}><ActivityIndicator size="large" color={colors.primary[500]} /></SafeAreaView>;
  }
  if (!postId || query.isError || !query.data || query.data.author_id !== user?.id) {
    return (
      <SafeAreaView style={styles.container}>
        <Pressable onPress={() => router.back()} style={styles.close} accessibilityRole="button" accessibilityLabel="Cancel editing post">
          <Ionicons name="close" size={24} color={colors.gray[600]} />
        </Pressable>
        <Text style={styles.title}>Couldn’t load post</Text>
        <Text style={styles.message}>It may have been deleted or is no longer available to edit.</Text>
      </SafeAreaView>
    );
  }
  return <LoadedEditPost key={query.data.id} post={query.data} userId={user.id} />;
}

export function LoadedEditPost({ post, userId }: { post: EditablePost; userId: string }) {
  const router = useRouter();
  const updatePost = useUpdatePost();
  // Background query refreshes must not replace this draft or its image baseline.
  const [original] = useState(post);
  const [initialDraft] = useState<PostDraft>(() => ({
    contentType: original.content_type === 'caption' ? 'caption' : 'reflection',
    body: (original.content_type === 'caption' ? original.caption : original.reflection) ?? '',
    reflectionTitle: original.content_type === 'caption' ? '' : original.caption ?? '',
    isPrivate: original.is_private,
    images: [...original.images].sort((a, b) => a.position - b.position).map(image => {
      const uri = getPublicUrl(BUCKETS.POST_IMAGES, image.storage_path);
      return {
        id: image.id, uri, width: image.width ?? 0, height: image.height ?? 0,
        isCropped: false, sourceUri: uri, sourceWidth: image.width ?? 0, sourceHeight: image.height ?? 0,
      };
    }),
  }));
  const save = async (draft: PostDraft) => {
    await updatePost.mutateAsync({
      postId: original.id, userId,
      caption: draft.contentType === 'caption' ? draft.body : draft.reflectionTitle,
      reflection: draft.contentType === 'reflection' ? draft.body : '',
      contentType: draft.contentType === 'reflection' && original.content_type === 'both' ? 'both' : draft.contentType,
      isPrivate: draft.isPrivate, images: draft.images, originalImages: original.images,
      originalContentType: original.content_type, originalIsPrivate: original.is_private,
    });
    router.back();
  };
  return <PostComposer editing initialDraft={initialDraft} saving={updatePost.isPending} onSubmit={save} onClose={() => router.back()} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  close: { position: 'absolute', top: spacing.xl, left: spacing.md, padding: spacing.sm },
  title: { fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.semibold, color: colors.gray[900] },
  message: { marginTop: spacing.sm, textAlign: 'center', color: colors.gray[500] },
});
