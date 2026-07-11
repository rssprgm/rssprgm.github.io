import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getCarouselButtonState } from "../project-carousel.js";

const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const indexMarkup = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const projectShowcaseMarkup = readFileSync(
  new URL("../_includes/project-showcase.html", import.meta.url),
  "utf8",
);
const projectsData = readFileSync(
  new URL("../_data/projects.yml", import.meta.url),
  "utf8",
);

function createRail({
  containerLeft = 0,
  containerRight = 950,
  firstCardLeft = 48,
  lastCardRight = 900,
}) {
  const cards = [
    { getBoundingClientRect: () => ({ left: firstCardLeft }) },
    { getBoundingClientRect: () => ({ right: lastCardRight }) },
  ];

  return {
    closest: () => ({
      getBoundingClientRect: () => ({
        left: containerLeft,
        right: containerRight,
      }),
    }),
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

test("cards outside the width-limited container count as overflow", () => {
  assert.deepEqual(
    getCarouselButtonState(
      createRail({
        containerLeft: 296,
        containerRight: 1736,
        firstCardLeft: 296,
        lastCardRight: 1940,
      }),
    ),
    { hasOverflow: true, canScrollPrevious: false, canScrollNext: true },
  );
});

test("carousel buttons fail closed before JavaScript initializes", () => {
  assert.equal(
    projectsData.match(/^- id:/gm)?.length,
    2,
  );
  assert.match(indexMarkup, /{% for project in site\.data\.projects %}/);
  assert.match(
    indexMarkup,
    /{% include project-showcase\.html project=project %}/,
  );
  assert.match(projectShowcaseMarkup, /class="carousel-controls" hidden/);
  assert.equal(
    projectShowcaseMarkup.match(/type="button"\s+disabled/g)?.length,
    2,
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
