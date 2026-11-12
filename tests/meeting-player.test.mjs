import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const source = readFileSync(new URL('../meeting-player.js', import.meta.url), 'utf8');
const { summaryForSlide } = await import(new URL('../meeting-player.js', import.meta.url));
const data = readFileSync(new URL('../_data/git_workshop.yml', import.meta.url), 'utf8');
const ranges = [[1, 1], [2, 3], ...[...data.matchAll(/    start: (\d+)\n    end: (\d+)/g)].map((match) => [+match[1], +match[2]]), [20, 20]];
const sections = ranges.map(([start, end]) => ({ dataset: { summaryStart: String(start), summaryEnd: String(end) } }));
test('every presentation slide maps to exactly one summary, including range boundaries', () => {
  for (let slide = 1; slide <= 20; slide++) {
    const matches = sections.filter(({ dataset }) => slide >= +dataset.summaryStart && slide <= +dataset.summaryEnd);
    assert.equal(matches.length, 1, `slide ${slide}`);
    assert.equal(summaryForSlide(sections, slide), matches[0]);
    assert.ok(existsSync(new URL(`../assets/meetings/git/slides/${String(slide).padStart(2, '0')}.jpg`, import.meta.url)));
  }
  assert.equal(summaryForSlide(sections, 0), undefined);
  assert.equal(summaryForSlide(sections, 21), undefined);
});

test('autoplay runs intro → slides → outro, stops at the end, and Replay restarts', async (t) => {
  const { setupMeetingPlayer } = await import(new URL('../meeting-player.js', import.meta.url));
  class Element extends EventTarget {
    constructor() { super(); this.children = {}; this.hidden = false; this.offsetLeft = 0; this.offsetTop = 0; this.offsetWidth = 18; this.clientWidth = 100; this.scrollLeft = 0; this.scrollWidth = 300; this.dataset = {}; this.attributes = {}; this.classList = { toggle() {} }; this.style = { setProperty() {} }; }
    querySelector(selector) { return this.children[selector] || null; }
    querySelectorAll(selector) { return this.children[selector] || []; }
    setAttribute(key, value) { this.attributes[key] = value; }
    scrollTo({ left }) { if (left !== undefined) this.scrollLeft = left; }
    closest() { return { hidden: false }; }
    contains(element) { return Object.values(this.children).includes(element); }
  }
  class Video extends Element {
    paused = true;
    ended = false;
    currentTime = 0;
    play() { this.paused = false; this.dispatchEvent(new Event('play')); return Promise.resolve(); }
    pause() { if (!this.paused) { this.paused = true; this.dispatchEvent(new Event('pause')); } }
    finish() { this.ended = true; this.paused = true; this.dispatchEvent(new Event('ended')); }
  }
  const root = new Element(), player = new Element(), track = new Element(), dotTrack = new Element(), summary = new Element();
  const slides = [new Element(), new Element(), new Element()];
  const intro = new Video(), outro = new Video();
  slides.forEach((slide, index) => { slide.offsetLeft = index * 100; slide.children['video, img'] = new Element(); });
  slides[0].children.video = intro; slides[2].children.video = outro;
  const dots = slides.map(() => new Element());
  const previous = new Element(), next = new Element(), replay = new Element(), pause = new Element();
  player.children = { '[data-slide-track]': track, '[data-gallery-playback]': new Element(), '[data-gallery-previous]': previous, '[data-gallery-next]': next, '[data-player-error]': new Element(), '[data-player-controls]': new Element(), '.meeting-stage': new Element() };
  player.children['[data-gallery-playback]'].children = { '[data-gallery-window]': dotTrack, '[data-gallery-item]': dots, '[data-gallery-toggle]': pause };
  root.children = { '[data-slide-player]': player, '[data-summary-scroll]': summary };
  track.children['[data-slide]'] = slides;
  summary.children['[data-summary-start]'] = sections.map(({ dataset }) => Object.assign(new Element(), { dataset }));
  const oldMatch = globalThis.matchMedia, oldObserver = globalThis.ResizeObserver, oldFrame = globalThis.requestAnimationFrame, oldCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  globalThis.matchMedia = () => ({ matches: true });
  globalThis.ResizeObserver = class { observe() {} };
  t.after(() => { globalThis.matchMedia = oldMatch; globalThis.ResizeObserver = oldObserver; globalThis.requestAnimationFrame = oldFrame; globalThis.cancelAnimationFrame = oldCancel; });
  let clock = 0;
  t.mock.method(performance, 'now', () => clock);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  setupMeetingPlayer(root);
  assert.equal(intro.paused, false);
  intro.finish();
  assert.equal(dots[1].attributes['aria-current'], 'true');
  clock = 5000;
  t.mock.timers.tick(5000);
  pause.dispatchEvent(new Event('click'));
  clock = 35000;
  t.mock.timers.tick(30000);
  assert.equal(dots[1].attributes['aria-current'], 'true', 'pause stops automatic advancement');
  pause.dispatchEvent(new Event('click'));
  t.mock.timers.tick(9999);
  assert.equal(dots[1].attributes['aria-current'], 'true');
  clock = 45000;
  t.mock.timers.tick(1);
  assert.equal(dots[2].attributes['aria-current'], 'true');
  assert.equal(outro.paused, false);
  outro.finish();
  assert.equal(pause.dataset.state, 'replay');
  t.mock.timers.tick(60000);
  assert.equal(dots[2].attributes['aria-current'], 'true');
  pause.dispatchEvent(new Event('click'));
  assert.equal(dots[0].attributes['aria-current'], 'true');
  assert.equal(intro.currentTime, 0);
  assert.equal(pause.dataset.state, 'pause');
  assert.equal(intro.paused, false);
});

 test('dot highlights crossfade continuously while a slide is partially scrolled', async () => {
  const { dotEmphasis } = await import(new URL('../meeting-player.js', import.meta.url));
  assert.equal(dotEmphasis(2, 2), 1);
  assert.equal(dotEmphasis(2, 2.25), .75);
  assert.equal(dotEmphasis(3, 2.25), .25);
  assert.equal(dotEmphasis(2, 2.5), .5);
  assert.equal(dotEmphasis(3, 2.5), .5);
  assert.equal(dotEmphasis(0, 2.5), 0);
});
