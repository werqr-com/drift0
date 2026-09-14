import type { APIRoute } from "astro";
import {
  jsonResponse,
  optionalNumber,
  requireNumber,
  requireUser,
} from "../../../lib/apiHelpers";

export const GET: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if (auth instanceof Response) return auth;
  const { supabase, user } = auth;

  let query = supabase
    .from("dope_entries")
    .select("*")
    .eq("user_id", user.id)
    .order("shot_at", { ascending: false });

  const rifleId = context.url.searchParams.get("rifle_id");
  const locationId = context.url.searchParams.get("location_id");
  const unit = context.url.searchParams.get("unit");

  if (rifleId) query = query.eq("rifle_id", rifleId);
  if (locationId) query = query.eq("location_id", locationId);
  if (unit === "moa" || unit === "mil") query = query.eq("correction_unit", unit);

  const { data, error } = await query.limit(500);
  if (error) return jsonResponse({ error: error.message }, 400);
  return jsonResponse({ entries: data ?? [] });
};

export const POST: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if (auth instanceof Response) return auth;
  const { supabase, user } = auth;

  try {
    const body = await context.request.json();
    const rifle_id = typeof body.rifle_id === "string" ? body.rifle_id : "";
    if (!rifle_id) return jsonResponse({ error: "rifle_id is required" }, 400);

    const dist = requireNumber(body.distance_m, "distance_m", 1, 5000);
    if (!dist.ok) return jsonResponse({ error: dist.error }, 400);

    const elev = requireNumber(
      body.elevation_correction ?? 0,
      "elevation_correction",
      -100,
      100
    );
    if (!elev.ok) return jsonResponse({ error: elev.error }, 400);

    const wind = requireNumber(
      body.windage_correction ?? 0,
      "windage_correction",
      -100,
      100
    );
    if (!wind.ok) return jsonResponse({ error: wind.error }, 400);

    const correction_unit = body.correction_unit === "mil" ? "mil" : "moa";
    const client_id =
      typeof body.client_id === "string" && body.client_id.length > 0
        ? body.client_id
        : crypto.randomUUID();

    const windSpeed = optionalNumber(body.wind_speed_ms, 0, 100);
    if (!windSpeed.ok) return jsonResponse({ error: windSpeed.error }, 400);
    const windAngle = optionalNumber(body.wind_angle_deg, 0, 360);
    if (!windAngle.ok) return jsonResponse({ error: windAngle.error }, 400);
    const temp = optionalNumber(body.temperature_c, -50, 60);
    if (!temp.ok) return jsonResponse({ error: temp.error }, 400);
    const alt = optionalNumber(body.altitude_m, -500, 10000);
    if (!alt.ok) return jsonResponse({ error: alt.error }, 400);
    const pressure = optionalNumber(body.pressure_hpa, 800, 1100);
    if (!pressure.ok) return jsonResponse({ error: pressure.error }, 400);
    const group = optionalNumber(body.group_size_mm, 0, 10000);
    if (!group.ok) return jsonResponse({ error: group.error }, 400);

    const row = {
      user_id: user.id,
      rifle_id,
      location_id:
        typeof body.location_id === "string" ? body.location_id : null,
      shot_at:
        typeof body.shot_at === "string" ? body.shot_at : new Date().toISOString(),
      distance_m: dist.value,
      elevation_correction: elev.value,
      windage_correction: wind.value,
      correction_unit,
      wind_speed_ms: windSpeed.value,
      wind_angle_deg: windAngle.value,
      temperature_c: temp.value,
      altitude_m: alt.value,
      pressure_hpa: pressure.value,
      group_size_mm: group.value,
      shots:
        typeof body.shots === "number" && body.shots >= 1 && body.shots <= 100
          ? Math.round(body.shots)
          : null,
      ammo_lot: typeof body.ammo_lot === "string" ? body.ammo_lot : null,
      notes: typeof body.notes === "string" ? body.notes : null,
      client_id,
    };

    const { data, error } = await supabase
      .from("dope_entries")
      .upsert(row, { onConflict: "user_id,client_id" })
      .select()
      .single();

    if (error) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ entry: data }, 201);
  } catch {
    return jsonResponse({ error: "Invalid request" }, 400);
  }
};
