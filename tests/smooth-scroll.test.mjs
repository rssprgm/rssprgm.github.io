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
