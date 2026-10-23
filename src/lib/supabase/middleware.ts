import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  GYM_JOIN_COOKIE,
  INTENT_COOKIE_MAX_AGE,
  JOIN_COOKIE,
  SIGNUP_COOKIE,
  gymJoinCodeOf,
  isSignupRole,
  joinCodeOf,
  pendingRedirect,
  setupPathFor,
} from "@/lib/trainerInvites";

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
    pathname.startsWith("/reset-password") ||
    // Readable before signing up.
    pathname === "/privacy";
  // Trainer and gym setup are those accounts' onboarding, so they're open before regular onboarding.
  const isOnboardingRoute = pathname.startsWith("/onboarding") || pathname === "/trainer/setup" || pathname === "/gym/setup";
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
  const gymJoinCode = gymJoinCodeOf(pathname);
  const intentCookie = {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: request.nextUrl.protocol === "https:",
    maxAge: INTENT_COOKIE_MAX_AGE,
  };
  const signupRole = request.nextUrl.searchParams.get("role");
  if (pathname.startsWith("/login") && isSignupRole(signupRole)) {
    supabaseResponse.cookies.set(SIGNUP_COOKIE, signupRole, intentCookie);
  }

  if (!userId && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // A gym's trainer link carries ?role=trainer through to sign-up.
    if (joinCode) url.search = "?invite=1";
    if (gymJoinCode) url.search = signupRole === "trainer" ? "?invite=gym&role=trainer" : "?invite=gym";
    const response = NextResponse.redirect(url);
    if (joinCode) response.cookies.set(JOIN_COOKIE, joinCode, intentCookie);
    if (gymJoinCode) response.cookies.set(GYM_JOIN_COOKIE, gymJoinCode, intentCookie);
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
      const role = request.cookies.get(SIGNUP_COOKIE)?.value;
      url.pathname = isSignupRole(role) ? setupPathFor(role) : "/onboarding";
      const response = NextResponse.redirect(url);
      if (joinCode) response.cookies.set(JOIN_COOKIE, joinCode, intentCookie);
      if (gymJoinCode) response.cookies.set(GYM_JOIN_COOKIE, gymJoinCode, intentCookie);
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
    const target = pendingRedirect({
      pathname,
      joinCookie: request.cookies.get(JOIN_COOKIE)?.value,
      gymJoinCookie: request.cookies.get(GYM_JOIN_COOKIE)?.value,
      signupCookie: request.cookies.get(SIGNUP_COOKIE)?.value,
    });
    if (target) {
      const url = request.nextUrl.clone();
      url.pathname = target;
      url.search = "";
      const response = NextResponse.redirect(url);
      supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
      // They're onboarded by now, so a sign-up role has done its job too (trainer setup, for a
      // trainer link, is offered on the join page when they need it).
      if (target.startsWith("/join/")) response.cookies.delete(JOIN_COOKIE);
      if (target.startsWith("/g/")) response.cookies.delete(GYM_JOIN_COOKIE);
      response.cookies.delete(SIGNUP_COOKIE);
      return response;
    }
  }

  return supabaseResponse;
}
