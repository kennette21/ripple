const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function updater({ upload, rpc, prepare, remove } = {}) {
  const calls = { prepared: [], uploaded: [], removed: [], saved: [] };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/hooks/posts/useUpdatePost.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const modules = {
    '@tanstack/react-query': { useMutation: options => options, useQueryClient: () => ({}) },
    '@/lib/query/keys': { queryKeys: {} },
    '@/lib/supabase/client': { supabase: {
      rpc: async (name, value) => { calls.saved.push({ name, value }); return rpc ? rpc(value, name) : { data: { post_id: 'post', deleted_storage_paths: ['old.jpg'] }, error: null }; },
      storage: { from: () => ({ remove: async paths => { calls.removed.push(paths); return remove ? remove(paths) : { error: null }; } }) },
    } },
    '@/lib/supabase/storage': {
      BUCKETS: { POST_IMAGES: 'post-images' }, getPublicUrl: (_, path) => 'https://example.test/' + path,
      uploadImage: async (...args) => { calls.uploaded.push(args); return upload ? upload(...args) : { path: args[1], error: null }; },
    },
    '@/lib/postImageUpload': { preparePostImage: async value => { calls.prepared.push(value); return prepare ? prepare(value) : { ...value, uri: 'prepared:' + value.uri }; } },
  };
  const exports = {};
  vm.runInNewContext(source, { exports, console: { warn() {} }, require: name => {
    assert.ok(Object.hasOwn(modules, name), 'Unexpected dependency ' + name); return modules[name];
  } });
  return { calls, save: input => exports.useUpdatePost().mutationFn(input) };
}
const photo = (id, uri = 'https://example.test/' + id + '.jpg') => ({ id, uri, sourceUri: uri, width: 1200, height: 800, sourceWidth: 1200, sourceHeight: 800, isCropped: false });
const input = () => ({ postId: 'post', userId: 'viewer', originalContentType: 'caption', originalIsPrivate: false, caption: 'caption', reflection: '', contentType: 'caption', isPrivate: false,
  originalImages: [{ id: 'one', storage_path: 'one.jpg' }, { id: 'two', storage_path: 'two.jpg' }], images: [photo('one'), photo('two')] });

test('unchanged published photos save in draft order without downloads or uploads', async () => {
  const h = updater(); const draft = input(); draft.images.reverse();
  await h.save(draft);
  assert.equal(h.calls.prepared.length, 0);
  assert.equal(h.calls.uploaded.length, 0);
  assert.equal(h.calls.saved[0].name, 'update_post_composition');
  assert.deepEqual(Array.from(h.calls.saved[0].value.p_images, image => image.id), ['two', 'one']);
  assert.deepEqual(Array.from(h.calls.removed[0]), ['old.jpg']);
});

test('edited and added photos use fresh non-overwriting paths and save in order with text and audience', async () => {
  const h = updater(); const draft = input();
  draft.images = [photo('new', 'new.jpg'), { ...photo('two', 'crop.jpg'), isCropped: true }, photo('one')];
  draft.isPrivate = true;
  await h.save(draft);
  assert.equal(h.calls.uploaded.length, 2);
  assert.ok(h.calls.uploaded.every(args => /^viewer\/post\/edit-[a-z0-9-]+\.jpg$/.test(args[1]) && args[4] === false));
  const saved = h.calls.saved[0].value;
  assert.equal(saved.p_images[0].id, undefined);
  assert.equal(saved.p_images[1].id, 'two');
  assert.equal(saved.p_images[2].id, 'one');
  assert.equal(saved.p_images[1].width, 1200);
  assert.equal(saved.p_is_private, true);
  assert.equal(saved.p_caption, 'caption');
  assert.equal(h.calls.prepared[1].alreadyJpeg, true);
});

test('a failed upload waits for the batch and removes new uploads without touching published objects', async () => {
  let resolveSlow;
  const h = updater({ upload: async (_, path, uri) => {
    if (uri.includes('fail')) throw new Error('Upload failed');
    if (uri.includes('slow')) await new Promise(resolve => { resolveSlow = resolve; });
    return { path, error: null };
  } });
  const draft = input(); draft.images = [photo('one', 'fail.jpg'), photo('two', 'slow.jpg'), photo('new', 'new.jpg'), photo('later', 'later.jpg')];
  const saving = h.save(draft);
  await new Promise(setImmediate);
  assert.equal(h.calls.removed.length, 0);
  resolveSlow();
  await assert.rejects(saving, /Upload failed/);
  assert.equal(h.calls.saved.length, 0);
  assert.equal(h.calls.uploaded.length, 3);
  assert.equal(h.calls.removed[0].length, 2);
  assert.ok(h.calls.removed[0].every(path => path.includes('/edit-')));
});

test('rejected database edits clean up new uploads; uncertain responses never delete possibly committed photos', async () => {
  const draft = input(); draft.images = [photo('one', 'crop.jpg')];
  const rejected = updater({ rpc: async () => ({ error: { code: '22023', message: 'Invalid composition' } }) });
  await assert.rejects(rejected.save(draft));
  assert.equal(rejected.calls.removed[0].length, 1);
  const offline = updater({ rpc: async () => { throw new Error('Lost response'); } });
  await assert.rejects(offline.save(draft), /Lost response/);
  assert.equal(offline.calls.removed.length, 0);
  const committed = updater({ remove: async () => { throw new Error('Storage offline'); } });
  await committed.save(draft);
  assert.equal(committed.calls.saved.length, 1);
  assert.deepEqual(Array.from(committed.calls.removed[0]), ['old.jpg']);
});


test('older databases retain text/reorder edits but cannot silently ignore photo or audience changes', async () => {
  const h = updater({ rpc: async (_, name) => name === 'update_post_composition'
    ? { error: { code: 'PGRST202' } }
    : { data: { post_id: 'post', deleted_storage_paths: [] }, error: null } });
  await h.save(input());
  assert.deepEqual(h.calls.saved.map(call => call.name), ['update_post_composition', 'update_post']);
  assert.deepEqual(Array.from(h.calls.saved[1].value.p_image_ids), ['one', 'two']);
  for (const change of [{ isPrivate: true }, { images: [photo('one', 'crop.jpg')] }, { contentType: 'reflection', reflection: 'Body' }]) {
    const pending = updater({ rpc: async () => ({ error: { code: 'PGRST202' } }) });
    await assert.rejects(pending.save({ ...input(), ...change }));
    assert.equal(pending.calls.saved.length, 1);
    if (change.images) assert.equal(pending.calls.removed[0].length, 1);
  }
});
