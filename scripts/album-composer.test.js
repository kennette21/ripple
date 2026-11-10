const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, modules = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: (name) => {
    assert.ok(Object.hasOwn(modules, name), 'Unexpected dependency: ' + name);
    return modules[name];
  } });
  return exports;
}

function nodes(value) {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== 'object') return [];
  return [value, ...nodes(value.props?.children)];
}
function textOf(value) {
  if (Array.isArray(value)) return value.map(textOf).join('');
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return value?.props ? textOf(value.props.children) : '';
}
function style(value) {
  return Array.isArray(value) ? Object.assign({}, ...value.map(style)) : value || {};
}
const settle = () => new Promise(setImmediate);
const noopAsync = async () => {};
const palette = new Proxy({}, { get: () => '#6366f1' });
const theme = {
  colors: { white: '#fff', black: '#000', gray: palette, primary: palette, error: { dark: '#b00' } },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  typography: { fontSizes: {}, fontWeights: {} },
  borderRadius: { sm: 4, md: 8, lg: 12, full: 999 },
};

function component(file, name, props = {}, overrides = {}) {
  const slots = [];
  let cursor = 0;
  let pending = [];
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], (value) => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    },
    useRef(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { current: initial };
      return slots[i];
    },
    useEffect(effect, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((value, n) => value !== slots[i].deps[n])) {
        const previous = slots[i];
        slots[i] = { deps };
        pending.push(() => { previous?.cleanup?.(); slots[i].cleanup = effect(); });
      }
    },
  };
  react.useLayoutEffect = react.useEffect;
  const element = (type, props) => ({ type, props });
  const modules = {
    react,
    'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'Fragment' },
    'react-native': {
      ...Object.fromEntries(['View', 'Text', 'TextInput', 'TouchableOpacity', 'ScrollView', 'Pressable', 'KeyboardAvoidingView', 'Modal'].map(t => [t, t])),
      StyleSheet: { create: (styles) => styles, absoluteFill: { position: 'absolute' } },
      Platform: { OS: 'ios' }, Keyboard: { dismiss() {} }, Alert: { alert() {} },
      useWindowDimensions: () => ({ width: 390, height: 844 }),
    },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ bottom: 34 }) },
    'react-native-gesture-handler': { GestureHandlerRootView: 'GestureRoot' },
    'react-native-draggable-flatlist': { __esModule: true, default: 'DraggableFlatList', ScaleDecorator: 'ScaleDecorator' },
    'expo-haptics': { selectionAsync: noopAsync, impactAsync: noopAsync, ImpactFeedbackStyle: { Light: 'light' } },
    'expo-image': { Image: 'Image' },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '@constants/theme': theme,
    '@/constants/theme': theme,
    '@/constants/config': { LIMITS: { maxImagesPerPost: 10 } },
    '@constants/config': { LIMITS: { captionMaxLength: 280, reflectionMaxLength: 10000, maxImagesPerPost: 10 } },
    '@components/ui': { Button: 'Button', Avatar: 'Avatar' },
    '@/components/ui/Button': { Button: 'Button' },
    '@/components/post/PostAudiencePicker': { PostAudiencePicker: 'PostAudiencePicker' },
    '@/components/compose/PostAlbumGrid': { PostAlbumGrid: 'PostAlbumGrid' },
    '@/components/compose/PostPhotoEditor': { PostPhotoEditor: 'PostPhotoEditor' },
    '@/lib/errors': load('src/lib/errors.ts'),
    '@/lib/postContent': load('src/lib/postContent.ts'),
    ...overrides,
  };
  const renderComponent = load(file, modules)[name];
  function render() {
    cursor = 0;
    const tree = renderComponent(props);
    const effects = pending; pending = [];
    effects.forEach(run => run());
    return nodes(tree);
  }
  function find(match) {
    const node = render().find(match);
    assert.ok(node, 'Missing rendered control');
    return node;
  }
  return {
    props, render, find,
    byType: (type) => find(node => node.type === type),
    byId: (id) => find(node => node.props?.testID === id),
    press(label) {
      return find(node => node.props?.onPress && (node.props.accessibilityLabel === label || node.props.title === label || textOf(node) === label)).props.onPress();
    },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

const photo = (id = 'one', width = 1200, height = 800) => ({
  id, uri: id + '.jpg', width, height, isCropped: false,
  sourceUri: id + '.jpg', sourceWidth: width, sourceHeight: height,
});

test('both writing modes grow without internal scrolling and leave photos after the text', () => {
  const h = composeHarness();
  let input = h.byId('post-body-input');
  assert.equal(input.props.scrollEnabled, false);
  assert.equal(style(input.props.style).height, undefined);
  assert.equal(style(input.props.style).maxHeight, undefined);
  assert.equal(style(input.props.style).minHeight, 56);
  input.props.onChangeText('A caption that can grow over several lines.');
  h.press('Reflection');
  h.byId('post-body-input').props.onChangeText('A long reflection.\n'.repeat(50));
  input = h.byId('post-body-input');
  assert.equal(style(input.props.style).height, undefined);
  assert.equal(style(input.props.style).maxHeight, undefined);
  assert.equal(input.props.scrollEnabled, false);
  const rendered = h.render();
  assert.ok(rendered.findIndex(node => node.props?.testID === 'post-body-input') < rendered.findIndex(node => node.type === 'PostAlbumGrid'));
  assert.equal(style(input.props.style).minHeight, 120);
});

function composeHarness() {
  const writes = [];
  const assets = [photo('one'), photo('two'), photo('three')].map(p => ({ ...p, assetId: p.id }));
  const h = component('app/(main)/(compose)/index.tsx', 'default', {}, {
    'expo-router': { router: { back() {}, navigate() {} } },
    'expo-image-picker': { launchImageLibraryAsync: async () => ({ canceled: false, assets }) },
    '@providers/AuthProvider': { useAuth: () => ({ user: { id: 'viewer' }, profile: { display_name: 'Billy', username: 'billy' } }) },
    '@/hooks/posts/useCreatePost': { useCreatePost: () => ({ isPending: false, mutateAsync: async value => writes.push(value) }) },
    '@/lib/postImageUpload': { clearPostImagePreparation() {}, preparePostImage: async value => value },
  });
  return Object.assign(h, { writes });
}

test('album reordering, cropping, and removal preserve photo identity and the upload sequence', async () => {
  const h = composeHarness();
  h.byType('PostAlbumGrid').props.onAdd();
  await settle();
  let grid = h.byType('PostAlbumGrid');
  assert.equal(grid.props.photos.length, 3);
  const originals = grid.props.photos;
  grid.props.onReorder([originals[2], originals[0], originals[1]]);
  grid = h.byType('PostAlbumGrid');
  grid.props.onEdit(grid.props.photos[0], true);
  const editor = h.byType('PostPhotoEditor');
  assert.equal(editor.props.startWithCrop, true);
  editor.props.onApply({ ...editor.props.photo, uri: 'custom-crop.jpg', width: 600, height: 400, isCropped: true });
  h.byType('PostAlbumGrid').props.onRemove(originals[0]);
  await h.press('Post');
  assert.deepEqual(Array.from(h.writes[0].input.images, p => p.sourceUri), ['three.jpg', 'two.jpg']);
  assert.equal(h.writes[0].input.images[0].uri, 'custom-crop.jpg');
  assert.equal(h.writes[0].input.images[0].width, 600);
  assert.equal(h.writes[0].input.caption, '');
});

test('grid tiles have a real height, expose the crop shortcut, and stop adding at ten photos', () => {
  const edits = [];
  const h = component('src/components/compose/PostAlbumGrid.tsx', 'PostAlbumGrid', {
    photos: [photo(), photo('two')], onEdit: (...args) => edits.push(args), onAdd() {}, onRemove() {}, onReorder() {},
  });
  assert.equal(h.byId('compose-photo-1').props.accessibilityRole, 'imagebutton');
  assert.ok(h.render().some(node => node.type === 'View' && style(node.props.style).height > 100 && style(node.props.style).width > 100));
  h.press('Crop photo 1');
  assert.equal(edits[0][0].id, 'one');
  assert.equal(edits[0][1], true);
  h.props.photos = Array.from({ length: 10 }, (_, n) => photo(String(n)));
  assert.equal(h.render().some(node => node.props?.testID === 'compose-add-photos'), false);
});

test('move controls reorder whole photo objects without losing their original source', () => {
  const photos = [photo(), photo('two'), photo('three')];
  let reordered;
  const h = component('src/components/compose/PostAlbumGrid.tsx', 'PostAlbumGrid', {
    photos, onEdit() {}, onAdd() {}, onRemove() {}, onReorder: value => { reordered = value; },
  });
  h.press('Reorder photos');
  const row = h.byType('DraggableFlatList').props.renderItem({ item: photos[0], getIndex: () => 0, drag() {}, isActive: false });
  nodes(row).find(node => node.props?.accessibilityLabel === 'Move photo 1 later').props.onPress();
  assert.deepEqual(Array.from(reordered, p => p.id), ['two', 'one', 'three']);
  assert.equal(reordered[1], photos[0]);
});

function editorHarness() {
  const applied = [];
  const deleted = [];
  const h = component('src/components/compose/PostPhotoEditor.tsx', 'PostPhotoEditor', {
    photo: photo(), onApply: p => applied.push(p), onClose() {},
  }, {
    './ImageCropScreen': { __esModule: true, default: 'ImageCropScreen' },
    '@/lib/postPhotoEditing': { fillPostPhotoFrame: async p => ({ ...p, uri: 'square.jpg', width: 800, height: 800, isCropped: true }) },
    'expo-file-system': { File: class {
      constructor(uri) { this.uri = uri; this.exists = true; }
      delete() { deleted.push(this.uri); }
    } },
  });
  return Object.assign(h, { applied, deleted });
}

test('custom cropping returns to framing, and Done retains the cropped image and original source', async () => {
  const h = editorHarness();
  h.press('Crop photo');
  const crop = h.byType('ImageCropScreen');
  assert.equal(crop.props.imageUri, 'one.jpg');
  crop.props.onCrop('custom.jpg', 600, 400);
  assert.equal(h.byType('Image').props.source.uri, 'custom.jpg');
  assert.equal(h.byType('Image').props.contentFit, 'contain');
  h.press('Done');
  await settle();
  assert.equal(h.applied[0].uri, 'custom.jpg');
  assert.equal(h.applied[0].sourceUri, 'one.jpg');
  h.unmount();
  assert.deepEqual(h.deleted, []);
});

test('cancelled photo edits discard generated files and never delete the original', () => {
  const h = editorHarness();
  h.press('Crop photo');
  h.byType('ImageCropScreen').props.onCrop('discarded-crop.jpg', 300, 300);
  h.press('Close photo editor');
  h.unmount();
  assert.deepEqual(h.applied, []);
  assert.deepEqual(h.deleted, ['discarded-crop.jpg']);
});

test('device Back exits cropping without closing the editor, and waits while a crop is processing', () => {
  const h = editorHarness();
  h.press('Crop photo');
  h.byType('ImageCropScreen').props.onProcessingChange(true);
  h.byType('Modal').props.onRequestClose();
  assert.ok(h.byType('ImageCropScreen'));
  h.byType('ImageCropScreen').props.onProcessingChange(false);
  h.byType('Modal').props.onRequestClose();
  assert.equal(h.byType('Image').props.source.uri, 'one.jpg');
  assert.deepEqual(h.applied, []);
});

test('Fill frame saves a centered square and releases native resources even on failure', async () => {
  const crops = [];
  let released = 0;
  let renderedReleased = 0;
  let fail = false;
  const { fillPostPhotoFrame } = load('src/lib/postPhotoEditing.ts', {
    'expo-image-manipulator': { SaveFormat: { JPEG: 'jpeg' }, ImageManipulator: { manipulate: () => ({
      crop: value => crops.push(value),
      renderAsync: async () => ({
        saveAsync: async () => {
          if (fail) throw new Error('Could not save');
          return { uri: 'square.jpg', width: 800, height: 800 };
        },
        release: () => { renderedReleased++; },
      }),
      release: () => { released++; },
    }) } },
  });
  const result = await fillPostPhotoFrame(photo());
  assert.deepEqual(JSON.parse(JSON.stringify(crops[0])), { originX: 200, originY: 0, width: 800, height: 800 });
  assert.equal(result.sourceUri, 'one.jpg');
  assert.equal(result.uri, 'square.jpg');
  fail = true;
  await assert.rejects(fillPostPhotoFrame(photo()), /Could not save/);
  assert.equal(released, 2);
  assert.equal(renderedReleased, 2);
  const square = photo('square', 800, 800);
  assert.equal(await fillPostPhotoFrame(square), square);
  assert.equal(crops.length, 2);
});
