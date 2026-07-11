import { initButtonEffects } from "./button-effects.js";
import { setupHeroFluid } from "./hero-fluid.js";
import { setupJoinDialog } from "./join-dialog.js";
import { setupLenisScroll } from "./lenis-scroll.js";
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

setupHeroFluid({ prefersReducedMotion });

const lenis = setupLenisScroll({ prefersReducedMotion });

setupProjectCarousels({ prefersReducedMotion });
setupStaggeredFadeIn();
setupFaqAccordion();
initButtonEffects({ prefersReducedMotion });

setupSmoothScrolling({ lenis, prefersReducedMotion });
setupJoinDialog({
  root: document.querySelector("[data-join-dialog]"),
  triggers: document.querySelectorAll("[data-open-join]"),
  prefersReducedMotion,
});
setupMobileMenu();

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

  const passedContentMargin = document.documentElement.scrollHeight;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const crossedTrigger =
          entry.boundingClientRect.top <= window.innerHeight * 0.85;

        if (!crossedTrigger || !pendingGroups.has(entry.target)) return;

        playStaggeredGroup(entry.target);
        pendingGroups.delete(entry.target);
        observer.unobserve(entry.target);
      });

      if (!pendingGroups.size) {
        observer.disconnect();
      }
    },
    {
      rootMargin: `${passedContentMargin}px 0px -15% 0px`,
      threshold: 0,
    },
  );

  requestAnimationFrame(() => {
    const triggerLine = window.innerHeight * 0.85;

    pendingGroups.forEach((group) => {
      if (group.getBoundingClientRect().top <= triggerLine) {
        playStaggeredGroup(group);
        pendingGroups.delete(group);
        return;
      }

      observer.observe(group);
    });

    if (!pendingGroups.size) {
      observer.disconnect();
    }
  });
}

function getStaggeredItems(group) {
  if (group.hasAttribute("data-staggered-item")) return [group];

  return Array.from(
    group.querySelectorAll('[data-staggered-item]:not([aria-hidden="true"])'),
  );
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

function setupFaqAccordion() {
  const items = Array.from(document.querySelectorAll("[data-faq-item]"));

  items.forEach((item) => {
    const trigger = item.querySelector("[data-faq-trigger]");
    const panel = item.querySelector("[data-faq-panel]");

    if (!trigger || !panel) return;

    panel.setAttribute("aria-hidden", "true");

    trigger.addEventListener("click", () => {
      const isOpen = trigger.getAttribute("aria-expanded") === "true";
      trigger.setAttribute("aria-expanded", String(!isOpen));
      panel.setAttribute("aria-hidden", String(isOpen));
      item.dataset.open = String(!isOpen);
    });
  });
}

function setupMobileMenu() {
  const toggle = document.querySelector("[data-menu-toggle]");
  const menu = document.querySelector("[data-mobile-menu]");

  if (!toggle || !menu) {
    return;
  }

  const menuItems = Array.from(
    menu.querySelectorAll("[data-mobile-menu-link]"),
  );
  const menuNav = menu.querySelector(".mobile-menu-nav");

  if (menuNav) {
    Array.from(menuNav.children).forEach((child, i) => {
      child.style.setProperty("--mobile-menu-index", i);
    });
  }

  toggle.dataset.menuReady = "true";

  const setMenuOpen = (isOpen) => {
    if (isOpen) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.documentElement.style.setProperty(
        "--menu-scrollbar-compensation",
        `${Math.max(0, scrollbarWidth)}px`,
      );
    } else {
      document.documentElement.style.removeProperty(
        "--menu-scrollbar-compensation",
      );
    }

    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
    document.body.classList.toggle("mobile-menu-open", isOpen);

    if (isOpen) {
      menu.hidden = false;
      menu.dataset.state = "opening";

      requestAnimationFrame(() => {
        menu.dataset.state = "open";
      });
      return;
    }

    menu.dataset.state = "closing";

    window.setTimeout(() => {
      if (toggle.getAttribute("aria-expanded") === "true") return;
      menu.hidden = true;
      menu.dataset.state = "closed";
    }, prefersReducedMotion ? 0 : 540);
  };

  toggle.addEventListener("click", () => {
    setMenuOpen(toggle.getAttribute("aria-expanded") !== "true");
  });

  menuItems.forEach((item) => {
    item.addEventListener("click", () => {
      setMenuOpen(false);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      setMenuOpen(false);
      toggle.focus({ preventScroll: true });
    }
  });

  window.addEventListener("resize", () => {
    if (window.matchMedia("(min-width: 761px)").matches) {
      setMenuOpen(false);
    }
  });
}
