import { createStaggeredTextRenderer } from "./text-effects.js";

const joinDialogHTML = `
  <div
    class="join-overlay"
    id="join-dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="join-title"
    tabindex="-1"
    hidden>
    <div class="join-dialog">
      <div class="join-panel">
      <form class="join-form" id="join-form">
        <div class="join-form-head">
          <h2 id="join-title">Join our club</h2>
          <button class="join-close" type="button" data-close-join aria-label="Close dialog">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <label>
          <span>Name</span>
          <span class="field-shell">
            <input name="name" autocomplete="name" maxlength="80" required />
          </span>
        </label>

        <label>
          <span>Student number</span>
          <span class="field-shell">
            <input
              name="student_number"
              inputmode="numeric"
              autocomplete="off"
              maxlength="20"
              pattern="[0-9]*"
              title="Use digits only."
              required />
          </span>
        </label>

        <label>
          <span>Grade</span>
          <span class="field-shell select-shell">
            <select name="grade" required>
              <option value="">Select</option>
              <option>8</option>
              <option>9</option>
              <option>10</option>
              <option>11</option>
              <option>12</option>
              <option>Other</option>
            </select>
            <span class="grade-value" aria-hidden="true"></span>
            <span class="select-arrow" aria-hidden="true"></span>
          </span>
        </label>

        <label>
          <span>Personal email for updates (optional)</span>
          <span class="field-shell">
            <input
              name="personal_email"
              type="email"
              autocomplete="email"
              maxlength="254"
              aria-describedby="personal-email-message" />
          </span>
          <small class="field-message" id="personal-email-message" aria-live="polite"></small>
        </label>

        <label>
          <span>What do you want to build? (optional)</span>
          <span class="field-shell field-shell-area">
            <textarea name="interest" rows="4" maxlength="500"></textarea>
          </span>
        </label>

        <label class="trap-field" aria-hidden="true">
          <span>Website</span>
          <input name="website" tabindex="-1" autocomplete="off" />
        </label>

        <div
          class="turnstile-box"
          id="join-turnstile"
          aria-label="Human verification"></div>

        <p class="join-status" data-join-status role="status" aria-live="polite"></p>

        <div class="join-actions">
          <button class="button button-primary join-submit" type="submit">
            <span>Submit</span>
          </button>
        </div>
      </form>

      <div class="join-success" id="join-success" tabindex="-1" hidden>
        <div class="join-form-head">
          <h2 id="join-success-title">You're on the list</h2>
        </div>

        <p>
          We got your signup. Once the club is ready, you will be added to our teams channel.
          If you need further assistance, please contact us at
          <a href="mailto:rssprogrammingclub@gmail.com"
            >rssprogrammingclub@gmail.com</a
          >.
        </p>

        <div class="join-actions">
          <button class="button button-primary" type="button" data-close-join>
            <span>Done</span>
          </button>
        </div>
      </div>
      </div>
    </div>
  </div>
`;

const range = document.createRange();
const fragment = range.createContextualFragment(joinDialogHTML);
if (document.body) {
  document.body.append(fragment);
} else {
  document.addEventListener("DOMContentLoaded", () => {
    document.body.append(fragment.cloneNode(true));
  });
}

const joinEndpoint = "https://wwpxrfnpwwdgffvfomyn.supabase.co/functions/v1/join";
const supabasePublishableKey = "sb_publishable_mowvPO11HaerjOlL2b7nuA_uaykTin6";
const turnstileSiteKey = "0x4AAAAAADuS4A5I_uUQo3fV";

export function setupJoinDialog({
  prefersReducedMotion = false,
  refreshButtonEffects = () => undefined,
} = {}) {
  const joinDialog = document.querySelector("#join-dialog");
  const joinForm = document.querySelector("#join-form");
  const joinSuccess = document.querySelector("#join-success");
  const joinStatus = document.querySelector("[data-join-status]");
  const gradeValue = document.querySelector(".grade-value");
  const personalEmailMessage = document.querySelector("#personal-email-message");
  const turnstileContainer = document.querySelector("#join-turnstile");

  if (
    !(joinDialog instanceof HTMLElement) ||
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

  renderGradeValue(false);

  document.querySelectorAll("[data-open-join]").forEach((button) => {
    button.addEventListener("click", () => {
      clearTimeout(closeTimeoutId);
      activeJoinTrigger = button instanceof HTMLElement ? button : null;
      joinSessionId += 1;
      cancelJoinRequest();
      joinStartedAt = Date.now();
      turnstileToken = "";
      showJoinForm();
      setJoinStatus("", "");
      lockPageScroll();
      joinDialog.hidden = false;
      joinDialog.scrollTop = 0;
      joinDialog.focus({ preventScroll: true });
      refreshTurnstile(joinSessionId);
      refreshButtonEffects();
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
    if (joinDialog.hidden) return;

    if (event.key === "Escape") {
      closeJoinDialog();
      return;
    }

    if (event.key === "Tab") {
      trapJoinFocus(event);
    }
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

  function closeJoinDialog() {
    joinSessionId += 1;
    cancelJoinRequest();
    disposeTurnstile();
    joinDialog.hidden = true;
    clearTimeout(closeTimeoutId);
    closeTimeoutId = setTimeout(() => {
      unlockPageScroll();
      activeJoinTrigger?.focus({ preventScroll: true });
      activeJoinTrigger = null;
    }, prefersReducedMotion ? 0 : 300);
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
      !joinDialog.hidden &&
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

  function trapJoinFocus(event) {
    const focusable = getFocusableJoinElements();
    if (!focusable.length) {
      event.preventDefault();
      joinDialog.focus({ preventScroll: true });
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeElement = document.activeElement;

    if (activeElement === joinDialog || !joinDialog.contains(activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus({ preventScroll: true });
      return;
    }

    if (event.shiftKey && activeElement === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
      return;
    }

    if (!event.shiftKey && activeElement === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  function getFocusableJoinElements() {
    return Array.from(
      joinDialog.querySelectorAll(
        [
          "a[href]",
          "button:not([disabled])",
          "input:not([disabled])",
          "select:not([disabled])",
          "textarea:not([disabled])",
          "iframe",
          '[tabindex]:not([tabindex="-1"])',
        ].join(","),
      ),
    ).filter((element) => {
      if (!(element instanceof HTMLElement) || element.hidden) return false;
      if (element.closest("[hidden], [inert], [aria-hidden='true']")) return false;
      if (!element.getClientRects().length) return false;

      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
    });
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
