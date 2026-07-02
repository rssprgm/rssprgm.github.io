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
const turnstileContainer = document.querySelector("#join-turnstile");
let joinStartedAt = Date.now();
let turnstileToken = "";
let turnstileWidgetId;

document.querySelectorAll("[data-open-join]").forEach((button) => {
  button.addEventListener("click", () => {
    joinStartedAt = Date.now();
    turnstileToken = "";
    showJoinForm();
    joinStatus.textContent = "";
    joinStatus.removeAttribute("data-tone");
    joinDialog.showModal();
    lenis?.stop();
    joinForm.elements.name.focus();
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

joinDialog.addEventListener("close", () => {
  lenis?.start();
});

joinForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitButton = joinForm.querySelector("[type='submit']");
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
    grade: formData.get("grade"),
    email: formData.get("email"),
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
    showJoinSuccess();
  } catch (error) {
    refreshTurnstile();
    setJoinStatus(error.message, "error");
  } finally {
    submitButton.disabled = false;
  }
});

function closeJoinDialog() {
  joinDialog.close();
}

function showJoinForm() {
  joinForm.hidden = false;
  joinSuccess.hidden = true;
}

function showJoinSuccess() {
  joinForm.hidden = true;
  joinSuccess.hidden = false;
  turnstileToken = "";
}

function setJoinStatus(message, tone) {
  joinStatus.textContent = message;

  if (tone) {
    joinStatus.dataset.tone = tone;
  } else {
    joinStatus.removeAttribute("data-tone");
  }
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
