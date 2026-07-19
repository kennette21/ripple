import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { BUCKETS, uploadPostImage } from '@/lib/supabase/storage';
import { preparePostImage } from '@/lib/postImageUpload';
import { queryKeys } from '@/lib/query/keys';
import type { ContentType } from '@/types/database';

interface ImageToUpload {
  uri: string;
  width: number;
  height: number;
  isCropped: boolean;
  blurhash?: string;
}

interface CreatePostInput {
  caption?: string;
  reflection?: string;
  contentType: ContentType;
  images?: ImageToUpload[];
  isPrivate?: boolean;
}

async function prepareImages(images: ImageToUpload[]): Promise<ImageToUpload[]> {
  return Promise.all(
    images.map(async (image) => {
      const preparedImage = await preparePostImage({
        uri: image.uri,
        width: image.width,
        height: image.height,
        alreadyJpeg: image.isCropped,
      });

      return {
        ...image,
        ...preparedImage,
      };
    })
  );
}

interface UploadedImage {
  row: {
    post_id: string;
    storage_path: string;
    blurhash: string | null;
    width: number;
    height: number;
    position: number;
  };
  storagePath: string;
}

async function rollbackCreatedPost(
  postId: string,
  storagePaths: string[]
): Promise<unknown[]> {
  const rollbackErrors: unknown[] = [];

  if (storagePaths.length > 0) {
    const { error } = await supabase.storage
      .from(BUCKETS.POST_IMAGES)
      .remove(storagePaths);
    if (error) rollbackErrors.push(error);
  }

  const { data: softDeleted, error: softDeleteError } = await supabase.rpc(
    'soft_delete_post',
    { p_post_id: postId }
  );

  if (softDeleteError) {
    rollbackErrors.push(softDeleteError);
    return rollbackErrors;
  }

  if (softDeleted !== true) {
    rollbackErrors.push(new Error('The failed post could not be rolled back.'));
    return rollbackErrors;
  }

  const { error: deleteError } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId);
  if (deleteError) rollbackErrors.push(deleteError);

  return rollbackErrors;
}

async function createPost(input: CreatePostInput, userId: string) {
  const preparedImages = await prepareImages(input.images ?? []);

  // Create the post first
  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert({
      author_id: userId,
      caption: input.caption || null,
      reflection: input.reflection || null,
      content_type: input.contentType,
      is_private: input.isPrivate || false,
    })
    .select()
    .single();

  if (postError) throw postError;

  if (preparedImages.length === 0) return post;

  const uploadedImages: UploadedImage[] = [];

  try {
    const uploadResults = await Promise.all(
      preparedImages.map(async (image, index) => {
        const { path, error } = await uploadPostImage(
          userId,
          post.id,
          index,
          image.uri
        );

        if (error || !path) {
          return {
            error: error || new Error('Failed to upload image'),
            uploadedImage: null,
          };
        }

        return {
          error: null,
          uploadedImage: {
            storagePath: path,
            row: {
              post_id: post.id,
              storage_path: path,
              blurhash: image.blurhash || null,
              width: image.width,
              height: image.height,
              position: index,
            },
          },
        };
      })
    );

    for (const result of uploadResults) {
      if (result.uploadedImage) uploadedImages.push(result.uploadedImage);
    }

    const failedUpload = uploadResults.find((result) => result.error);
    if (failedUpload?.error) throw failedUpload.error;

    const { error: imageError } = await supabase
      .from('post_images')
      .insert(uploadedImages.map((image) => image.row));

    if (imageError) throw imageError;
  } catch (error) {
    const rollbackErrors = await rollbackCreatedPost(
      post.id,
      uploadedImages.map((image) => image.storagePath)
    );

    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        'Post creation failed and cleanup was incomplete.'
      );
    }

    throw error;
  }

  return post;
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ input, userId }: { input: CreatePostInput; userId: string }) =>
      createPost(input, userId),
    onSuccess: () => {
      // Invalidate feed queries to show new post
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
    },
  });
}
