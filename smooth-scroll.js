export function setupSmoothScrolling({
  lenis = null,
  prefersReducedMotion = false,
} = {}) {
  const behavior = prefersReducedMotion ? "auto" : "smooth";

  document.querySelectorAll("a[href]").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (!isPrimaryPageNavigation(event, link)) return;

      const url = getSameOriginHashUrl(link);
      if (!url) return;

      const targetId = getTargetId(url.hash);
      if (!targetId) return;

      if (url.pathname !== window.location.pathname || url.search !== window.location.search) return;

      const target = document.getElementById(targetId);
      if (!target) return;

      event.preventDefault();
      scrollToTarget(target);
    });
  });

  function scrollToTarget(target) {
    if (lenis) {
      lenis.scrollTo(target, { duration: 1.1, offset: 0 });
      return;
    }

    const targetTop = target.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: Math.max(0, targetTop), behavior });
  }
}

function isPrimaryPageNavigation(event, link) {
  return !(
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    link.hasAttribute("download") ||
    (link.target && link.target !== "_self")
  );
}

function getSameOriginHashUrl(link) {
  try {
    const url = new URL(link.href, window.location.href);
    return url.origin === window.location.origin && url.hash ? url : null;
  } catch {
    return null;
  }
}

function getTargetId(hash) {
  if (!hash || hash.length === 1) return null;

  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return null;
  }
}
