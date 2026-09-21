import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The real userDate is used here (not stubbed): these tests prove the queries' date windows come
// from the person's timezone, including the two AI-plan summaries that used to slice a UTC date.

type Call = [string, ...unknown[]];
let timeZone: string | null = "Asia/Kolkata";
let calls: Record<string, Call[]> = {};

function builder(table: string) {
  const record = (name: string) => (...args: unknown[]) => {
    (calls[table] ??= []).push([name, ...args]);
    return chain;
  };
  const chain: Record<string, unknown> = {
    select: record("select"),
    eq: record("eq"),
    gte: record("gte"),
    lte: record("lte"),
    order: record("order"),
    maybeSingle: async () => ({ data: { timezone: timeZone }, error: null }),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
  };
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from: (table: string) => builder(table),
  }),
}));

const { getRecentTrainingSummary, getTrainingConsistency, getUpcomingScheduleSummary } = await import("./queries");

// 01:30 on Sep 21 in India — the exact moment a UTC server still says Sep 20.
const NOW = new Date("2026-09-20T20:00:00Z");

const argsOf = (table: string, name: string) => (calls[table] ?? []).filter((c) => c[0] === name).map((c) => c.slice(1));

beforeEach(() => {
  timeZone = "Asia/Kolkata";
  calls = {};
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("query date windows follow the person's timezone", () => {
  it("getRecentTrainingSummary counts back from the person's today (Sep 21), not the UTC date", async () => {
    await getRecentTrainingSummary(14);
    expect(argsOf("workout_logs", "gte")).toEqual([["date", "2026-09-07"]]);
  });

  it("getUpcomingScheduleSummary starts at the person's today and looks ahead from it", async () => {
    await getUpcomingScheduleSummary(7);
    expect(argsOf("workout_plans", "gte")).toEqual([["date", "2026-09-21"]]);
    expect(argsOf("workout_plans", "lte")).toEqual([["date", "2026-09-28"]]);
  });

  it("getTrainingConsistency bounds the window at the person's today", async () => {
    await getTrainingConsistency(7);
    expect(argsOf("workout_logs", "lte")).toEqual([["date", "2026-09-21"]]);
    expect(argsOf("workout_logs", "gte")).toEqual([["date", "2026-09-15"]]);
  });

  it("the same instant is an earlier day for someone west of UTC", async () => {
    timeZone = "America/New_York";
    await getTrainingConsistency(7);
    expect(argsOf("workout_logs", "lte")).toEqual([["date", "2026-09-20"]]);
    expect(argsOf("workout_logs", "gte")).toEqual([["date", "2026-09-14"]]);
  });
});
