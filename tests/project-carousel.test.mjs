import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getCarouselButtonState } from "../project-carousel.js";

const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const indexMarkup = readFileSync(new URL("../index.html", import.meta.url), "utf8");

function createRail({
  railLeft = 0,
  railRight = 950,
  firstCardLeft = 48,
  lastCardRight = 900,
}) {
  const cards = [
    { getBoundingClientRect: () => ({ left: firstCardLeft }) },
    { getBoundingClientRect: () => ({ right: lastCardRight }) },
  ];

  return {
    getBoundingClientRect: () => ({ left: railLeft, right: railRight }),
    querySelectorAll: () => cards,
  };
}

test("carousel buttons disappear when every card fits", () => {
  assert.deepEqual(getCarouselButtonState(createRail({})), {
    hasOverflow: false,
    canScrollPrevious: false,
    canScrollNext: false,
  });
});

test("only Next is available at the start of an overflowing carousel", () => {
  assert.deepEqual(
    getCarouselButtonState(createRail({ lastCardRight: 1100 })),
    { hasOverflow: true, canScrollPrevious: false, canScrollNext: true },
  );
});

test("both directions are available between carousel ends", () => {
  assert.deepEqual(
    getCarouselButtonState(
      createRail({ firstCardLeft: -100, lastCardRight: 1100 }),
    ),
    { hasOverflow: true, canScrollPrevious: true, canScrollNext: true },
  );
});

test("only Previous is available at the end of a carousel", () => {
  assert.deepEqual(
    getCarouselButtonState(
      createRail({ firstCardLeft: -100, lastCardRight: 900 }),
    ),
    { hasOverflow: true, canScrollPrevious: true, canScrollNext: false },
  );
});

test("carousel buttons fail closed before JavaScript initializes", () => {
  assert.equal(
    indexMarkup.match(/class="carousel-controls" hidden/g)?.length,
    2,
  );
  assert.equal(
    indexMarkup.match(
      /type="button"\s+disabled\s+aria-label="(?:Previous|Next) (?:RHS App|HSR Battlegrounds) card"/g,
    )?.length,
    4,
  );
  assert.match(
    styles,
    /\.carousel-controls\[hidden\]\s*\{\s*display:\s*none;/,
  );
  assert.match(
    styles,
    /\.carousel-button:disabled\s*\{[^}]*opacity:\s*0\.42;[^}]*pointer-events:\s*none;/s,
  );
});
