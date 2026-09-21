import { beforeEach, describe, expect, it, vi } from "vitest";

let user: { id: string } | null = { id: "user-1" };
let updateResult: { data: { id: string }[] | null; error: unknown } = { data: [{ id: "user-1" }], error: null };
const update = vi.fn();
const eq = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
    from: (table: string) => {
      expect(table).toBe("profiles");
      const chain = {
        update: (values: unknown) => {
          update(values);
          return chain;
        },
        eq: (...args: unknown[]) => {
          eq(...args);
          return chain;
        },
        select: async () => updateResult,
      };
      return chain;
    },
  }),
}));

const { syncTimezone } = await import("./actions");

beforeEach(() => {
  user = { id: "user-1" };
  updateResult = { data: [{ id: "user-1" }], error: null };
  update.mockClear();
  eq.mockClear();
});

describe("syncTimezone", () => {
  it("stores the timezone on the signed-in person's own profile", async () => {
    expect(await syncTimezone("Asia/Kolkata")).toEqual({ outcome: "updated" });
    expect(update).toHaveBeenCalledWith({ timezone: "Asia/Kolkata" });
    expect(eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("refuses something that isn't a timezone, without touching the database", async () => {
    expect(await syncTimezone("Mars/Olympus_Mons")).toEqual({ outcome: "failed" });
    expect(await syncTimezone("")).toEqual({ outcome: "failed" });
    expect(update).not.toHaveBeenCalled();
  });

  it("does nothing when signed out", async () => {
    user = null;
    expect(await syncTimezone("Asia/Kolkata")).toEqual({ outcome: "no_profile" });
    expect(update).not.toHaveBeenCalled();
  });

  it("reports no_profile when the profile row doesn't exist yet", async () => {
    updateResult = { data: [], error: null };
    expect(await syncTimezone("Asia/Kolkata")).toEqual({ outcome: "no_profile" });
  });

  it("reports failed on a database error (e.g. column not migrated), never throwing", async () => {
    updateResult = { data: null, error: { message: 'column "timezone" does not exist' } };
    expect(await syncTimezone("Asia/Kolkata")).toEqual({ outcome: "failed" });
  });
});
