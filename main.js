import Lenis from "https://cdn.jsdelivr.net/npm/lenis@1.3.11/+esm";

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

if (!prefersReducedMotion) {
  const lenis = new Lenis({
    duration: 0.85,
    smoothWheel: true,
    smoothTouch: false,
    wheelMultiplier: 0.9,
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }

  requestAnimationFrame(raf);

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href || href === "#") {
        lenis.scrollTo(0);
        return;
      }

      const target = document.querySelector(href);
      if (!target) return;

      event.preventDefault();
      lenis.scrollTo(target, {
        offset: -24,
        duration: 1.1,
      });
    });
  });
}
