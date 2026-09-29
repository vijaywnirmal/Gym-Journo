import { createClient } from "@/lib/supabase/server";

// Helpers for the app's JSON route handlers (app/api). Every endpoint is private to the signed-in
// person: responses are never stored by shared caches.

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export function jsonResponse(body: unknown, init: { status?: number; cacheControl?: string } = {}): Response {
  return Response.json(body, {
    status: init.status ?? 200,
    headers: { "Cache-Control": init.cacheControl ?? "private, no-store" },
  });
}

export function jsonError(status: number, message: string): Response {
  return jsonResponse({ error: message }, { status });
}

// The request's Supabase client and user, or null when nobody is signed in.
export async function signedInClient(): Promise<{ supabase: SupabaseClient; userId: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, userId: user.id } : null;
}

// Search params as a plain object for schema parsing (repeated keys keep the last value).
export function queryObject(request: Request): Record<string, string> {
  return Object.fromEntries(new URL(request.url).searchParams);
}
