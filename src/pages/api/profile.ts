import type { APIRoute } from "astro";
import { jsonResponse, requireUser } from "../../lib/apiHelpers";

export const GET: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if (auth instanceof Response) return auth;
  const { supabase, user } = auth;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) return jsonResponse({ error: error.message }, 400);
  return jsonResponse({
    profile: data ?? {
      id: user.id,
      display_name: user.display_name,
      unit_system: "imperial",
      default_click_value: "0.25moa",
    },
    user,
  });
};

export const PUT: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if (auth instanceof Response) return auth;
  const { supabase, user } = auth;

  try {
    const body = await context.request.json();
    const updates: Record<string, unknown> = {};

    if (typeof body.display_name === "string") {
      updates.display_name = body.display_name.trim() || null;
    }
    if (body.unit_system === "imperial" || body.unit_system === "metric") {
      updates.unit_system = body.unit_system;
    }
    if (typeof body.default_click_value === "string") {
      updates.default_click_value = body.default_click_value;
    }

    const { data, error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, ...updates })
      .select()
      .single();

    if (error) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ profile: data });
  } catch {
    return jsonResponse({ error: "Invalid request" }, 400);
  }
};
