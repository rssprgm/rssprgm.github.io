import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const main = readFileSync("main.js", "utf8");

test("staggered groups use an 85 percent viewport observer", () => {
  assert.match(main, /new IntersectionObserver\(/);
  assert.match(
    main,
    /const passedContentMargin = document\.documentElement\.scrollHeight/,
  );
  assert.match(
    main,
    /rootMargin: `\$\{passedContentMargin\}px 0px -15% 0px`/,
  );
  assert.match(main, /threshold: 0/);
  assert.match(
    main,
    /entry\.boundingClientRect\.top <= window\.innerHeight \* 0\.85/,
  );
  assert.doesNotMatch(main, /!entry\.isIntersecting/);
  assert.match(main, /observer\.observe\(group\)/);
  assert.match(main, /observer\.unobserve\(entry\.target\)/);
  assert.match(main, /observer\.disconnect\(\)/);
  assert.doesNotMatch(main, /addEventListener\("scroll", queueRevealCheck/);
  assert.doesNotMatch(main, /addEventListener\("resize", queueRevealCheck/);
});

test("staggered groups already above the trigger reveal immediately", () => {
  assert.match(main, /const triggerLine = window\.innerHeight \* 0\.85/);
  assert.match(
    main,
    /group\.getBoundingClientRect\(\)\.top <= triggerLine[\s\S]*playStaggeredGroup\(group\)/,
  );
});
