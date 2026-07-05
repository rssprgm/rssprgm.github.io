import { withSupabase } from "jsr:@supabase/server@^1";

type SubmissionRow = {
  id: string;
  created_at: string;
  name: string;
  student_number: string | null;
  grade: string | null;
  personal_email: string | null;
  interest: string | null;
  source: string | null;
  status: string;
  user_agent: string | null;
};

export default {
  fetch: withSupabase({ auth: "secret" }, async (request, ctx) => {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: getCorsHeaders(request) });
    }

    if (request.method !== "GET") {
      return json(request, { error: "Method not allowed" }, 405);
    }

    const url = new URL(request.url);
    const query = sanitizeSearchTerm(url.searchParams.get("q"));

    let requestQuery = ctx.supabaseAdmin
      .from("join_submissions")
      .select(
        [
          "id",
          "created_at",
          "name",
          "student_number",
          "grade",
          "personal_email",
          "interest",
          "source",
          "status",
          "user_agent",
        ].join(","),
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (query) {
      const escaped = escapeIlikeTerm(query);
      requestQuery = requestQuery.or(
        [
          `name.ilike.%${escaped}%`,
          `student_number.ilike.%${escaped}%`,
          `grade.ilike.%${escaped}%`,
          `personal_email.ilike.%${escaped}%`,
          `interest.ilike.%${escaped}%`,
          `source.ilike.%${escaped}%`,
          `status.ilike.%${escaped}%`,
        ].join(","),
      );
    }

    const { data, error } = await requestQuery.returns<SubmissionRow[]>();

    if (error) {
      console.error(error);
      return json(request, { error: "Could not load submissions." }, 500);
    }

    return json(request, { submissions: data ?? [] });
  }),
};

const allowedOrigins = new Set([
  "https://rssprgm.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const baseCorsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "no-store",
  "Vary": "Origin",
};

function getCorsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const allowedOrigin = allowedOrigins.has(origin)
    ? origin
    : "https://rssprgm.github.io";

  return {
    ...baseCorsHeaders,
    "Access-Control-Allow-Origin": allowedOrigin,
  };
}

function json(request: Request, body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: getCorsHeaders(request),
  });
}

function sanitizeSearchTerm(value: string | null) {
  return (value ?? "")
    .trim()
    .slice(0, 80)
    .replace(/[(),]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeIlikeTerm(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}
