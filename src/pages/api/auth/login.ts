import type { APIRoute } from "astro";
import { applyRateLimit, jsonResponse } from "../../../lib/apiHelpers";
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

    if (!email || !password) {
      return jsonResponse(
        { error: "Email and password are required" },
        400,
        rate.headers
      );
    }

    const supabase = createSupabaseServerClient(context);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return jsonResponse({ error: error.message }, 401, rate.headers);
    }

    return jsonResponse(
      {
        user: {
          id: data.user.id,
          email: data.user.email,
          display_name:
            (data.user.user_metadata as { display_name?: string } | undefined)
              ?.display_name ?? null,
        },
      },
      200,
      rate.headers
    );
  } catch {
    return jsonResponse({ error: "Invalid request" }, 400, rate.headers);
  }
};
