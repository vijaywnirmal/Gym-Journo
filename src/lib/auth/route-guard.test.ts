import { describe, expect, it } from "vitest";
import { resolveRedirect, safeNextPath } from "./route-guard";

describe("resolveRedirect", () => {
  it("sends unauthenticated users hitting a protected route to /login with a next param", () => {
    expect(
      resolveRedirect({
        pathname: "/calendar",
        search: "?week=2026-01-01",
        isAuthenticated: false,
        isOnboarded: false,
      })
    ).toBe(`/login?next=${encodeURIComponent("/calendar?week=2026-01-01")}`);
  });

  it("lets unauthenticated users reach public-only routes", () => {
    for (const pathname of ["/login", "/register", "/forgot-password"]) {
      expect(
        resolveRedirect({ pathname, search: "", isAuthenticated: false, isOnboarded: false })
      ).toBeNull();
    }
  });

  it("never redirects on neutral routes regardless of auth state (no redirect loop)", () => {
    for (const pathname of ["/auth/callback", "/reset-password"]) {
      expect(
        resolveRedirect({ pathname, search: "", isAuthenticated: false, isOnboarded: false })
      ).toBeNull();
      expect(
        resolveRedirect({ pathname, search: "", isAuthenticated: true, isOnboarded: true })
      ).toBeNull();
    }
  });

  it("sends authenticated-but-not-onboarded users to /onboarding", () => {
    expect(
      resolveRedirect({ pathname: "/", search: "", isAuthenticated: true, isOnboarded: false })
    ).toBe("/onboarding");
  });

  it("sends authenticated + onboarded users away from onboarding", () => {
    expect(
      resolveRedirect({
        pathname: "/onboarding",
        search: "",
        isAuthenticated: true,
        isOnboarded: true,
      })
    ).toBe("/");
  });

  it("lets authenticated + not-onboarded users stay on /onboarding", () => {
    expect(
      resolveRedirect({
        pathname: "/onboarding",
        search: "",
        isAuthenticated: true,
        isOnboarded: false,
      })
    ).toBeNull();
  });

  it("bounces signed-in users away from public-only auth pages", () => {
    expect(
      resolveRedirect({ pathname: "/login", search: "", isAuthenticated: true, isOnboarded: true })
    ).toBe("/");
    expect(
      resolveRedirect({
        pathname: "/register",
        search: "",
        isAuthenticated: true,
        isOnboarded: false,
      })
    ).toBe("/onboarding");
  });

  it("lets authenticated + onboarded users through to protected routes", () => {
    expect(
      resolveRedirect({
        pathname: "/history",
        search: "",
        isAuthenticated: true,
        isOnboarded: true,
      })
    ).toBeNull();
  });
});

describe("safeNextPath", () => {
  it("defaults to / when missing", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
  });

  it("rejects protocol-relative and absolute URLs (open-redirect prevention)", () => {
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
  });

  it("keeps a valid same-origin path", () => {
    expect(safeNextPath("/calendar?week=2026-01-01")).toBe("/calendar?week=2026-01-01");
  });
});
