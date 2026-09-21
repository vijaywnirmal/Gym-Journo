import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let user: { id: string } | null = { id: "user-1" };
let profileResult: { data: unknown; error: unknown } = { data: { timezone: "Asia/Kolkata" }, error: null };
let throwOnClient = false;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    if (throwOnClient) throw new Error("boom");
    return {
      auth: { getUser: async () => ({ data: { user } }) },
      from: (table: string) => {
        if (table !== "profiles") throw new Error(`unexpected table ${table}`);
        const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => profileResult };
        return chain;
      },
    };
  },
}));

const { getToday, getUserTimeZone } = await import("./userDate");

// 01:30 on Sep 21 in India; still Sep 20 in UTC.
const NOW = new Date("2026-09-20T20:00:00Z");

beforeEach(() => {
  user = { id: "user-1" };
  profileResult = { data: { timezone: "Asia/Kolkata" }, error: null };
  throwOnClient = false;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("getUserTimeZone", () => {
  it("returns the stored timezone for a signed-in person", async () => {
    expect(await getUserTimeZone()).toEqual({ signedIn: true, timeZone: "Asia/Kolkata" });
  });

  it("is signed out when there is no user", async () => {
    user = null;
    expect(await getUserTimeZone()).toEqual({ signedIn: false, timeZone: null });
  });

  it("has no timezone yet when none is stored", async () => {
    profileResult = { data: { timezone: null }, error: null };
    expect(await getUserTimeZone()).toEqual({ signedIn: true, timeZone: null });
    profileResult = { data: null, error: null };
    expect(await getUserTimeZone()).toEqual({ signedIn: true, timeZone: null });
  });

  it("ignores a stored value that isn't a real timezone", async () => {
    profileResult = { data: { timezone: "Mars/Olympus_Mons" }, error: null };
    expect(await getUserTimeZone()).toEqual({ signedIn: true, timeZone: null });
  });

  it("survives the lookup failing (e.g. the column isn't migrated yet)", async () => {
    profileResult = { data: null, error: { message: 'column "timezone" does not exist' } };
    expect(await getUserTimeZone()).toEqual({ signedIn: true, timeZone: null });
  });

  it("survives the client failing to even start", async () => {
    throwOnClient = true;
    expect(await getUserTimeZone()).toEqual({ signedIn: false, timeZone: null });
  });
});

describe("getToday", () => {
  it("is the date in the person's timezone, not the server's", async () => {
    expect(await getToday()).toBe("2026-09-21");
    profileResult = { data: { timezone: "America/New_York" }, error: null };
    expect(await getToday()).toBe("2026-09-20");
  });

  it("falls back to the server's local date when no timezone is known", async () => {
    profileResult = { data: { timezone: null }, error: null };
    const local = await getToday();
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    user = null;
    expect(await getToday()).toBe(local);
  });
});
