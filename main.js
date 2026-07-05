import { initButtonEffects } from "./button-effects.js";
import { setupJoinDialog } from "./join-dialog.js";
import { setupProjectCarousels } from "./project-carousel.js";
import { setupSmoothScrolling } from "./smooth-scroll.js";

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

document.documentElement.classList.add("js");
document.documentElement.classList.toggle("reduced-motion", prefersReducedMotion);
document.documentElement.classList.toggle(
  "no-reduced-motion",
  !prefersReducedMotion,
);

setupProjectCarousels({ prefersReducedMotion });
setupStaggeredFadeIn();
const refreshButtonEffects = initButtonEffects({ prefersReducedMotion });

setupSmoothScrolling({ prefersReducedMotion });
setupJoinDialog({ prefersReducedMotion, refreshButtonEffects });

function setupStaggeredFadeIn() {
  const groups = Array.from(
    document.querySelectorAll('[data-component-list*="StaggeredFadeIn"]'),
  );

  if (!groups.length) return;

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    groups.forEach((group) => {
      group.classList.add("staggered-end");
      getStaggeredItems(group).forEach((item) => {
        item.style.removeProperty("--stagger-delay");
      });
    });
    return;
  }

  const pendingGroups = new Set();

  groups.forEach((group) => {
    const items = getStaggeredItems(group);
    if (!items.length) return;

    const styles = window.getComputedStyle(group);
    const delay = Number(styles.getPropertyValue("--staggered-delay")) || 0.15;

    items.forEach((item, index) => {
      item.style.setProperty("--stagger-delay", `${index * delay}s`);
    });

    group.classList.add("staggered-ready");
    pendingGroups.add(group);
  });

  if (!pendingGroups.size) return;

  let checkQueued = false;
  const queueRevealCheck = () => {
    if (checkQueued) return;
    checkQueued = true;

    requestAnimationFrame(() => {
      checkQueued = false;
      checkStaggeredGroups(pendingGroups, queueRevealCheck);
    });
  };

  window.addEventListener("scroll", queueRevealCheck, { passive: true });
  window.addEventListener("resize", queueRevealCheck, { passive: true });
  requestAnimationFrame(() => {
    checkStaggeredGroups(pendingGroups, queueRevealCheck);
  });
}

function getStaggeredItems(group) {
  if (group.hasAttribute("data-staggered-item")) return [group];

  return Array.from(
    group.querySelectorAll('[data-staggered-item]:not([aria-hidden="true"])'),
  );
}

function getStaggeredAnchor(group) {
  return group.querySelector("[data-staggered-anchor]") || group;
}

function checkStaggeredGroups(pendingGroups, queueRevealCheck) {
  const triggerLine = window.innerHeight * 0.85;

  pendingGroups.forEach((group) => {
    if (group.classList.contains("staggered-start")) return;

    const anchor = getStaggeredAnchor(group);
    const rect = anchor.getBoundingClientRect();
    if (rect.top > triggerLine) return;

    playStaggeredGroup(group);
    pendingGroups.delete(group);
  });

  if (!pendingGroups.size) {
    window.removeEventListener("scroll", queueRevealCheck);
    window.removeEventListener("resize", queueRevealCheck);
  }
}

function playStaggeredGroup(group) {
  const items = getStaggeredItems(group);
  const finalItem = items[items.length - 1];
  if (!finalItem) return;

  group.classList.add("staggered-start");

  const complete = (event) => {
    if (
      event.target !== finalItem ||
      event.animationName !== "staggeredFadeInOpacity"
    ) {
      return;
    }

    finalItem.removeEventListener("animationend", complete);
    group.classList.add("staggered-end");
  };

  finalItem.addEventListener("animationend", complete);
}
