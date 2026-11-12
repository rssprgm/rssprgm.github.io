import test from 'node:test';
import assert from 'node:assert/strict';
import { setupGalleryControls } from '../gallery-controls.js';

test('dot pointer focus preserves the current scroll viewport before navigation', () => {
  class Element extends EventTarget {
    style = { setProperty() {} };
    dataset = {};
    focus(options) { this.focusOptions = options; }
  }
  const dot = new Element();
  const viewport = new Element();
  viewport.scrollLeft = 180;
  const playback = new Element();
  playback.querySelector = (selector) => selector === '[data-gallery-window]' ? viewport : new Element();
  playback.querySelectorAll = () => [dot];
  const root = { querySelector: (selector) => selector === '[data-gallery-playback]' ? playback : new Element() };
  let selected = null;
  setupGalleryControls(root, { onPrevious() {}, onNext() {}, onSelect(index) { selected = index; }, onToggle() {}, onReplay() {} });
  const event = new Event('pointerdown', { cancelable: true });
  Object.defineProperty(event, 'button', { value: 0 });
  dot.dispatchEvent(event);
  assert.ok(event.defaultPrevented);
  assert.deepEqual(dot.focusOptions, { preventScroll: true });
  assert.equal(viewport.scrollLeft, 180);
  dot.dispatchEvent(new Event('click'));
  assert.equal(selected, 0);
});

test('dot strip targets the tapped dot from its current viewport while slides catch up', (t) => {
  class Element extends EventTarget {
    style = { setProperty() {} };
    dataset = {};
    offsetWidth = 18;
    offsetLeft = 0;
    focus() {}
    scrollTo({ left }) { this.scrollLeft = left; }
  }
  const dots = Array.from({ length: 3 }, (_, index) => Object.assign(new Element(), { offsetLeft: index * 24 }));
  const viewport = Object.assign(new Element(), { scrollLeft: 30, scrollWidth: 200, clientWidth: 48 });
  const playback = new Element();
  playback.querySelector = (selector) => selector === '[data-gallery-window]' ? viewport : new Element();
  playback.querySelectorAll = () => dots;
  const root = { querySelector: (selector) => selector === '[data-gallery-playback]' ? playback : new Element() };
  let callback;
  let now = 0;
  const oldFrame = globalThis.requestAnimationFrame, oldCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = (fn) => { callback = fn; return 1; };
  globalThis.cancelAnimationFrame = () => {};
  t.after(() => { globalThis.requestAnimationFrame = oldFrame; globalThis.cancelAnimationFrame = oldCancel; });
  t.mock.method(performance, 'now', () => now);
  const controls = setupGalleryControls(root, { onPrevious() {}, onNext() {}, onSelect() {}, onToggle() {}, onReplay() {} });
  dots[2].dispatchEvent(new Event('click'));
  controls.setPosition(0);
  assert.equal(viewport.scrollLeft, 30, 'old slide position cannot reset dot viewport');
  now = 16;
  callback(now);
  assert.ok(viewport.scrollLeft > 30, 'dot strip moves directly toward tapped dot');
});
