import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { APIContext, AstroCookieSetOptions } from "astro";

type CookieContext = {
  request: Request;
  cookies: {
    set: (name: string, value: string, options?: AstroCookieSetOptions) => void;
  };
};

function getSupabaseEnv() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
  }

  return { url, key };
}

export function createSupabaseServerClient(context: CookieContext | APIContext) {
  const { url, key } = getSupabaseEnv();

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

export function isSupabaseConfigured(): boolean {
  return Boolean(
    import.meta.env.PUBLIC_SUPABASE_URL &&
      import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}
