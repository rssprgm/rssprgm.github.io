import test from 'node:test';
import assert from 'node:assert/strict';
import { preferFlatControls } from '../glass-controls.js';
const capable = { gpu: {}, deviceMemory: 8, hardwareConcurrency: 8 };
const preferences = { reducedMotion: false, reducedTransparency: false };
test('flat controls cover missing WebGPU, constrained devices and user preferences', () => {
  assert.equal(preferFlatControls(capable, preferences), false);
  for (const device of [{ ...capable, gpu: undefined }, { ...capable, deviceMemory: 2 }, { ...capable, hardwareConcurrency: 1 }, { ...capable, connection: { saveData: true } }]) {
    assert.equal(preferFlatControls(device, preferences), true);
  }
  assert.equal(preferFlatControls(capable, { ...preferences, reducedMotion: true }), true);
  assert.equal(preferFlatControls(capable, { ...preferences, reducedTransparency: true }), true);
  assert.equal(preferFlatControls({ gpu: {} }, preferences), false);
  assert.equal(preferFlatControls({ ...capable, deviceMemory: 4, hardwareConcurrency: 2 }, preferences), false);
});

import { setupGlassControls } from '../glass-controls.js';
test('unsupported adapters and initialization errors leave flat controls usable', async (t) => {
  const originalMatchMedia = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: false });
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalWindow = globalThis.window;
  globalThis.window = { removeEventListener() {} };
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const dataset = {};
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: { dataset }, querySelector: () => null } });
  try {
    for (const result of [null, { info: { isFallbackAdapter: true } }, { info: {}, features: new Set() }]) {
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { gpu: { requestAdapter: async () => result } } });
      await setupGlassControls();
      assert.notEqual(dataset.glass, 'gpu');
    }
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { gpu: { requestAdapter: async () => { throw Error('Unavailable'); } } } });
    await setupGlassControls();
    assert.equal(dataset.glass, 'flat');
  } finally {
    if (originalWindow) globalThis.window = originalWindow;
    else delete globalThis.window;
    if (originalMatchMedia) globalThis.matchMedia = originalMatchMedia;
    else delete globalThis.matchMedia;
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else delete globalThis.document;
  }
});


import { readFileSync } from 'node:fs';
test('glass enhancement stays limited to the original button scope', () => {
  const source = readFileSync(new URL('../glass-controls.js', import.meta.url), 'utf8');
  assert.match(source, /querySelectorAll\('\.button, \.join-close'\)/);
  assert.doesNotMatch(source, /gallery-button|gallery-toggle/);
});

test('related controls use their existing group and the native control-clear recipe', () => {
  const source = readFileSync(new URL('../glass-controls.js', import.meta.url), 'utf8');
  assert.match(source, /closest\('\.hero-actions, \.join-actions'\)/);
  assert.match(source, /const host = group \|\| document.createElement/);
  assert.match(source, /new GlassEffectContainer\(host\)/);
  assert.match(source, /createNativeLensFullParameters\(host.offsetWidth, height, 'control-clear'\)/);
  const styles = readFileSync(new URL('../glass-controls.css', import.meta.url), 'utf8');
  assert.doesNotMatch(styles, /color-mix|85%/);
  assert.match(source, /container.setProminentWhite\(item.platter\)/);
});
