import type { APIRoute } from "astro";
import {
  applyRateLimit,
  jsonResponse,
} from "../../../lib/apiHelpers";
import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "../../../lib/supabase/server";

export const POST: APIRoute = async (context) => {
  if (!isSupabaseConfigured()) {
    return jsonResponse({ error: "Auth is not configured" }, 503);
  }

  const rate = applyRateLimit(context.request, 20);
  if (!rate.allowed) {
    return jsonResponse(
      { error: "Too many requests. Please try again later." },
      429,
      {
        ...rate.headers,
        "Retry-After": String(Math.ceil((rate.resetTime - Date.now()) / 1000)),
      }
    );
  }

  try {
    const body = await context.request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const displayName =
      typeof body.display_name === "string" ? body.display_name.trim() : "";

    if (!email || !password || password.length < 8) {
      return jsonResponse(
        { error: "Email and password (min 8 characters) are required" },
        400,
        rate.headers
      );
    }

    const supabase = createSupabaseServerClient(context);
    const origin = new URL(context.request.url).origin;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/confirm`,
        data: displayName ? { display_name: displayName } : undefined,
      },
    });

    if (error) {
      return jsonResponse({ error: error.message }, 400, rate.headers);
    }

    return jsonResponse(
      {
        user: data.user
          ? { id: data.user.id, email: data.user.email }
          : null,
        needsConfirmation: !data.session,
        message: data.session
          ? "Account created"
          : "Check your email to confirm your account",
      },
      200,
      rate.headers
    );
  } catch {
    return jsonResponse({ error: "Invalid request" }, 400, rate.headers);
  }
};
