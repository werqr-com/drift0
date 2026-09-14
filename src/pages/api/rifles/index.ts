import type { APIRoute } from "astro";
import {
  jsonResponse,
  requireNumber,
  requireUser,
} from "../../../lib/apiHelpers";

export const GET: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if (auth instanceof Response) return auth;
  const { supabase, user } = auth;

  const { data, error } = await supabase
    .from("rifles")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) return jsonResponse({ error: error.message }, 400);
  return jsonResponse({ rifles: data ?? [] });
};

export const POST: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if (auth instanceof Response) return auth;
  const { supabase, user } = auth;

  try {
    const body = await context.request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return jsonResponse({ error: "Name is required" }, 400);

    const mv = requireNumber(body.muzzle_velocity_ms, "muzzle_velocity_ms", 50, 2000);
    if (!mv.ok) return jsonResponse({ error: mv.error }, 400);
    const bw = requireNumber(body.bullet_weight_g, "bullet_weight_g", 0.1, 200);
    if (!bw.ok) return jsonResponse({ error: bw.error }, 400);
    const bc = requireNumber(body.ballistic_coefficient, "ballistic_coefficient", 0.001, 2);
    if (!bc.ok) return jsonResponse({ error: bc.error }, 400);

    const zero = requireNumber(body.zero_range_m ?? 91.44, "zero_range_m", 1, 2000);
    if (!zero.ok) return jsonResponse({ error: zero.error }, 400);
    const sight = requireNumber(body.sight_height_mm ?? 38.1, "sight_height_mm", 0, 500);
    if (!sight.ok) return jsonResponse({ error: sight.error }, 400);

    const scope_unit = body.scope_unit === "mil" ? "mil" : "moa";
    const click_value =
      typeof body.click_value === "string" ? body.click_value : "0.25moa";
    const is_default = Boolean(body.is_default);

    if (is_default) {
      await supabase
        .from("rifles")
        .update({ is_default: false })
        .eq("user_id", user.id);
    }

    const { data, error } = await supabase
      .from("rifles")
      .insert({
        user_id: user.id,
        name,
        muzzle_velocity_ms: mv.value,
        bullet_weight_g: bw.value,
        ballistic_coefficient: bc.value,
        zero_range_m: zero.value,
        sight_height_mm: sight.value,
        click_value,
        scope_unit,
        trued_muzzle_velocity_ms: body.trued_muzzle_velocity_ms ?? null,
        notes: typeof body.notes === "string" ? body.notes : null,
        is_default,
      })
      .select()
      .single();

    if (error) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ rifle: data }, 201);
  } catch {
    return jsonResponse({ error: "Invalid request" }, 400);
  }
};
