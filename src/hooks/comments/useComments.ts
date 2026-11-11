import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';
import { updateCachedCommentCount } from '@/lib/query/postCache';
import type { Comment, Profile } from '@/types/database';

export interface CommentWithAuthor extends Comment {
  author: Profile;
  replies?: CommentWithAuthor[];
  replyToAuthor?: Profile;
}

const COMMENT_FIELDS = '*, author:profiles!comments_author_id_fkey(*)';
const PREVIEW_ROOTS = 3;
const PAGE_SIZE = 20;
const PREVIEW_REPLIES = 2;

function threadQuery(postId: string) {
  return supabase.from('comments').select(COMMENT_FIELDS, { count: 'exact' })
    .eq('post_id', postId).is('parent_id', null)
    .order('created_at', { ascending: true }).order('id', { ascending: true });
}

async function fetchComments(postId: string, offset: number, signal: AbortSignal) {
  const limit = offset === 0 ? PREVIEW_ROOTS : PAGE_SIZE;
  const { data, count, error } = await threadQuery(postId)
    .range(offset, offset + limit - 1).abortSignal(signal);
  if (error) throw error;
  const comments = (data as unknown as CommentWithAuthor[] ?? []);
  const nextOffset = offset + comments.length;
  return { comments, total: count ?? 0,
    nextOffset: comments.length === limit && nextOffset < (count ?? 0) ? nextOffset : null };
}

async function fetchFocusedThread(postId: string, commentId: string, signal: AbortSignal) {
  const { data, error } = await supabase.from('comments').select(COMMENT_FIELDS)
    .eq('post_id', postId).eq('id', commentId).abortSignal(signal).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const focused = (data as unknown as CommentWithAuthor);
  const rootId = focused.thread_root_id ?? focused.id;
  const result = await threadQuery(postId).eq('id', rootId).abortSignal(signal).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) return null;
  const root = (result.data as unknown as CommentWithAuthor);
  if (focused.parent_id === root.id) focused.replyToAuthor = root.author;
  else if (focused.parent_id) {
    const parent = await supabase.from('comments')
      .select('author:profiles!comments_author_id_fkey(*)')
      .eq('post_id', postId).eq('id', focused.parent_id).abortSignal(signal).maybeSingle();
    if (parent.error) throw parent.error;
    focused.replyToAuthor = parent.data?.author;
  }
  if (focused.parent_id && !root.replies?.some((reply) => reply.id === focused.id)) {
    root.replies = [...(root.replies ?? []), focused];
  }
  return root;
}

export function useComments(postId: string | undefined, focusedCommentId?: string) {
  const query = useInfiniteQuery({
    queryKey: [...queryKeys.comments.byPost(postId || ''), 'threads'],
    queryFn: ({ pageParam, signal }) => fetchComments(postId!, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (page) => page.nextOffset,
    enabled: !!postId,
    staleTime: 30_000,
  });
  const focused = useQuery({
    queryKey: [...queryKeys.comments.byPost(postId || ''), 'focused', focusedCommentId],
    queryFn: ({ signal }) => fetchFocusedThread(postId!, focusedCommentId!, signal),
    enabled: !!postId && !!focusedCommentId,
    staleTime: 30_000,
  });
  const comments = query.data?.pages.flatMap((page) => page.comments) ?? [];
  const focusedThread = focused.data;
  if (focusedThread) {
    const index = comments.findIndex((comment) => comment.id === focusedThread.id);
    if (index === -1) comments.push(focusedThread);
    else comments[index] = focusedThread;
  }
  return { ...query, comments, total: query.data?.pages[0]?.total ?? 0,
    refetch: async () => {
      await query.refetch();
      if (focusedCommentId) await focused.refetch();
    },
    isError: query.isError || focused.isError,
    isLoading: query.isLoading || (!!focusedCommentId && focused.isLoading) };
}

export function useCommentReplies(root: CommentWithAuthor, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.comments.byPost(root.post_id), 'replies', root.id],
    queryFn: async ({ pageParam, signal }) => {
      const limit = pageParam === 0 ? PREVIEW_REPLIES : PAGE_SIZE;
      const { data, count, error } = await supabase.from('comments')
        .select(COMMENT_FIELDS, { count: 'exact' }).eq('post_id', root.post_id)
        .eq('thread_root_id', root.id)
        .order('created_at', { ascending: true }).order('id', { ascending: true })
        .range(pageParam, pageParam + limit - 1).abortSignal(signal);
      if (error) throw error;
      const replies = (data as unknown as CommentWithAuthor[] ?? []);
      // Resolve reply-to labels in one bounded batch, including parents outside this page.
      const authors = new Map([[root.id, root.author], ...replies.map((reply) =>
        [reply.id, reply.author] as const)]);
      const missingParents = [...new Set(replies.map((reply) => reply.parent_id)
        .filter((id): id is string => !!id && !authors.has(id)))];
      if (missingParents.length) {
        const parents = await supabase.from('comments')
          .select('id, author:profiles!comments_author_id_fkey(*)')
          .eq('post_id', root.post_id).in('id', missingParents).abortSignal(signal);
        if (parents.error) throw parents.error;
        parents.data?.forEach((parent) => authors.set(parent.id, parent.author));
      }
      replies.forEach((reply) => { reply.replyToAuthor = authors.get(reply.parent_id!); });
      const nextOffset = pageParam + replies.length;
      return { replies, total: count ?? 0,
        nextOffset: replies.length === limit && nextOffset < (count ?? 0) ? nextOffset : null };
    },
    initialPageParam: 0,
    getNextPageParam: (page) => page.nextOffset,
    enabled,
    staleTime: 30_000,
  });
}

async function refreshCommentCount(client: ReturnType<typeof useQueryClient>, postId: string) {
  const { count, error } = await supabase.from('comments')
    .select('id', { count: 'exact', head: true }).eq('post_id', postId);
  if (!error && count !== null) updateCachedCommentCount(client, postId, count);
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

export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, content, parentId }: {
      postId: string;
      content: string;
      parentId?: string;
    }) => createComment(postId, content, parentId),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.comments.byPost(variables.postId) }),
        refreshCommentCount(queryClient, variables.postId),
      ]);
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.comments.byPost(variables.postId),
      });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId }: { commentId: string; postId: string }) => deleteComment(commentId),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.comments.byPost(variables.postId) }),
        refreshCommentCount(queryClient, variables.postId),
      ]);
    },
  });
}
