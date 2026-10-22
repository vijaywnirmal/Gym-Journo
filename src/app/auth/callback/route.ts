import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/validation";

// Where every auth email lands: sign-up confirmation, magic link and password reset.
// - `token_hash` + `type` (the links in supabase/templates) are verified on their own, so they work
//   in whatever browser opens them: a phone's mail app, or a different device from the one that asked.
// - `code` (Supabase's default links) needs the PKCE verifier cookie set when the email was requested,
//   so it only works in that same browser. Kept for links sent before the templates changed.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"), "/");

  const supabase = await createClient();
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=invalid_link`);
}
