import { preferFlatControls } from './glass-controls.js';

export async function setupPlaybackEffects() {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const transparency = matchMedia('(prefers-reduced-transparency: reduce)');
  if (preferFlatControls(navigator, { reducedMotion: motion.matches, reducedTransparency: transparency.matches })) return;
  const roots = [...document.querySelectorAll('[data-gallery-playback]')];
  if (!roots.length) return;
  const cleanups = [];
  const dispose = () => cleanups.splice(0).forEach((cleanup) => cleanup());
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter || adapter.info?.isFallbackAdapter || !adapter.features.has('shader-f16')) return;
    const { setupFlatFlexControls } = await import('./vendor/glass/flat-controls.js');
    for (const root of roots) {
      cleanups.push(await setupFlatFlexControls(root, [...root.querySelectorAll('.gallery-progress-pill, .gallery-toggle')]));
    }
    motion.addEventListener('change', dispose, { once: true });
    window.addEventListener('pagehide', dispose, { once: true });
  } catch (error) {
    dispose();
    console.warn('Playback effects unavailable', error);
  }
}
