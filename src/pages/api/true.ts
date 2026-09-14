import type { APIRoute } from "astro";
import { jsonResponse, requireUser } from "../../lib/apiHelpers";
import type { BallisticsInput } from "../../lib/ballistics";
import { trueMuzzleVelocity } from "../../lib/truing";

export const POST: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if (auth instanceof Response) return auth;
  const { supabase, user } = auth;

  try {
    const body = await context.request.json();
    const rifle_id = typeof body.rifle_id === "string" ? body.rifle_id : "";
    if (!rifle_id) return jsonResponse({ error: "rifle_id is required" }, 400);

    const { data: rifle, error: rifleError } = await supabase
      .from("rifles")
      .select("*")
      .eq("id", rifle_id)
      .eq("user_id", user.id)
      .single();

    if (rifleError || !rifle) {
      return jsonResponse({ error: "Rifle not found" }, 404);
    }

    let query = supabase
      .from("dope_entries")
      .select("*")
      .eq("user_id", user.id)
      .eq("rifle_id", rifle_id)
      .order("shot_at", { ascending: false })
      .limit(100);

    if (typeof body.min_distance_m === "number") {
      query = query.gte("distance_m", body.min_distance_m);
    }
    if (typeof body.max_distance_m === "number") {
      query = query.lte("distance_m", body.max_distance_m);
    }

    const { data: entries, error: entriesError } = await query;
    if (entriesError) {
      return jsonResponse({ error: entriesError.message }, 400);
    }
    if (!entries || entries.length === 0) {
      return jsonResponse(
        { error: "No DOPE entries found for this rifle" },
        400
      );
    }

    const input: BallisticsInput = {
      muzzleVelocity: rifle.muzzle_velocity_ms,
      bulletWeight: rifle.bullet_weight_g,
      ballisticCoefficient: rifle.ballistic_coefficient,
      zeroRange: rifle.zero_range_m,
      targetDistance: Math.max(...entries.map((e) => e.distance_m)),
      windSpeed: 0,
      windAngle: 90,
      sightHeight: rifle.sight_height_mm,
      temperature:
        typeof body.temperature_c === "number" ? body.temperature_c : 15,
      altitude: typeof body.altitude_m === "number" ? body.altitude_m : 0,
    };

    const observations = entries.map((e) => ({
      distance_m: e.distance_m as number,
      elevation_correction: e.elevation_correction as number,
      correction_unit: e.correction_unit as "moa" | "mil",
    }));

    const result = trueMuzzleVelocity(input, observations);

    if (body.save === true) {
      await supabase
        .from("rifles")
        .update({ trued_muzzle_velocity_ms: result.muzzleVelocity })
        .eq("id", rifle_id)
        .eq("user_id", user.id);
    }

    return jsonResponse({
      ...result,
      originalMuzzleVelocity: rifle.muzzle_velocity_ms,
      observationCount: observations.length,
    });
  } catch (err) {
    console.error("Truing error:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Truing failed" },
      400
    );
  }
};
