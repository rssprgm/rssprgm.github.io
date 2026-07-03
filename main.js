import Lenis from "https://cdn.jsdelivr.net/npm/lenis@1.3.11/+esm";

const joinEndpoint = "https://wwpxrfnpwwdgffvfomyn.supabase.co/functions/v1/join";
const supabasePublishableKey = "sb_publishable_mowvPO11HaerjOlL2b7nuA_uaykTin6";
const turnstileSiteKey = "0x4AAAAAADuS4A5I_uUQo3fV";
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
let lenis;

if (!prefersReducedMotion) {
  lenis = new Lenis({
    duration: 0.85,
    smoothWheel: true,
    smoothTouch: false,
    wheelMultiplier: 0.9,
    prevent: (node) => Boolean(node.closest?.("[data-lenis-prevent]")),
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }

  requestAnimationFrame(raf);

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href || href === "#") {
        lenis.scrollTo(0);
        return;
      }

      const target = document.querySelector(href);
      if (!target) return;

      event.preventDefault();
      lenis.scrollTo(target, {
        offset: -24,
        duration: 1.1,
      });
    });
  });
}

const joinDialog = document.querySelector("#join-dialog");
const joinForm = document.querySelector("#join-form");
const joinSuccess = document.querySelector("#join-success");
const joinStatus = document.querySelector("[data-join-status]");
const gradeSelect = joinForm.elements.grade;
const gradeValue = document.querySelector(".grade-value");
const personalEmailInput = joinForm.elements.personal_email;
const personalEmailMessage = document.querySelector("#personal-email-message");
const turnstileContainer = document.querySelector("#join-turnstile");
const gradeCharacterStaggerMs = 55;
const buttonPressVisualGrowth = 15.5;
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
};
let joinStartedAt = Date.now();
let turnstileToken = "";
let turnstileWidgetId;
let lockedScrollY = 0;
let gradeValueVersion = 0;

renderGradeValue(false);
initButtonPressEffects();

document.querySelectorAll("[data-open-join]").forEach((button) => {
  button.addEventListener("click", () => {
    joinStartedAt = Date.now();
    turnstileToken = "";
    showJoinForm();
    joinStatus.textContent = "";
    joinStatus.removeAttribute("data-tone");
    lockPageScroll();
    joinDialog.hidden = false;
    joinDialog.scrollTop = 0;
    joinDialog.focus({ preventScroll: true });
    refreshTurnstile();
  });
});

document.querySelectorAll("[data-close-join]").forEach((button) => {
  button.addEventListener("click", closeJoinDialog);
});

joinDialog.addEventListener("click", (event) => {
  if (event.target === joinDialog) {
    closeJoinDialog();
  }
});

document.addEventListener("keydown", (event) => {
  if (!joinDialog.hidden && event.key === "Escape") {
    closeJoinDialog();
  }
});

personalEmailInput.addEventListener("input", validatePersonalEmail);
personalEmailInput.addEventListener("blur", validatePersonalEmail);
gradeSelect.addEventListener("change", () => renderGradeValue(true));

joinForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitButton = joinForm.querySelector("[type='submit']");

  if (!validatePersonalEmail()) {
    personalEmailInput.reportValidity();
    return;
  }

  setJoinStatus("Checking verification...", "");
  submitButton.disabled = true;

  const token = await waitForTurnstileToken();
  if (!token) {
    setJoinStatus("Complete the verification above and try again.", "error");
    submitButton.disabled = false;
    return;
  }

  const formData = new FormData(joinForm);
  const payload = {
    name: formData.get("name"),
    studentNumber: formData.get("student_number"),
    grade: formData.get("grade"),
    personalEmail: formData.get("personal_email"),
    interest: formData.get("interest"),
    website: formData.get("website"),
    source: getSource(),
    startedAt: joinStartedAt,
    turnstileToken: token,
  };

  setJoinStatus("Submitting...", "");

  try {
    const response = await fetch(joinEndpoint, {
      method: "POST",
      headers: {
        apikey: supabasePublishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Could not submit right now.");
    }

    joinForm.reset();
    renderGradeValue(false);
    showJoinSuccess();
  } catch (error) {
    refreshTurnstile();
    setJoinStatus(error.message, "error");
  } finally {
    submitButton.disabled = false;
  }
});

function closeJoinDialog() {
  joinDialog.hidden = true;
  unlockPageScroll();
}

function lockPageScroll() {
  lockedScrollY = window.scrollY;
  document.body.classList.add("join-page-locked");
  document.body.style.position = "fixed";
  document.body.style.top = `-${lockedScrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
}

function unlockPageScroll() {
  if (!document.body.classList.contains("join-page-locked")) return;

  document.body.classList.remove("join-page-locked");
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  window.scrollTo(0, lockedScrollY);
}

function showJoinForm() {
  joinDialog.dataset.mode = "form";
  joinForm.hidden = false;
  joinSuccess.hidden = true;
  renderGradeValue(false);
  validatePersonalEmail();
}

function showJoinSuccess() {
  joinDialog.dataset.mode = "success";
  joinDialog.scrollTop = 0;
  joinForm.hidden = true;
  joinSuccess.hidden = false;
  turnstileToken = "";
}

function initButtonPressEffects() {
  document.querySelectorAll(".button, .join-close").forEach((button) => {
    const activeGlows = new Map();
    const scaleSpring = createSpringAnimator(button, {
      onUpdate: (growth) => setButtonPressGrowth(button, growth),
      value: 0,
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
      activeGlows.set(event.pointerId, glow);
      scaleSpring.to(buttonPressVisualGrowth, buttonSpringVariants.press);

      if (typeof button.setPointerCapture === "function") {
        button.setPointerCapture(event.pointerId);
      }
    });

    button.addEventListener("pointermove", (event) => {
      const glow = activeGlows.get(event.pointerId);
      if (!glow || glow.dataset.released === "true") return;

      positionButtonGlow(button, glow, event);
    });

    const release = (event) => {
      const glow = activeGlows.get(event.pointerId);
      if (!glow) return;

      activeGlows.delete(event.pointerId);
      releaseButtonGlow(glow);

      if (activeGlows.size === 0) {
        scaleSpring.to(0, buttonSpringVariants.release);
      }
    };

    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  });
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

function createSpringAnimator(element, { onUpdate, value }) {
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

function spawnButtonGlow(button, event) {
  const glow = document.createElement("span");

  glow.className = "button-press-glow";
  glow.setAttribute("aria-hidden", "true");

  glow.addEventListener("animationend", () => {
    if (glow.dataset.released === "true") {
      glow.remove();
    }
  });

  window.setTimeout(() => {
    if (glow.isConnected) {
      releaseButtonGlow(glow);
    }
  }, 1800);

  button.prepend(glow);
  positionButtonGlow(button, glow, event);
  return glow;
}

function positionButtonGlow(button, glow, event) {
  const rect = button.getBoundingClientRect();
  const x = clamp(event.clientX - rect.left, 0, rect.width);
  const y = clamp(event.clientY - rect.top, 0, rect.height);
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
    glow.remove();
  }, 700);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function renderGradeValue(animate) {
  const text = gradeSelect.value || "Select";

  if (prefersReducedMotion || !animate) {
    gradeValue.replaceChildren(createGradeValueRun(text, false));
    return;
  }

  const currentRun = gradeValue.querySelector(".grade-value-run");
  if (currentRun) {
    currentRun.classList.add("grade-value-run-out");
    window.setTimeout(() => currentRun.remove(), 260);
  }

  gradeValue.append(createGradeValueRun(text, true));
}

function createGradeValueRun(text, animate) {
  const run = document.createElement("span");
  run.className = "grade-value-run";
  gradeValueVersion += 1;

  Array.from(String(text)).forEach((character, index) => {
    const span = document.createElement("span");
    span.className = animate ? "grade-value-char" : "grade-value-char-static";
    span.textContent = character;
    span.style.animationDelay = `${index * gradeCharacterStaggerMs}ms`;
    span.dataset.version = String(gradeValueVersion);
    run.append(span);
  });

  return run;
}

function setJoinStatus(message, tone) {
  joinStatus.textContent = message;

  if (tone) {
    joinStatus.dataset.tone = tone;
  } else {
    joinStatus.removeAttribute("data-tone");
  }
}

function validatePersonalEmail() {
  const email = personalEmailInput.value.trim().toLowerCase();
  const domain = email.split("@").at(-1) || "";
  const isSchoolEmail = domain === "bc.ca" || domain.endsWith(".bc.ca");

  if (isSchoolEmail) {
    personalEmailInput.setCustomValidity(
      "Use a personal email, not a school email.",
    );
    personalEmailMessage.textContent =
      "Use a personal email for updates, not a school email.";
    personalEmailMessage.dataset.tone = "error";
    return false;
  }

  personalEmailInput.setCustomValidity("");

  if (!email) {
    personalEmailMessage.textContent =
      "Optional. We will only use this for club updates.";
  } else {
    personalEmailMessage.textContent = "We will only use this for club updates.";
  }

  personalEmailMessage.removeAttribute("data-tone");
  return true;
}

function getSource() {
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("src") ||
    params.get("source") ||
    params.get("utm_source") ||
    "site"
  );
}

function getTurnstileToken() {
  if (turnstileToken) {
    return turnstileToken;
  }

  const hiddenToken = turnstileContainer
    ?.querySelector('input[name="cf-turnstile-response"]')
    ?.value;

  if (hiddenToken) {
    turnstileToken = hiddenToken;
    return hiddenToken;
  }

  if (typeof window.turnstile?.getResponse !== "function") {
    return "";
  }

  turnstileToken = window.turnstile.getResponse(turnstileWidgetId) || "";
  return turnstileToken;
}

function refreshTurnstile() {
  turnstileToken = "";

  whenTurnstileReady()
    .then(() => {
      if (!turnstileContainer || typeof window.turnstile?.render !== "function") {
        return;
      }

      if (turnstileWidgetId === undefined) {
        turnstileWidgetId = window.turnstile.render(turnstileContainer, {
          sitekey: turnstileSiteKey,
          theme: "dark",
          size: "flexible",
          appearance: "always",
          callback: (token) => {
            turnstileToken = token;
            if (
              joinStatus.textContent ===
                "Complete the verification above and try again." ||
              joinStatus.textContent === "Checking verification..."
            ) {
              joinStatus.textContent = "";
              joinStatus.removeAttribute("data-tone");
            }
          },
          "expired-callback": () => {
            turnstileToken = "";
          },
          "error-callback": () => {
            turnstileToken = "";
          },
        });
        return;
      }

      window.turnstile.reset(turnstileWidgetId);
    })
    .catch(() => {
      setJoinStatus("Verification failed to load. Refresh and try again.", "error");
    });
}

function waitForTurnstileToken() {
  const existingToken = getTurnstileToken();
  if (existingToken) {
    return Promise.resolve(existingToken);
  }

  refreshTurnstile();

  return new Promise((resolve) => {
    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      const token = getTurnstileToken();

      if (token) {
        window.clearInterval(intervalId);
        resolve(token);
        return;
      }

      if (Date.now() - startedAt > 6000) {
        window.clearInterval(intervalId);
        resolve("");
      }
    }, 100);
  });
}

function whenTurnstileReady() {
  if (typeof window.turnstile?.render === "function") {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      if (typeof window.turnstile?.render === "function") {
        window.clearInterval(intervalId);
        resolve();
        return;
      }

      if (Date.now() - startedAt > 8000) {
        window.clearInterval(intervalId);
        reject(new Error("Turnstile did not load."));
      }
    }, 100);
  });
}
