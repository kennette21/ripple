const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const ownComment = {
  id: 'mine', post_id: 'post', author_id: 'viewer', content: 'My original comment',
  created_at: '2026-11-01T12:00:00Z',
  author: { username: 'billy', display_name: 'Billy' },
};
const otherComment = {
  ...ownComment, id: 'theirs', author_id: 'other', content: 'A conversation worth keeping visible.',
  author: { username: 'gator', display_name: 'Gator' },
};

function nodes(value) {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== 'object') return [];
  return [value, ...nodes(value.props?.children)];
}

function harness(kind = 'InlineComments', overrides = {}) {
  const state = [];
  const writes = [];
  const alerts = [];
  const palette = new Proxy({}, { get: (_, key) => key });
  let cursor = 0;
  const create = { isPending: false, mutateAsync: async value => { writes.push(value); return { id: 'new' }; } };
  const update = { isPending: false, mutateAsync: async value => { writes.push(value); } };
  const element = (type, props) => ({ type, props });
  const props = kind === 'InlineComments' ? {
    postId: 'post', commentCount: 2, currentUserId: 'viewer', isThreadActive: true,
    onThreadActiveChange: active => { props.isThreadActive = active; },
  } : {
    comment: ownComment, currentUserId: 'viewer',
    onReply: value => writes.push(['reply', value]),
    onEdit: value => writes.push(['edit', value]),
    onDelete: value => writes.push(['delete', value]),
  };
  Object.assign(props, overrides);
  const modules = {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
      },
      useRef(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = { current: initial };
        return state[index];
      },
      useCallback: callback => callback,
      useMemo: callback => callback(),
      useEffect() {}, // Keyboard positioning is checked in the native app.
    },
    'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'Fragment' },
    'react-native': {
      ...Object.fromEntries(['ActivityIndicator', 'Modal', 'Pressable', 'Text', 'TextInput', 'View'].map(name => [name, name])),
      StyleSheet: { create: value => value, absoluteFill: {}, hairlineWidth: 1 },
      Keyboard: { dismiss() {} }, Alert: { alert: (...args) => alerts.push(args) },
      useWindowDimensions: () => ({ width: 390, height: 844 }),
    },
    'expo-router': { useRouter: () => ({ push() {} }) },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'expo-blur': { BlurView: 'BlurView' },
    'expo-haptics': {
      impactAsync: async () => {}, notificationAsync: async () => {},
      ImpactFeedbackStyle: { Light: 'light' }, NotificationFeedbackType: { Warning: 'warning' },
    },
    'date-fns': { formatDistanceToNow: () => '9 days ago' },
    './CommentItem': { CommentItem: 'CommentItem' },
    '@/components/ui/Avatar': { Avatar: 'Avatar' },
    '@/providers/AuthProvider': { useAuth: () => ({ profile: ownComment.author }) },
    '@/hooks/comments/useComments': {
      useComments: () => ({ comments: [ownComment, otherComment], total: 2 }),
      useCommentReplies: () => ({}),
      useCreateComment: () => create, useUpdateComment: () => update,
      useDeleteComment: () => ({ mutate: value => writes.push(value) }),
    },
    '@/constants/config': { LIMITS: { commentMaxLength: 500 } },
    '@/constants/theme': {
      colors: { gray: palette, primary: palette, error: palette },
      spacing: { xs: 4, sm: 8, md: 16 }, borderRadius: {}, shadows: {},
      typography: { fontSizes: {}, fontWeights: {} },
    },
    '@/lib/errors': { getErrorMessage: error => error.message },
  };
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, `../src/components/comments/${kind}.tsx`), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports, require: name => {
    assert.ok(Object.hasOwn(modules, name), `Unexpected dependency: ${name}`);
    return modules[name];
  } });
  function render() {
    cursor = 0;
    const tree = nodes(exports[kind](props));
    tree.forEach(node => {
      if (node.props?.ref && !node.props.ref.current) {
        node.props.ref.current = { focus() {}, measureInWindow: callback => callback(60, 650, 310, 100) };
      }
    });
    return tree;
  }
  function find(match) {
    const result = render().find(match);
    assert.ok(result, 'Missing comment control');
    return result;
  }
  const input = () => find(node => node.type === 'TextInput');
  return {
    props, writes, alerts, create, update, render, find, input,
    press: label => find(node => node.props?.accessibilityLabel === label).props.onPress(),
    type: value => input().props.onChangeText(value),
    item: id => find(node => node.type === 'CommentItem' && node.props.comment.id === id).props,
  };
}
const settle = () => new Promise(setImmediate);

test('comment, reply, and edit modes keep their context and send the right mutation', async () => {
  const h = harness();
  h.press('Write a comment');
  assert.equal(h.input().props.scrollEnabled, false);
  h.type(' A new comment \n\n\n with space  ');
  h.press('Post comment');
  await settle();
  assert.equal(h.writes[0].content, 'A new comment\n\n with space');
  assert.equal(h.writes[0].parentId, undefined);

  h.item('theirs').onReply(otherComment);
  h.type('My reply');
  assert.ok(h.render().some(node => node.props?.accessibilityLabel === `Replying to Gator: ${otherComment.content}`));
  h.press('Send reply');
  await settle();
  assert.equal(h.writes[1].parentId, 'theirs');

  h.item('mine').onEdit(ownComment);
  assert.equal(h.input().props.value, ownComment.content);
  assert.equal(h.find(node => node.props?.accessibilityLabel === 'Save comment').props.disabled, true);
  h.type('Updated comment');
  h.press('Save comment');
  await settle();
  assert.equal(h.writes[2].commentId, 'mine');
  assert.equal(h.writes[2].content, 'Updated comment');
});

test('failed sends preserve the draft; pending sends cannot duplicate or discard it', async () => {
  const h = harness();
  let reject;
  let attempts = 0;
  h.create.mutateAsync = () => { attempts++; return new Promise((_, fail) => { reject = fail; }); };
  h.press('Write a comment');
  h.type('Keep this draft');
  h.press('Post comment');
  h.press('Post comment');
  h.press('Cancel comment');
  h.item('theirs').onReply(otherComment);
  h.item('mine').onEdit(ownComment);
  assert.equal(attempts, 1);
  assert.equal(h.input().props.value, 'Keep this draft');
  reject(new Error('Offline'));
  await settle();
  assert.equal(h.input().props.value, 'Keep this draft');
  assert.equal(h.alerts[0][1], 'Offline');
  h.press('Cancel comment');
  assert.equal(h.render().some(node => node.type === 'TextInput'), false);
});

test('switching reply to edit clears the previous mode, and cancelling never writes', () => {
  const h = harness();
  h.item('theirs').onReply(otherComment);
  h.type('Unsent reply');
  h.item('mine').onEdit(ownComment);
  assert.equal(h.input().props.value, ownComment.content);
  assert.equal(h.render().some(node => node.props?.accessibilityLabel?.startsWith('Replying to Gator:')), false);
  h.press('Cancel editing comment');
  assert.equal(h.render().some(node => node.type === 'TextInput'), false);
  assert.deepEqual(h.writes, []);
});

test('only your comments expose Edit/Delete, and dismissing the actions menu does nothing', () => {
  const h = harness('CommentItem');
  h.press('Comment actions');
  assert.ok(h.find(node => node.props?.accessibilityLabel === 'Delete comment'));
  h.press('Dismiss comment actions');
  assert.deepEqual(h.writes, []);
  h.press('Comment actions');
  h.press('Edit comment');
  assert.deepEqual(h.writes, [['edit', ownComment]]);
  h.press('Comment actions');
  h.press('Delete comment');
  assert.deepEqual(h.writes[1], ['delete', 'mine']);
  h.props.comment = otherComment;
  assert.equal(h.render().some(node => node.props?.accessibilityLabel === 'Comment actions'), false);
  assert.ok(h.find(node => node.props?.accessibilityLabel === 'Reply to Gator'));
});
