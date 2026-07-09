import { createStaggeredTextRenderer } from "./text-effects.js";

const joinEndpoint = "https://wwpxrfnpwwdgffvfomyn.supabase.co/functions/v1/join";
const supabasePublishableKey = "sb_publishable_mowvPO11HaerjOlL2b7nuA_uaykTin6";
const turnstileSiteKey = "0x4AAAAAADuS4A5I_uUQo3fV";

export function setupJoinDialog({
  root = null,
  triggers = [],
  prefersReducedMotion = false,
  refreshButtonEffects = () => undefined,
} = {}) {
  const joinDialog = root;
  const joinForm = joinDialog?.querySelector("[data-join-form]");
  const joinSuccess = joinDialog?.querySelector("[data-join-success]");
  const joinStatus = joinDialog?.querySelector("[data-join-status]");
  const gradeValue = joinDialog?.querySelector("[data-join-grade-value]");
  const personalEmailMessage = joinDialog?.querySelector(
    "[data-join-personal-email-message]",
  );
  const turnstileContainer = joinDialog?.querySelector("[data-join-turnstile]");

  if (
    !(joinDialog instanceof HTMLDialogElement) ||
    !(joinForm instanceof HTMLFormElement) ||
    !(joinSuccess instanceof HTMLElement) ||
    !(joinStatus instanceof HTMLElement) ||
    !(gradeValue instanceof HTMLElement) ||
    !(personalEmailMessage instanceof HTMLElement) ||
    !(turnstileContainer instanceof HTMLElement)
  ) {
    return;
  }

  const gradeSelect = joinForm.elements.grade;
  const studentNumberInput = joinForm.elements.student_number;
  const personalEmailInput = joinForm.elements.personal_email;

  if (
    !(gradeSelect instanceof HTMLSelectElement) ||
    !(studentNumberInput instanceof HTMLInputElement) ||
    !(personalEmailInput instanceof HTMLInputElement)
  ) {
    return;
  }

  const renderGradeValue = createStaggeredTextRenderer({
    getText: () => gradeSelect.value || "Select",
    prefersReducedMotion,
    target: gradeValue,
  });
  let activeJoinTrigger = null;
  let joinRequestController = null;
  let joinSessionId = 0;
  let joinStartedAt = Date.now();
  let turnstileReadyPromise;
  let turnstileToken = "";
  let turnstileWidgetId;
  let lockedScrollY = 0;
  let closeTimeoutId = null;
  const joinTriggers = Array.from(triggers).filter(
    (trigger) => trigger instanceof HTMLElement,
  );

  renderGradeValue(false);

  joinTriggers.forEach((button) => {
    button.addEventListener("click", () => {
      openJoinDialog(button);
    });
  });

  joinDialog.querySelectorAll("[data-close-join]").forEach((button) => {
    button.addEventListener("click", closeJoinDialog);
  });

  joinDialog.addEventListener("click", (event) => {
    if (event.target === joinDialog) {
      closeJoinDialog();
    }
  });

  joinDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeJoinDialog();
  });

  personalEmailInput.addEventListener("input", validatePersonalEmail);
  personalEmailInput.addEventListener("blur", validatePersonalEmail);
  studentNumberInput.addEventListener("input", sanitizeStudentNumber);
  gradeSelect.addEventListener("change", () => renderGradeValue(true));

  joinForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = joinForm.querySelector("[type='submit']");
    if (!(submitButton instanceof HTMLButtonElement)) return;

    const sessionId = joinSessionId;

    sanitizeStudentNumber();

    if (!validatePersonalEmail()) {
      personalEmailInput.reportValidity();
      return;
    }

    setJoinStatus("Checking verification...", "");
    submitButton.disabled = true;

    try {
      const token = await waitForTurnstileToken(sessionId);
      if (sessionId !== joinSessionId) return;

      if (token === null) {
        return;
      }

      if (!token) {
        setJoinStatus("Complete the verification above and try again.", "error");
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
      cancelJoinRequest();
      const requestController = new AbortController();
      joinRequestController = requestController;
      const timeoutId = window.setTimeout(() => {
        requestController.abort();
      }, 12000);

      let response;
      try {
        response = await fetch(joinEndpoint, {
          method: "POST",
          headers: {
            apikey: supabasePublishableKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: requestController.signal,
        });
      } finally {
        window.clearTimeout(timeoutId);
        if (joinRequestController === requestController) {
          joinRequestController = null;
        }
      }

      if (sessionId !== joinSessionId) return;

      const result = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(result.error || "Could not submit right now.");
      }

      joinForm.reset();
      renderGradeValue(false);
      showJoinSuccess();
    } catch (error) {
      if (sessionId !== joinSessionId) return;

      refreshTurnstile(sessionId);
      setJoinStatus(getSubmissionErrorMessage(error), "error");
    } finally {
      if (sessionId === joinSessionId) {
        submitButton.disabled = false;
      }
    }
  });

  function openJoinDialog(button) {
    clearCloseTimeout();
    activeJoinTrigger = button;
    joinSessionId += 1;
    cancelJoinRequest();
    joinStartedAt = Date.now();
    turnstileToken = "";
    showJoinForm();
    setJoinStatus("", "");

    if (!joinDialog.open) {
      lockPageScroll();
      joinDialog.showModal();
    }

    joinDialog.scrollTop = 0;
    joinDialog.dataset.state = "opening";
    requestAnimationFrame(() => {
      if (joinDialog.open && joinDialog.dataset.state === "opening") {
        joinDialog.dataset.state = "open";
      }
    });
    refreshTurnstile(joinSessionId);
    refreshButtonEffects();
  }

  function closeJoinDialog() {
    if (!joinDialog.open || joinDialog.dataset.state === "closing") return;

    joinSessionId += 1;
    cancelJoinRequest();
    disposeTurnstile();
    joinDialog.dataset.state = "closing";
    clearCloseTimeout();

    const completeClose = () => {
      closeTimeoutId = null;
      if (!joinDialog.open || joinDialog.dataset.state !== "closing") return;

      joinDialog.close();
      joinDialog.dataset.state = "closed";
      unlockPageScroll();
      activeJoinTrigger?.focus({ preventScroll: true });
      activeJoinTrigger = null;
    };

    if (prefersReducedMotion) {
      completeClose();
      return;
    }

    closeTimeoutId = window.setTimeout(completeClose, 300);
  }

  function clearCloseTimeout() {
    if (closeTimeoutId === null) return;

    window.clearTimeout(closeTimeoutId);
    closeTimeoutId = null;
  }

  function cancelJoinRequest() {
    joinRequestController?.abort();
    joinRequestController = null;
  }

  function lockPageScroll() {
    if (document.body.classList.contains("join-page-locked")) return;

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
    const submitButton = joinForm.querySelector("[type='submit']");

    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = false;
    }

    joinDialog.dataset.mode = "form";
    joinDialog.setAttribute("aria-labelledby", "join-title");
    joinForm.hidden = false;
    joinSuccess.hidden = true;
    renderGradeValue(false);
    validatePersonalEmail();
  }

  function showJoinSuccess() {
    joinDialog.dataset.mode = "success";
    joinDialog.setAttribute("aria-labelledby", "join-success-title");
    joinDialog.scrollTop = 0;
    joinForm.hidden = true;
    joinSuccess.hidden = false;
    joinSuccess.focus?.({ preventScroll: true });
    disposeTurnstile();
  }

  function setJoinStatus(message, tone) {
    joinStatus.textContent = message;

    if (tone) {
      joinStatus.dataset.tone = tone;
    } else {
      joinStatus.removeAttribute("data-tone");
    }
  }

  function sanitizeStudentNumber() {
    const digits = studentNumberInput.value.replace(/\D/g, "");

    if (studentNumberInput.value !== digits) {
      studentNumberInput.value = digits;
    }
  }

  function validatePersonalEmail() {
    const email = personalEmailInput.value.trim().toLowerCase();
    const domain = email.split("@").pop() || "";
    const isSchoolEmail = domain === "bc.ca" || domain.endsWith(".bc.ca");

    if (isSchoolEmail) {
      personalEmailInput.setCustomValidity(
        "Use a personal email, not a school email.",
      );
      personalEmailInput.setAttribute("aria-invalid", "true");
      personalEmailMessage.textContent =
        "Use a personal email for updates, not a school email.";
      personalEmailMessage.dataset.tone = "error";
      return false;
    }

    personalEmailInput.setCustomValidity("");
    personalEmailInput.removeAttribute("aria-invalid");

    if (!email) {
      personalEmailMessage.textContent =
        "Optional. We will only use this for club updates.";
    } else {
      personalEmailMessage.textContent = "We will only use this for club updates.";
    }

    personalEmailMessage.removeAttribute("data-tone");
    return true;
  }

  function isCurrentJoinSession(sessionId) {
    return (
      sessionId === joinSessionId &&
      joinDialog.open &&
      joinDialog.dataset.state !== "closing" &&
      joinDialog.dataset.mode === "form"
    );
  }

  function getTurnstileToken(sessionId) {
    if (!isCurrentJoinSession(sessionId)) {
      return "";
    }

    if (turnstileToken) {
      return turnstileToken;
    }

    const hiddenToken = turnstileContainer.querySelector(
      'input[name="cf-turnstile-response"]',
    )?.value;

    if (hiddenToken) {
      turnstileToken = hiddenToken;
      return hiddenToken;
    }

    if (
      turnstileWidgetId === undefined ||
      typeof window.turnstile?.getResponse !== "function"
    ) {
      return "";
    }

    turnstileToken = window.turnstile.getResponse(turnstileWidgetId) || "";
    return turnstileToken;
  }

  function refreshTurnstile(sessionId) {
    turnstileToken = "";

    return whenTurnstileReady()
      .then(() => {
        if (!isCurrentJoinSession(sessionId)) {
          return false;
        }

        if (typeof window.turnstile?.render !== "function") {
          return false;
        }

        if (turnstileWidgetId === undefined) {
          turnstileWidgetId = window.turnstile.render(turnstileContainer, {
            sitekey: turnstileSiteKey,
            theme: "dark",
            size: "flexible",
            appearance: "always",
            action: "join",
            callback: (token) => {
              if (!isCurrentJoinSession(sessionId)) {
                return;
              }

              turnstileToken = token;
              if (
                joinStatus.textContent ===
                  "Complete the verification above and try again." ||
                joinStatus.textContent === "Checking verification..."
              ) {
                setJoinStatus("", "");
              }
            },
            "expired-callback": () => {
              if (!isCurrentJoinSession(sessionId)) {
                return;
              }

              turnstileToken = "";
            },
            "error-callback": () => {
              if (!isCurrentJoinSession(sessionId)) {
                return;
              }

              turnstileToken = "";
            },
          });
          return true;
        }

        if (!isCurrentJoinSession(sessionId)) {
          return false;
        }

        window.turnstile.reset(turnstileWidgetId);
        return true;
      })
      .catch(() => {
        if (isCurrentJoinSession(sessionId)) {
          setJoinStatus("Verification failed to load. Refresh and try again.", "error");
        }

        return false;
      });
  }

  async function waitForTurnstileToken(sessionId) {
    const existingToken = getTurnstileToken(sessionId);
    if (existingToken) {
      return existingToken;
    }

    const isReady = await refreshTurnstile(sessionId);
    if (!isReady || !isCurrentJoinSession(sessionId)) {
      return null;
    }

    return new Promise((resolve) => {
      const startedAt = Date.now();
      const intervalId = window.setInterval(() => {
        if (!isCurrentJoinSession(sessionId)) {
          window.clearInterval(intervalId);
          resolve(null);
          return;
        }

        const token = getTurnstileToken(sessionId);

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

  function disposeTurnstile() {
    turnstileToken = "";

    if (
      turnstileWidgetId !== undefined &&
      typeof window.turnstile?.remove === "function"
    ) {
      window.turnstile.remove(turnstileWidgetId);
    }

    turnstileWidgetId = undefined;
  }

  function whenTurnstileReady() {
    if (typeof window.turnstile?.render === "function") {
      return Promise.resolve();
    }

    if (turnstileReadyPromise) {
      return turnstileReadyPromise;
    }

    turnstileReadyPromise = new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const intervalId = window.setInterval(() => {
        if (typeof window.turnstile?.render === "function") {
          window.clearInterval(intervalId);
          resolve();
          return;
        }

        if (Date.now() - startedAt > 8000) {
          window.clearInterval(intervalId);
          turnstileReadyPromise = undefined;
          document.querySelector("[data-turnstile-script]")?.remove();
          reject(new Error("Turnstile did not load."));
        }
      }, 100);

      if (!document.querySelector("[data-turnstile-script]")) {
        const script = document.createElement("script");
        script.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.dataset.turnstileScript = "true";
        script.addEventListener("error", () => {
          window.clearInterval(intervalId);
          turnstileReadyPromise = undefined;
          script.remove();
          reject(new Error("Turnstile did not load."));
        });
        document.head.append(script);
      }
    });

    return turnstileReadyPromise;
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

async function readJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return {};
  }

  return response.json().catch(() => ({}));
}

function getSubmissionErrorMessage(error) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "The request timed out. Try again.";
  }

  return error instanceof Error && error.message
    ? error.message
    : "Could not submit right now.";
}
