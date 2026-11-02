import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const signOut = vi.fn().mockResolvedValue({ error: null });
const profileUpdate = vi.fn();
const pushDelete = vi.fn().mockResolvedValue({ error: null });
const from = vi.fn((table: string) =>
  table === "profiles"
    ? { update: (values: unknown) => ({ eq: () => profileUpdate(values) }) }
    : { delete: () => ({ eq: pushDelete }) }
);
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser, signOut }, from }),
}));

const deleteCookie = vi.fn();
vi.mock("next/headers", () => ({ cookies: async () => ({ delete: deleteCookie }) }));
const redirect = vi.fn();
vi.mock("next/navigation", () => ({ redirect: (path: string) => redirect(path) }));

const { disableAccount, reactivateAccount } = await import("./accountActions");

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  profileUpdate.mockResolvedValue({ error: null });
});

describe("disableAccount", () => {
  it("marks the account disabled, stops notifications and signs out everywhere", async () => {
    expect(await disableAccount()).toEqual({ success: true });
    expect(profileUpdate).toHaveBeenCalledWith(expect.objectContaining({ disabled_at: expect.any(String), workout_reminders: false }));
    expect(pushDelete).toHaveBeenCalledWith("user_id", "user-1");
    expect(deleteCookie).toHaveBeenCalledWith("gj-onboarded");
    expect(signOut).toHaveBeenCalledWith({ scope: "global" });
  });

  it("requires a signed-in person", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await disableAccount()).toEqual({ error: "Not signed in" });
    expect(profileUpdate).not.toHaveBeenCalled();
  });

  it("stays signed in with a message if it can't be saved", async () => {
    profileUpdate.mockResolvedValue({ error: { message: "boom" } });
    expect((await disableAccount()).error).toBeTruthy();
    expect(signOut).not.toHaveBeenCalled();
    expect(pushDelete).not.toHaveBeenCalled();
  });
});

describe("reactivateAccount", () => {
  it("clears the disabled mark and goes to the app", async () => {
    await reactivateAccount();
    expect(profileUpdate).toHaveBeenCalledWith(expect.objectContaining({ disabled_at: null }));
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("reports a failure instead of going on", async () => {
    profileUpdate.mockResolvedValue({ error: { message: "boom" } });
    expect((await reactivateAccount())?.error).toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });
});
