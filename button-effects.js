const defaultButtonSelector = ".button, .join-close";
const refractionBezelWidth = 3.0;
const refractionGlassThickness = 8;
const refractionIor = 1.85;
const refractionFallbackScale = 1;
const buttonPressVisualGrowth = 15.5;
const buttonStretchMultiplier = 0.6;
const buttonStretchAmount = 0.075;
const buttonSpringVariants = {
  press: springFromResponse({
    response: 0.3,
    dampingFraction: 0.48,
  }),
  release: springFromPhysics({
    mass: 1,
    stiffness: 300,
    damping: 12,
  }),
  stretch: springFromResponse({
    response: 0.24,
    dampingFraction: 0.72,
  }),
};

let refractionFilterSequence = 0;
const pressEffectElements = new WeakSet();

export function initButtonEffects({
  defs = document.querySelector(".svg-filters defs"),
  prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches,
  selector = defaultButtonSelector,
} = {}) {
  initButtonPressEffects({ prefersReducedMotion, selector });
  return initRefractionFilters({ defs, selector });
}

function initRefractionFilters({ defs, selector }) {
  if (!defs) {
    return () => {};
  }

  const filterInstances = new WeakMap();
  const elements = getRefractionElements(selector);
  const pendingElements = new Set();
  let updateFrame = 0;

  const flushRefractionUpdates = () => {
    updateFrame = 0;

    pendingElements.forEach((element) => {
      updateElementRefraction(
        element,
        filterInstances,
        refractionBezelWidth,
        refractionGlassThickness,
        refractionIor,
        defs,
      );
    });
    pendingElements.clear();
  };

  const queueRefractionUpdate = (element) => {
    pendingElements.add(element);

    if (!updateFrame) {
      updateFrame = requestAnimationFrame(flushRefractionUpdates);
    }
  };

  const resizeObserver =
    "ResizeObserver" in window
      ? new ResizeObserver((entries) => {
          entries.forEach((entry) => {
            queueRefractionUpdate(entry.target);
          });
        })
      : null;

  elements.forEach((element) => {
    queueRefractionUpdate(element);
    resizeObserver?.observe(element);
  });

  return () => {
    resizeObserver?.disconnect();

    if (updateFrame) {
      cancelAnimationFrame(updateFrame);
    }

    pendingElements.clear();
  };
}

function getRefractionElements(selector) {
  return Array.from(document.querySelectorAll(selector)).filter(
    (element) => !element.closest("[data-join-dialog]"),
  );
}

function updateElementRefraction(
  element,
  filterInstances,
  bevel,
  thickness,
  ior,
  defs,
) {
  const width = element.offsetWidth;
  const height = element.offsetHeight;
  const pixelRatio = window.devicePixelRatio || 1;

  if (!width || !height) {
    return;
  }

  const instance = getElementRefractionFilter(element, filterInstances, defs);

  if (
    instance.width === width &&
    instance.height === height &&
    instance.pixelRatio === pixelRatio
  ) {
    return;
  }

  const displacementMap = createGlassDisplacementMap(
    width,
    height,
    bevel,
    thickness,
    ior,
  );

  instance.image.setAttribute("href", displacementMap.url);
  instance.image.setAttributeNS(
    "http://www.w3.org/1999/xlink",
    "href",
    displacementMap.url,
  );
  instance.image.setAttribute("width", String(width));
  instance.image.setAttribute("height", String(height));
  instance.displacement.setAttribute(
    "scale",
    String(displacementMap.scale || refractionFallbackScale),
  );
  element.style.setProperty(
    "--glass-refraction-filter",
    `url("#${instance.id}")`,
  );
  element.style.webkitBackdropFilter =
    `url("#${instance.id}") blur(var(--button-backdrop-blur)) saturate(1.2)`;
  element.style.backdropFilter =
    `url("#${instance.id}") blur(var(--button-backdrop-blur)) saturate(1.2)`;
  instance.width = width;
  instance.height = height;
  instance.pixelRatio = pixelRatio;
}

function getElementRefractionFilter(element, filterInstances, defs) {
  const existing = filterInstances.get(element);

  if (existing) {
    return existing;
  }

  const svgNamespace = "http://www.w3.org/2000/svg";
  refractionFilterSequence += 1;
  const id = `rss-glass-refraction-${refractionFilterSequence}`;
  const filter = document.createElementNS(svgNamespace, "filter");
  const blur = document.createElementNS(svgNamespace, "feGaussianBlur");
  const image = document.createElementNS(svgNamespace, "feImage");
  const displacement = document.createElementNS(
    svgNamespace,
    "feDisplacementMap",
  );

  filter.setAttribute("id", id);
  filter.setAttribute("color-interpolation-filters", "sRGB");
  blur.setAttribute("in", "SourceGraphic");
  blur.setAttribute("stdDeviation", "0.2");
  blur.setAttribute("result", "blurred-source");
  image.setAttribute("x", "0");
  image.setAttribute("y", "0");
  image.setAttribute("preserveAspectRatio", "none");
  image.setAttribute("result", "glass-map");
  displacement.setAttribute("in", "blurred-source");
  displacement.setAttribute("in2", "glass-map");
  displacement.setAttribute("xChannelSelector", "R");
  displacement.setAttribute("yChannelSelector", "G");
  filter.append(blur, image, displacement);
  defs.append(filter);

  const instance = {
    displacement,
    filter,
    height: 0,
    id,
    image,
    pixelRatio: 0,
    width: 0,
  };

  filterInstances.set(element, instance);
  return instance;
}

function createGlassDisplacementMap(width, height, bevel, thickness, ior) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;

  const radius = Math.min(width, height) / 2;
  const bezelWidth = getBezelWidth(bevel, radius);
  const glassThickness = getGlassThickness(thickness);
  const vectors = [];
  const magnitudes = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const vector = getDisplacementVector(
        x + 0.5,
        y + 0.5,
        width,
        height,
        radius,
        bezelWidth,
        glassThickness,
        ior,
      );
      const magnitude = Math.hypot(vector.x, vector.y);

      vectors.push(vector);
      magnitudes.push(magnitude);
    }
  }

  const scale = Math.max(...magnitudes, 0);
  const image = context.createImageData(width, height);

  vectors.forEach((vector, index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    const offset = index * 4;
    const normalizedX = scale ? vector.x / scale : 0;
    const normalizedY = scale ? vector.y / scale : 0;

    image.data[offset] = encodeDisplacementChannel(normalizedX, x, y);
    image.data[offset + 1] = encodeDisplacementChannel(normalizedY, x, y + 5);
    image.data[offset + 2] = 128;
    image.data[offset + 3] = 255;
  });

  context.putImageData(image, 0, 0);
  return {
    scale,
    url: canvas.toDataURL("image/png"),
  };
}

function getBezelWidth(bevel, radius) {
  return Math.max(0.5, Math.min(radius - 0.5, bevel * 8));
}

function getGlassThickness(thickness) {
  return Math.max(thickness, 0) * 8;
}

function encodeDisplacementChannel(value, x, y) {
  const exact = 127.5 + clamp(value, -1, 1) * 127.5;
  const low = Math.floor(exact);
  const fraction = exact - low;
  const threshold = ((x * 13 + y * 7) % 16) / 16;

  return low + (fraction > threshold ? 1 : 0);
}

function getDisplacementVector(
  x,
  y,
  width,
  height,
  radius,
  bevelPx,
  glassThickness,
  ior,
) {
  const signedDistance = signedDistanceToPill(x, y, width, height, radius);
  const distanceInside = -signedDistance;

  if (distanceInside <= 0 || distanceInside >= bevelPx || ior <= 1) {
    return { x: 0, y: 0 };
  }

  const distanceFromSide = clamp(distanceInside / bevelPx, 0, 1);
  const derivative = glassSurfaceDerivative(distanceFromSide);
  const incidenceAngle = Math.atan(Math.abs(derivative));
  const refractionAngle = Math.asin(
    clamp(Math.sin(incidenceAngle) / ior, -1, 1),
  );
  const bendAngle = incidenceAngle - refractionAngle;
  const magnitude = Math.tan(bendAngle) * glassThickness;
  const outwardNormal = pillNormal(x, y, width, height, radius);

  return {
    x: -outwardNormal.x * magnitude,
    y: -outwardNormal.y * magnitude,
  };
}

function glassSurfaceDerivative(distanceFromSide) {
  const delta = 0.001;
  const y1 = convexSquircleSurface(distanceFromSide - delta);
  const y2 = convexSquircleSurface(distanceFromSide + delta);

  return (y2 - y1) / (2 * delta);
}

function signedDistanceToPill(x, y, width, height, radius) {
  const px = x - width / 2;
  const py = y - height / 2;
  const bx = width / 2 - radius;
  const qx = Math.abs(px) - bx;
  const qy = Math.abs(py);
  const outsideX = Math.max(qx, 0);
  const outsideY = Math.max(qy, 0);
  const outsideDistance = Math.hypot(outsideX, outsideY);
  const insideDistance = Math.min(Math.max(qx, qy), 0);

  return outsideDistance + insideDistance - radius;
}

function pillNormal(x, y, width, height, radius) {
  const delta = 0.5;
  const dx =
    signedDistanceToPill(x + delta, y, width, height, radius) -
    signedDistanceToPill(x - delta, y, width, height, radius);
  const dy =
    signedDistanceToPill(x, y + delta, width, height, radius) -
    signedDistanceToPill(x, y - delta, width, height, radius);
  const length = Math.hypot(dx, dy) || 1;

  return {
    x: dx / length,
    y: dy / length,
  };
}

function convexSquircleSurface(x) {
  const t = clamp(x, 0, 1);

  return Math.pow(1 - Math.pow(1 - t, 4), 1 / 4);
}

function initButtonPressEffects({ prefersReducedMotion, selector }) {
  document.querySelectorAll(selector).forEach((button) => {
    if (pressEffectElements.has(button)) {
      return;
    }

    pressEffectElements.add(button);
    ensureButtonGeometryShadow(button);

    const activeGlows = new Map();
    const scaleSpring = createSpringAnimator({
      onUpdate: (growth) => setButtonPressGrowth(button, growth),
      prefersReducedMotion,
      value: 0,
    });
    const stretchXSpring = createSpringAnimator({
      onUpdate: (value) => setButtonStretchAxis(button, "x", value),
      prefersReducedMotion,
      value: 1,
    });
    const stretchYSpring = createSpringAnimator({
      onUpdate: (value) => setButtonStretchAxis(button, "y", value),
      prefersReducedMotion,
      value: 1,
    });
    const originXSpring = createSpringAnimator({
      onUpdate: (value) => setButtonPressOrigin(button, "x", value),
      prefersReducedMotion,
      value: 50,
    });
    const originYSpring = createSpringAnimator({
      onUpdate: (value) => setButtonPressOrigin(button, "y", value),
      prefersReducedMotion,
      value: 50,
    });

    button.draggable = false;
    button.addEventListener("dragstart", (event) => {
      event.preventDefault();
    });
    button.addEventListener("selectstart", (event) => {
      event.preventDefault();
    });

    button.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || button.disabled) return;

      const glow = spawnButtonGlow(button, event);
      const pressState = createButtonPressState(glow);

      activeGlows.set(event.pointerId, pressState);
      updateButtonStretch(
        button,
        event,
        stretchXSpring,
        stretchYSpring,
        originXSpring,
        originYSpring,
      );
      scaleSpring.to(buttonPressVisualGrowth, buttonSpringVariants.press);

      if (typeof button.setPointerCapture === "function") {
        button.setPointerCapture(event.pointerId);
      }
    });

    button.addEventListener("pointermove", (event) => {
      const pressState = activeGlows.get(event.pointerId);
      if (!pressState || pressState.glow.dataset.released === "true") return;

      positionButtonGlow(button, pressState.glow, event);
      updateButtonStretch(
        button,
        event,
        stretchXSpring,
        stretchYSpring,
        originXSpring,
        originYSpring,
      );
    });

    const release = (event) => {
      const pressState = activeGlows.get(event.pointerId);
      if (!pressState) return;

      activeGlows.delete(event.pointerId);
      releaseButtonGlow(pressState.glow);

      if (activeGlows.size === 0) {
        scaleSpring.to(0, buttonSpringVariants.release);
        stretchXSpring.to(1, buttonSpringVariants.release);
        stretchYSpring.to(1, buttonSpringVariants.release);
        originXSpring.to(50, buttonSpringVariants.release);
        originYSpring.to(50, buttonSpringVariants.release);
      }
    };

    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
  });
}

function ensureButtonGeometryShadow(button) {
  if (button.querySelector(":scope > .button-geometry-shadow")) {
    return;
  }

  const shadow = document.createElement("span");

  shadow.className = "button-geometry-shadow";
  shadow.setAttribute("aria-hidden", "true");
  button.prepend(shadow);
}

function springFromPhysics({
  mass = 1,
  stiffness,
  damping,
  initialVelocity = 0,
}) {
  return { damping, initialVelocity, mass, stiffness };
}

function springFromResponse({
  response = 0.5,
  dampingFraction = 0.825,
  initialVelocity = 0,
  mass = 1,
}) {
  const safeResponse = Math.max(response, 0.001);
  const angularFrequency = (Math.PI * 2) / safeResponse;
  const stiffness = mass * angularFrequency * angularFrequency;
  const damping = dampingFraction * 2 * Math.sqrt(stiffness * mass);

  return springFromPhysics({ damping, initialVelocity, mass, stiffness });
}

function createSpringAnimator({ onUpdate, prefersReducedMotion, value }) {
  const state = {
    frame: 0,
    spring: buttonSpringVariants.release,
    target: value,
    value,
    velocity: 0,
  };

  onUpdate(value);

  function to(target, spring) {
    if (prefersReducedMotion) {
      state.target = target;
      state.value = target;
      state.velocity = 0;
      onUpdate(target);
      return;
    }

    state.target = target;
    state.spring = spring;

    if (!state.frame) {
      state.velocity = spring.initialVelocity * (target - state.value);
      state.lastTime = performance.now();
      state.frame = requestAnimationFrame(step);
    }
  }

  function step(time) {
    const deltaSeconds = Math.min((time - state.lastTime) / 1000, 0.034);
    state.lastTime = time;

    const { damping, mass, stiffness } = state.spring;
    const displacement = state.value - state.target;
    const acceleration =
      (-stiffness * displacement - damping * state.velocity) / mass;

    state.velocity += acceleration * deltaSeconds;
    state.value += state.velocity * deltaSeconds;

    onUpdate(state.value);

    if (
      Math.abs(state.velocity) < 0.001 &&
      Math.abs(state.value - state.target) < 0.0005
    ) {
      state.frame = 0;
      state.value = state.target;
      state.velocity = 0;
      onUpdate(state.target);
      return;
    }

    state.frame = requestAnimationFrame(step);
  }

  return { to };
}

function setButtonPressGrowth(button, growth) {
  const rect = button.getBoundingClientRect();
  const visualSize = Math.max(Math.sqrt(rect.width * rect.height), 1);
  const scale = 1 + growth / visualSize;

  button.style.setProperty("--press-scale", String(scale));
}

function updateButtonStretch(
  button,
  event,
  stretchXSpring,
  stretchYSpring,
  originXSpring,
  originYSpring,
) {
  const stretch = getButtonStretch(button, event);

  originXSpring.to(stretch.originX, buttonSpringVariants.stretch);
  originYSpring.to(stretch.originY, buttonSpringVariants.stretch);
  stretchXSpring.to(stretch.x, buttonSpringVariants.stretch);
  stretchYSpring.to(stretch.y, buttonSpringVariants.stretch);
}

function createButtonPressState(glow) {
  return { glow };
}

function getButtonStretch(button, event) {
  const rect = button.getBoundingClientRect();
  const width = Math.max(rect.width, 1);
  const height = Math.max(rect.height, 1);
  const localX = event.clientX - rect.left;
  const localY = event.clientY - rect.top;
  const clampedPoint = clampPointToPill(localX, localY, width, height);
  const deltaX = (localX - clampedPoint.x) / (width / 2);
  const deltaY = (localY - clampedPoint.y) / (height / 2);
  const originX = (clampedPoint.x - width / 2) / (width / 2);
  const originY = (clampedPoint.y - height / 2) / (height / 2);
  const rubberDeltaX = rubberBandAxis(deltaX);
  const rubberDeltaY = rubberBandAxis(deltaY);
  const rubberOriginX = rubberBandAxis(originX);
  const rubberOriginY = rubberBandAxis(originY);
  const horizontal = smoothMagnitude(rubberDeltaX);
  const vertical = smoothMagnitude(rubberDeltaY);
  const stretchAmount = buttonStretchAmount * buttonStretchMultiplier;
  const originAmount = 12 * buttonStretchMultiplier;

  return {
    originX: 50 - rubberOriginX * originAmount,
    originY: 50 - rubberOriginY * originAmount,
    x: 1 + stretchAmount * horizontal - stretchAmount * 0.35 * vertical,
    y: 1 + stretchAmount * vertical - stretchAmount * 0.35 * horizontal,
  };
}

function clampPointToPill(x, y, width, height) {
  const centerX = width / 2;
  const centerY = height / 2;
  const px = x - centerX;
  const py = y - centerY;
  const radius = Math.min(width, height) / 2;
  const horizontal = width >= height;
  const segmentHalf = Math.max(
    (horizontal ? width : height) / 2 - radius,
    0,
  );
  const segmentX = horizontal ? clamp(px, -segmentHalf, segmentHalf) : 0;
  const segmentY = horizontal ? 0 : clamp(py, -segmentHalf, segmentHalf);
  const dx = px - segmentX;
  const dy = py - segmentY;
  const distance = Math.hypot(dx, dy);

  if (distance <= radius || distance === 0) {
    return { x, y };
  }

  return {
    x: centerX + segmentX + (dx / distance) * radius,
    y: centerY + segmentY + (dy / distance) * radius,
  };
}

function rubberBandAxis(value) {
  if (value === 0) return 0;

  return Math.sign(value) * Math.log2(1 + Math.abs(value) * 9);
}

function smoothMagnitude(value) {
  return Math.log(value * value + Math.E) - 1;
}

function setButtonStretchAxis(button, axis, value) {
  const safeValue = Math.max(value, 0.001);

  button.style.setProperty(`--stretch-${axis}`, String(safeValue));
  button.style.setProperty(`--stretch-inverse-${axis}`, String(1 / safeValue));
}

function setButtonPressOrigin(button, axis, value) {
  button.style.setProperty(`--press-origin-${axis}`, `${value}%`);
}

function spawnButtonGlow(button, event) {
  const clip = document.createElement("span");
  const glow = document.createElement("span");

  clip.className = "button-glow-clip";
  clip.setAttribute("aria-hidden", "true");
  glow.className = "button-press-glow";
  glow.setAttribute("aria-hidden", "true");

  glow.addEventListener("animationend", () => {
    if (glow.dataset.released === "true") {
      clip.remove();
    }
  });

  clip.append(glow);
  button.prepend(clip);
  positionButtonGlow(button, glow, event);
  return glow;
}

function positionButtonGlow(button, glow, event) {
  const rect = button.getBoundingClientRect();
  const localX = event.clientX - rect.left;
  const localY = event.clientY - rect.top;
  const { x, y } = clampPointToPill(localX, localY, rect.width, rect.height);
  const maxDistance = Math.max(
    Math.hypot(x, y),
    Math.hypot(rect.width - x, y),
    Math.hypot(x, rect.height - y),
    Math.hypot(rect.width - x, rect.height - y),
  );

  glow.style.setProperty("--press-x", `${x}px`);
  glow.style.setProperty("--press-y", `${y}px`);
  glow.style.setProperty("--press-size", `${Math.ceil(maxDistance * 2.65)}px`);
}

function releaseButtonGlow(glow) {
  if (glow.dataset.released === "true") return;

  glow.dataset.released = "true";

  window.setTimeout(() => {
    glow.parentElement?.remove();
  }, 700);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
