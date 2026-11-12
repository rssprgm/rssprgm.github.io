export function dotEmphasis(position, progress) {
  return Math.max(0, 1 - Math.abs(position - progress));
}

export function setupGalleryControls(root, { onPrevious, onNext, onSelect, onToggle, onReplay }) {
  const playback = root.querySelector('[data-gallery-playback]');
  const window = playback.querySelector('[data-gallery-window]');
  const items = [...playback.querySelectorAll('[data-gallery-item]')];
  const toggle = playback.querySelector('[data-gallery-toggle]');
  const previous = root.querySelector('[data-gallery-previous]');
  const next = root.querySelector('[data-gallery-next]');
  let ended = false;
  playback.hidden = false;
  previous.addEventListener('click', onPrevious);
  next.addEventListener('click', onNext);
  items.forEach((item, index) => item.addEventListener('click', () => onSelect(index)));
  toggle.addEventListener('click', () => ended ? onReplay() : onToggle());
  function fadeEdges() {
    window.style.setProperty('--dot-fade-start', window.scrollLeft > 1 ? '16px' : '0px');
    window.style.setProperty('--dot-fade-end', window.scrollLeft < window.scrollWidth - window.clientWidth - 1 ? '16px' : '0px');
  }
  window.addEventListener('scroll', fadeEdges, { passive: true });
  return {
    setState({ index, running, complete = false }) {
      ended = complete;
      const state = complete ? 'replay' : running ? 'pause' : 'play';
      toggle.dataset.state = state;
      toggle.setAttribute('aria-label', `${state === 'replay' ? 'Replay' : state === 'pause' ? 'Pause' : 'Play'} presentation`);
      previous.hidden = next.hidden = false;
      previous.disabled = index === 0;
      next.disabled = index === items.length - 1;
      items.forEach((item, position) => item.setAttribute('aria-current', String(position === index)));
    },
    setPosition(position) {
      position = Math.max(0, Math.min(items.length - 1, position));
      items.forEach((item, index) => item.style.setProperty('--dot-emphasis', dotEmphasis(index, position)));
      const start = Math.floor(position);
      const from = items[Math.min(start, items.length - 1)];
      const to = items[Math.min(start + 1, items.length - 1)];
      const center = from.offsetLeft + from.offsetWidth / 2 + (to.offsetLeft + to.offsetWidth / 2 - from.offsetLeft - from.offsetWidth / 2) * (position - start);
      window.scrollTo({ left: center - window.offsetLeft - window.clientWidth / 2, behavior: 'instant' });
      fadeEdges();
    },
    setProgress(index, progress) {
      items.forEach((item, position) => item.style.setProperty('--item-progress', position === index ? Math.max(0, Math.min(1, progress)) : 0));
    },
  };
}
