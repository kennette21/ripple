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
    if (!Object.hasOwn(modules, name) && name.startsWith('./')) {
      return load(path.join(path.dirname(file), name + '.ts'), modules);
    }
    assert.ok(Object.hasOwn(modules, name), 'Unexpected dependency: ' + name);
    return modules[name];
  } });
  return exports;
}

function nodes(value) {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== 'object') return [];
  const children = value.type === 'SortableGrid'
    ? value.props.data.map((item, index) => value.props.renderItem({ item, index }))
    : value.props?.children;
  return [value, ...nodes(children)];
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
    'react-native-reanimated': {
      __esModule: true, default: { View: 'AnimatedView', ScrollView: 'ScrollView' },
      useAnimatedRef: () => react.useRef(null),
      Easing: { out: value => value, cubic: 'cubic' },
      withTiming: value => value,
      useAnimatedStyle: callback => callback(),
      useSharedValue: initial => react.useRef({
        value: initial, get() { return this.value; }, set(value) { this.value = value; },
      }).current,
    },
    'react-native-draggable-flatlist': { __esModule: true, default: 'DraggableFlatList', ScaleDecorator: 'ScaleDecorator' },
    'react-native-sortables': { __esModule: true, default: { Grid: 'SortableGrid', Handle: 'SortableHandle', Touchable: 'SortableTouchable' } },
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
    '@/lib/photoEditingGeometry': load('src/lib/photoEditingGeometry.ts'),
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
      const control = find(node => (node.props?.onPress || node.props?.onTap) && (node.props.accessibilityLabel === label || node.props.title === label || textOf(node) === label));
      return (control.props.onPress || control.props.onTap)();
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
  const h = component('src/components/compose/PostComposer.tsx', 'PostComposer', { saving: false, onClose() {}, onSubmit: async value => writes.push(value) }, {
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
  assert.deepEqual(Array.from(h.writes[0].images, p => p.sourceUri), ['three.jpg', 'two.jpg']);
  assert.equal(h.writes[0].images[0].uri, 'custom-crop.jpg');
  assert.equal(h.writes[0].images[0].width, 600);
  assert.equal(h.writes[0].body, '');
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
  h.byId('compose-photo-1').props.onAccessibilityAction({ nativeEvent: { actionName: 'moveLater' } });
  assert.deepEqual(Array.from(reordered, p => p.id), ['two', 'one', 'three']);
  assert.equal(reordered[1], photos[0]);
});

test('album previews are directly draggable, the add tile stays fixed, and drops preserve photo identity', () => {
  const photos = [photo(), photo('two'), photo('three')];
  let reordered;
  const h = component('src/components/compose/PostAlbumGrid.tsx', 'PostAlbumGrid', {
    photos, onEdit() {}, onAdd() {}, onRemove() {}, onReorder: value => { reordered = value; },
  });
  const grid = h.byType('SortableGrid');
  assert.equal(grid.props.sortEnabled, true);
  assert.equal(grid.props.columns, 2);
  assert.equal(grid.props.customHandle, true);
  assert.ok(h.render().some(node => node.type === 'SortableHandle' && node.props.mode === 'fixed-order'));
  grid.props.onDragEnd({ data: [photos[1], photos[2], photos[0], grid.props.data[3]], fromIndex: 0, toIndex: 2 });
  assert.deepEqual(Array.from(reordered, p => p.id), ['two', 'three', 'one']);
  assert.equal(reordered[2], photos[0]);
});

test('dragging a crop corner keeps the selected source pixels through settling and saving', async () => {
  const gestures = {};
  const crops = [];
  const rotations = [];
  let saved;
  const h = component('src/components/compose/ImageCropScreen.tsx', 'default', {
    imageUri: 'source.jpg', imageWidth: 1200, imageHeight: 800,
    onCrop: (...args) => { saved = args; }, onCancel() {},
  }, {
    'react-native-gesture-handler': { GestureDetector: 'GestureDetector',
      usePanGesture: handlers => { gestures.pan = handlers; return handlers; },
      usePinchGesture: handlers => { gestures.pinch = handlers; return handlers; },
      useSimultaneousGestures() {},
    },
    'react-native-safe-area-context': {
      useSafeAreaInsets: () => ({ top: 59, bottom: 34 }), initialWindowMetrics: null,
    },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'expo-image-manipulator': { SaveFormat: { JPEG: 'jpeg' }, ImageManipulator: { manipulate: () => ({
      rotate: angle => rotations.push(angle),
      crop: value => crops.push(value),
      renderAsync: async () => ({ saveAsync: async () => ({ uri: 'cropped.jpg', width: 900, height: 600 }), release() {} }),
      release() {},
    }) } },
  });
  h.render();
  // 342 × 228 image, centered in a 390 × 594 crop stage. Select its
  // top-left corner before the first movement leaves the handle's hit area.
  gestures.pan.onBegin({ x: 24, y: 183, absoluteX: 24, absoluteY: 183 });
  gestures.pan.onUpdate({ absoluteX: 109.5, absoluteY: 240 });
  gestures.pan.onDeactivate({ absoluteX: 109.5, absoluteY: 240, canceled: false });
  await h.press('Apply crop');
  await settle();
  assert.ok(Math.abs(crops[0].originX - 300) <= 1);
  assert.ok(Math.abs(crops[0].originY - 200) <= 1);
  assert.ok(Math.abs(crops[0].width - 900) <= 1);
  assert.ok(Math.abs(crops[0].height - 600) <= 1);
  assert.deepEqual(saved, ['cropped.jpg', 900, 600]);
  h.press('Rotate crop 90 degrees clockwise');
  h.press('Apply crop');
  await settle();
  assert.deepEqual(rotations, [90]);
  assert.deepEqual(JSON.parse(JSON.stringify(crops[1])), { originX: 0, originY: 300, width: 600, height: 900 });
  for (let i = 0; i < 3; i++) h.press('Rotate crop 90 degrees clockwise');
  h.press('Apply crop');
  await settle();
  assert.deepEqual(JSON.parse(JSON.stringify(crops[2])), JSON.parse(JSON.stringify(crops[0])));
});

function editorHarness() {
  const applied = [];
  const deleted = [];
  const transforms = [];
  const h = component('src/components/compose/PostPhotoEditor.tsx', 'PostPhotoEditor', {
    photo: photo(), onApply: p => applied.push(p), onClose() {},
  }, {
    './ImageCropScreen': { __esModule: true, default: 'ImageCropScreen' },
    './PhotoFramePreview': { PhotoFramePreview: 'PhotoFramePreview' },
    '@/lib/postPhotoEditing': { transformPostPhoto: async (p, options) => {
      transforms.push(options);
      if (!options.rotation && !options.crop) return p;
      return { ...p, uri: 'transformed.jpg', width: options.crop?.width ?? p.height, height: options.crop?.height ?? p.width, isCropped: true };
    } },
    'expo-file-system': { File: class {
      constructor(uri) { this.uri = uri; this.exists = true; }
      delete() { deleted.push(this.uri); }
    } },
  });
  return Object.assign(h, { applied, deleted, transforms });
}

test('custom cropping returns to framing, and Done retains the cropped image and original source', async () => {
  const h = editorHarness();
  h.byType('PhotoFramePreview').props.onCrop();
  const crop = h.byType('ImageCropScreen');
  assert.equal(crop.props.imageUri, 'one.jpg');
  crop.props.onCrop('custom.jpg', 600, 400);
  assert.equal(h.byType('PhotoFramePreview').props.photo.uri, 'custom.jpg');
  assert.equal(h.byType('PhotoFramePreview').props.fillFrame, false);
  h.press('Done');
  await settle();
  assert.equal(h.applied[0].uri, 'custom.jpg');
  assert.equal(h.applied[0].sourceUri, 'one.jpg');
  h.unmount();
  assert.deepEqual(h.deleted, []);
});

test('cancelled photo edits discard generated files and never delete the original', () => {
  const h = editorHarness();
  h.byType('PhotoFramePreview').props.onCrop();
  h.byType('ImageCropScreen').props.onCrop('discarded-crop.jpg', 300, 300);
  h.press('Close photo editor');
  h.unmount();
  assert.deepEqual(h.applied, []);
  assert.deepEqual(h.deleted, ['discarded-crop.jpg']);
});

test('device Back exits cropping without closing the editor, and waits while a crop is processing', () => {
  const h = editorHarness();
  h.byType('PhotoFramePreview').props.onCrop();
  h.byType('ImageCropScreen').props.onProcessingChange(true);
  h.byType('Modal').props.onRequestClose();
  assert.ok(h.byType('ImageCropScreen'));
  h.byType('ImageCropScreen').props.onProcessingChange(false);
  h.byType('Modal').props.onRequestClose();
  assert.equal(h.byType('PhotoFramePreview').props.photo.uri, 'one.jpg');
  assert.deepEqual(h.applied, []);
});

test('quarter turns remain reversible and positioned framing is passed to saving and cropping', async () => {
  const h = editorHarness();
  for (let i = 0; i < 4; i++) h.press('Rotate photo 90 degrees clockwise');
  assert.equal(h.byType('PhotoFramePreview').props.rotation, 0);
  assert.deepEqual(h.transforms, []);
  h.press('Fill frame. Crop to a square');
  h.byType('PhotoFramePreview').props.onCropChange({ originX: 100, originY: 50, width: 600, height: 600 });
  h.press('Rotate photo 90 degrees clockwise');
  let preview = h.byType('PhotoFramePreview');
  assert.equal(preview.props.rotation, 90);
  assert.deepEqual(JSON.parse(JSON.stringify(preview.props.initialCrop)), { originX: 150, originY: 100, width: 600, height: 600 });
  preview.props.onCrop();
  const crop = h.byType('ImageCropScreen');
  assert.equal(crop.props.initialRotation, 90);
  assert.equal(crop.props.initialCrop.originX, 150);
  crop.props.onCancel();
  h.press('Done');
  await settle();
  assert.equal(h.transforms[0].rotation, 90);
  assert.equal(h.transforms[0].crop.originX, 150);
  assert.equal(h.applied[0].sourceUri, 'one.jpg');
});

test('Reset restores the full original after cropping and rotating without applying anything', () => {
  const h = editorHarness();
  h.byType('PhotoFramePreview').props.onCrop();
  h.byType('ImageCropScreen').props.onCrop('temporary.jpg', 400, 500);
  h.press('Rotate photo 90 degrees clockwise');
  h.press('Reset photo edits');
  const preview = h.byType('PhotoFramePreview').props;
  assert.equal(preview.photo.uri, 'one.jpg');
  assert.equal(preview.photo.width, 1200);
  assert.equal(preview.rotation, 0);
  assert.equal(preview.fillFrame, false);
  assert.deepEqual(h.applied, []);
  h.unmount();
  assert.deepEqual(h.deleted, ['temporary.jpg']);
});

test('positioning and zoom export the latest coordinates even before animated values reach the UI thread', () => {
  const reported = [];
  const interactions = [];
  const h = component('src/components/compose/PhotoFramePreview.tsx', 'PhotoFramePreview', {
    photo: photo(), size: 300, rotation: 0, fillFrame: true, disabled: false,
    onCropChange: crop => reported.push(crop), onCrop() {}, onInteractionChange: active => interactions.push(active),
  }, {
    'react-native-gesture-handler': {
      GestureDetector: 'GestureDetector', usePanGesture: config => config, usePinchGesture: config => config,
      useSimultaneousGestures: (pan, pinch) => ({ pan, pinch }),
    },
    'react-native-reanimated': {
      __esModule: true, default: { View: 'AnimatedView' }, useAnimatedStyle: callback => callback(),
      // JS setters are queued to the UI thread. A synchronous read still sees
      // the previous value, so the saved composition must not depend on it.
      useSharedValue: initial => ({ get: () => initial, set() {} }),
    },
  });
  const pan = h.byType('GestureDetector').props.gesture.pan;
  pan.onBegin({ absoluteX: 100, absoluteY: 100 });
  // A fast drag can activate and finish without a separate update event.
  pan.onDeactivate({ absoluteX: 300, absoluteY: 100, canceled: false });
  pan.onFinalize();
  assert.equal(reported[0].originX, 0);
  assert.equal(reported[0].width, 800);
  assert.deepEqual(interactions, [true, false]);
  h.press('Zoom photo in');
  assert.equal(reported[1].width, 640);
  assert.equal(reported[1].originX, 80);
  assert.ok(h.render().some(node => node.props?.accessibilityLabel === 'Photo zoom 125 percent'));
  h.press('Center photo in frame');
  assert.equal(reported[2].originX, 200);
  assert.equal(reported[2].width, 800);
});

test('rotation and a positioned crop are rendered once, with original metadata and native handle cleanup', async () => {
  const operations = [];
  let renders = 0;
  let releases = 0;
  const { transformPostPhoto } = load('src/lib/postPhotoEditing.ts', {
    'expo-image-manipulator': { SaveFormat: { JPEG: 'jpeg' }, ImageManipulator: { manipulate: uri => {
      operations.push(['source', uri]);
      return {
        rotate: angle => operations.push(['rotate', angle]),
        crop: crop => operations.push(['crop', crop]),
        renderAsync: async () => {
          renders++;
          return { saveAsync: async () => ({ uri: 'rotated-crop.jpg', width: 600, height: 600 }), release: () => { releases++; } };
        },
        release: () => { releases++; },
      };
    } } },
  });
  const original = photo();
  assert.equal(await transformPostPhoto(original), original);
  assert.equal(renders, 0);
  const result = await transformPostPhoto(original, { rotation: 90, crop: { originX: 150, originY: 100, width: 600, height: 600 } });
  assert.equal(renders, 1);
  assert.equal(releases, 2);
  assert.equal(result.uri, 'rotated-crop.jpg');
  assert.equal(result.sourceUri, original.uri);
  assert.equal(result.id, original.id);
  assert.deepEqual(JSON.parse(JSON.stringify(operations)), [
    ['source', 'one.jpg'], ['rotate', 90], ['crop', { originX: 150, originY: 100, width: 600, height: 600 }],
  ]);
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

test('editing shares the composer, stages photo changes, and keeps its baseline across refetches', async () => {
  const writes = [];
  const alerts = [];
  const original = photo('published');
  const initialDraft = { contentType: 'caption', body: 'Original caption', reflectionTitle: '', isPrivate: false, images: [original] };
  const h = component('src/components/compose/PostComposer.tsx', 'PostComposer', {
    editing: true, initialDraft, saving: false, onClose() {}, onSubmit: async draft => writes.push(draft),
  }, {
    '@providers/AuthProvider': { useAuth: () => ({ profile: {} }) },
    'expo-image-picker': { launchImageLibraryAsync: async () => ({ canceled: true }) },
    '@/lib/postImageUpload': { clearPostImagePreparation() {}, preparePostImage: async value => value },
    'react-native': {
      View: 'View', Text: 'Text', TextInput: 'TextInput', TouchableOpacity: 'TouchableOpacity', Pressable: 'Pressable', KeyboardAvoidingView: 'KeyboardAvoidingView',
      StyleSheet: { create: value => value }, Platform: { OS: 'ios' }, Keyboard: { dismiss() {} }, Alert: { alert: (...args) => alerts.push(args) },
    },
  });
  assert.equal(h.byType('Button').props.title, 'Save');
  assert.equal(h.byType('Button').props.disabled, true);
  assert.equal(h.byId('post-body-input').props.scrollEnabled, false);
  assert.equal(h.byId('post-body-input').props.autoFocus, false);
  await h.byType('PostAlbumGrid').props.onEdit(original, true);
  const editor = h.byType('PostPhotoEditor');
  assert.equal(editor.props.startWithCrop, true);
  editor.props.onApply({ ...original, uri: 'edited.jpg', isCropped: true });
  h.byId('post-body-input').props.onChangeText('My draft');
  h.props.initialDraft = { ...initialDraft, body: 'Background refetch', images: [] };
  assert.equal(h.byId('post-body-input').props.value, 'My draft');
  assert.equal(h.byType('PostAlbumGrid').props.photos[0].uri, 'edited.jpg');
  assert.equal(writes.length, 0);
  h.press('Cancel editing post');
  assert.equal(alerts.at(-1)[0], 'Discard changes?');
  assert.equal(writes.length, 0);
  await h.press('Save');
  assert.equal(writes[0].images[0].uri, 'edited.jpg');
  assert.equal(writes[0].body, 'My draft');
});

test('failed saves retain the full edit draft and a second save cannot run while pending', async () => {
  let reject;
  let calls = 0;
  const h = component('src/components/compose/PostComposer.tsx', 'PostComposer', {
    editing: true, initialDraft: { contentType: 'caption', body: '', reflectionTitle: '', isPrivate: false, images: [photo()] },
    saving: false, onClose() {}, onSubmit: () => { calls++; return new Promise((_, fail) => { reject = fail; }); },
  }, {
    '@providers/AuthProvider': { useAuth: () => ({ profile: {} }) },
    'expo-image-picker': {},
    '@/lib/postImageUpload': { clearPostImagePreparation() {}, preparePostImage: async value => value },
  });
  h.byId('post-body-input').props.onChangeText('Unsaved caption');
  const saving = h.press('Save');
  await h.press('Save');
  assert.equal(calls, 1);
  reject(new Error('Offline'));
  await saving;
  assert.equal(h.byId('post-body-input').props.value, 'Unsaved caption');
  assert.equal(h.byType('PostAlbumGrid').props.photos[0].uri, 'one.jpg');
});

test('older published photos resolve actual dimensions before opening crop controls', async () => {
  const legacy = { ...photo('legacy', 0, 0), uri: 'https://example.test/legacy.jpg' };
  const h = component('src/components/compose/PostComposer.tsx', 'PostComposer', {
    editing: true, initialDraft: { contentType: 'caption', body: '', reflectionTitle: '', isPrivate: false, images: [legacy] },
    saving: false, onClose() {}, onSubmit: async () => {},
  }, {
    '@providers/AuthProvider': { useAuth: () => ({ profile: {} }) },
    'expo-image-picker': {},
    '@/lib/postImageUpload': { clearPostImagePreparation() {}, preparePostImage: async value => value },
    'react-native': {
      View: 'View', Text: 'Text', TextInput: 'TextInput', TouchableOpacity: 'TouchableOpacity', Pressable: 'Pressable', KeyboardAvoidingView: 'KeyboardAvoidingView',
      StyleSheet: { create: value => value }, Platform: { OS: 'ios' }, Keyboard: { dismiss() {} }, Alert: { alert() {} },
      Image: { getSize: async () => ({ width: 1600, height: 900 }) },
    },
  });
  h.byType('PostAlbumGrid').props.onEdit(legacy, true);
  await settle();
  assert.equal(h.byType('PostPhotoEditor').props.photo.sourceWidth, 1600);
  assert.equal(h.byType('PostPhotoEditor').props.photo.sourceHeight, 900);
  assert.equal(h.byType('Button').props.disabled, true, 'resolving metadata alone is not an edit');
});

test('create and edit routes both render the shared composer and map its complete draft into their mutations', async () => {
  const creates = [];
  const edits = [];
  const composerStub = { PostComposer: 'PostComposer' };
  const create = component('app/(main)/(compose)/index.tsx', 'default', {}, {
    'expo-router': { router: { back() {}, navigate() {} } },
    '@providers/AuthProvider': { useAuth: () => ({ user: { id: 'viewer' } }) },
    '@/hooks/posts/useCreatePost': { useCreatePost: () => ({ isPending: false, mutateAsync: async value => creates.push(value) }) },
    '@/components/compose/PostComposer': composerStub,
  });
  const draft = { contentType: 'reflection', body: 'Reflection body', reflectionTitle: 'Title', images: [photo()], isPrivate: true };
  await create.byType('PostComposer').props.onSubmit(draft);
  assert.equal(creates[0].input.caption, 'Title');
  assert.equal(creates[0].input.reflection, 'Reflection body');
  assert.equal(creates[0].input.isPrivate, true);
  const original = { id: 'post', author_id: 'viewer', content_type: 'both', caption: 'Old title', reflection: 'Old body', is_private: false,
    images: [{ id: 'one', storage_path: 'one.jpg', width: null, height: null, position: 0 }] };
  const edit = component('app/edit-post.tsx', 'LoadedEditPost', { post: original, userId: 'viewer' }, {
    'expo-router': { useRouter: () => ({ back() {} }) },
    '@/providers/AuthProvider': {},
    '@/hooks/posts': { useUpdatePost: () => ({ isPending: false, mutateAsync: async value => edits.push(value) }) },
    '@/components/compose/PostComposer': composerStub,
    '@/lib/supabase/storage': { BUCKETS: { POST_IMAGES: 'post-images' }, getPublicUrl: (_, path) => 'https://example.test/' + path },
  });
  const shared = edit.byType('PostComposer');
  assert.equal(shared.props.editing, true);
  assert.equal(shared.props.initialDraft.body, 'Old body');
  assert.equal(shared.props.initialDraft.images[0].width, 0);
  edit.props.post = { ...original, caption: 'Refetched', images: [] };
  await edit.byType('PostComposer').props.onSubmit(draft);
  assert.equal(edits[0].originalImages, original.images);
  assert.equal(edits[0].contentType, 'both');
  assert.equal(edits[0].reflection, 'Reflection body');
  assert.equal(edits[0].images, draft.images);
  assert.equal(edits[0].isPrivate, true);
});
