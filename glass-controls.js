import { connectGlassCanvas } from './glass-canvas.js';

export function preferFlatControls(device, preferences) {
  return !device.gpu || preferences.reducedMotion || preferences.reducedTransparency ||
    device.connection?.saveData === true ||
    (device.deviceMemory > 0 && device.deviceMemory <= 2) ||
    (device.hardwareConcurrency > 0 && device.hardwareConcurrency <= 1);
}

export async function setupGlassControls() {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const transparency = matchMedia('(prefers-reduced-transparency: reduce)');
  if (preferFlatControls(navigator, {
    reducedMotion: motion.matches,
    reducedTransparency: transparency.matches,
  })) return;

  let scene;
  let observer;
  let dialogObserver;
  let GlassInteraction;
  const dialog = document.querySelector("[data-join-dialog]");
  function syncInteractions() {
    for (const control of controls) {
      const inDialog = !!control.host.closest("[data-join-dialog]");
      const active = inDialog ? dialog?.open && dialog.dataset.state === "open" : !dialog?.open;
      for (const item of control.items) {
        if (!active) {
          item.interaction?.dispose();
          item.interaction = null;
        } else if (!item.interaction && control.host.classList.contains("glass-ready")) {
          item.interaction = new GlassInteraction(item.button, control.container);
        }
      }
    }
  }
  let stopped = false;
  const controls = [];
  function runtimeError(event) {
    if (event.filename?.includes("/vendor/glass/glass.js")) {
      event.preventDefault();
      fallback(event.error);
    }
  }
  function fallback(reason) {
    if (stopped) return;
    stopped = true;
    console.warn("Glass fallback", reason);
    observer?.disconnect();
    dialogObserver?.disconnect();
    window.removeEventListener("error", runtimeError);
    for (const { items, container, host, ownedHost, backdropSource } of controls.reverse()) {
      for (const item of items) item.interaction?.dispose();
      container?.dispose();
      backdropSource?.remove();
      for (const { button, platter } of items) platter.replaceWith(button);
      host.classList.remove('glass-ready', 'glass-host');
      if (ownedHost) host.replaceWith(...host.childNodes);
    }
    controls.length = 0;
    scene?.dispose();
    document.documentElement.dataset.glass = 'flat';
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter || adapter.info?.isFallbackAdapter || !adapter.features.has('shader-f16')) return;
    const { GlassButton, GlassEffectContainer, GlassScene, createNativeLensFullParameters, createNativeLensStateFromParameters } = await import('./vendor/glass/glass.js');
    GlassInteraction = GlassButton;
    scene = await GlassScene.forDocument(document);
    const render = scene.renderNow.bind(scene);
    scene.renderNow = () => {
      try { render(); } catch (error) { fallback(error); }
    };
    const canvas = document.querySelector('[data-hero-fluid]');
    if (canvas) connectGlassCanvas(scene, canvas);
    scene.gpuDevice.lost.then(fallback);
    scene.gpuDevice.addEventListener('uncapturederror', fallback);
    window.addEventListener("error", runtimeError);
    document.documentElement.dataset.glass = 'gpu';
    const groups = new WeakSet();
    observer = new IntersectionObserver(async (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || stopped) continue;
        const button = entry.target;
        const group = button.closest('.hero-actions, .join-actions');
        if (group && groups.has(group)) continue;
        const buttons = group ? [...group.querySelectorAll('.button, .join-close')] : [button];
        buttons.forEach((element) => observer.unobserve(element));
        const host = group || document.createElement('span');
        if (group) groups.add(group);
        else button.before(host);
        host.classList.add('glass-host');
        const control = { host, items: [], container: null, ownedHost: !group, backdropSource: null };
        controls.push(control);
        try {
        const items = buttons.map((button) => {
          const platter = document.createElement('span');
          platter.className = 'glass-platter';
          button.before(platter);
          platter.append(button);
          if (!group) host.append(platter);
          return { button, platter, interaction: null };
        });
        control.items = items;
        const backdrop = document.createElement('canvas');
        backdrop.width = backdrop.height = 1;
        const paint = backdrop.getContext('2d');
        if (!paint) throw new Error('Canvas backdrop unavailable');
        const ancestors = [];
        for (let node = host.parentElement; node; node = node.parentElement) ancestors.unshift(node);
        for (const ancestor of ancestors) {
          paint.fillStyle = getComputedStyle(ancestor).backgroundColor;
          paint.fillRect(0, 0, 1, 1);
        }
        const backdropSource = document.createElement('span');
        backdropSource.className = 'glass-backdrop-source';
        backdropSource.style.backgroundImage = `url("${backdrop.toDataURL()}")`;
        host.before(backdropSource);
        control.backdropSource = backdropSource;
          const container = new GlassEffectContainer(host);
          control.container = container;
          container.setBackdropSource(backdropSource);
          await container.ready;
          if (stopped) return;
          const height = Math.min(...buttons.map((element) => element.offsetHeight));
          const parameters = createNativeLensFullParameters(host.offsetWidth, height, 'control-clear');
          const material = createNativeLensStateFromParameters(parameters, 'control-clear');
          await container.setNativeMaterial(parameters, material.backgroundKeyOverrides, material.foregroundKeyOverrides);
          if (stopped) return;
          for (const item of items) {
            if (item.button.classList.contains("button-primary")) container.setProminentWhite(item.platter);
          }
          host.classList.add('glass-ready');
          syncInteractions();
        } catch (error) {
          fallback(error);
        }
      }
    });
    document.querySelectorAll('.button, .join-close').forEach((button) => observer.observe(button));
    dialogObserver = new MutationObserver(syncInteractions);
    if (dialog) dialogObserver.observe(dialog, { attributes: true, attributeFilter: ['open', 'data-state'] });
    motion.addEventListener('change', fallback, { once: true });
    transparency.addEventListener('change', fallback, { once: true });
  } catch {
    fallback();
  }
}
