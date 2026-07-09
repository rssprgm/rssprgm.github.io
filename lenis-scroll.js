import Lenis from "https://cdn.jsdelivr.net/npm/lenis@1.3.11/+esm";

export function setupLenisScroll({ prefersReducedMotion = false } = {}) {
  if (prefersReducedMotion) return null;

  const lenis = new Lenis({
    duration: 0.85,
    smoothWheel: true,
    smoothTouch: false,
    wheelMultiplier: 0.9,
    prevent: (node) => Boolean(node.closest?.("[data-lenis-prevent]")),
  });

  const raf = (time) => {
    lenis.raf(time);
    requestAnimationFrame(raf);
  };

  requestAnimationFrame(raf);
  return lenis;
}
