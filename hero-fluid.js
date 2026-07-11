const SIMULATION_CELL_SIZE = 14;
const STEP_SECONDS = 1 / 30;
const PRESSURE_PASSES = 10;
const VISCOSITY = 1.5;
const VISCOSITY_PASSES = 5;
const VORTICITY_STRENGTH = 14;
const SPLAT_SHEAR = 0.35;
const POINTER_FORCE_PER_CELL = 3.2;
const MAX_POINTER_FORCE = 10;
const DENSITY_PER_CELL = 0.45;
const MAX_SPLAT_DENSITY = 0.58;
const MAX_DENSITY = 1;
const DENSITY_DISSIPATION = 0.35;
const GLYPHS = "#$~ ";
const REFERENCE_LUMA = 0.685;
const GLYPH_LUMA_STEPS = [0.53125, 0.375, 0.28125];
const CHARACTER_VISIBILITY_SCALE = 1.1;
const GLYPH_DENSITY_STEPS = GLYPH_LUMA_STEPS.map(
  (step) => (step / REFERENCE_LUMA) * CHARACTER_VISIBILITY_SCALE,
);
const MIN_VISIBLE_DENSITY =
  GLYPH_DENSITY_STEPS[GLYPH_DENSITY_STEPS.length - 1];
const GLYPH_MIN_ALPHA = 0.20;
const GLYPH_MAX_ALPHA = 0.80;
const MAX_BACKING_PIXELS = 4_000_000;

export function setupHeroFluid({ prefersReducedMotion = false } = {}) {
  const hero = document.querySelector(".hero");
  const canvas = hero?.querySelector("[data-hero-fluid]");
  const joinDialog = document.querySelector("[data-join-dialog]");
  const mobileMenu = document.querySelector("[data-mobile-menu]");

  if (!hero || !(canvas instanceof HTMLCanvasElement)) {
    return () => {};
  }

  const output = canvas.getContext("2d", { alpha: false });
  if (!output) return () => {};

  let gridWidth = 1;
  let gridHeight = 1;
  let gridSize = 1;
  let velocityX = new Float32Array(1);
  let velocityY = new Float32Array(1);
  let velocityScratchX = new Float32Array(1);
  let velocityScratchY = new Float32Array(1);
  let density = new Float32Array(1);
  let densityScratch = new Float32Array(1);
  let pressure = new Float32Array(1);
  let pressureScratch = new Float32Array(1);
  let divergence = new Float32Array(1);
  let curl = new Float32Array(1);
  const pendingSplats = [];
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

  const view = {
    width: 1,
    height: 1,
    pixelScale: 1,
    simulationScale: SIMULATION_CELL_SIZE,
    offsetX: 0,
    offsetY: 0,
  };

  let initialized = false;
  let isVisible = true;
  let isDocumentVisible = !document.hidden;
  let animationFrame = 0;
  let previousFrameTime = 0;
  let accumulatedTime = 0;
  let activeUntil = 0;
  let previousPointer = null;

  function cellIndex(x, y) {
    return x + y * gridWidth;
  }

  function sampleField(field, x, y) {
    const safeX = clamp(x, 0, gridWidth - 1);
    const safeY = clamp(y, 0, gridHeight - 1);
    const left = Math.floor(safeX);
    const top = Math.floor(safeY);
    const right = Math.min(gridWidth - 1, left + 1);
    const bottom = Math.min(gridHeight - 1, top + 1);
    const blendX = safeX - left;
    const blendY = safeY - top;
    const upper = mix(
      field[cellIndex(left, top)],
      field[cellIndex(right, top)],
      blendX,
    );
    const lower = mix(
      field[cellIndex(left, bottom)],
      field[cellIndex(right, bottom)],
      blendX,
    );
    return mix(upper, lower, blendY);
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));

    const backingBudget = Math.sqrt(
      MAX_BACKING_PIXELS / (width * height),
    );
    const pixelScale = clamp(
      Math.min(window.devicePixelRatio || 1, 2, backingBudget),
      0.75,
      2,
    );

    const nextGridWidth = Math.max(
      8,
      Math.ceil(width / SIMULATION_CELL_SIZE) + 2,
    );
    const nextGridHeight = Math.max(
      8,
      Math.ceil(height / SIMULATION_CELL_SIZE) + 2,
    );
    const gridChanged =
      nextGridWidth !== gridWidth || nextGridHeight !== gridHeight;
    const backingChanged =
      width !== view.width ||
      height !== view.height ||
      pixelScale !== view.pixelScale;

    if (!gridChanged && !backingChanged && initialized) return;

    view.width = width;
    view.height = height;
    view.pixelScale = pixelScale;
    view.offsetX =
      (width - nextGridWidth * SIMULATION_CELL_SIZE) * 0.5;
    view.offsetY =
      (height - nextGridHeight * SIMULATION_CELL_SIZE) * 0.5;

    canvas.width = Math.max(1, Math.round(width * pixelScale));
    canvas.height = Math.max(1, Math.round(height * pixelScale));
    previousPointer = null;
    pendingSplats.length = 0;

    if (!initialized || gridChanged) {
      allocateSimulation(nextGridWidth, nextGridHeight);
      initialized = true;
      activeUntil = 0;
    }

    render();

    if (canAnimate()) requestAnimation();
  }

  function allocateSimulation(width, height) {
    gridWidth = width;
    gridHeight = height;
    gridSize = width * height;
    velocityX = new Float32Array(gridSize);
    velocityY = new Float32Array(gridSize);
    velocityScratchX = new Float32Array(gridSize);
    velocityScratchY = new Float32Array(gridSize);
    density = new Float32Array(gridSize);
    densityScratch = new Float32Array(gridSize);
    pressure = new Float32Array(gridSize);
    pressureScratch = new Float32Array(gridSize);
    divergence = new Float32Array(gridSize);
    curl = new Float32Array(gridSize);
    pendingSplats.length = 0;
    previousFrameTime = 0;
    accumulatedTime = 0;
  }

  function addSplat(centerX, centerY, forceX, forceY, amount, radius) {
    const left = Math.max(1, Math.floor(centerX - radius));
    const right = Math.min(gridWidth - 2, Math.ceil(centerX + radius));
    const top = Math.max(1, Math.floor(centerY - radius));
    const bottom = Math.min(gridHeight - 2, Math.ceil(centerY + radius));
    const inverseRadiusSquared = 1 / (radius * radius);
    const forceMagnitude = Math.hypot(forceX, forceY);
    const tangentX = forceMagnitude ? forceX / forceMagnitude : 0;
    const tangentY = forceMagnitude ? forceY / forceMagnitude : 0;
    const normalX = -tangentY;
    const normalY = tangentX;

    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = (dx * dx + dy * dy) * inverseRadiusSquared;
        if (distance >= 1) continue;

        const falloff = (1 - distance) ** 2;
        const index = cellIndex(x, y);
        const side =
          ((dx * normalX + dy * normalY) / radius) *
          forceMagnitude *
          SPLAT_SHEAR;
        const densityHeadroom = Math.max(
          0,
          1 - density[index] / MAX_DENSITY,
        );
        density[index] = Math.min(
          MAX_DENSITY,
          density[index] + amount * falloff * densityHeadroom,
        );
        velocityX[index] += (forceX + tangentX * side) * falloff;
        velocityY[index] += (forceY + tangentY * side) * falloff;
      }
    }
  }

  function applyPendingSplats() {
    while (pendingSplats.length) {
      const splat = pendingSplats.shift();
      addSplat(
        splat.x,
        splat.y,
        splat.forceX,
        splat.forceY,
        splat.amount,
        splat.radius,
      );
    }
  }

  function simulate(deltaSeconds) {
    applyPendingSplats();
    diffuseVelocity(deltaSeconds);

    advect(
      velocityScratchX,
      velocityX,
      velocityX,
      velocityY,
      deltaSeconds,
      1,
    );
    advect(
      velocityScratchY,
      velocityY,
      velocityX,
      velocityY,
      deltaSeconds,
      2,
    );
    [velocityX, velocityScratchX] = [velocityScratchX, velocityX];
    [velocityY, velocityScratchY] = [velocityScratchY, velocityY];

    applyVorticity(deltaSeconds);
    projectVelocity();

    advect(
      densityScratch,
      density,
      velocityX,
      velocityY,
      deltaSeconds,
      0,
    );
    [density, densityScratch] = [densityScratch, density];

    const velocityDecay = Math.exp(-0.65 * deltaSeconds);
    const densityDecay = Math.exp(-DENSITY_DISSIPATION * deltaSeconds);

    for (let index = 0; index < gridSize; index += 1) {
      velocityX[index] *= velocityDecay;
      velocityY[index] *= velocityDecay;
      density[index] *= densityDecay;
    }
  }

  function diffuseVelocity(deltaSeconds) {
    const amount = VISCOSITY * deltaSeconds;
    if (amount <= 0 || VISCOSITY_PASSES <= 0) return;

    velocityScratchX.set(velocityX);
    velocityScratchY.set(velocityY);
    const inverseScale = 1 / (1 + 4 * amount);

    for (let pass = 0; pass < VISCOSITY_PASSES; pass += 1) {
      for (let y = 1; y < gridHeight - 1; y += 1) {
        for (let x = 1; x < gridWidth - 1; x += 1) {
          const index = cellIndex(x, y);
          velocityX[index] =
            (velocityScratchX[index] +
              amount *
                (velocityX[index - 1] +
                  velocityX[index + 1] +
                  velocityX[index - gridWidth] +
                  velocityX[index + gridWidth])) *
            inverseScale;
          velocityY[index] =
            (velocityScratchY[index] +
              amount *
                (velocityY[index - 1] +
                  velocityY[index + 1] +
                  velocityY[index - gridWidth] +
                  velocityY[index + gridWidth])) *
            inverseScale;
        }
      }

      setBoundary(velocityX, 1);
      setBoundary(velocityY, 2);
    }
  }

  function applyVorticity(deltaSeconds) {
    curl.fill(0);

    for (let y = 1; y < gridHeight - 1; y += 1) {
      for (let x = 1; x < gridWidth - 1; x += 1) {
        const index = cellIndex(x, y);
        curl[index] =
          0.5 *
          (velocityY[index + 1] -
            velocityY[index - 1] -
            velocityX[index + gridWidth] +
            velocityX[index - gridWidth]);
      }
    }

    for (let y = 2; y < gridHeight - 2; y += 1) {
      for (let x = 2; x < gridWidth - 2; x += 1) {
        const index = cellIndex(x, y);
        const gradientX =
          Math.abs(curl[index + 1]) - Math.abs(curl[index - 1]);
        const gradientY =
          Math.abs(curl[index + gridWidth]) -
          Math.abs(curl[index - gridWidth]);
        const gradientLength = Math.hypot(gradientX, gradientY) + 0.0001;
        const densityWeight = smoothstep(0.015, 0.32, density[index]);
        const force =
          VORTICITY_STRENGTH * curl[index] * densityWeight * deltaSeconds;

        velocityX[index] = clamp(
          velocityX[index] + (gradientY / gradientLength) * force,
          -28,
          28,
        );
        velocityY[index] = clamp(
          velocityY[index] - (gradientX / gradientLength) * force,
          -28,
          28,
        );
      }
    }

    setBoundary(velocityX, 1);
    setBoundary(velocityY, 2);
  }

  function advect(
    destination,
    source,
    flowX,
    flowY,
    deltaSeconds,
    boundaryType,
  ) {
    for (let y = 1; y < gridHeight - 1; y += 1) {
      for (let x = 1; x < gridWidth - 1; x += 1) {
        const index = cellIndex(x, y);
        const sourceX = x - flowX[index] * deltaSeconds;
        const sourceY = y - flowY[index] * deltaSeconds;
        destination[index] = sampleField(source, sourceX, sourceY);
      }
    }

    setBoundary(destination, boundaryType);
  }

  function projectVelocity() {
    pressure.fill(0);
    pressureScratch.fill(0);
    divergence.fill(0);

    for (let y = 1; y < gridHeight - 1; y += 1) {
      for (let x = 1; x < gridWidth - 1; x += 1) {
        const index = cellIndex(x, y);
        divergence[index] =
          -0.5 *
          (velocityX[index + 1] -
            velocityX[index - 1] +
            velocityY[index + gridWidth] -
            velocityY[index - gridWidth]);
      }
    }

    setBoundary(divergence, 0);

    for (let pass = 0; pass < PRESSURE_PASSES; pass += 1) {
      for (let y = 1; y < gridHeight - 1; y += 1) {
        for (let x = 1; x < gridWidth - 1; x += 1) {
          const index = cellIndex(x, y);
          pressureScratch[index] =
            (divergence[index] +
              pressure[index - 1] +
              pressure[index + 1] +
              pressure[index - gridWidth] +
              pressure[index + gridWidth]) *
            0.25;
        }
      }

      setBoundary(pressureScratch, 0);
      [pressure, pressureScratch] = [pressureScratch, pressure];
    }

    for (let y = 1; y < gridHeight - 1; y += 1) {
      for (let x = 1; x < gridWidth - 1; x += 1) {
        const index = cellIndex(x, y);
        velocityX[index] -=
          0.5 * (pressure[index + 1] - pressure[index - 1]);
        velocityY[index] -=
          0.5 *
          (pressure[index + gridWidth] - pressure[index - gridWidth]);
      }
    }

    setBoundary(velocityX, 1);
    setBoundary(velocityY, 2);
  }

  function setBoundary(field, boundaryType) {
    for (let x = 1; x < gridWidth - 1; x += 1) {
      field[cellIndex(x, 0)] =
        boundaryType === 2
          ? -field[cellIndex(x, 1)]
          : field[cellIndex(x, 1)];
      field[cellIndex(x, gridHeight - 1)] =
        boundaryType === 2
          ? -field[cellIndex(x, gridHeight - 2)]
          : field[cellIndex(x, gridHeight - 2)];
    }

    for (let y = 1; y < gridHeight - 1; y += 1) {
      field[cellIndex(0, y)] =
        boundaryType === 1
          ? -field[cellIndex(1, y)]
          : field[cellIndex(1, y)];
      field[cellIndex(gridWidth - 1, y)] =
        boundaryType === 1
          ? -field[cellIndex(gridWidth - 2, y)]
          : field[cellIndex(gridWidth - 2, y)];
    }

    field[cellIndex(0, 0)] =
      0.5 * (field[cellIndex(1, 0)] + field[cellIndex(0, 1)]);
    field[cellIndex(gridWidth - 1, 0)] =
      0.5 *
      (field[cellIndex(gridWidth - 2, 0)] +
        field[cellIndex(gridWidth - 1, 1)]);
    field[cellIndex(0, gridHeight - 1)] =
      0.5 *
      (field[cellIndex(1, gridHeight - 1)] +
        field[cellIndex(0, gridHeight - 2)]);
    field[cellIndex(gridWidth - 1, gridHeight - 1)] =
      0.5 *
      (field[cellIndex(gridWidth - 2, gridHeight - 1)] +
        field[cellIndex(gridWidth - 1, gridHeight - 2)]);
  }

  function render() {
    output.setTransform(view.pixelScale, 0, 0, view.pixelScale, 0, 0);
    output.globalAlpha = 1;
    output.fillStyle = "#0a0a0b";
    output.fillRect(0, 0, view.width, view.height);

    renderGlyphs();
    output.globalAlpha = 1;
  }

  function renderGlyphs() {
    const cellWidth = view.width < 760 ? 12 : 11;
    const cellHeight = view.width < 760 ? 16 : 15;
    const columns = Math.ceil(view.width / cellWidth);
    const rows = Math.ceil(view.height / cellHeight);

    output.imageSmoothingEnabled = false;
    output.fillStyle = "#f4f4f2";
    output.font = `500 ${view.width < 760 ? 9 : 10}px "Geist Mono", ui-monospace, monospace`;
    output.textAlign = "center";
    output.textBaseline = "middle";

    for (let row = 0; row < rows; row += 1) {
      const y = row * cellHeight + cellHeight * 0.5;

      for (let column = 0; column < columns; column += 1) {
        const x = column * cellWidth + cellWidth * 0.5;
        const gridX =
          (x - view.offsetX) / view.simulationScale - 0.5;
        const gridY =
          (y - view.offsetY) / view.simulationScale - 0.5;
        const amount = sampleField(density, gridX, gridY);
        const glyphIndex = densityGlyphIndex(amount);

        if (glyphIndex === GLYPHS.length - 1) continue;

        output.globalAlpha = glyphOpacity(amount);
        output.fillText(GLYPHS[glyphIndex], x, y);
      }
    }
  }

  function frame(time) {
    animationFrame = 0;
    if (
      !canAnimate() ||
      !isVisible ||
      !isDocumentVisible ||
      isOverlayOpen()
    ) {
      previousFrameTime = 0;
      accumulatedTime = 0;
      return;
    }

    if (!previousFrameTime) previousFrameTime = time;
    const elapsed = clamp((time - previousFrameTime) / 1000, 0, 0.07);
    previousFrameTime = time;
    accumulatedTime = Math.min(accumulatedTime + elapsed, STEP_SECONDS * 2);

    let stepped = false;
    let stepCount = 0;

    while (accumulatedTime >= STEP_SECONDS && stepCount < 2) {
      simulate(STEP_SECONDS);
      accumulatedTime -= STEP_SECONDS;
      stepCount += 1;
      stepped = true;
    }

    if (stepped) render();

    const peakDensity = measurePeakDensity();
    const shouldContinue =
      time < activeUntil ||
      pendingSplats.length > 0 ||
      peakDensity > MIN_VISIBLE_DENSITY;

    if (shouldContinue) {
      animationFrame = window.requestAnimationFrame(frame);
    } else {
      previousFrameTime = 0;
      accumulatedTime = 0;
    }
  }

  function measurePeakDensity() {
    let peakDensity = 0;

    for (let index = 0; index < gridSize; index += 1) {
      peakDensity = Math.max(peakDensity, density[index]);
    }

    return peakDensity;
  }

  function requestAnimation() {
    if (
      animationFrame ||
      !canAnimate() ||
      !isVisible ||
      !isDocumentVisible ||
      isOverlayOpen()
    ) {
      return;
    }

    animationFrame = window.requestAnimationFrame(frame);
  }

  function canAnimate() {
    return !prefersReducedMotion && finePointer.matches;
  }

  function isOverlayOpen() {
    return Boolean(
      joinDialog?.hasAttribute("open") ||
      (mobileMenu && !mobileMenu.hidden),
    );
  }

  function onPointerMove(event) {
    if (!canAnimate() || !isVisible || !isDocumentVisible) return;
    const eventPath = event.composedPath();
    if (
      isOverlayOpen() ||
      eventPath.includes(joinDialog) ||
      eventPath.includes(mobileMenu)
    ) {
      pendingSplats.length = 0;
      resetPointer();
      return;
    }

    const bounds = canvas.getBoundingClientRect();

    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    ) {
      resetPointer();
      return;
    }

    const point = {
      x:
        (event.clientX - bounds.left - view.offsetX) /
          view.simulationScale -
        0.5,
      y:
        (event.clientY - bounds.top - view.offsetY) /
          view.simulationScale -
        0.5,
    };

    if (!previousPointer) {
      previousPointer = point;
      return;
    }

    const deltaX = point.x - previousPointer.x;
    const deltaY = point.y - previousPointer.y;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance < 0.05) {
      previousPointer = point;
      return;
    }

    const subdivisions = Math.max(1, Math.ceil(distance / 1.4));
    const segmentDistance = distance / subdivisions;
    const segmentX = deltaX / subdivisions;
    const segmentY = deltaY / subdivisions;
    const densityAmount = Math.min(
      MAX_SPLAT_DENSITY,
      segmentDistance * DENSITY_PER_CELL,
    );
    const forceX = clamp(
      segmentX * POINTER_FORCE_PER_CELL,
      -MAX_POINTER_FORCE,
      MAX_POINTER_FORCE,
    );
    const forceY = clamp(
      segmentY * POINTER_FORCE_PER_CELL,
      -MAX_POINTER_FORCE,
      MAX_POINTER_FORCE,
    );

    for (let step = 1; step <= subdivisions; step += 1) {
      const progress = step / subdivisions;
      pendingSplats.push({
        x: mix(previousPointer.x, point.x, progress),
        y: mix(previousPointer.y, point.y, progress),
        forceX,
        forceY,
        amount: densityAmount,
        radius: 2.5,
      });
    }

    if (pendingSplats.length > 96) {
      pendingSplats.splice(0, pendingSplats.length - 96);
    }

    previousPointer = point;
    activeUntil = performance.now() + 5000;
    requestAnimation();
  }

  function resetPointer() {
    previousPointer = null;
  }

  function onVisibilityChange() {
    isDocumentVisible = !document.hidden;

    if (!isDocumentVisible) {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      pendingSplats.length = 0;
      previousFrameTime = 0;
      accumulatedTime = 0;
      resetPointer();
      return;
    }

    if (isDocumentVisible) requestAnimation();
  }

  function onPointerCapabilityChange() {
    resize();

    if (!canAnimate()) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      pendingSplats.length = 0;
      previousFrameTime = 0;
      accumulatedTime = 0;
      resetPointer();
      return;
    }

    requestAnimation();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  const intersectionObserver = new IntersectionObserver(([entry]) => {
    isVisible = entry?.isIntersecting ?? true;

    if (!isVisible) {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      pendingSplats.length = 0;
      previousFrameTime = 0;
      accumulatedTime = 0;
      resetPointer();
      return;
    }

    if (isVisible) requestAnimation();
  });
  intersectionObserver.observe(hero);

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("blur", resetPointer);
  document.documentElement.addEventListener("pointerleave", resetPointer);
  finePointer.addEventListener("change", onPointerCapabilityChange);
  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", onVisibilityChange);
  resize();

  return () => {
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("blur", resetPointer);
    document.documentElement.removeEventListener("pointerleave", resetPointer);
    finePointer.removeEventListener("change", onPointerCapabilityChange);
    window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.cancelAnimationFrame(animationFrame);
  };
}

function mix(start, end, amount) {
  return start + (end - start) * amount;
}

function smoothstep(edge0, edge1, value) {
  const amount = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

function densityGlyphIndex(value) {
  for (let index = 0; index < GLYPH_DENSITY_STEPS.length; index += 1) {
    if (value > GLYPH_DENSITY_STEPS[index]) return index;
  }

  return GLYPHS.length - 1;
}

function glyphOpacity(value) {
  const ramp = smoothstep(
    MIN_VISIBLE_DENSITY,
    GLYPH_DENSITY_STEPS[0],
    value,
  );
  return mix(GLYPH_MIN_ALPHA, GLYPH_MAX_ALPHA, ramp);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
