import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client for administrative operations (e.g. deleting an Auth user).
// Must NEVER be imported from client components or exposed to the browser.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
