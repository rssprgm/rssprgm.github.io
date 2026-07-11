import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const smoothScroll = readFileSync("smooth-scroll.js", "utf8");
const homePage = readFileSync("index.html", "utf8");

test("same-page hash links land at the section start", () => {
  assert.match(
    smoothScroll,
    /const targetTop = target\.getBoundingClientRect\(\)\.top \+ window\.scrollY;/,
  );
  assert.doesNotMatch(smoothScroll, /headerHeight|scrollOffset/);
});

test("cross-page hash links keep native browser navigation", () => {
  assert.match(
    smoothScroll,
    /if \(url\.pathname !== window\.location\.pathname \|\| url\.search !== window\.location\.search\) return;/,
  );
  assert.doesNotMatch(smoothScroll, /sessionStorage|location\.assign|url\.hash = ""/);
});

test("modified and new-tab link clicks keep their native behavior", () => {
  assert.match(smoothScroll, /event\.metaKey/);
  assert.match(smoothScroll, /event\.ctrlKey/);
  assert.match(smoothScroll, /link\.hasAttribute\("download"\)/);
  assert.match(smoothScroll, /link\.target && link\.target !== "_self"/);
});

test("responsive media reserves the selected desktop aspect ratio", () => {
  assert.match(
    homePage,
    /<source\s+media="\(min-width: 761px\)"\s+width="4066"\s+height="1618"\s+srcset="\.\/assets\/projects\/rhs-app\/xcode-desktop\.webp"/,
  );
});
