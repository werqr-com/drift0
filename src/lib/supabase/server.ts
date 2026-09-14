import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { APIContext, AstroCookieSetOptions } from "astro";

type CookieContext = {
  request: Request;
  cookies: {
    set: (name: string, value: string, options?: AstroCookieSetOptions) => void;
  };
  locals?: {
    runtime?: {
      env?: Record<string, unknown>;
    };
  };
};

function readEnvValue(
  name: string,
  runtimeEnv?: Record<string, unknown>
): string | undefined {
  const fromMeta = (import.meta.env as Record<string, string | undefined>)[name];
  if (fromMeta) return fromMeta;

  const fromRuntime = runtimeEnv?.[name];
  if (typeof fromRuntime === "string" && fromRuntime.length > 0) {
    return fromRuntime;
  }

  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process;
  const fromProcess = proc?.env?.[name];
  if (fromProcess) return fromProcess;

  return undefined;
}

function getRuntimeEnv(
  context?: CookieContext | APIContext
): Record<string, unknown> | undefined {
  return (context as CookieContext | undefined)?.locals?.runtime?.env;
}

function getSupabaseEnv(context?: CookieContext | APIContext) {
  const runtimeEnv = getRuntimeEnv(context);
  const url = readEnvValue("PUBLIC_SUPABASE_URL", runtimeEnv);
  const key = readEnvValue("PUBLIC_SUPABASE_PUBLISHABLE_KEY", runtimeEnv);

  if (!url || !key) {
    throw new Error(
      "Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
  }

  return { url, key };
}

export function createSupabaseServerClient(context: CookieContext | APIContext) {
  const { url, key } = getSupabaseEnv(context);

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return parseCookieHeader(context.request.headers.get("Cookie") ?? "");
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          context.cookies.set(name, value, options as AstroCookieSetOptions);
        });
      },
    },
  });
}

export function isSupabaseConfigured(
  context?: CookieContext | APIContext
): boolean {
  const runtimeEnv = getRuntimeEnv(context);
  return Boolean(
    readEnvValue("PUBLIC_SUPABASE_URL", runtimeEnv) &&
      readEnvValue("PUBLIC_SUPABASE_PUBLISHABLE_KEY", runtimeEnv)
  );
}
