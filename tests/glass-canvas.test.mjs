import test from 'node:test';
import assert from 'node:assert/strict';
import { connectGlassCanvas } from '../glass-canvas.js';

test('canvas paint source uploads current pixels, reuses textures, and cleans up', () => {
  const originalUsage = globalThis.GPUTextureUsage;
  globalThis.GPUTextureUsage = { TEXTURE_BINDING: 1, COPY_DST: 2, RENDER_ATTACHMENT: 4 };
  try {
    const canvas = new EventTarget();
    Object.assign(canvas, { width: 100, height: 60, getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 60 }) });
    let source, allocations = 0, uploads = 0, destroyed = 0, requested = 0;
    const scene = {
      gpuDevice: {
        createTexture() { allocations++; return { destroy() { destroyed++; } }; },
        queue: { copyExternalImageToTexture(input) { assert.equal(input.source, canvas); uploads++; } },
      },
      requestRender() { requested++; },
      addPaintSource(element, paint) { assert.equal(element, canvas); source = paint; return () => paint.dispose(); },
    };
    const dispose = connectGlassCanvas(scene, canvas);
    assert.equal(source.paint().owner, source);
    source.paint();
    assert.equal(uploads, 1);
    canvas.dispatchEvent(new Event('hero-fluid-frame'));
    source.paint();
    assert.equal(uploads, 2);
    assert.equal(allocations, 1);
    assert.equal(requested, 1);
    canvas.width = 200;
    source.paint();
    assert.equal(allocations, 2);
    assert.equal(destroyed, 1);
    dispose();
    canvas.dispatchEvent(new Event('hero-fluid-frame'));
    assert.equal(requested, 1);
    assert.equal(destroyed, 2);
  } finally {
    if (originalUsage) globalThis.GPUTextureUsage = originalUsage;
    else delete globalThis.GPUTextureUsage;
  }
});
