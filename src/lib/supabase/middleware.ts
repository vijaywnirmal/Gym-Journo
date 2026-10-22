import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { INTENT_COOKIE_MAX_AGE, JOIN_COOKIE, SIGNUP_COOKIE, joinCodeOf, pendingRedirect } from "@/lib/trainerInvites";

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
      // Secure in production (always HTTPS); local `next dev` runs over plain http.
      cookieOptions: { secure: process.env.NODE_ENV === "production" },
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
  // Trainer setup is a trainer's onboarding, so it's open before regular onboarding is done.
  const isOnboardingRoute = pathname.startsWith("/onboarding") || pathname === "/trainer/setup";
  // JSON endpoints answer for themselves: a signed-out fetch gets a 401 rather than the login page's
  // HTML, and onboarding (a page flow) doesn't apply.
  const isApiRoute = pathname.startsWith("/api/");
  // Scheduled jobs are called by the scheduler, not a person, and check their own secret.
  if (pathname.startsWith("/api/cron/")) return supabaseResponse;

  if (!userId && isApiRoute) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  // An invite opened before signing in, or "I'm a trainer" on the login page, is remembered through
  // sign-up, email confirmation and onboarding (see pendingRedirect).
  const joinCode = joinCodeOf(pathname);
  const intentCookie = {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: request.nextUrl.protocol === "https:",
    maxAge: INTENT_COOKIE_MAX_AGE,
  };
  if (pathname.startsWith("/login") && request.nextUrl.searchParams.get("role") === "trainer") {
    supabaseResponse.cookies.set(SIGNUP_COOKIE, "trainer", intentCookie);
  }

  if (!userId && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (joinCode) url.search = "?invite=1";
    const response = NextResponse.redirect(url);
    if (joinCode) response.cookies.set(JOIN_COOKIE, joinCode, intentCookie);
    return response;
  }

  if (userId && !isAuthRoute && !isOnboardingRoute && !isApiRoute && request.cookies.get(ONBOARDED_COOKIE)?.value !== userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarded")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.onboarded) {
      const url = request.nextUrl.clone();
      url.pathname = request.cookies.get(SIGNUP_COOKIE)?.value === "trainer" ? "/trainer/setup" : "/onboarding";
      const response = NextResponse.redirect(url);
      if (joinCode) response.cookies.set(JOIN_COOKIE, joinCode, intentCookie);
      return response;
    }
    supabaseResponse.cookies.set(ONBOARDED_COOKIE, userId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  if (userId && !isApiRoute) {
    const joinCookie = request.cookies.get(JOIN_COOKIE)?.value;
    const target = pendingRedirect({ pathname, joinCookie, signupCookie: request.cookies.get(SIGNUP_COOKIE)?.value });
    if (target) {
      const url = request.nextUrl.clone();
      url.pathname = target;
      url.search = "";
      const response = NextResponse.redirect(url);
      supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
      response.cookies.delete(target.startsWith("/join/") ? JOIN_COOKIE : SIGNUP_COOKIE);
      return response;
    }
  }

  return supabaseResponse;
}
