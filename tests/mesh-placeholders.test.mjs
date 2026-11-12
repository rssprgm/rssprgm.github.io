import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const main = readFileSync('main.js', 'utf8');
const setup = main.slice(main.indexOf('function setupMeshPlaceholders()'), main.indexOf('function setupStaggeredFadeIn()'));
const source = 'data:image/bmp;base64,Qk0=';

function fixture({ loaded = false, fail = false } = {}) {
  const calls = { decodes: 0, encodes: 0, sources: [], unobserved: [] };
  const context = { drawImage(...args) { calls.draw = args.slice(1); } };
  const hosts = Array.from({ length: 2 }, () => {
    const image = {
      naturalWidth: loaded ? 1920 : 0,
      complete: loaded,
      classes: new Set(),
      classList: { add(name) { image.classes.add(name); } },
      addEventListener(name, callback) { image[name] = callback; },
    };
    return { image, style: { backgroundImage: `url("${source}")` }, querySelectorAll() { return [image]; } };
  });
  let enter;
  runInNewContext(`${setup}\nsetupMeshPlaceholders();`, {
    document: {
      querySelectorAll() { return hosts; },
      createElement() {
        return {
          getContext() { return context; },
          toDataURL(type) {
            assert.equal(type, 'image/webp');
            calls.encodes++;
            return 'data:image/webp;base64,bG9jYWw=';
          },
        };
      },
    },
    Image: class {
      async decode() {
        calls.decodes++;
        calls.sources.push(this.src);
        if (fail) throw new Error('Decode failed');
      }
    },
    IntersectionObserver: class {
      constructor(callback) { enter = callback; }
      observe() {}
      unobserve(host) { calls.unobserved.push(host); }
    },
  });
  return { calls, context, hosts, enter() { enter(hosts.map((target) => ({ target, isIntersecting: true }))); } };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

test('visible placeholders use one cached native high-quality pass with embedded input only', async () => {
  const f = fixture();
  assert.equal(f.calls.decodes, 0);
  f.enter();
  await flush();
  assert.deepEqual(f.calls.sources, [source]);
  assert.equal(f.calls.encodes, 1);
  assert.equal(f.context.imageSmoothingEnabled, true);
  assert.equal(f.context.imageSmoothingQuality, 'high');
  assert.deepEqual(f.calls.draw, [0, 0, 64, 64]);
  assert.equal(f.calls.unobserved.length, 2);
  f.hosts.forEach((host) => assert.match(host.style.backgroundImage, /^url\("data:image\/webp;/));
});

test('loaded images skip resampling; pending and failed images stay hidden until a successful load', async () => {
  const loaded = fixture({ loaded: true });
  loaded.enter();
  await flush();
  assert.equal(loaded.calls.decodes, 0);
  assert.ok(loaded.hosts[0].image.classes.has('mesh-image-loaded'));

  const failed = fixture({ fail: true });
  failed.enter();
  await flush();
  const host = failed.hosts[0];
  assert.equal(host.style.backgroundImage, `url("${source}")`);
  assert.equal(host.image.classes.size, 0);
  host.image.naturalWidth = 1920;
  host.image.complete = true;
  host.image.load();
  assert.ok(host.image.classes.has('mesh-image-loaded'));
});
