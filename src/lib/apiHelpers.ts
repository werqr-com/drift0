import type { APIContext } from "astro";
import { checkRateLimit, getClientIP } from "./rateLimit";
import { createSupabaseServerClient, isSupabaseConfigured } from "./supabase/server";
import type { AuthUser } from "./supabase/types";

export function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

export function applyRateLimit(
  request: Request,
  maxRequests = 60,
  windowMs = 60000
) {
  const clientIP = getClientIP(request);
  const result = checkRateLimit(clientIP, { maxRequests, windowMs });
  return {
    ...result,
    headers: {
      "X-RateLimit-Limit": String(maxRequests),
      "X-RateLimit-Remaining": String(result.remaining),
      "X-RateLimit-Reset": String(result.resetTime),
    } as Record<string, string>,
  };
}

export async function requireUser(
  context: APIContext
): Promise<{ user: AuthUser; supabase: ReturnType<typeof createSupabaseServerClient> } | Response> {
  if (!isSupabaseConfigured()) {
    return jsonResponse({ error: "Auth is not configured" }, 503);
  }

  const rate = applyRateLimit(context.request);
  if (!rate.allowed) {
    return jsonResponse(
      { error: "Too many requests. Please try again later." },
      429,
      {
        ...rate.headers,
        "Retry-After": String(Math.ceil((rate.resetTime - Date.now()) / 1000)),
      }
    );
  }

  const supabase = createSupabaseServerClient(context);
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) {
    return jsonResponse({ error: "Unauthorized" }, 401, rate.headers);
  }

  const user: AuthUser = {
    id: data.claims.sub as string,
    email: (data.claims.email as string | undefined) ?? null,
    display_name:
      (data.claims.user_metadata as { display_name?: string } | undefined)
        ?.display_name ?? null,
  };

  return { user, supabase };
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function optionalNumber(
  value: unknown,
  min: number,
  max: number
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }
  if (!isFiniteNumber(value) || value < min || value > max) {
    return { ok: false, error: `Value out of range (${min}-${max})` };
  }
  return { ok: true, value };
}

export function requireNumber(
  value: unknown,
  field: string,
  min: number,
  max: number
): { ok: true; value: number } | { ok: false; error: string } {
  if (!isFiniteNumber(value) || value < min || value > max) {
    return {
      ok: false,
      error: `Invalid value for ${field}: must be a number between ${min} and ${max}`,
    };
  }
  return { ok: true, value };
}

export { parseClickValue } from "./clickValue";
