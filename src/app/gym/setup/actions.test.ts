import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const deleteCookie = vi.fn();
vi.mock("next/headers", () => ({ cookies: async () => ({ delete: deleteCookie }) }));

let adminGym: { id: string } | null = null;
vi.mock("@/lib/gyms", () => ({ getAdminGym: async () => adminGym }));

const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } });
let onboarded = true;
let saveError: { message: string } | null = null;
const rpc = vi.fn(async () => ({ data: { id: "gym-1" }, error: saveError }));
const gymUpdate = vi.fn(() => ({ eq: async () => ({ error: saveError }) }));
const profileUpsert = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    rpc,
    from: (table: string) =>
      table === "gyms"
        ? { update: gymUpdate }
        : {
            upsert: profileUpsert,
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { onboarded } }) }) }),
          },
  }),
}));

const { saveGym } = await import("./actions");

const input = { name: "  Iron   Gym ", city: " Pune ", area: "", phone: "98765 43210", ownerName: "", confirmedAdult: false };

describe("saveGym", () => {
  beforeEach(() => {
    adminGym = null;
    onboarded = true;
    saveError = null;
    rpc.mockClear();
    gymUpdate.mockClear();
    profileUpsert.mockClear();
    deleteCookie.mockClear();
  });

  it("creates a gym with tidied details and the number in +91 form", async () => {
    expect(await saveGym(input)).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("create_gym", { p_name: "Iron Gym", p_city: "Pune", p_area: "", p_phone: "+919876543210" });
    expect(gymUpdate).not.toHaveBeenCalled();
    expect(profileUpsert).not.toHaveBeenCalled();
    expect(deleteCookie).toHaveBeenCalledWith("gj-signup");
  });

  it("updates the gym the person already runs", async () => {
    adminGym = { id: "gym-1" };
    expect(await saveGym({ ...input, phone: "" })).toEqual({ success: true });
    expect(gymUpdate).toHaveBeenCalledWith({ name: "Iron Gym", city: "Pune", area: null, phone: null });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("requires a gym name and a real number", async () => {
    expect((await saveGym({ ...input, name: " " })).error).toBe("Enter your gym's name.");
    expect((await saveGym({ ...input, phone: "12345" })).error).toMatch(/10 to 15 digits/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("for a new account, asks for a name and the age check and finishes onboarding", async () => {
    onboarded = false;
    expect((await saveGym(input)).error).toBe("Enter your name.");
    expect((await saveGym({ ...input, ownerName: "Vikram Rao" })).error).toMatch(/18 or older/);
    expect(rpc).not.toHaveBeenCalled();

    expect(await saveGym({ ...input, ownerName: " Vikram  Rao ", confirmedAdult: true })).toEqual({ success: true });
    expect(profileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-1", first_name: "Vikram", last_name: "Rao", full_name: "Vikram Rao", onboarded: true })
    );
  });

  it("returns a safe error when saving fails", async () => {
    saveError = { message: "new row violates check constraint" };
    expect((await saveGym(input)).error).toBe("Couldn't save your gym. Please try again.");
    expect(profileUpsert).not.toHaveBeenCalled();
    expect(deleteCookie).not.toHaveBeenCalled();
  });
});
