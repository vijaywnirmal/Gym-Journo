import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const deleteCookie = vi.fn();
vi.mock("next/headers", () => ({ cookies: async () => ({ delete: deleteCookie }) }));

const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } });
let onboarded = true;
let trainerError: { message: string } | null = null;
const trainerUpsert = vi.fn(async () => ({ error: trainerError }));
const profileUpsert = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: (table: string) =>
      table === "trainer_profiles"
        ? { upsert: trainerUpsert }
        : {
            upsert: profileUpsert,
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { onboarded } }) }) }),
          },
  }),
}));

const { saveTrainerProfile } = await import("./actions");

const input = { displayName: "  Ravi   Kumar ", gymName: " Iron Gym ", city: "", whatsapp: "98765 43210", confirmedAdult: false };

describe("saveTrainerProfile", () => {
  beforeEach(() => {
    onboarded = true;
    trainerError = null;
    trainerUpsert.mockClear();
    profileUpsert.mockClear();
    deleteCookie.mockClear();
  });

  it("saves tidied details with the number in +91 form", async () => {
    expect(await saveTrainerProfile(input)).toEqual({ success: true });
    expect(trainerUpsert).toHaveBeenCalledWith({
      user_id: "user-1",
      display_name: "Ravi Kumar",
      gym_name: "Iron Gym",
      city: null,
      whatsapp: "+919876543210",
    });
    expect(profileUpsert).not.toHaveBeenCalled();
    expect(deleteCookie).toHaveBeenCalledWith("gj-signup");
  });

  it("requires a name and a real number", async () => {
    expect((await saveTrainerProfile({ ...input, displayName: " " })).error).toBe("Enter your name.");
    expect((await saveTrainerProfile({ ...input, whatsapp: "12345" })).error).toMatch(/10 to 15 digits/);
    expect(trainerUpsert).not.toHaveBeenCalled();
  });

  it("for a new account, asks for the age check and finishes onboarding", async () => {
    onboarded = false;
    expect((await saveTrainerProfile(input)).error).toMatch(/18 or older/);
    expect(trainerUpsert).not.toHaveBeenCalled();

    expect(await saveTrainerProfile({ ...input, confirmedAdult: true })).toEqual({ success: true });
    expect(profileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-1", first_name: "Ravi", last_name: "Kumar", full_name: "Ravi Kumar", onboarded: true })
    );
  });

  it("returns a safe error when saving fails", async () => {
    trainerError = { message: "permission denied for table trainer_profiles" };
    const result = await saveTrainerProfile(input);
    expect(result.error).toBe("Couldn't save your trainer details. Please try again.");
    expect(deleteCookie).not.toHaveBeenCalled();
  });
});
