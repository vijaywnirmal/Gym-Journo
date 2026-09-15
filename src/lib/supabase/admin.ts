import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// NOTE: no `server-only` guard package is added here to avoid an extra
// dependency. This module must only ever be imported from a "use server"
// Server Action file — never from a Client Component.

/**
 * Service-role Supabase client. Bypasses RLS entirely — use only for operations
 * that genuinely require admin privileges (currently: account deletion via
 * `auth.admin.deleteUser`). Never import this from a Client Component or expose
 * `SUPABASE_SERVICE_ROLE_KEY` as a `NEXT_PUBLIC_*` variable.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL) must be set to perform admin operations."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
