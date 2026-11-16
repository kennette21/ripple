const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the picker’s interactions with native views represented as elements.
// State and event handlers are real; no device or backend writes are involved.
function pickerHarness(props = {}) {
  const slots = [];
  let cursor = 0;
  const writes = [];
  const element = (type, props) => ({ type, props });
  const theme = new Proxy({}, { get: (_, key) => key });
  const modules = {
    'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'Fragment' },
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = initial;
        return [slots[index], (value) => { slots[index] = value; }];
      },
      useRef(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = { current: initial };
        return slots[index];
      },
    },
    'react-native': {
      ActivityIndicator: 'Spinner', Keyboard: { dismiss() {} }, Modal: 'Modal',
      Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View',
      StyleSheet: { create: (styles) => styles, absoluteFill: {} },
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 34 }) },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/components/ui/Button': { Button: 'Button' },
    '@/constants/theme': { colors: { primary: theme, gray: theme, error: theme }, spacing: theme, typography: { fontSizes: theme, fontWeights: theme }, borderRadius: theme },
    '@/lib/errors': { getErrorMessage: (error, fallback) => error.message || fallback },
  };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/components/post/PostAudiencePicker.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: (name) => {
    assert.ok(Object.hasOwn(modules, name), `Unexpected dependency: ${name}`);
    return modules[name];
  } });
  const current = { isPrivate: false, onChange: async (value) => { writes.push(value); }, ...props };
  function nodes(value) {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== 'object') return [];
    return [value, ...nodes(value.props?.children)];
  }
  function render() { cursor = 0; return nodes(exports.PostAudiencePicker(current)); }
  function find(label) {
    const node = render().find(({ props }) => props?.accessibilityLabel === label || props?.title === label);
    assert.ok(node, `Missing action: ${label}`);
    return node;
  }
  return {
    writes, props: current, render,
    press: (label) => find(label).props.onPress(),
    isVisible: () => render().some(({ type }) => type === 'Modal'),
    text: () => render().flatMap(({ type, props }) => type === 'Text' && typeof props.children === 'string' ? [props.children] : []),
  };
}

const publicOption = 'Public. Anyone on Ripple can view this post, including people who don’t follow you.';
const privateOption = 'Only me. Visible only to you on your profile.';
const settle = () => new Promise(setImmediate);

test('draft audience changes apply only on Done; dismissing or keeping the same audience does not write', async () => {
  const h = pickerHarness();
  h.press('Change audience, currently Public');
  h.press(privateOption);
  assert.deepEqual(h.writes, []);
  h.press('Close audience picker');
  assert.equal(h.isVisible(), false);
  h.press('Change audience, currently Public');
  h.press('Done');
  assert.deepEqual(h.writes, []);
  h.press('Change audience, currently Public');
  h.press(privateOption);
  h.press('Done');
  await settle();
  assert.deepEqual(h.writes, [true]);
  assert.equal(h.isVisible(), false);
});

test('widening a published audience requires a separate confirmation and Cancel leaves it private', async () => {
  const h = pickerHarness({ isPrivate: true, confirmChange: true });
  h.press('Change audience, currently Only me');
  h.press(publicOption);
  h.press('Done');
  assert.deepEqual(h.writes, []);
  assert.ok(h.text().includes('Make this post public?'));
  assert.ok(h.text().some((text) => text.includes('including people who don’t follow you')));
  h.press('Cancel');
  assert.equal(h.isVisible(), false);
  assert.deepEqual(h.writes, []);
  h.press('Change audience, currently Only me');
  h.press(publicOption);
  h.press('Done');
  h.press('Make public');
  await settle();
  assert.deepEqual(h.writes, [false]);
  assert.equal(h.isVisible(), false);
});

test('failed privacy updates retain the current audience and can be retried', async () => {
  let fail = true;
  const h = pickerHarness({ confirmChange: true, onChange: async () => {
    if (fail) throw new Error('Offline. Please try again.');
  } });
  h.press('Change audience, currently Public');
  h.press(privateOption);
  h.press('Done');
  h.press('Make private');
  await settle();
  assert.equal(h.isVisible(), true);
  assert.ok(h.text().includes('Offline. Please try again.'));
  assert.ok(h.text().includes('Public'));
  fail = false;
  h.press('Make private');
  await settle();
  assert.equal(h.isVisible(), false);
});

test('a pending privacy update cannot be submitted twice or dismissed', async () => {
  let finish;
  let writes = 0;
  const h = pickerHarness({ confirmChange: true, onChange: () => {
    writes++;
    return new Promise((resolve) => { finish = resolve; });
  } });
  h.press('Change audience, currently Public');
  h.press(privateOption);
  h.press('Done');
  h.press('Make private');
  h.press('Make private');
  h.press('Cancel');
  assert.equal(writes, 1);
  assert.equal(h.isVisible(), true);
  finish();
  await settle();
  assert.equal(h.isVisible(), false);
});
