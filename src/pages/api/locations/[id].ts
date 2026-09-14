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
    if (body.altitude_m !== undefined) {
      const alt = requireNumber(body.altitude_m, "altitude_m", -500, 10000);
      if (!alt.ok) return jsonResponse({ error: alt.error }, 400);
      updates.altitude_m = alt.value;
    }
    if (body.lat !== undefined) updates.lat = body.lat;
    if (body.lon !== undefined) updates.lon = body.lon;
    if (body.notes !== undefined) {
      updates.notes = typeof body.notes === "string" ? body.notes : null;
    }

    const { data, error } = await supabase
      .from("locations")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ location: data });
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
    .from("locations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return jsonResponse({ error: error.message }, 400);
  return jsonResponse({ ok: true });
};
