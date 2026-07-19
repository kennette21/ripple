import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';
import type { Post, PostImage } from '@/types/database';

export type EditablePostImage = Pick<
  PostImage,
  'id' | 'storage_path' | 'blurhash' | 'position'
>;

export type EditablePost = Pick<
  Post,
  | 'id'
  | 'author_id'
  | 'caption'
  | 'reflection'
  | 'content_type'
> & {
  images: EditablePostImage[];
};

async function fetchEditablePost(
  postId: string,
  userId: string
): Promise<EditablePost> {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      id,
      author_id,
      caption,
      reflection,
      content_type,
      images:post_images (
        id,
        storage_path,
        blurhash,
        position
      )
    `)
    .eq('id', postId)
    .eq('author_id', userId)
    .is('deleted_at', null)
    .single();

  if (error) throw error;

  return data;
}

export function useEditablePost(
  postId: string | undefined,
  userId: string | undefined
) {
  return useQuery({
    queryKey: queryKeys.posts.edit(postId ?? '', userId ?? ''),
    queryFn: () => fetchEditablePost(postId!, userId!),
    enabled: Boolean(postId && userId),
  });
}
