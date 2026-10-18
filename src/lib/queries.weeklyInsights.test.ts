import { describe, expect, it, vi, beforeEach } from "vitest";
import { shiftDate, today, weekDates } from "./date";

const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } });

type QueryResult = { data: unknown; error: unknown };

// getWeeklyInsights runs several queries in parallel, so table results are routed by table and RPC
// results by function name and arguments rather than by call order.
let resultFor: (table: string) => QueryResult = () => ({ data: [], error: null });
let rpcFor: (fn: string, args: Record<string, string | null>) => QueryResult = () => ({ data: [], error: null });
const rpcCalls: [string, Record<string, string | null>][] = [];

function makeBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  for (const name of ["eq", "gte", "lte", "lt", "order", "limit", "in"]) builder[name] = () => builder;
  builder.then = (resolve: (v: QueryResult) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

const from = vi.fn((table: string) => ({ select: () => makeBuilder(resultFor(table)) }));
const rpc = vi.fn((fn: string, args: Record<string, string | null>) => {
  rpcCalls.push([fn, args]);
  return makeBuilder(rpcFor(fn, args));
});

vi.mock("@/lib/userDate", async () => {
  const { today } = await import("./date");
  return { getToday: async () => today(), getUserTimeZone: async () => ({ signedIn: true, timeZone: null }) };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from, rpc }),
}));

const { getWeeklyInsights } = await import("./queries");

const todayStr = today();
const thisWeekStart = weekDates(todayStr)[0];
const lastWeekStart = shiftDate(thisWeekStart, -7);

const chestRow = (sets: number) => ({ muscle_group_id: "c", name: "Chest", sets });

describe("getWeeklyInsights", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpcCalls.length = 0;
    resultFor = () => ({ data: [], error: null });
    rpcFor = () => ({ data: [], error: null });
  });

  it("asks the database for this week's and last week's hard sets and maps the rows", async () => {
    resultFor = (table) => (table === "workout_plans" ? { data: [{ date: todayStr }], error: null } : { data: [], error: null });
    rpcFor = (fn, args) => {
      if (fn === "performed_workout_dates") return { data: [{ date: todayStr }], error: null };
      return args.p_from === thisWeekStart
        ? { data: [chestRow(4), { muscle_group_id: "b", name: "Back", sets: 6 }], error: null }
        : { data: [chestRow(2)], error: null };
    };

    const insights = await getWeeklyInsights();
    const setCalls = rpcCalls.filter(([fn]) => fn === "muscle_set_counts").map(([, args]) => args);
    expect(setCalls).toEqual([
      { p_from: thisWeekStart, p_to: todayStr },
      { p_from: lastWeekStart, p_to: shiftDate(thisWeekStart, -1) },
    ]);
    expect(insights?.thisWeek).toEqual([
      { muscleGroupId: "b", name: "Back", sets: 6 },
      { muscleGroupId: "c", name: "Chest", sets: 4 },
    ]);
    expect(insights?.lastWeek).toEqual([{ muscleGroupId: "c", name: "Chest", sets: 2 }]);
    expect(insights?.adherence).toEqual({ planned: 1, performed: 1 });
  });

  it("is null when the set counts can't be read", async () => {
    rpcFor = (fn) => (fn === "muscle_set_counts" ? { data: null, error: { message: "boom" } } : { data: [], error: null });
    expect(await getWeeklyInsights()).toBeNull();
  });

  it("is null when the workout days can't be read", async () => {
    rpcFor = (fn) => (fn === "performed_workout_dates" ? { data: null, error: { message: "boom" } } : { data: [], error: null });
    expect(await getWeeklyInsights()).toBeNull();
  });

  it("is null when signed out", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await getWeeklyInsights()).toBeNull();
  });

  it("has no adherence when the plans query fails", async () => {
    resultFor = (table) =>
      table === "workout_plans" ? { data: null, error: { message: "boom" } } : { data: [], error: null };
    const insights = await getWeeklyInsights();
    expect(insights?.adherence).toBeNull();
    expect(insights?.thisWeek).toEqual([]);
  });
});
