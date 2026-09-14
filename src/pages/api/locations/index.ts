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
    .from("locations")
    .select("*")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  if (error) return jsonResponse({ error: error.message }, 400);
  return jsonResponse({ locations: data ?? [] });
};

export const POST: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if (auth instanceof Response) return auth;
  const { supabase, user } = auth;

  try {
    const body = await context.request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return jsonResponse({ error: "Name is required" }, 400);

    const alt = requireNumber(body.altitude_m ?? 0, "altitude_m", -500, 10000);
    if (!alt.ok) return jsonResponse({ error: alt.error }, 400);

    const { data, error } = await supabase
      .from("locations")
      .insert({
        user_id: user.id,
        name,
        altitude_m: alt.value,
        lat: typeof body.lat === "number" ? body.lat : null,
        lon: typeof body.lon === "number" ? body.lon : null,
        notes: typeof body.notes === "string" ? body.notes : null,
      })
      .select()
      .single();

    if (error) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ location: data }, 201);
  } catch {
    return jsonResponse({ error: "Invalid request" }, 400);
  }
};
