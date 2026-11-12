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
