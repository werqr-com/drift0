import type { APIRoute } from "astro";
import {
  jsonResponse,
  requireNumber,
  requireUser,
} from "../../../lib/apiHelpers";

export const PUT: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if (auth instanceof Response) return auth;
  const { supabase, user } = auth;
  const id = context.params.id;
  if (!id) return jsonResponse({ error: "Missing id" }, 400);

  try {
    const body = await context.request.json();
    const updates: Record<string, unknown> = {};

    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) return jsonResponse({ error: "Name is required" }, 400);
      updates.name = name;
    }
    if (body.muzzle_velocity_ms !== undefined) {
      const mv = requireNumber(body.muzzle_velocity_ms, "muzzle_velocity_ms", 50, 2000);
      if (!mv.ok) return jsonResponse({ error: mv.error }, 400);
      updates.muzzle_velocity_ms = mv.value;
    }
    if (body.bullet_weight_g !== undefined) {
      const bw = requireNumber(body.bullet_weight_g, "bullet_weight_g", 0.1, 200);
      if (!bw.ok) return jsonResponse({ error: bw.error }, 400);
      updates.bullet_weight_g = bw.value;
    }
    if (body.ballistic_coefficient !== undefined) {
      const bc = requireNumber(body.ballistic_coefficient, "ballistic_coefficient", 0.001, 2);
      if (!bc.ok) return jsonResponse({ error: bc.error }, 400);
      updates.ballistic_coefficient = bc.value;
    }
    if (body.zero_range_m !== undefined) {
      const zero = requireNumber(body.zero_range_m, "zero_range_m", 1, 2000);
      if (!zero.ok) return jsonResponse({ error: zero.error }, 400);
      updates.zero_range_m = zero.value;
    }
    if (body.sight_height_mm !== undefined) {
      const sight = requireNumber(body.sight_height_mm, "sight_height_mm", 0, 500);
      if (!sight.ok) return jsonResponse({ error: sight.error }, 400);
      updates.sight_height_mm = sight.value;
    }
    if (typeof body.click_value === "string") updates.click_value = body.click_value;
    if (body.scope_unit === "moa" || body.scope_unit === "mil") {
      updates.scope_unit = body.scope_unit;
    }
    if (body.trued_muzzle_velocity_ms !== undefined) {
      updates.trued_muzzle_velocity_ms = body.trued_muzzle_velocity_ms;
    }
    if (body.notes !== undefined) {
      updates.notes = typeof body.notes === "string" ? body.notes : null;
    }
    if (body.is_default === true) {
      await supabase
        .from("rifles")
        .update({ is_default: false })
        .eq("user_id", user.id);
      updates.is_default = true;
    } else if (body.is_default === false) {
      updates.is_default = false;
    }

    const { data, error } = await supabase
      .from("rifles")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ rifle: data });
  } catch {
    return jsonResponse({ error: "Invalid request" }, 400);
  }
};

export const DELETE: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if (auth instanceof Response) return auth;
  const { supabase, user } = auth;
  const id = context.params.id;
  if (!id) return jsonResponse({ error: "Missing id" }, 400);

  const { error } = await supabase
    .from("rifles")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return jsonResponse({ error: error.message }, 400);
  return jsonResponse({ ok: true });
};
