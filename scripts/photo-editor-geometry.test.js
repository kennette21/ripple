const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');
function load(file) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, require: name => load(path.resolve(path.dirname(file), name + '.ts')) });
  return exports;
}
const g = load(path.join(__dirname, '../src/lib/photoEditorGeometry.ts'));
const plain = value => JSON.parse(JSON.stringify(value));

test('fitting a rotated portrait keeps its complete source inside the available canvas', () => {
  const crop = g.fullPhotoCrop(1200, 800, 90);
  assert.deepEqual(plain(crop), { originX: 0, originY: 0, width: 800, height: 1200 });
  const view = g.photoCanvasLayout(crop, 390, 594);
  assert.ok(view.frameLeft >= g.PHOTO_EDGE_INSET);
  assert.ok(view.frameTop >= g.PHOTO_EDGE_INSET);
  assert.ok(view.frameLeft + view.frameWidth <= 390 - g.PHOTO_EDGE_INSET);
  assert.ok(view.frameTop + view.frameHeight <= 594 - g.PHOTO_EDGE_INSET);
  assert.equal(view.imageLeft, view.frameLeft);
  assert.equal(view.imageTop, view.frameTop);
});

test('Fill centers a square within the chosen composition and panning cannot expose blank image area', () => {
  const crop = g.squarePhotoCrop({ originX: 100, originY: 50, width: 900, height: 600 });
  assert.deepEqual(plain(crop), { originX: 250, originY: 50, width: 600, height: 600 });
  assert.deepEqual(plain(g.panPhotoCrop(crop, 10000, -10000, .5, 1200, 800)), { originX: 0, originY: 200, width: 600, height: 600 });
});

test('zoom preserves the point under the pinch and stops at the source edges', () => {
  const crop = { originX: 100, originY: 80, width: 800, height: 500 };
  const zoomed = g.zoomPhotoCrop(crop, 1200, 800, 3, .2, .75);
  assert.equal(zoomed.originX + zoomed.width * .2, crop.originX + crop.width * .2);
  assert.equal(zoomed.originY + zoomed.height * .75, crop.originY + crop.height * .75);
  assert.equal(g.photoCropZoom(zoomed, 1200, 800), 3);
  const whole = g.zoomPhotoCrop(zoomed, 1200, 800, 1, 1, 1);
  assert.ok(whole.originX >= 0 && whole.originY >= 0);
  assert.ok(whole.originX + whole.width <= 1200 && whole.originY + whole.height <= 800);
});

test('corner resizing stops at visible source edges and maintains a usable handle separation', () => {
  const crop = { originX: 0, originY: 0, width: 1200, height: 800 };
  const view = g.photoCanvasLayout(crop, 390, 594);
  const expanded = g.resizePhotoCrop(crop, 'nw', -10000, -10000, view, 1200, 800, 390, 594);
  assert.deepEqual(plain(expanded), crop);
  const tiny = g.resizePhotoCrop(crop, 'se', -10000, -10000, view, 1200, 800, 390, 594);
  assert.ok(tiny.width * view.scale >= 64 - 1e-6);
  assert.ok(tiny.height * view.scale >= 64 - 1e-6);
  const movingFrame = g.frameOnImage(tiny, view);
  assert.equal(movingFrame.imageLeft, view.imageLeft);
  assert.equal(movingFrame.imageTop, view.imageTop);
  const settled = g.photoCanvasLayout(tiny, 390, 594);
  assert.equal((settled.frameLeft - settled.imageLeft) / settled.scale, tiny.originX);
  assert.equal((settled.frameTop - settled.imageTop) / settled.scale, tiny.originY);
});
