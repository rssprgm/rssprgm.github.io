const carouselAnimations = new WeakMap();
const carouselWheelStates = new WeakMap();

let shouldReduceMotion = false;

export function setupProjectCarousels({ prefersReducedMotion = false } = {}) {
  shouldReduceMotion = prefersReducedMotion;

  const rails = Array.from(document.querySelectorAll(".project-rail"));
  let resizeQueued = false;
  let viewportWidth = window.innerWidth;

  rails.forEach((rail) => {
    prepareProjectRail(rail);
    syncCarouselControls(rail);
  });

  document.querySelectorAll("[data-carousel-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const rail = document.getElementById(button.dataset.carouselTarget);
      if (!rail) return;

      alignRelativeCard(rail, Number(button.dataset.carouselDir || 1));
    });
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth === viewportWidth) return;
    viewportWidth = window.innerWidth;
    if (resizeQueued) return;
    resizeQueued = true;

    requestAnimationFrame(() => {
      resizeQueued = false;
      rails.forEach((rail) => {
        const activeCard = rail.querySelector('[data-centered="true"]');
        if (activeCard) {
          alignCard(activeCard, rail, "auto");
        }

        syncCarouselControls(rail);
      });
    });
  });
}

function syncCarouselControls(rail) {
  const state = getCarouselButtonState(rail);
  const buttons = Array.from(
    document.querySelectorAll(`[data-carousel-target="${rail.id}"]`),
  );
  const controls = buttons[0]?.closest(".carousel-controls");

  if (controls) controls.hidden = !state.hasOverflow;

  buttons.forEach((button) => {
    const direction = Number(button.dataset.carouselDir || 1);
    button.disabled = direction < 0
      ? !state.canScrollPrevious
      : !state.canScrollNext;
  });
}

export function getCarouselButtonState(rail) {
  const cards = Array.from(rail.querySelectorAll(".project-card"));
  if (!cards.length) {
    return {
      hasOverflow: false,
      canScrollPrevious: false,
      canScrollNext: false,
    };
  }

  const carouselBounds = (
    rail.closest(".project-showcase") || rail
  ).getBoundingClientRect();
  const firstCardBounds = cards[0].getBoundingClientRect();
  const lastCardBounds = cards[cards.length - 1].getBoundingClientRect();
  const tolerance = 1;

  const canScrollPrevious = firstCardBounds.left
    < carouselBounds.left - tolerance;
  const canScrollNext = lastCardBounds.right
    > carouselBounds.right + tolerance;

  return {
    hasOverflow: canScrollPrevious || canScrollNext,
    canScrollPrevious,
    canScrollNext,
  };
}

function prepareProjectRail(rail) {
  let ticking = false;

  rail.addEventListener("wheel", (event) => handleCarouselWheel(event, rail), {
    passive: false,
  });

  rail.addEventListener("click", (event) => {
    const card = event.target.closest(".project-card");
    if (!card || !rail.contains(card)) return;

    alignCard(card, rail);
  });

  rail.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        markActiveCard(rail);
        syncCarouselControls(rail);
        ticking = false;
      });
    },
    { passive: true },
  );

  requestAnimationFrame(() => {
    markActiveCard(rail);
  });
}

function alignRelativeCard(rail, direction) {
  const cards = Array.from(rail.querySelectorAll(".project-card"));
  if (!cards.length) return;

  const targetCard = getDirectionalCard(rail, cards, direction);
  if (!targetCard) return;

  alignCard(targetCard, rail);
}

function alignCard(card, rail, behavior = shouldReduceMotion ? "auto" : "smooth") {
  const targetLeft = getAlignedScrollLeft(rail, card);

  setCarouselScrollLeft(rail, targetLeft, behavior === "auto");
  markActiveCard(rail, card);
}

function markActiveCard(rail, preferredCard) {
  const cards = Array.from(rail.querySelectorAll(".project-card"));
  const activeCard = preferredCard || getActiveCard(rail, cards);

  cards.forEach((card) => {
    if (card === activeCard) {
      card.dataset.centered = "true";
    } else {
      delete card.dataset.centered;
    }
  });
}

function getActiveCard(rail, cards = Array.from(rail.querySelectorAll(".project-card"))) {
  if (rail.scrollLeft <= 1) return cards[0];

  const firstCardOffset = getFirstCardOffset(rail);
  const currentTarget = rail.scrollLeft;

  return cards.reduce((closest, card) => {
    const cardTarget = clampCarouselScrollLeft(rail, card.offsetLeft - firstCardOffset);
    const distance = Math.abs(cardTarget - currentTarget);

    if (!closest || distance < closest.distance) {
      return { card, distance };
    }

    return closest;
  }, null)?.card;
}

function getDirectionalCard(rail, cards, direction) {
  const firstCardOffset = getFirstCardOffset(rail);
  const currentTarget = rail.scrollLeft;
  const threshold = 2;
  const candidates = cards.map((card) => ({
    card,
    target: clampCarouselScrollLeft(rail, card.offsetLeft - firstCardOffset),
  }));

  if (direction > 0) {
    return candidates.find(({ target }) => target > currentTarget + threshold)
      ?.card;
  }

  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    if (candidates[index].target < currentTarget - threshold) {
      return candidates[index].card;
    }
  }

  return null;
}

function handleCarouselWheel(event, rail) {
  const horizontalDelta = event.deltaX;
  const verticalDelta = event.deltaY;

  if (
    Math.abs(horizontalDelta) <= Math.abs(verticalDelta) ||
    Math.abs(horizontalDelta) < 2
  ) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const now = performance.now();
  const state = carouselWheelStates.get(rail) || {
    lockedUntil: 0,
  };

  if (now >= state.lockedUntil) {
    alignRelativeCard(rail, Math.sign(horizontalDelta));
    state.lockedUntil = now + 560;
  }

  carouselWheelStates.set(rail, state);
}

function getFirstCardOffset(rail) {
  return rail.querySelector(".project-card")?.offsetLeft || 0;
}

export function getAlignedScrollLeft(rail, card, firstCard = rail.querySelector(".project-card")) {
  return clampCarouselScrollLeft(rail, card.offsetLeft - (firstCard?.offsetLeft || 0));
}

function clampCarouselScrollLeft(rail, targetLeft) {
  const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
  return Math.min(Math.max(targetLeft, 0), maxScrollLeft);
}

export function setCarouselScrollLeft(rail, targetLeft, immediate = false) {
  const target = clampCarouselScrollLeft(rail, targetLeft);
  const active = carouselAnimations.get(rail);
  if (immediate || shouldReduceMotion) {
    if (active) {
      cancelAnimationFrame(active.frame);
      rail.style.scrollSnapType = active.scrollSnapType;
      carouselAnimations.delete(rail);
    }
    rail.scrollLeft = target;
    return;
  }
  if (active) {
    active.target = target;
    return;
  }
  if (Math.abs(target - rail.scrollLeft) < .5) return;
  const state = { target, position: rail.scrollLeft, velocity: 0, time: performance.now(), frame: 0, scrollSnapType: rail.style.scrollSnapType };
  rail.style.scrollSnapType = "none";
  const step = (now) => {
    const dt = Math.min(.064, Math.max(0, (now - state.time) / 1000));
    state.time = now;
    const offset = state.position - state.target;
    const decay = Math.exp(-12 * dt);
    const momentum = state.velocity + 12 * offset;
    state.position = state.target + (offset + momentum * dt) * decay;
    state.velocity = (state.velocity - 12 * momentum * dt) * decay;
    rail.scrollLeft = state.position;
    if (Math.abs(state.position - state.target) < .5 && Math.abs(state.velocity) < 2) {
      rail.scrollLeft = state.target;
      rail.style.scrollSnapType = state.scrollSnapType;
      carouselAnimations.delete(rail);
    } else state.frame = requestAnimationFrame(step);
  };
  carouselAnimations.set(rail, state);
  state.frame = requestAnimationFrame(step);
}
