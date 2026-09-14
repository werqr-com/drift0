import type { APIRoute } from "astro";
import {
  jsonResponse,
  optionalNumber,
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

    if (typeof body.rifle_id === "string") updates.rifle_id = body.rifle_id;
    if (body.location_id !== undefined) {
      updates.location_id =
        typeof body.location_id === "string" ? body.location_id : null;
    }
    if (typeof body.shot_at === "string") updates.shot_at = body.shot_at;
    if (body.distance_m !== undefined) {
      const dist = requireNumber(body.distance_m, "distance_m", 1, 5000);
      if (!dist.ok) return jsonResponse({ error: dist.error }, 400);
      updates.distance_m = dist.value;
    }
    if (body.elevation_correction !== undefined) {
      const elev = requireNumber(
        body.elevation_correction,
        "elevation_correction",
        -100,
        100
      );
      if (!elev.ok) return jsonResponse({ error: elev.error }, 400);
      updates.elevation_correction = elev.value;
    }
    if (body.windage_correction !== undefined) {
      const wind = requireNumber(
        body.windage_correction,
        "windage_correction",
        -100,
        100
      );
      if (!wind.ok) return jsonResponse({ error: wind.error }, 400);
      updates.windage_correction = wind.value;
    }
    if (body.correction_unit === "moa" || body.correction_unit === "mil") {
      updates.correction_unit = body.correction_unit;
    }

    for (const [key, min, max] of [
      ["wind_speed_ms", 0, 100],
      ["wind_angle_deg", 0, 360],
      ["temperature_c", -50, 60],
      ["altitude_m", -500, 10000],
      ["pressure_hpa", 800, 1100],
      ["group_size_mm", 0, 10000],
    ] as const) {
      if (body[key] !== undefined) {
        const parsed = optionalNumber(body[key], min, max);
        if (!parsed.ok) return jsonResponse({ error: parsed.error }, 400);
        updates[key] = parsed.value;
      }
    }

    if (body.shots !== undefined) {
      updates.shots =
        typeof body.shots === "number" && body.shots >= 1 && body.shots <= 100
          ? Math.round(body.shots)
          : null;
    }
    if (body.ammo_lot !== undefined) {
      updates.ammo_lot = typeof body.ammo_lot === "string" ? body.ammo_lot : null;
    }
    if (body.notes !== undefined) {
      updates.notes = typeof body.notes === "string" ? body.notes : null;
    }

    const { data, error } = await supabase
      .from("dope_entries")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ entry: data });
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
    .from("dope_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return jsonResponse({ error: error.message }, 400);
  return jsonResponse({ ok: true });
};
