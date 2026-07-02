import { withSupabase } from "jsr:@supabase/server@^1";

type JoinPayload = {
  name?: unknown;
  grade?: unknown;
  email?: unknown;
  interest?: unknown;
  source?: unknown;
  startedAt?: unknown;
  turnstileToken?: unknown;
  website?: unknown;
};

export default {
  fetch: withSupabase({ auth: "publishable" }, async (request, ctx) => {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    let payload: JoinPayload;

    try {
      payload = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const startedAt =
      typeof payload.startedAt === "number" ? payload.startedAt : 0;

    if (Date.now() - startedAt < 2000) {
      return Response.json(
        { error: "Try again in a moment." },
        { status: 400 },
      );
    }

    if (typeof payload.website === "string" && payload.website.trim() !== "") {
      return Response.json({ ok: true });
    }

    const turnstileResult = await verifyTurnstile(
      clean(payload.turnstileToken, 2048),
      getClientIp(request),
    );

    if (!turnstileResult.ok) {
      return Response.json(
        { error: turnstileResult.error },
        { status: turnstileResult.status },
      );
    }

    const name = clean(payload.name, 80);
    const grade = clean(payload.grade, 20);
    const email = clean(payload.email, 254).toLowerCase();
    const interest = cleanOptional(payload.interest, 500);
    const source = cleanOptional(payload.source, 80);

    if (!name || !grade || !email) {
      return Response.json(
        { error: "Missing required fields." },
        { status: 400 },
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Invalid email." }, { status: 400 });
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { count, error: countError } = await ctx.supabaseAdmin
      .from("join_submissions")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", oneHourAgo);

    if (countError) {
      console.error(countError);
      return Response.json(
        { error: "Could not submit right now." },
        { status: 500 },
      );
    }

    if ((count ?? 0) >= 2) {
      return Response.json(
        { error: "You already submitted recently." },
        { status: 429 },
      );
    }

    const { error } = await ctx.supabaseAdmin.from("join_submissions").insert({
      name,
      grade,
      email,
      interest,
      source,
      user_agent: cleanOptional(request.headers.get("user-agent"), 300),
      ip_hash: await hashIp(getClientIp(request)),
    });

    if (error) {
      console.error(error);
      return Response.json(
        { error: "Could not submit right now." },
        { status: 500 },
      );
    }

    return Response.json({ ok: true });
  }),
};

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanOptional(value: unknown, maxLength: number) {
  const cleaned = clean(value, maxLength);
  return cleaned || null;
}

function getClientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    ""
  );
}

async function hashIp(ip: string) {
  if (!ip) return null;

  const salt = Deno.env.get("RATE_LIMIT_SALT");
  if (!salt) return null;

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
    response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: formData,
      },
    );
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

  return {
    ok: true,
    status: 200,
    error: "",
  };
}
