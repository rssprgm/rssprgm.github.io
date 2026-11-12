import { getAlignedScrollLeft } from './project-carousel.js';
import { setupGalleryControls, dotEmphasis } from './gallery-controls.js';
export { dotEmphasis } from './gallery-controls.js';

export function summaryForSlide(sections, slide) {
  return sections.find((section) => slide >= Number(section.dataset.summaryStart) && slide <= Number(section.dataset.summaryEnd));
}

export function setupMeetingPlayer(root) {
  const player = root?.querySelector('[data-slide-player]');
  if (!player) return;
  const track = player.querySelector('[data-slide-track]');
  const slides = [...track.querySelectorAll('[data-slide]')];
  const error = player.querySelector('[data-player-error]');
  const summary = root.querySelector('[data-summary-scroll]');
  const sections = [...summary.querySelectorAll('[data-summary-start]')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0;
  let running = true;
  let complete = false;
  let elapsed = 0;
  let startedAt = null;
  let timer, frame, scrollTimer;
  const controls = setupGalleryControls(player, {
    onPrevious: () => go(index - 1),
    onNext: () => go(index + 1),
    onSelect: (position) => go(position),
    onToggle: () => setRunning(!running),
    onReplay: () => {
      slides.forEach((slide) => { const video = slide.querySelector('video'); if (video) video.currentTime = 0; });
      running = true;
      go(0, true);
    },
  });
  function renderProgress() {
    const position = Math.max(0, Math.min(slides.length - 1, track.scrollLeft / (slides[1].offsetLeft - slides[0].offsetLeft)));
    controls.setPosition(position);
    slides.forEach((slide, index) => slide.style.setProperty('--slide-focus', dotEmphasis(index, position)));
  }
  function syncSummary() {
    const active = summaryForSlide(sections, index + 1);
    sections.forEach((section) => section.classList.toggle('is-current', section === active));
    if (active && !summary.closest('[data-panel]').hidden) {
      summary.scrollTo({ top: active.offsetTop, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    }
  }
  function stopClock() {
    if (startedAt !== null) elapsed += performance.now() - startedAt;
    startedAt = null;
    clearTimeout(timer);
    cancelAnimationFrame(frame);
  }
  function paintTime() {
    const video = slides[index].querySelector('video');
    const progress = video ? (video.duration ? video.currentTime / video.duration : 0) : (elapsed + (startedAt === null ? 0 : performance.now() - startedAt)) / 15000;
    controls.setProgress(index, complete ? 1 : progress);
    if (running) frame = requestAnimationFrame(paintTime);
  }
  function setRunning(value) {
    stopClock();
    running = value;
    controls.setState({ index, running, complete });
    const video = slides[index].querySelector('video');
    if (!running) video?.pause();
    else if (video) {
      video.play().catch(() => { if (slides[index].contains(video)) setRunning(false); });
    } else {
      startedAt = performance.now();
      timer = setTimeout(() => go(index + 1), Math.max(0, 15000 - elapsed));
    }
    paintTime();
  }
  function activate(value) {
    stopClock();
    elapsed = 0;
    complete = false;
    index = Math.max(0, Math.min(slides.length - 1, value));
    slides.forEach((slide, position) => {
      if (position !== index) slide.querySelector('video')?.pause();
      const video = slide.querySelector('video');
      if (video) video.inert = position !== index;
    });
    player.querySelector('.meeting-stage').classList.toggle('is-video', Boolean(slides[index].querySelector('video')));
    error.hidden = true;
    syncSummary();
    setRunning(running);
  }
  function go(value, instant = false) {
    const target = Math.max(0, Math.min(slides.length - 1, value));
    activate(target);
    track.scrollTo({ left: getAlignedScrollLeft(track, slides[target], slides[0]), behavior: instant || reducedMotion.matches ? 'instant' : 'smooth' });
  }
  function settled() {
    clearTimeout(scrollTimer);
    const position = Math.round(track.scrollLeft / (slides[1].offsetLeft - slides[0].offsetLeft));
    if (position !== index) activate(position);
    else if (running) setRunning(true);
  }
  track.addEventListener('scroll', () => {
    renderProgress();
    stopClock();
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(settled, 140);
  }, { passive: true });
  track.addEventListener('click', (event) => {
    const card = event.target.closest('[data-slide]');
    const position = slides.indexOf(card);
    if (position >= 0 && position !== index) go(position);
  });
  track.addEventListener('pointerdown', stopClock, { passive: true });
  track.addEventListener('pointerup', settled, { passive: true });
  track.addEventListener('pointercancel', settled, { passive: true });
  slides.forEach((slide, position) => {
    const video = slide.querySelector('video');
    if (video) {
      video.addEventListener('ended', () => {
        if (position !== index) return;
        if (index < slides.length - 1) go(index + 1);
        else { complete = true; setRunning(false); }
      });
      video.addEventListener('play', () => { if (position === index && !running) { complete = false; setRunning(true); } });
      video.addEventListener('pause', () => { if (position === index && !video.ended && running) setRunning(false); });
      video.addEventListener('timeupdate', () => { if (position === index && !running) paintTime(); });
    }
    slide.querySelector('video, img').addEventListener('error', () => {
      if (position !== index) return;
      setRunning(false);
      error.textContent = 'Could not load this slide. Try another slide or download the presentation.';
      error.hidden = false;
    });
  });
  player.addEventListener('keydown', (event) => {
    if (event.target.tagName === 'VIDEO') return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      go(index + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  new ResizeObserver(() => {
    track.scrollTo({ left: getAlignedScrollLeft(track, slides[index], slides[0]), behavior: 'instant' });
    renderProgress();
  }).observe(track);
  root.addEventListener('meeting-panel-change', syncSummary);
  go(0, true);
  renderProgress();
}
