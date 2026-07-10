import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const lenisScroll = readFileSync("lenis-scroll.js", "utf8");
const vendoredLenis = readFileSync("vendor/lenis/lenis.mjs", "utf8");
const main = readFileSync("main.js", "utf8");
const smoothScroll = readFileSync("smooth-scroll.js", "utf8");
const joinDialogMarkup = readFileSync("_includes/join-dialog.html", "utf8");
const mobileMenuMarkup = readFileSync("_includes/mobile-menu.html", "utf8");

test("Lenis runs for normal motion and respects reduced motion", () => {
  assert.match(lenisScroll, /\.\/vendor\/lenis\/lenis\.mjs/);
  assert.doesNotMatch(lenisScroll, /https?:\/\//);
  assert.match(vendoredLenis, /var version\s*=\s*"1\.3\.11"/);
  assert.match(lenisScroll, /if \(prefersReducedMotion\) return null/);
  assert.match(lenisScroll, /smoothWheel: true/);
  assert.match(lenisScroll, /smoothTouch: false/);
  assert.match(lenisScroll, /wheelMultiplier: 0\.9/);
  assert.match(lenisScroll, /requestAnimationFrame\(raf\)/);
});

test("anchor scrolling uses the active Lenis instance", () => {
  assert.match(main, /const lenis = setupLenisScroll\(\{ prefersReducedMotion \}\)/);
  assert.match(main, /setupSmoothScrolling\(\{ lenis, prefersReducedMotion \}\)/);
  assert.match(smoothScroll, /lenis\.scrollTo\(target, \{ duration: 1\.1, offset: 0 \}\)/);
});

test("modal surfaces opt out of Lenis wheel handling", () => {
  assert.match(joinDialogMarkup, /data-lenis-prevent/);
  assert.match(mobileMenuMarkup, /data-lenis-prevent/);
});
