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
  fetch: withSupabase({ auth: "publishable" }, async (request, ctx) => {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, 405);
    }

    const expectedToken = Deno.env.get("VIEWER_TOKEN");
    const suppliedToken = request.headers.get("x-viewer-token")?.trim();

    if (!expectedToken || suppliedToken !== expectedToken) {
      return json({ error: "Unauthorized" }, 401);
    }

    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim() ?? "";

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
      const escaped = query.replaceAll("%", "\\%").replaceAll("_", "\\_");
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
      return json({ error: "Could not load submissions." }, 500);
    }

    return json({ submissions: data ?? [] });
  }),
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, content-type, x-viewer-token",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: corsHeaders,
  });
}
