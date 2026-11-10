import React from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@providers/AuthProvider';
import { useCreatePost } from '@/hooks/posts/useCreatePost';
import { PostComposer, type PostDraft } from '@/components/compose/PostComposer';

export default function ComposeScreen() {
  const { user } = useAuth();
  const createPost = useCreatePost();
  const handlePost = async (draft: PostDraft) => {
    if (!user) throw new Error('Please sign in before posting.');
    await createPost.mutateAsync({
      userId: user.id,
      input: {
        caption: draft.contentType === 'caption' ? draft.body : draft.reflectionTitle || undefined,
        reflection: draft.contentType === 'reflection' ? draft.body : undefined,
        contentType: draft.contentType, images: draft.images, isPrivate: draft.isPrivate,
      },
    });
    Alert.alert('Success', draft.isPrivate ? 'Saved to your profile. Only you can see it.' : 'Your post has been shared!', [
      { text: 'OK', onPress: () => router.navigate('/(main)/(feed)') },
    ]);
  };
  return <PostComposer saving={createPost.isPending} onSubmit={handlePost} onClose={() => router.back()} />;
}
