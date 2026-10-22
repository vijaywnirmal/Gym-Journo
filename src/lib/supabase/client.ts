import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // Secure over HTTPS. (The session cookie stays readable by JavaScript: this browser client reads it.)
    { cookieOptions: { secure: typeof location !== "undefined" && location.protocol === "https:" } }
  );
}
