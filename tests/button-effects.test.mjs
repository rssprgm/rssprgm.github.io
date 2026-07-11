import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const buttonEffects = readFileSync("button-effects.js", "utf8");
const buttonStyles = readFileSync("button-effects.css", "utf8");
const joinDialog = readFileSync("join-dialog.js", "utf8");
const main = readFileSync("main.js", "utf8");

test("dialog buttons keep press effects but skip generated SVG refraction", () => {
  assert.match(buttonEffects, /const defaultButtonSelector = "\.button, \.join-close"/);
  assert.match(
    buttonEffects,
    /!element\.closest\("\[data-join-dialog\]"\)/,
  );
  assert.match(
    buttonStyles,
    /\[data-join-dialog\] \.button,[\s\S]*backdrop-filter: blur\(var\(--button-backdrop-blur\)\) saturate\(1\.2\)/,
  );
  assert.match(
    buttonStyles,
    /@supports \(-moz-appearance: none\)[\s\S]*\[data-join-dialog\] \.button,[\s\S]*backdrop-filter: none/,
  );
});

test("refraction maps use stable layout dimensions and skip unchanged sizes", () => {
  assert.match(buttonEffects, /const width = element\.offsetWidth/);
  assert.match(buttonEffects, /const height = element\.offsetHeight/);
  assert.match(
    buttonEffects,
    /instance\.width === width[\s\S]*instance\.height === height[\s\S]*instance\.pixelRatio === pixelRatio/,
  );
});

test("refraction updates observe eligible elements and batch changed sizes", () => {
  assert.match(buttonEffects, /new ResizeObserver\(\(entries\) =>/);
  assert.match(buttonEffects, /resizeObserver\?\.observe\(element\)/);
  assert.match(
    buttonEffects,
    /updateFrame = requestAnimationFrame\(flushRefractionUpdates\)/,
  );
  assert.match(buttonEffects, /pendingElements\.add\(element\)/);
  assert.match(buttonEffects, /resizeObserver\?\.disconnect\(\)/);
  assert.match(buttonEffects, /cancelAnimationFrame\(updateFrame\)/);
  assert.doesNotMatch(
    buttonEffects,
    /window\.addEventListener\("resize", updateRefraction\)/,
  );
});

test("opening the join dialog does not trigger a global refraction refresh", () => {
  assert.doesNotMatch(joinDialog, /refreshButtonEffects/);
  assert.match(main, /initButtonEffects\(\{ prefersReducedMotion \}\);/);
  assert.doesNotMatch(main, /const refreshButtonEffects|refreshButtonEffects,/);
});
