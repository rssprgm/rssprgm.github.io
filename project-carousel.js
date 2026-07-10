const carouselAnimations = new WeakMap();
const carouselWheelStates = new WeakMap();

let shouldReduceMotion = false;

export function setupProjectCarousels({ prefersReducedMotion = false } = {}) {
  shouldReduceMotion = prefersReducedMotion;

  const rails = Array.from(document.querySelectorAll(".project-rail"));
  let resizeQueued = false;

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

  const railBounds = rail.getBoundingClientRect();
  const firstCardBounds = cards[0].getBoundingClientRect();
  const lastCardBounds = cards[cards.length - 1].getBoundingClientRect();
  const tolerance = 1;

  const canScrollPrevious = firstCardBounds.left < railBounds.left - tolerance;
  const canScrollNext = lastCardBounds.right > railBounds.right + tolerance;

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

function getAlignedScrollLeft(rail, card) {
  return clampCarouselScrollLeft(rail, card.offsetLeft - getFirstCardOffset(rail));
}

function clampCarouselScrollLeft(rail, targetLeft) {
  const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
  return Math.min(Math.max(targetLeft, 0), maxScrollLeft);
}

function setCarouselScrollLeft(rail, targetLeft, immediate = false) {
  const clampedTarget = clampCarouselScrollLeft(rail, targetLeft);
  const activeAnimation = carouselAnimations.get(rail);
  if (activeAnimation) {
    cancelAnimationFrame(activeAnimation.frame);
    rail.style.scrollSnapType = activeAnimation.scrollSnapType;
    carouselAnimations.delete(rail);
  }

  if (immediate || shouldReduceMotion) {
    rail.scrollLeft = clampedTarget;
    return;
  }

  const startLeft = rail.scrollLeft;
  const distance = clampedTarget - startLeft;
  if (Math.abs(distance) < 1) return;

  const duration = Math.min(920, Math.max(620, Math.abs(distance) * 0.9));
  const startedAt = performance.now();
  const scrollSnapType = rail.style.scrollSnapType;
  rail.style.scrollSnapType = "none";

  const step = (now) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    rail.scrollLeft = startLeft + distance * easeInOutCubic(progress);

    if (progress < 1) {
      carouselAnimations.set(rail, {
        frame: requestAnimationFrame(step),
        scrollSnapType,
      });
    } else {
      rail.scrollLeft = clampedTarget;
      rail.style.scrollSnapType = scrollSnapType;
      carouselAnimations.delete(rail);
    }
  };

  carouselAnimations.set(rail, {
    frame: requestAnimationFrame(step),
    scrollSnapType,
  });
}

function easeInOutCubic(progress) {
  return progress < 0.5
    ? 4 * progress ** 3
    : 1 - (-2 * progress + 2) ** 3 / 2;
}
