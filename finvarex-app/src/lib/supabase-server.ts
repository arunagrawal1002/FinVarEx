import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client.
 *
 * IMPORTANT: this uses the service role key, which bypasses Row Level
 * Security entirely. It must never be imported into a Client Component
 * or exposed to the browser. All 7 tables have RLS enabled with zero
 * anon/authenticated policies (see supabase/migrations/), so the anon
 * key cannot read or write anything -- every DB access in this app goes
 * through Server Components / Server Actions using this client instead.
 */
function assertServer() {
  if (typeof window !== "undefined") {
    throw new Error(
      "supabase-server.ts was imported into client code. This module uses " +
        "the service role key and must only run on the server."
    );
  }
}

let cachedClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseServerClient() {
  assertServer();

  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. " +
        "Set them in .env.local (see .env.example)."
    );
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  return cachedClient;
}
