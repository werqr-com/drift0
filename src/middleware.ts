import { defineMiddleware } from "astro:middleware";
import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "./lib/supabase/server";

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;

  if (isSupabaseConfigured(context)) {
    try {
      const supabase = createSupabaseServerClient(context);
      const { data } = await supabase.auth.getClaims();
      if (data?.claims?.sub) {
        context.locals.user = {
          id: data.claims.sub as string,
          email: (data.claims.email as string | undefined) ?? null,
          display_name:
            (
              data.claims.user_metadata as
                | { display_name?: string }
                | undefined
            )?.display_name ?? null,
        };
      }
    } catch (err) {
      console.error("Auth middleware error:", err);
    }
  }

  const path = context.url.pathname;
  if (
    path.startsWith("/account/") &&
    path !== "/account/reset-password" &&
    !context.locals.user
  ) {
    return context.redirect("/login");
  }

  const response = await next();
  const newResponse = new Response(response.body, response);

  const securityHeaders = {
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' seo.werqr.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-XSS-Protection": "1; mode=block",
    "Permissions-Policy": [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "interest-cohort=()",
      "payment=()",
      "usb=()",
    ].join(", "),
  };

  Object.entries(securityHeaders).forEach(([key, value]) => {
    newResponse.headers.set(key, value);
  });

  const origin = context.request.headers.get("origin");
  const allowedOrigins = [
    "http://localhost:8080",
    "https://drift0.werqr.com",
  ];

  if (origin && allowedOrigins.includes(origin)) {
    newResponse.headers.set("Access-Control-Allow-Origin", origin);
    newResponse.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    );
    newResponse.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type"
    );
    newResponse.headers.set("Access-Control-Allow-Credentials", "true");
    newResponse.headers.set("Access-Control-Max-Age", "86400");
  }

  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: newResponse.headers,
    });
  }

  return newResponse;
});
