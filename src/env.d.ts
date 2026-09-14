/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Env {
  PUBLIC_SUPABASE_URL: string;
  PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
  ASSETS: Fetcher;
}

declare namespace App {
  interface Locals {
    user: {
      id: string;
      email: string | null;
      display_name: string | null;
    } | null;
    runtime?: {
      env: Env;
    };
  }
}
