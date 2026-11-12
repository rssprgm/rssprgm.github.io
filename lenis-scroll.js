import Lenis from "./vendor/lenis/lenis.mjs";

export function setupLenisScroll({ prefersReducedMotion = false } = {}) {
  if (prefersReducedMotion) return null;

  const lenis = new Lenis({
    duration: 0.85,
    smoothWheel: true,
    smoothTouch: false,
    wheelMultiplier: 0.9,
    prevent: (node) => Boolean(node.closest?.("[data-lenis-prevent]")),
  });

  window.addEventListener("resize", () => {
    lenis.reset();
    lenis.resize();
  });

  const raf = (time) => {
    lenis.raf(time);
    requestAnimationFrame(raf);
  };

  requestAnimationFrame(raf);
  return lenis;
}
