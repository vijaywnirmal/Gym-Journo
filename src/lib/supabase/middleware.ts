import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Set once this browser's signed-in person is known to be onboarded, holding their user id, so the
// proxy doesn't query the profile on every request (each query was a round trip to the database,
// prefetches included). Only ever skips the onboarding redirect for that same user.
const ONBOARDED_COOKIE = "gj-onboarded";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims verifies the session token locally against the project's published signing keys
  // (refreshing an expiring session first), instead of a round trip to Supabase Auth per request.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;

  const pathname = request.nextUrl.pathname;
  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password");
  const isOnboardingRoute = pathname.startsWith("/onboarding");
  // JSON endpoints answer for themselves: a signed-out fetch gets a 401 rather than the login page's
  // HTML, and onboarding (a page flow) doesn't apply.
  const isApiRoute = pathname.startsWith("/api/");
  // Scheduled jobs are called by the scheduler, not a person, and check their own secret.
  if (pathname.startsWith("/api/cron/")) return supabaseResponse;

  if (!userId && isApiRoute) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  if (!userId && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (userId && !isAuthRoute && !isOnboardingRoute && !isApiRoute && request.cookies.get(ONBOARDED_COOKIE)?.value !== userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarded")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.onboarded) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }
    supabaseResponse.cookies.set(ONBOARDED_COOKIE, userId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return supabaseResponse;
}
