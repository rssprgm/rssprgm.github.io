import { getAlignedScrollLeft, setCarouselScrollLeft } from './project-carousel.js';
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
  let destination = null;
  let running = true;
  let complete = false;
  let elapsed = 0;
  let startedAt = null;
  let timer, frame, scrollTimer;
  const resetTimers = new Map();
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
      video.play().catch((error) => { if (error.name !== 'AbortError' && slides[index].querySelector('video') === video) setRunning(false); });
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
    const previousVideo = slides[index].querySelector('video');
    const previousIndex = index;
    index = Math.max(0, Math.min(slides.length - 1, value));
    slides.forEach((slide, position) => {
      if (position !== index) slide.querySelector('video')?.pause();
      const video = slide.querySelector('video');
      if (video) video.inert = position !== index;
    });
    if (previousVideo && previousIndex !== index) {
      slides[previousIndex].classList.toggle('is-video-playing', false);
      clearTimeout(resetTimers.get(previousVideo));
      resetTimers.set(previousVideo, setTimeout(() => { previousVideo.currentTime = 0; resetTimers.delete(previousVideo); }, reducedMotion.matches ? 0 : 200));
    }
    const video = slides[index].querySelector('video');
    if (video && previousIndex !== index) {
      clearTimeout(resetTimers.get(video));
      resetTimers.delete(video);
      video.currentTime = 0;
      running = true;
    }
    error.hidden = true;
    syncSummary();
    setRunning(running);
  }
  function go(value, instant = false) {
    const target = Math.max(0, Math.min(slides.length - 1, value));
    if (!instant && target === index) return;
    clearTimeout(scrollTimer);
    destination = instant || reducedMotion.matches ? null : target;
    track.classList.toggle("is-navigating", destination !== null);
    setCarouselScrollLeft(track, getAlignedScrollLeft(track, slides[target], slides[0]), instant || reducedMotion.matches);
    activate(target);
  }
  function settled() {
    clearTimeout(scrollTimer);
    if (destination !== null) {
      const goal = getAlignedScrollLeft(track, slides[destination], slides[0]);
      if (Math.abs(track.scrollLeft - goal) > 1) return;
      destination = null;
      track.classList.toggle('is-navigating', false);
    }
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
  const interruptNavigation = () => {
    setCarouselScrollLeft(track, track.scrollLeft, true);
    destination = null;
    track.classList.toggle('is-navigating', false);
    stopClock();
  };
  let pointerStart = null;
  track.addEventListener('pointerdown', (event) => { pointerStart = { x: event.clientX, y: event.clientY }; }, { passive: true });
  track.addEventListener('pointermove', (event) => {
    if (pointerStart && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 6) {
      pointerStart = null;
      interruptNavigation();
    }
  }, { passive: true });
  track.addEventListener('wheel', interruptNavigation, { passive: true });
  track.addEventListener('scrollend', settled, { passive: true });
  track.addEventListener('pointerup', () => { pointerStart = null; settled(); }, { passive: true });
  track.addEventListener('pointercancel', () => { pointerStart = null; settled(); }, { passive: true });
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
      video.addEventListener('timeupdate', () => {
        if (position !== index) return;
        if (video.currentTime > 0) slide.classList.toggle('is-video-playing', true);
        if (!running) paintTime();
      });
    }
    slide.querySelector('video, img').addEventListener('error', () => {
      if (position !== index) return;
      setRunning(false);
      error.textContent = 'Could not load this slide. Try another slide or reload the page.';
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
  let trackWidth = track.clientWidth;
  new ResizeObserver(() => {
    if (track.clientWidth === trackWidth) return;
    trackWidth = track.clientWidth;
    clearTimeout(scrollTimer);
    destination = null;
    track.classList.toggle('is-navigating', false);
    setCarouselScrollLeft(track, getAlignedScrollLeft(track, slides[index], slides[0]), true);
    renderProgress();
  }).observe(track);
  root.addEventListener('meeting-panel-change', syncSummary);
  go(0, true);
  renderProgress();
}
