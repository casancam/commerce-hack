import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
}

export function supabaseKey() {
  return (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  );
}

export function supabaseConfigured() {
  return Boolean(supabaseUrl() && supabaseKey());
}

let cached: SupabaseClient | null = null;

export function getSupabase() {
  if (!supabaseConfigured()) return null;
  if (!cached) cached = createClient(supabaseUrl(), supabaseKey());
  return cached;
}
