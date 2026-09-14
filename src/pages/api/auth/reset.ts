import type { APIRoute } from "astro";
import { applyRateLimit, jsonResponse, requireUser } from "../../../lib/apiHelpers";
import { isSupabaseConfigured } from "../../../lib/supabase/server";

export const POST: APIRoute = async (context) => {
  if (!isSupabaseConfigured()) {
    return jsonResponse({ error: "Auth is not configured" }, 503);
  }

  const auth = await requireUser(context);
  if (auth instanceof Response) return auth;
  const { supabase } = auth;

  const rate = applyRateLimit(context.request, 10);

  try {
    const body = await context.request.json();
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 8) {
      return jsonResponse(
        { error: "Password must be at least 8 characters" },
        400,
        rate.headers
      );
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      return jsonResponse({ error: error.message }, 400, rate.headers);
    }

    return jsonResponse({ ok: true }, 200, rate.headers);
  } catch {
    return jsonResponse({ error: "Invalid request" }, 400, rate.headers);
  }
};
