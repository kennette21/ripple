const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, modules = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: (name) => {
    assert.ok(Object.hasOwn(modules, name), `Unexpected dependency: ${name}`);
    return modules[name];
  } });
  return exports;
}

const keys = load('src/lib/query/keys.ts').queryKeys;
const content = load('src/lib/postContent.ts');

function postCreator() {
  const posts = [];
  const images = [];
  const { useCreatePost } = load('src/hooks/posts/useCreatePost.ts', {
    '@tanstack/react-query': { useMutation: (options) => options, useQueryClient: () => ({}) },
    '@/lib/query/keys': { queryKeys: keys },
    '@/lib/postContent': content,
    '@/lib/postImageUpload': { preparePostImage: async (image) => image },
    '@/lib/supabase/storage': {
      BUCKETS: { POST_IMAGES: 'post-images' },
      uploadPostImage: async () => ({ path: 'viewer/post/0.jpg', error: null }),
    },
    '@/lib/supabase/client': { supabase: { from: (table) => ({ insert: (value) => {
      if (table === 'post_images') {
        images.push(...value);
        return Promise.resolve({ error: null });
      }
      posts.push(value);
      return { select: () => ({ single: async () => ({ data: { id: 'post' }, error: null }) }) };
    } }) } },
  });
  return { posts, images, create: (input) => useCreatePost().mutationFn({ input, userId: 'viewer' }) };
}

test('photo-only creation preserves an empty caption and commits the image metadata', async () => {
  const post = postCreator();
  await post.create({ contentType: 'caption', caption: '   ', images: [
    { uri: 'sample.jpg', width: 1200, height: 800, isCropped: false },
  ] });
  assert.equal(post.posts[0].caption, '');
  assert.equal(post.posts[0].reflection, null);
  assert.equal(post.images.length, 1);
  assert.equal(post.images[0].post_id, 'post');
  assert.equal(post.images[0].position, 0);
});

test('text-only captions still work, while empty posts and empty reflections never start a write', async () => {
  const post = postCreator();
  await post.create({ contentType: 'caption', caption: 'A text-only post' });
  assert.equal(post.posts[0].caption, 'A text-only post');
  for (const input of [
    { contentType: 'caption', caption: '  ' },
    { contentType: 'caption' },
    { contentType: 'reflection', caption: 'A title', images: [{ uri: 'sample.jpg' }] },
  ]) {
    await assert.rejects(post.create(input), /before posting/);
  }
  assert.equal(post.posts.length, 1);
});

test('removing the last photo requires text; a reflection always requires its body', () => {
  assert.equal(content.hasPostContent('caption', '', 1), true);
  assert.equal(content.hasPostContent('caption', '', 0), false);
  assert.equal(content.hasPostContent('caption', 'A caption', 0), true);
  assert.equal(content.hasPostContent('reflection', ' ', 1), false);
  assert.equal(content.hasPostContent('both', 'A reflection', 0), true);
});
