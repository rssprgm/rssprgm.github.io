const pendingScrollTargetKey = "rssprgm:pending-scroll-target";

export function setupSmoothScrolling({
  prefersReducedMotion = false,
} = {}) {
  const behavior = prefersReducedMotion ? "auto" : "smooth";

  scrollToPendingTarget();

  document.querySelectorAll("a[href]").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (!isPrimaryPageNavigation(event, link)) return;

      const url = getSameOriginHashUrl(link);
      if (!url) return;

      const targetId = getTargetId(url.hash);
      if (!targetId) return;

      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        const target = document.getElementById(targetId);
        if (!target) return;

        event.preventDefault();
        scrollToTarget(target);
        return;
      }

      event.preventDefault();

      if (!storePendingTarget(targetId)) {
        window.location.assign(url.href);
        return;
      }

      url.hash = "";
      window.location.assign(url.href);
    });
  });

  function scrollToPendingTarget() {
    const targetId = takePendingTarget();
    if (!targetId) return;

    const target = document.getElementById(targetId);
    if (!target) return;

    requestAnimationFrame(() => {
      scrollToTarget(target);
      window.history.replaceState(null, "", `#${encodeURIComponent(targetId)}`);
    });
  }

  function scrollToTarget(target) {
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

function storePendingTarget(targetId) {
  try {
    window.sessionStorage.setItem(pendingScrollTargetKey, targetId);
    return true;
  } catch {
    return false;
  }
}

function takePendingTarget() {
  try {
    const targetId = window.sessionStorage.getItem(pendingScrollTargetKey);
    window.sessionStorage.removeItem(pendingScrollTargetKey);
    return targetId;
  } catch {
    return null;
  }
}
