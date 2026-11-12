import test from 'node:test';
import assert from 'node:assert/strict';
import { springProgress } from '../playback-intro.js';

test('entrance springs hold before their stage and settle at the destination', () => {
  for (const [stiffness, damping] of [[100, 20], [100, 8], [100, 10], [200, 20]]) {
    assert.equal(springProgress(-.1, stiffness, damping), 0);
    assert.equal(springProgress(0, stiffness, damping), 0);
    assert.ok(Math.abs(1 - springProgress(2, stiffness, damping)) < .001);
  }
});

test('entrance redraws the shared SDF on each frame and restores resting geometry', async () => {
  const { revealPlayback } = await import('../playback-intro.js');
  const saved = Object.fromEntries(['window', 'IntersectionObserver', 'requestAnimationFrame', 'cancelAnimationFrame'].map((key) => [key, globalThis[key]]));
  let enter, draw;
  const element = (offsetWidth) => ({ offsetWidth, style: { removeProperty(key) { delete this[key]; }, setProperty(key, value) { this[key] = value; } }, children: [] });
  const pill = element(180), toggle = element(44), content = element(160);
  toggle.children = [element(0)];
  const classes = new Set();
  let redraws = 0;
  const root = { style: element(0).style, classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) }, querySelector: (selector) => ({ '.gallery-progress-pill': pill, '.gallery-toggle': toggle, '.gallery-progress-window': content })[selector], dispatchEvent: () => { redraws++; } };
  const motion = { matches: false, addEventListener() {}, removeEventListener() {} };
  try {
    globalThis.window = { IntersectionObserver: true };
    globalThis.IntersectionObserver = class { constructor(callback) { enter = callback; } observe() {} disconnect() {} };
    globalThis.requestAnimationFrame = (callback) => { draw = callback; return 1; };
    globalThis.cancelAnimationFrame = () => {};
    const started = performance.now();
    const done = revealPlayback(root, motion);
    enter([{ isIntersecting: true }]);
    draw(started + 600);
    assert.equal(redraws, 1);
    assert.ok(Math.abs(parseFloat(pill.style.width) + parseFloat(pill.style.marginRight) - 180) < .001);
    draw(started + 2100);
    await done;
    assert.equal(redraws, 2);
    assert.equal(classes.size, 0);
    assert.equal(pill.style.width, undefined);
    assert.equal(root.style.transform, undefined);
  } finally {
    Object.assign(globalThis, saved);
  }
});
