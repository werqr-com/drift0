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

  const rate = applyRateLimit(context.request, 30);
  if (!rate.allowed) {
    return jsonResponse(
      { error: "Too many requests. Please try again later." },
      429,
      rate.headers
    );
  }

  const supabase = createSupabaseServerClient(context);
  await supabase.auth.signOut();
  return jsonResponse({ ok: true }, 200, rate.headers);
};
