import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';
import type { Comment, Profile } from '@/types/database';

export interface CommentWithAuthor extends Comment {
  author: Profile;
  replies?: CommentWithAuthor[];
}

async function fetchComments(postId: string): Promise<CommentWithAuthor[]> {
  // Fetch top-level comments
  const { data: comments, error } = await (supabase
    .from('comments') as any)
    .select(`
      *,
      author:profiles!comments_author_id_fkey(*)
    `)
    .eq('post_id', postId)
    .is('parent_id', null)
    .order('created_at', { ascending: true });

  if (error) throw error;

  // Fetch replies for each comment
  const commentsWithReplies = await Promise.all(
    (comments || []).map(async (comment: CommentWithAuthor) => {
      const { data: replies } = await (supabase
        .from('comments') as any)
        .select(`
          *,
          author:profiles!comments_author_id_fkey(*)
        `)
        .eq('parent_id', comment.id)
        .order('created_at', { ascending: true });

      return {
        ...comment,
        replies: replies || [],
      };
    })
  );

  return commentsWithReplies;
}

async function createComment(
  postId: string,
  userId: string,
  content: string,
  parentId?: string
) {
  const { data, error } = await (supabase
    .from('comments') as any)
    .insert({
      post_id: postId,
      author_id: userId,
      content,
      parent_id: parentId || null,
      depth: parentId ? 1 : 0,
    })
    .select(`
      *,
      author:profiles!comments_author_id_fkey(*)
    `)
    .single();

  if (error) throw error;
  return data;
}

async function deleteComment(commentId: string) {
  const { error } = await (supabase
    .from('comments') as any)
    .delete()
    .eq('id', commentId);

  if (error) throw error;
}

export function useComments(postId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.comments.byPost(postId || ''),
    queryFn: () => fetchComments(postId!),
    enabled: !!postId,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, userId, content, parentId }: {
      postId: string;
      userId: string;
      content: string;
      parentId?: string;
    }) => createComment(postId, userId, content, parentId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.byPost(variables.postId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.detail(variables.postId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.all });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteComment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.all });
    },
  });
}
