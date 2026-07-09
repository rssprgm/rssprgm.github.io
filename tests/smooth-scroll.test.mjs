import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const smoothScroll = readFileSync("smooth-scroll.js", "utf8");

test("same-page hash links land at the section start", () => {
  assert.match(
    smoothScroll,
    /const targetTop = target\.getBoundingClientRect\(\)\.top \+ window\.scrollY;/,
  );
  assert.doesNotMatch(smoothScroll, /headerHeight|scrollOffset/);
});

test("cross-page hash links resume with smooth scrolling after navigation", () => {
  assert.match(smoothScroll, /pendingScrollTargetKey/);
  assert.match(smoothScroll, /window\.sessionStorage\.setItem/);
  assert.match(smoothScroll, /url\.hash = ""/);
  assert.match(smoothScroll, /window\.location\.assign\(url\.href\)/);
  assert.match(smoothScroll, /window\.history\.replaceState/);
});

test("modified and new-tab link clicks keep their native behavior", () => {
  assert.match(smoothScroll, /event\.metaKey/);
  assert.match(smoothScroll, /event\.ctrlKey/);
  assert.match(smoothScroll, /link\.hasAttribute\("download"\)/);
  assert.match(smoothScroll, /link\.target && link\.target !== "_self"/);
});
