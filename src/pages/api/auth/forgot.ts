import type { APIRoute } from "astro";
import { applyRateLimit, jsonResponse } from "../../../lib/apiHelpers";
import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "../../../lib/supabase/server";

export const POST: APIRoute = async (context) => {
  if (!isSupabaseConfigured(context)) {
    return jsonResponse(
      {
        error:
          "Auth is not configured. Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_PUBLISHABLE_KEY on the Worker.",
      },
      503
    );
  }

  const rate = applyRateLimit(context.request, 10);
  if (!rate.allowed) {
    return jsonResponse(
      { error: "Too many requests. Please try again later." },
      429,
      rate.headers
    );
  }

  try {
    const body = await context.request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!email) {
      return jsonResponse({ error: "Email is required" }, 400, rate.headers);
    }

    const supabase = createSupabaseServerClient(context);
    const origin = new URL(context.request.url).origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/account/reset-password`,
    });

    if (error) {
      return jsonResponse({ error: error.message }, 400, rate.headers);
    }

    return jsonResponse(
      { message: "If that email exists, a reset link was sent" },
      200,
      rate.headers
    );
  } catch {
    return jsonResponse({ error: "Invalid request" }, 400, rate.headers);
  }
};
