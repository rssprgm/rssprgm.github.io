export function setupSmoothScrolling({
  offset = 24,
  prefersReducedMotion = false,
} = {}) {
  const behavior = prefersReducedMotion ? "auto" : "smooth";

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href) return;

      if (href === "#") {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior });
        return;
      }

      const target = getHashTarget(href);
      if (!target) return;

      event.preventDefault();
      const targetTop =
        target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: Math.max(0, targetTop), behavior });
    });
  });
}

function getHashTarget(href) {
  if (!href.startsWith("#") || href.length === 1) return null;

  try {
    return document.getElementById(decodeURIComponent(href.slice(1)));
  } catch {
    return null;
  }
}
