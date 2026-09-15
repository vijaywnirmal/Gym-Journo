/**
 * Pure routing-decision logic for the auth/session middleware, kept separate from
 * `src/lib/supabase/middleware.ts` so redirect/loop behavior is unit-testable
 * without a live Supabase call.
 */

// Routes reachable without a session. A signed-in, onboarded user is bounced
// away from these (to "/") except where noted.
const PUBLIC_ONLY_PREFIXES = ["/login", "/register", "/forgot-password"];

// Routes that never redirect based on auth/onboarding state: the callback is
// mid-flow (code exchange in progress), and reset-password relies on the
// short-lived "recovery" session created by clicking the email link, which
// must not be treated as a normal signed-in session.
const NEUTRAL_PREFIXES = ["/auth", "/reset-password"];

// Onboarding itself is reachable once signed in, regardless of onboarded state.
const ONBOARDING_PREFIX = "/onboarding";

export type RouteGuardInput = {
  pathname: string;
  search: string;
  isAuthenticated: boolean;
  isOnboarded: boolean;
};

/** Returns the path+query to redirect to, or null to let the request through. */
export function resolveRedirect({
  pathname,
  search,
  isAuthenticated,
  isOnboarded,
}: RouteGuardInput): string | null {
  if (NEUTRAL_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const isPublicOnly = PUBLIC_ONLY_PREFIXES.some((p) => pathname.startsWith(p));
  const isOnboardingRoute = pathname.startsWith(ONBOARDING_PREFIX);

  if (!isAuthenticated) {
    if (isPublicOnly) return null;
    const next = encodeURIComponent(`${pathname}${search}`);
    return `/login?next=${next}`;
  }

  // Authenticated from here on.
  if (isPublicOnly) {
    return isOnboarded ? "/" : "/onboarding";
  }

  if (!isOnboarded && !isOnboardingRoute) {
    return "/onboarding";
  }

  if (isOnboarded && isOnboardingRoute) {
    return "/";
  }

  return null;
}

/** Validates a post-login `next` target so it can't be used as an open redirect. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}
