const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');
const { QueryClient, InfiniteQueryObserver } = require('@tanstack/react-query');

function load(file, modules) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, AbortController, require: (name) => {
    assert.ok(Object.hasOwn(modules, name), `Unexpected dependency: ${name}`);
    return modules[name];
  } });
  return exports;
}
const keys = load('src/lib/query/keys.ts', {}).queryKeys;
const cache = load('src/lib/query/postCache.ts', {});
const author = { id: 'author', username: 'author' };
const comment = (id, parent = null) => ({ id, post_id: 'post', parent_id: parent,
  thread_root_id: parent ? 'root' : null, author, created_at: '2026-11-04T12:00:00Z' });

function backend(handler) {
  const requests = [];
  const supabase = createClient('https://ripple.test', 'public-test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, options) => {
      const url = new URL(input);
      requests.push(url);
      const result = handler(url, options);
      return new Response(options.method === 'HEAD' ? null : JSON.stringify(result.rows), {
        status: 200, headers: { 'Content-Type': 'application/json',
          'Content-Range': `0-${Math.max(0, result.rows.length - 1)}/${result.count ?? result.rows.length}` },
      });
    } },
  });
  return { requests, supabase };
}
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
function hookModules(db, queryClient, captures = []) {
  return {
    '@tanstack/react-query': {
      useQueryClient: () => queryClient,
      useInfiniteQuery: (options) => { captures.push(options); return options; },
      useQuery: (options) => { captures.push(options); return {}; },
      useMutation: (options) => options,
    },
    '@/lib/supabase/client': { supabase: db },
    '@/lib/query/keys': { queryKeys: keys },
    '@/lib/query/postCache': cache,
  };
}
const postRows = () => Array.from({ length: 20 }, (_, i) => ({ id: `post-${i}`,
  author_id: 'viewer', created_at: `2026-11-04T12:00:${String(59 - i).padStart(2, '0')}Z`,
  comments: [{ count: 0 }], reposts: [{ count: 0 }], bookmarks: [] }));
function feedBackend() {
  return backend((url) => ({ rows: url.pathname.endsWith('/posts') ? postRows() : [] }));
}

test('later feed pages reuse audience data, and social invalidation refreshes it', async () => {
  const db = feedBackend(); const qc = client();
  const { useFeed } = load('src/hooks/feed/useFeed.ts', hookModules(db.supabase, qc));
  const options = useFeed('viewer'); const signal = new AbortController().signal;
  const first = await options.queryFn({ signal });
  assert.equal(db.requests.length, 5);
  await options.queryFn({ signal, pageParam: first.nextCursor });
  assert.equal(db.requests.length, 6);
  await qc.invalidateQueries({ queryKey: keys.feed.all, refetchType: 'none' });
  await options.queryFn({ signal });
  assert.equal(db.requests.length, 11);
  qc.clear();
});

test('pull-to-refresh fetches one page and retains a usable next-page cursor', async () => {
  const db = feedBackend(); const qc = client();
  const hooks = load('src/hooks/feed/useFeed.ts', hookModules(db.supabase, qc));
  const options = hooks.useFeed('viewer');
  const observer = new InfiniteQueryObserver(qc, { ...options, staleTime: Infinity });
  qc.setQueryData(options.queryKey, {
    pages: [1, 2, 3].map(() => ({ posts: [], nextCursor: 'old' })), pageParams: [undefined, 'a', 'b'],
  });
  const unsubscribe = observer.subscribe(() => {});
  await hooks.refreshFeed(qc, 'viewer');
  const data = qc.getQueryData(options.queryKey);
  assert.equal(db.requests.filter((url) => url.pathname.endsWith('/posts')).length, 1);
  assert.equal(data.pages.length, 1);
  assert.equal(data.pageParams.length, 1);
  assert.ok(data.pages[0].nextCursor);
  unsubscribe(); qc.clear();
});

test('comment count updates preserve loaded pages and unrelated cached posts', () => {
  const qc = client();
  const pages = { pages: [{ posts: [{ id: 'post', comment_count: 9 },
    { id: 'other', comment_count: 7 }], nextCursor: 'cursor' }], pageParams: [undefined] };
  qc.setQueryData(keys.feed.list('viewer'), pages);
  qc.setQueryData(keys.posts.byUser('author', 'viewer'), pages);
  qc.setQueryData(keys.posts.detail('post', 'viewer'), { id: 'post', comment_count: 9 });
  qc.setQueryData(keys.posts.edit('post', 'author'), { caption: 'keep me' });
  cache.updateCachedCommentCount(qc, 'post', 4); // e.g. a cascade removed several replies
  for (const key of [keys.feed.list('viewer'), keys.posts.byUser('author', 'viewer')]) {
    const data = qc.getQueryData(key);
    assert.equal(data.pages[0].posts[0].comment_count, 4);
    assert.equal(data.pages[0].posts[1].comment_count, 7);
    assert.equal(data.pages[0].nextCursor, 'cursor');
    assert.equal(data.pageParams.length, 1);
  }
  assert.equal(qc.getQueryData(keys.posts.detail('post', 'viewer')).comment_count, 4);
  assert.equal(qc.getQueryData(keys.posts.edit('post', 'author')).caption, 'keep me');
  qc.clear();
});

test('a comment mutation refreshes only its thread and synchronizes counts without refetching feeds', async () => {
  const db = backend(() => ({ rows: [], count: 4 })); const qc = client();
  qc.setQueryData(keys.feed.list('viewer'), {
    pages: [{ posts: [{ id: 'post', comment_count: 9 }], nextCursor: null }], pageParams: [undefined],
  });
  const threadKey = [...keys.comments.byPost('post'), 'threads'];
  const otherThreadKey = [...keys.comments.byPost('other'), 'threads'];
  qc.setQueryData(threadKey, { pages: [], pageParams: [] });
  qc.setQueryData(otherThreadKey, { pages: [], pageParams: [] });
  const hooks = load('src/hooks/comments/useComments.ts', hookModules(db.supabase, qc));
  await hooks.useDeleteComment().onSuccess(undefined, { postId: 'post', commentId: 'deleted' });
  assert.equal(db.requests.length, 1);
  assert.equal(qc.getQueryData(keys.feed.list('viewer')).pages[0].posts[0].comment_count, 4);
  assert.equal(qc.getQueryState(keys.feed.list('viewer')).isInvalidated, false);
  assert.equal(qc.getQueryState(threadKey).isInvalidated, true);
  assert.equal(qc.getQueryState(otherThreadKey).isInvalidated, false);
  qc.clear();
});

test('comment previews and reply pages are bounded; deep links fetch the target directly', async () => {
  const roots = Array.from({ length: 40 }, (_, i) => comment(i === 0 ? 'root' : `root-${i}`));
  const replies = Array.from({ length: 55 }, (_, i) => comment(`reply-${i}`, i === 50 ? 'reply-40' : 'root'));
  const db = backend((url) => {
    const q = url.searchParams;
    let rows = q.has('thread_root_id') ? replies : q.has('parent_id') ? roots : [...roots, ...replies];
    if (q.has('id')) {
      const filter = q.get('id');
      rows = rows.filter((row) => filter.startsWith('eq.') ? row.id === filter.slice(3) : filter.includes(row.id));
    }
    const count = rows.length;
    const offset = Number(q.get('offset') ?? 0); const limit = Number(q.get('limit') ?? count);
    return { rows: rows.slice(offset, offset + limit), count };
  });
  const captures = []; const qc = client();
  const hooks = load('src/hooks/comments/useComments.ts', hookModules(db.supabase, qc, captures));
  hooks.useComments('post', 'reply-50');
  const signal = new AbortController().signal;
  const rootsOptions = captures[0];
  const first = await rootsOptions.queryFn({ pageParam: 0, signal });
  assert.equal(first.comments.length, 3); assert.equal(first.total, 40); assert.equal(first.nextOffset, 3);
  const second = await rootsOptions.queryFn({ pageParam: first.nextOffset, signal });
  assert.equal(second.comments.length, 20); assert.equal(second.nextOffset, 23);
  const focused = await captures[1].queryFn({ signal });
  assert.equal(focused.id, 'root'); assert.equal(focused.replies[0].id, 'reply-50');
  assert.equal(focused.replies[0].replyToAuthor.id, 'author');
  const replyOptions = hooks.useCommentReplies(roots[0], true);
  const preview = await replyOptions.queryFn({ pageParam: 0, signal });
  assert.equal(preview.replies.length, 2); assert.equal(preview.total, 55);
  const more = await replyOptions.queryFn({ pageParam: preview.nextOffset, signal });
  assert.equal(more.replies.length, 20); assert.equal(more.nextOffset, 22);
  assert.ok(db.requests.every((url) => url.searchParams.has('limit') || url.searchParams.has('id')));
  qc.clear();
});

function uploads(failAt) {
  const attempts = []; const removed = []; const rows = []; let active = 0; let peak = 0;
  const db = {
    from: (table) => ({
      insert: (value) => {
        if (table === 'post_images') { rows.push(...value); return Promise.resolve({ error: null }); }
        return { select: () => ({ single: async () => ({ data: { id: 'post' }, error: null }) }) };
      },
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
    storage: { from: () => ({ remove: async (paths) => { removed.push(...paths); return { error: null }; } }) },
    rpc: async () => ({ data: true, error: null }),
  };
  const modules = hookModules(db, client());
  modules['@/lib/postImageUpload'] = { preparePostImage: async (image) => image };
  modules['@/lib/supabase/storage'] = { BUCKETS: { POST_IMAGES: 'post-images' },
    uploadPostImage: async (_user, _post, position) => {
      attempts.push(position); peak = Math.max(peak, ++active);
      await new Promise(setImmediate); active--;
      return position === failAt ? { path: null, error: new Error('upload failed') }
        : { path: `image-${position}`, error: null };
    },
  };
  const hook = load('src/hooks/posts/useCreatePost.ts', modules).useCreatePost();
  return { run: () => hook.mutationFn({ userId: 'viewer', input: { contentType: 'photo',
    images: Array.from({ length: 8 }, (_, i) => ({ uri: `photo-${i}`, width: 100, height: 100 })) } }),
    attempts, removed, rows, peak: () => peak, active: () => active };
}

test('photo uploads are bounded and retain image order', async () => {
  const upload = uploads(); await upload.run();
  assert.equal(upload.peak(), 3); assert.equal(upload.rows.length, 8);
  assert.deepEqual(upload.rows.map((row) => row.position), [0, 1, 2, 3, 4, 5, 6, 7]);
});

test('failed upload waits for its batch, stops new work, and removes every successful upload', async () => {
  const upload = uploads(4); await assert.rejects(upload.run(), /upload failed/);
  assert.equal(upload.peak(), 3); assert.equal(upload.active(), 0);
  assert.deepEqual(upload.attempts, [0, 1, 2, 3, 4, 5]);
  assert.deepEqual([...upload.removed].sort(), ['image-0', 'image-1', 'image-2', 'image-3', 'image-5']);
  assert.equal(upload.rows.length, 0);
});
