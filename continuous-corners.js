import { quartzCoreContinuousCSSPath } from './vendor/glass/corners.js';

export function updateContinuousCorners(element) {
  const width = element.offsetWidth, height = element.offsetHeight;
  if (!(width > 0 && height > 0)) return;
  element.style.removeProperty('border-radius');
  const radius = parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;
  element.style.clipPath = radius ? quartzCoreContinuousCSSPath(width, height, radius) : 'none';
  element.style.borderRadius = '0';
}

export function setupContinuousCorners() {
  const elements = document.querySelectorAll('.project-media, .gallery-media, .meeting-card-image, .meeting-card-image > span, .join-dialog, .field-shell, .faq-list, .meeting-search input');
  const observer = new ResizeObserver((entries) => {
    entries.forEach(({ target }) => updateContinuousCorners(target));
  });
  elements.forEach((element) => {
    updateContinuousCorners(element);
    observer.observe(element);
  });
  window.addEventListener('resize', () => elements.forEach(updateContinuousCorners));
}
