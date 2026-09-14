import type { APIRoute } from "astro";
import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "../../lib/supabase/server";

export const GET: APIRoute = async (context) => {
  if (!isSupabaseConfigured(context)) {
    return context.redirect("/login?error=not_configured");
  }

  const token_hash = context.url.searchParams.get("token_hash");
  const type = context.url.searchParams.get("type") as
    | "signup"
    | "email"
    | "recovery"
    | "invite"
    | "magiclink"
    | "email_change"
    | null;
  const next = context.url.searchParams.get("next") ?? "/";

  if (!token_hash || !type) {
    return context.redirect("/login?error=invalid_link");
  }

  const supabase = createSupabaseServerClient(context);
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash,
  });

  if (error) {
    return context.redirect(
      `/login?error=${encodeURIComponent(error.message)}`
    );
  }

  if (type === "recovery") {
    return context.redirect("/account/reset-password");
  }

  return context.redirect(next.startsWith("/") ? next : "/");
};
