import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const deleteCookie = vi.fn();
let gymJoinCookie: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({ delete: deleteCookie, get: (name: string) => (name === "gj-gym-join" && gymJoinCookie ? { value: gymJoinCookie } : undefined) }),
}));
const profileUpsert = vi.fn(async () => ({ error: null }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from: () => ({ upsert: profileUpsert }),
  }),
}));

const { saveAdminProfile } = await import("./actions");

describe("saveAdminProfile", () => {
  beforeEach(() => {
    gymJoinCookie = undefined;
    profileUpsert.mockClear();
    deleteCookie.mockClear();
  });

  it("asks for a name and the age check", async () => {
    expect((await saveAdminProfile({ name: " ", confirmedAdult: true })).error).toBe("Enter your name.");
    expect((await saveAdminProfile({ name: "Deepa", confirmedAdult: false })).error).toMatch(/18 or older/);
    expect(profileUpsert).not.toHaveBeenCalled();
  });

  it("finishes onboarding and goes back to the gym's link", async () => {
    gymJoinCookie = "abcdefgh23";
    expect(await saveAdminProfile({ name: " Deepa  Rao ", confirmedAdult: true })).toEqual({ success: true, next: "/g/abcdefgh23" });
    expect(profileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-1", first_name: "Deepa", last_name: "Rao", full_name: "Deepa Rao", onboarded: true })
    );
    expect(deleteCookie).toHaveBeenCalledWith("gj-signup");
    expect(deleteCookie).toHaveBeenCalledWith("gj-gym-join");
    gymJoinCookie = undefined;
    expect(await saveAdminProfile({ name: "Deepa", confirmedAdult: true })).toEqual({ success: true, next: "/" });
  });
});
