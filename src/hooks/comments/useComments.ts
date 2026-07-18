import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';
import type { Comment, Profile } from '@/types/database';

export interface CommentWithAuthor extends Comment {
  author: Profile;
  replies?: CommentWithAuthor[];
  replyToAuthor?: Profile;
}

async function fetchComments(postId: string): Promise<CommentWithAuthor[]> {
  const { data: comments, error } = await supabase
    .from('comments')
    .select(`
      *,
      author:profiles!comments_author_id_fkey(*)
    `)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const threadedComments: CommentWithAuthor[] = (comments || []).map((comment: CommentWithAuthor) => ({
    ...comment,
    replies: [],
  }));
  const commentsById = new Map<string, CommentWithAuthor>(
    threadedComments.map((comment: CommentWithAuthor) => [comment.id, comment])
  );

  threadedComments.forEach((comment: CommentWithAuthor) => {
    if (!comment.parent_id) return;

    const parent = commentsById.get(comment.parent_id);
    comment.replyToAuthor = parent?.author;
    const root = commentsById.get(comment.thread_root_id ?? comment.parent_id);
    root?.replies?.push(comment);
  });

  return threadedComments.filter(
    (comment: CommentWithAuthor) => !comment.parent_id
  );
}

async function createComment(
  postId: string,
  content: string,
  parentId?: string
) {
  const { data, error } = await supabase.rpc('create_comment', {
    p_post_id: postId,
    p_content: content,
    p_parent_id: parentId || null,
  });

  if (error) throw error;
  return data;
}

async function updateComment(commentId: string, content: string) {
  const { data, error } = await supabase
    .from('comments')
    .update({ content })
    .eq('id', commentId)
    .select(`
      *,
      author:profiles!comments_author_id_fkey(*)
    `)
    .single();

  if (error) throw error;
  return data as CommentWithAuthor;
}

async function deleteComment(commentId: string) {
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId);

  if (error) throw error;
}

export function useComments(postId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.comments.byPost(postId || ''),
    queryFn: () => fetchComments(postId!),
    enabled: !!postId,
    staleTime: 0,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, content, parentId }: {
      postId: string;
      content: string;
      parentId?: string;
    }) => createComment(postId, content, parentId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.byPost(variables.postId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.all });
    },
  });
}

export function useUpdateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, content }: {
      commentId: string;
      postId: string;
      content: string;
    }) => updateComment(commentId, content),
    onSuccess: (updatedComment, variables) => {
      queryClient.setQueryData<CommentWithAuthor[]>(
        queryKeys.comments.byPost(variables.postId),
        (comments) => comments?.map((comment) => {
          if (comment.id === updatedComment.id) {
            return { ...updatedComment, replies: comment.replies };
          }

          return {
            ...comment,
            replies: comment.replies?.map((reply) =>
              reply.id === updatedComment.id
                ? { ...updatedComment, replies: reply.replies }
                : reply
            ),
          };
        })
      );
      queryClient.invalidateQueries({
        queryKey: queryKeys.comments.byPost(variables.postId),
      });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteComment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.all });
    },
  });
}
