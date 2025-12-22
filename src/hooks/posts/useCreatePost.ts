import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { uploadPostImage } from '@/lib/supabase/storage';
import { queryKeys } from '@/lib/query/keys';
import type { ContentType } from '@/types/database';

interface ImageToUpload {
  uri: string;
  width: number;
  height: number;
  blurhash?: string;
}

interface CreatePostInput {
  caption?: string;
  reflection?: string;
  contentType: ContentType;
  images?: ImageToUpload[];
}

async function createPost(input: CreatePostInput, userId: string) {
  // Create the post first
  const { data: post, error: postError } = await (supabase
    .from('posts') as any)
    .insert({
      author_id: userId,
      caption: input.caption || null,
      reflection: input.reflection || null,
      content_type: input.contentType,
    })
    .select()
    .single();

  if (postError) throw postError;

  // Upload images if any
  if (input.images && input.images.length > 0) {
    const imagePromises = input.images.map(async (image, index) => {
      const { path: storagePath, error: uploadError } = await uploadPostImage(
        userId,
        post.id,
        index,
        image.uri
      );

      if (uploadError || !storagePath) {
        throw uploadError || new Error('Failed to upload image');
      }

      return (supabase.from('post_images') as any).insert({
        post_id: post.id,
        storage_path: storagePath,
        blurhash: image.blurhash || null,
        width: image.width,
        height: image.height,
        position: index,
      });
    });

    const results = await Promise.all(imagePromises);
    const imageError = results.find(r => r.error)?.error;
    if (imageError) throw imageError;
  }

  return post;
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ input, userId }: { input: CreatePostInput; userId: string }) => {
      return createPost(input, userId);
    },
    onSuccess: () => {
      // Invalidate feed queries to show new post
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
    },
  });
}
