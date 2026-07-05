const defaultCharacterStaggerMs = 55;

export function createStaggeredTextRenderer({
  getText,
  prefersReducedMotion = false,
  target,
  staggerMs = defaultCharacterStaggerMs,
}) {
  let version = 0;

  function createRun(text, animate) {
    const run = document.createElement("span");
    run.className = "grade-value-run";
    version += 1;

    Array.from(String(text)).forEach((character, index) => {
      const span = document.createElement("span");
      span.className = animate ? "grade-value-char" : "grade-value-char-static";
      span.textContent = character;
      span.style.animationDelay = `${index * staggerMs}ms`;
      span.dataset.version = String(version);
      run.append(span);
    });

    return run;
  }

  return function render(animate) {
    const text = getText();

    if (prefersReducedMotion || !animate) {
      target.replaceChildren(createRun(text, false));
      return;
    }

    target.querySelectorAll(".grade-value-run").forEach((currentRun) => {
      currentRun.classList.add("grade-value-run-out");
      window.setTimeout(() => {
        if (currentRun.parentElement === target) {
          currentRun.remove();
        }
      }, 260);
    });

    target.append(createRun(text, true));
  };
}
