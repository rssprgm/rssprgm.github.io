import { withSupabase } from "jsr:@supabase/server@^1";

type JoinPayload = {
  name?: unknown;
  studentNumber?: unknown;
  grade?: unknown;
  personalEmail?: unknown;
  interest?: unknown;
  source?: unknown;
  startedAt?: unknown;
  turnstileToken?: unknown;
  website?: unknown;
};

const allowedGrades = new Set(["8", "9", "10", "11", "12", "Other"]);
const defaultTurnstileHostnames = new Set(["rssprgm.github.io"]);
const maxRequestBodyBytes = 16 * 1024;
const maxStartedAtAgeMs = 6 * 60 * 60 * 1000;
const minCompletionMs = 2000;
const defaultRecentIpLimit = 200;
const rateLimitWindowMs = 60 * 60 * 1000;
const turnstileAction = "join";
const turnstileTimeoutMs = 8000;

export default {
  fetch: withSupabase({ auth: "publishable" }, async (request, ctx) => {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const payloadResult = await readJoinPayload(request);
    if (!payloadResult.ok) {
      return payloadResult.response;
    }

    const payload = payloadResult.payload;
    const now = Date.now();
    const startedAt =
      typeof payload.startedAt === "number" ? payload.startedAt : Number.NaN;

    if (!isPlausibleStartedAt(startedAt, now)) {
      return Response.json(
        { error: "Refresh the form and try again." },
        { status: 400 },
      );
    }

    if (now - startedAt < minCompletionMs) {
      return Response.json(
        { error: "Try again in a moment." },
        { status: 400 },
      );
    }

    if (typeof payload.website === "string" && payload.website.trim() !== "") {
      return Response.json({ ok: true });
    }

    const clientIp = getClientIp(request);
    const turnstileResult = await verifyTurnstile(
      clean(payload.turnstileToken, 2048),
      clientIp,
    );

    if (!turnstileResult.ok) {
      return Response.json(
        { error: turnstileResult.error },
        { status: turnstileResult.status },
      );
    }

    const name = clean(payload.name, 80);
    const studentNumber = clean(payload.studentNumber, 20);
    const grade = clean(payload.grade, 20);
    const personalEmail = cleanOptional(payload.personalEmail, 254)?.toLowerCase() ?? null;
    const interest = cleanOptional(payload.interest, 500);
    const source = cleanOptional(payload.source, 80);

    if (!name || !studentNumber || !grade) {
      return Response.json(
        { error: "Missing required fields." },
        { status: 400 },
      );
    }

    if (!allowedGrades.has(grade)) {
      return Response.json({ error: "Invalid grade." }, { status: 400 });
    }

    if (!/^[0-9]+$/.test(studentNumber)) {
      return Response.json(
        { error: "Invalid student number." },
        { status: 400 },
      );
    }

    if (personalEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail)) {
        return Response.json({ error: "Invalid email." }, { status: 400 });
      }

      const emailDomain = personalEmail.split("@").pop() ?? "";
      if (emailDomain === "bc.ca" || emailDomain.endsWith(".bc.ca")) {
        return Response.json(
          { error: "Use a personal email, not a school email." },
          { status: 400 },
        );
      }
    }

    const rateLimitSalt = Deno.env.get("RATE_LIMIT_SALT");
    if (!rateLimitSalt) {
      console.error("Missing RATE_LIMIT_SALT; join submissions are blocked.");
      return Response.json(
        { error: "Could not submit right now." },
        { status: 500 },
      );
    }

    const ipHash = clientIp ? await hashIp(clientIp, rateLimitSalt) : null;
    const oneHourAgo = new Date(now - rateLimitWindowMs).toISOString();
    const recentIpLimit = getPositiveIntegerEnv(
      "JOIN_RECENT_IP_LIMIT",
      defaultRecentIpLimit,
    );

    const { data: submitResult, error: submitError } = await ctx.supabaseAdmin.rpc(
      "create_join_submission",
      {
        p_grade: grade,
        p_interest: interest,
        p_ip_hash: ipHash,
        p_name: name,
        p_personal_email: personalEmail,
        p_rate_window_start: oneHourAgo,
        p_recent_ip_limit: recentIpLimit,
        p_source: source,
        p_student_number: studentNumber,
        p_user_agent: cleanOptional(request.headers.get("user-agent"), 300),
      },
    );

    if (submitError) {
      console.error(submitError);
      return Response.json(
        { error: "Could not submit right now." },
        { status: 500 },
      );
    }

    const submitCode = getSubmitResultCode(submitResult);
    if (submitCode === "ip_rate_limited") {
      return Response.json(
        { error: "Too many submissions from this network. Try again later." },
        { status: 429 },
      );
    }

    if (!isSubmitResultOk(submitResult)) {
      console.error("Unexpected join submission result", submitResult);
      return Response.json(
        { error: "Could not submit right now." },
        { status: 500 },
      );
    }

    return Response.json({ ok: true });
  }),
};

type PayloadResult =
  | { ok: true; payload: JoinPayload }
  | { ok: false; response: Response };

async function readJoinPayload(request: Request): Promise<PayloadResult> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return {
      ok: false,
      response: Response.json(
        { error: "Expected JSON." },
        { status: 415 },
      ),
    };
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxRequestBodyBytes) {
    return {
      ok: false,
      response: Response.json(
        { error: "Request body is too large." },
        { status: 413 },
      ),
    };
  }

  const bodyResult = await readLimitedText(request, maxRequestBodyBytes);
  if (!bodyResult.ok) {
    return {
      ok: false,
      response: bodyResult.response,
    };
  }

  try {
    const payload = JSON.parse(bodyResult.text);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Payload must be an object.");
    }

    return { ok: true, payload };
  } catch {
    return {
      ok: false,
      response: Response.json({ error: "Invalid JSON" }, { status: 400 }),
    };
  }
}

function isPlausibleStartedAt(startedAt: number, now: number) {
  return (
    Number.isFinite(startedAt) &&
    startedAt > 0 &&
    startedAt <= now + 5000 &&
    now - startedAt <= maxStartedAtAgeMs
  );
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanOptional(value: unknown, maxLength: number) {
  const cleaned = clean(value, maxLength);
  return cleaned || null;
}

function getClientIp(request: Request) {
  return getSingleIpHeader(request.headers.get("cf-connecting-ip"));
}

type BodyReadResult =
  | { ok: true; text: string }
  | { ok: false; response: Response };

async function readLimitedText(
  request: Request,
  maxBytes: number,
): Promise<BodyReadResult> {
  if (!request.body) {
    return { ok: true, text: "" };
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let byteCount = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (!value) {
        continue;
      }

      byteCount += value.byteLength;
      if (byteCount > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return {
          ok: false,
          response: Response.json(
            { error: "Request body is too large." },
            { status: 413 },
          ),
        };
      }

      text += decoder.decode(value, { stream: true });
    }
  } catch {
    return {
      ok: false,
      response: Response.json({ error: "Invalid JSON" }, { status: 400 }),
    };
  }

  text += decoder.decode();
  return { ok: true, text };
}

function getSingleIpHeader(value: string | null) {
  if (!value) {
    return "";
  }

  const ip = value.trim();
  if (!ip || ip.includes(",")) {
    return "";
  }

  return isValidIpLiteral(ip) ? ip : "";
}

function isValidIpLiteral(value: string) {
  return isValidIpv4(value) || isValidIpv6(value);
}

function isValidIpv4(value: string) {
  const parts = value.split(".");
  return (
    parts.length === 4 &&
    parts.every((part) => {
      if (!/^[0-9]+$/.test(part)) {
        return false;
      }

      const octet = Number(part);
      return octet >= 0 && octet <= 255 && String(octet) === part;
    })
  );
}

function isValidIpv6(value: string) {
  if (!value.includes(":") || value.includes(",")) {
    return false;
  }

  try {
    new URL(`http://[${value}]`);
    return true;
  } catch {
    return false;
  }
}

async function hashIp(ip: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyTurnstile(token: string, ip: string) {
  if (!token) {
    return {
      ok: false,
      status: 400,
      error: "Verification is required.",
    };
  }

  const secret = Deno.env.get("CLOUDFLARE_TURNSTILE_SECRET_KEY");
  if (!secret) {
    console.error("Missing CLOUDFLARE_TURNSTILE_SECRET_KEY");
    return {
      ok: false,
      status: 500,
      error: "Could not submit right now.",
    };
  }

  const formData = new FormData();
  formData.set("secret", secret);
  formData.set("response", token);

  if (ip) {
    formData.set("remoteip", ip);
  }

  let response: Response;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), turnstileTimeoutMs);

    try {
      response = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          body: formData,
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error(error);
    return {
      ok: false,
      status: 500,
      error: "Could not verify right now.",
    };
  }

  const result = await response.json().catch(() => null);

  if (!response.ok || result?.success !== true) {
    console.error("Turnstile verification failed", result);
    return {
      ok: false,
      status: 400,
      error: "Verification failed. Try again.",
    };
  }

  if (!isExpectedTurnstileResult(result)) {
    console.error("Turnstile verification metadata mismatch", {
      action: result?.action,
      hostname: result?.hostname,
    });
    return {
      ok: false,
      status: 400,
      error: "Verification failed. Try again.",
    };
  }

  return {
    ok: true,
    status: 200,
    error: "",
  };
}

function getSubmitResultCode(result: unknown) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return "";
  }

  const code = (result as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

function getPositiveIntegerEnv(name: string, fallback: number) {
  const value = Deno.env.get(name);
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isSubmitResultOk(result: unknown) {
  return (
    Boolean(result) &&
    typeof result === "object" &&
    !Array.isArray(result) &&
    (result as { ok?: unknown }).ok === true
  );
}

function isExpectedTurnstileResult(result: unknown) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return false;
  }

  const action = (result as { action?: unknown }).action;
  const hostname = (result as { hostname?: unknown }).hostname;

  return (
    action === turnstileAction &&
    typeof hostname === "string" &&
    getAllowedTurnstileHostnames().has(hostname)
  );
}

function getAllowedTurnstileHostnames() {
  const configuredHostnames = Deno.env.get("TURNSTILE_ALLOWED_HOSTNAMES")
    ?.split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);

  return configuredHostnames?.length
    ? new Set(configuredHostnames)
    : defaultTurnstileHostnames;
}
