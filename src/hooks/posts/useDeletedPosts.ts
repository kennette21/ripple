import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';
import type { Post, PostImage } from '@/types/database';

const POSTS_PER_PAGE = 20;

export interface DeletedPost extends Post {
  deleted_at: string;
  images: PostImage[];
}

interface DeletedPostsPage {
  posts: DeletedPost[];
  nextCursor: string | null;
}

async function fetchDeletedPosts(
  userId: string,
  cursor?: string
): Promise<DeletedPostsPage> {
  let query = supabase
    .from('posts')
    .select(`
      *,
      images:post_images(*)
    `)
    .eq('author_id', userId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(POSTS_PER_PAGE);

  if (cursor) {
    query = query.lt('deleted_at', cursor);
  }

  const { data, error } = await query;
  if (error) throw error;

  const posts = (data || []) as DeletedPost[];
  const lastPost = posts[posts.length - 1];

  return {
    posts,
    nextCursor:
      posts.length === POSTS_PER_PAGE ? lastPost?.deleted_at ?? null : null,
  };
}

export function useDeletedPosts(userId: string | undefined) {
  return useInfiniteQuery({
    queryKey: queryKeys.posts.deleted(userId || ''),
    queryFn: ({ pageParam }) => fetchDeletedPosts(userId!, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!userId,
  });
}
