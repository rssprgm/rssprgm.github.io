import test from 'node:test';
import assert from 'node:assert/strict';
import { rippleInfluence, fluidFalloff, fluidBrightness } from '../hero-fluid.js';

test('focus ripple expands circularly and fades out after 1.2 seconds', () => {
  assert.equal(rippleInfluence(0, 0, -1), 0);
  assert.equal(rippleInfluence(0, 0, 1.2), 0);
  assert.equal(rippleInfluence(0.1, 0, 0.1), 0);
  assert.ok(rippleInfluence(0.1, 0, 0.6) > 0);
  assert.equal(rippleInfluence(0.05, 0, 0.6), rippleInfluence(0, 0.05, 0.6));
  assert.ok(rippleInfluence(0, 0, 0.3) > rippleInfluence(0, 0, 0.6));
  assert.ok(rippleInfluence(0, 0, 0.6) > rippleInfluence(0.1, 0, 0.6));
});

test('Gaussian force extends well beyond the narrow density source', () => {
  assert.equal(fluidFalloff(0, 4), 1);
  assert.ok(fluidFalloff(16, 4) > 0.36);
  assert.ok(fluidFalloff(16, 1.8) < 0.008);
});

test('motion gently brightens existing glyphs without making empty fluid visible', () => {
  assert.equal(fluidBrightness(0, 100), 0);
  assert.equal(fluidBrightness(0.4, 0), 0.4);
  assert.equal(fluidBrightness(0.4, 10), 0.5);
  assert.equal(fluidBrightness(0.4, 100), 0.5);
  assert.equal(fluidBrightness(1, 100), 1);
});
