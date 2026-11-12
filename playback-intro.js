export function springProgress(time, stiffness = 100, damping = 20) {
  if (time <= 0) return 0;
  const decay = damping / 2;
  const frequency = Math.sqrt(stiffness - decay * decay);
  return frequency ? 1 - Math.exp(-decay * time) * (Math.cos(frequency * time) + decay / frequency * Math.sin(frequency * time)) : 1 - Math.exp(-decay * time) * (1 + decay * time);
}

export function revealPlayback(root, motion) {
  if (motion.matches || !('IntersectionObserver' in window)) return Promise.resolve();
  const pill = root.querySelector('.gallery-progress-pill');
  const toggle = root.querySelector('.gallery-toggle');
  const content = root.querySelector('.gallery-progress-window');
  const icons = [...toggle.children];
  root.style.opacity = '0';
  return new Promise((resolve) => {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      const pillWidth = pill.offsetWidth;
      const toggleWidth = toggle.offsetWidth;
      const toggleShift = -(pillWidth + 12) / 2;
      const start = performance.now();
      let frame;
      const finish = () => {
        cancelAnimationFrame(frame);
        root.style.removeProperty('opacity');
        root.style.removeProperty('transform');
        root.style.removeProperty('--progress-intro');
        root.classList.remove('playback-intro');
        for (const element of [pill, toggle, content, ...icons]) {
          for (const property of ['transform', 'opacity', 'width', 'height', 'box-sizing', 'margin-right']) element.style.removeProperty(property);
        }
        motion.removeEventListener('change', finish);
        root.dispatchEvent(new Event('playback-geometry-change'));
        resolve();
      };
      root.classList.add('playback-intro');
      motion.addEventListener('change', finish, { once: true });
      const draw = (now) => {
        const time = (now - start) / 1000;
        if (time >= 2 || motion.matches) return finish();
        root.style.opacity = '1';
        root.style.setProperty('--progress-intro', springProgress(time - .74, 200, 20));
        root.style.transform = `translateY(${180 * (1 - springProgress(time - .03, 100, 8))}px)`;
        pill.style.boxSizing = 'border-box';
        const width = time < .5 ? 30 + 10 * springProgress(time - .05, 100, 8) : 40 + (pillWidth - 40) * springProgress(time - .5, 100, 10);
        pill.style.width = `${width}px`;
        pill.style.marginRight = `${pillWidth - width}px`;
        pill.style.height = `${80 - 44 * springProgress(time - .15, 100, 8) + 8 * springProgress(time - .7, 100, 10)}px`;
        pill.style.transform = `translateX(${(pillWidth + toggleWidth + 12 - width) / 2 * (1 - springProgress(time - .5))}px)`;
        toggle.style.transform = `translateX(${toggleShift * (1 - springProgress(time - .54))}px) scale(${Math.max(.001, springProgress(time - .54))})`;
        content.style.opacity = String(Math.max(0, Math.min(1, (time - .74) / .1)));
        content.style.transform = `translateX(${36 * (1 - springProgress(time - .74, 200, 20))}px)`;
        icons.forEach((icon) => { icon.style.opacity = String(Math.max(0, Math.min(1, (time - .94) / .1))); });
        root.dispatchEvent(new Event('playback-geometry-change'));
        frame = requestAnimationFrame(draw);
      };
      frame = requestAnimationFrame(draw);
    }, { threshold: .5 });
    observer.observe(root);
  });
}
