import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { FeedPost } from '@/hooks/feed/useFeed';

// A comment changes one count, not the membership or ordering of post lists.
export function updateCachedCommentCount(client: QueryClient, postId: string, count: number) {
  const updatePost = (post: FeedPost) => post.id === postId
    ? { ...post, comment_count: count } : post;
  for (const queryKey of [['feed', 'list'], ['posts', 'byUser']]) {
    client.setQueriesData<InfiniteData<{ posts: FeedPost[]; nextCursor: string | null }>>(
      { queryKey },
      (data) => data ? { ...data, pages: data.pages.map((page) => ({
        ...page, posts: page.posts.map(updatePost),
      })) } : data,
    );
  }
  client.setQueriesData<FeedPost>({ queryKey: ['posts', 'detail', postId] },
    (post) => post ? updatePost(post) : post);
}
