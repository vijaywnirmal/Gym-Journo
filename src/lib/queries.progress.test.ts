import { describe, expect, it, vi, beforeEach } from "vitest";
import { today, shiftDate, weekDates } from "./date";

const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } });

type QueryResult = { data: unknown; error: unknown };

// Table reads (plans, completion flags) and the performed_workout_dates RPC are both awaited
// directly, so each builder is thenable. Table results are queued per from().select(); RPC results
// are set with setRpcResult and every call's arguments are recorded.
function makeBuilder(result: QueryResult) {
  const calls: Record<string, unknown[][]> = { eq: [], gte: [], lte: [], lt: [], order: [], limit: [], in: [] };
  const builder: Record<string, unknown> = { calls };
  for (const name of Object.keys(calls)) {
    builder[name] = vi.fn((...args: unknown[]) => {
      calls[name].push(args);
      return builder;
    });
  }
  builder.then = (resolve: (v: QueryResult) => unknown) => Promise.resolve(result).then(resolve);
  return builder as unknown as { calls: Record<string, unknown[][]> } & PromiseLike<QueryResult>;
}

let queue: QueryResult[] = [];
let lastResult: QueryResult = { data: [], error: null };
const builders: ReturnType<typeof makeBuilder>[] = [];
let lastSelectArg = "";
function setResults(...results: QueryResult[]) {
  queue = [...results];
  builders.length = 0;
}
const select = vi.fn((arg: string) => {
  lastSelectArg = arg;
  const next = queue.shift();
  if (next) lastResult = next;
  const b = makeBuilder(lastResult);
  builders.push(b);
  return b;
});
const from = vi.fn(() => ({ select }));

let rpcResult: QueryResult = { data: [], error: null };
const rpcBuilders: ReturnType<typeof makeBuilder>[] = [];
function setRpcResult(result: QueryResult) {
  rpcResult = result;
  rpcBuilders.length = 0;
}
const rpc = vi.fn(() => {
  const b = makeBuilder(rpcResult);
  rpcBuilders.push(b);
  return b;
});
const dates = (...ds: string[]) => ({ data: ds.map((date) => ({ date })), error: null });

// These tests pin the exact queries each function sends, so the person's-today lookup (its own
// profiles query — covered in userDate.test.ts) is stubbed to the server-local today() they assert on.
vi.mock("@/lib/userDate", async () => {
  const { today } = await import("./date");
  return {
    getToday: async () => today(),
    getUserTimeZone: async () => ({ signedIn: true, timeZone: null }),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from, rpc }),
}));

const {
  getTrainingConsistency,
  getLastPerformedWorkoutDate,
  getWeekOverview,
  getWeeklyTrainingDays,
} = await import("./queries");

// Which dates count as workout days (blank sets, empty logs, future dates, completed_at ignored)
// is decided by the performed_workout_dates SQL function; supabase/tests/stats_functions.sql
// checks those rules against a real database. These tests cover what the app still owns: the
// window it asks for and what it does with the answer.

describe("getTrainingConsistency", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpc.mockClear();
    setRpcResult({ data: [], error: null });
  });

  it("asks for an inclusive N-calendar-day window ending today — 28 days is today − 27", async () => {
    await getTrainingConsistency(28);
    expect(rpc).toHaveBeenCalledWith("performed_workout_dates", { p_from: shiftDate(today(), -27), p_to: today() });
  });

  it("2. last 7 days is today − 6", async () => {
    await getTrainingConsistency(7);
    expect(rpc).toHaveBeenCalledWith("performed_workout_dates", { p_from: shiftDate(today(), -6), p_to: today() });
  });

  it("1. last 1 day is today only", async () => {
    await getTrainingConsistency(1);
    expect(rpc).toHaveBeenCalledWith("performed_workout_dates", { p_from: today(), p_to: today() });
  });

  it("counts each workout day the database returns", async () => {
    setRpcResult(dates(shiftDate(today(), -5), shiftDate(today(), -3), shiftDate(today(), -1)));
    expect(await getTrainingConsistency(28)).toEqual({ windowDays: 28, daysPerformed: 3 });
  });

  it("returns zero for a signed-out user without querying", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await getTrainingConsistency(28)).toEqual({ windowDays: 28, daysPerformed: 0 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns zero on a query error", async () => {
    setRpcResult({ data: null, error: { message: "boom" } });
    expect((await getTrainingConsistency(28)).daysPerformed).toBe(0);
  });

  it("returns zero when no workout days fall in the window", async () => {
    expect((await getTrainingConsistency(28)).daysPerformed).toBe(0);
  });
});

describe("getLastPerformedWorkoutDate", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpc.mockClear();
    setRpcResult({ data: [], error: null });
  });

  it("asks for the single newest workout day up to today, with no lower bound", async () => {
    setRpcResult(dates("2026-09-10"));
    await getLastPerformedWorkoutDate();
    expect(rpc).toHaveBeenCalledWith("performed_workout_dates", { p_from: null, p_to: today() });
    expect(rpcBuilders[0].calls.order).toEqual([["date", { ascending: false }]]);
    expect(rpcBuilders[0].calls.limit).toEqual([[1]]);
  });

  it("returns the date the database returns", async () => {
    setRpcResult(dates("2026-09-10"));
    expect(await getLastPerformedWorkoutDate()).toEqual({ date: "2026-09-10" });
  });

  it("returns null when there is no workout day at all", async () => {
    expect(await getLastPerformedWorkoutDate()).toEqual({ date: null });
  });

  it("returns null on a query error", async () => {
    setRpcResult({ data: null, error: { message: "boom" } });
    expect(await getLastPerformedWorkoutDate()).toEqual({ date: null });
  });

  it("returns null for a signed-out user without querying", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await getLastPerformedWorkoutDate()).toEqual({ date: null });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("getWeekOverview — performed and completed are separate facts", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    from.mockClear();
    rpc.mockClear();
    setRpcResult({ data: [], error: null });
  });

  const d1 = shiftDate(today(), -3);
  const d2 = shiftDate(today(), -2);
  const d3 = shiftDate(today(), -1);
  const d4 = shiftDate(today(), 2);
  const week = [d1, d2, d3, d4, today()];

  it("20. reports performed and completed independently for each day", async () => {
    setResults(
      { data: [{ date: d1, title: "Push", is_rest_day: false }], error: null },
      {
        data: [
          { date: d1, completed_at: "2026-09-01T10:00:00Z" }, // performed + completed
          { date: d2, completed_at: null }, // performed, not completed
          { date: d3, completed_at: "2026-09-02T10:00:00Z" }, // completed, nothing performed
        ],
        error: null,
      }
    );
    setRpcResult(dates(d1, d2));
    const overview = await getWeekOverview(week);
    const none = { dayType: null, markedLate: false };
    expect(overview.get(d1)).toEqual({ title: "Push", performed: true, completed: true, dayType: "workout", markedLate: false });
    expect(overview.get(d2)).toEqual({ title: null, performed: true, completed: false, ...none });
    expect(overview.get(d3)).toEqual({ title: null, performed: false, completed: true, ...none });
    expect(overview.get(today())).toEqual({ title: null, performed: false, completed: false, ...none });
  });

  it("reads rest and absence days and whether they were marked afterwards", async () => {
    setResults(
      {
        data: [
          { date: d1, title: "Flu", is_rest_day: true, off_kind: "absence", off_marked_late: true },
          { date: d2, title: null, is_rest_day: true, off_kind: "rest", off_marked_late: false },
        ],
        error: null,
      },
      { data: [], error: null }
    );
    const overview = await getWeekOverview(week);
    expect(overview.get(d1)).toMatchObject({ title: "Flu", dayType: "absence", markedLate: true });
    expect(overview.get(d2)).toMatchObject({ dayType: "rest", markedLate: false });
  });

  it("reads completion without pulling sets", async () => {
    setResults({ data: [], error: null }, { data: [], error: null });
    await getWeekOverview(week);
    expect(lastSelectArg).toBe("date, completed_at");
  });

  it("asks for workout days from the first date up to today, never past it", async () => {
    setResults({ data: [], error: null }, { data: [], error: null });
    await getWeekOverview(week);
    expect(rpc).toHaveBeenCalledWith("performed_workout_dates", { p_from: d1, p_to: today() });
  });

  it("stops at the week's last date when the whole week is in the past", async () => {
    const past = [shiftDate(today(), -10), shiftDate(today(), -9)];
    setResults({ data: [], error: null }, { data: [], error: null });
    await getWeekOverview(past);
    expect(rpc).toHaveBeenCalledWith("performed_workout_dates", { p_from: past[0], p_to: past[1] });
  });

  it("doesn't ask at all for a week entirely in the future", async () => {
    setResults({ data: [], error: null }, { data: [{ date: d4, completed_at: null }], error: null });
    const overview = await getWeekOverview([d4]);
    expect(rpc).not.toHaveBeenCalled();
    expect(overview.get(d4)?.performed).toBe(false);
  });

  it("returns an empty overview for a signed-out user without querying", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await getWeekOverview(week)).size).toBe(0);
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("getWeeklyTrainingDays", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpc.mockClear();
    setRpcResult({ data: [], error: null });
  });

  const currentStart = () => weekDates(today())[0];
  const previousStart = () => shiftDate(currentStart(), -7);

  it("asks from the Sunday starting the oldest completed week through today", async () => {
    await getWeeklyTrainingDays();
    expect(rpc).toHaveBeenCalledWith("performed_workout_dates", {
      p_from: shiftDate(currentStart(), -56),
      p_to: today(),
    });
  });

  it("returns the current week plus 8 completed weeks, newest first", async () => {
    const result = await getWeeklyTrainingDays();
    expect(result).toHaveLength(9);
    expect(result[0]).toMatchObject({ weekStart: currentStart(), isCurrentWeek: true });
    expect(result[1].weekStart).toBe(previousStart());
  });

  it("buckets the returned workout days into their weeks", async () => {
    setRpcResult(dates(shiftDate(previousStart(), 1), shiftDate(previousStart(), 3), today()));
    const result = await getWeeklyTrainingDays();
    expect(result[0].daysPerformed).toBe(1);
    expect(result[1].daysPerformed).toBe(2);
    expect(result.slice(2).every((w) => w.daysPerformed === 0)).toBe(true);
  });

  it("returns nothing for a signed-out user without querying", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await getWeeklyTrainingDays()).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns nothing on a query error", async () => {
    setRpcResult({ data: null, error: { message: "boom" } });
    expect(await getWeeklyTrainingDays()).toEqual([]);
  });

  it("15. the rolling 7-day count and the weekly breakdown use the same database definition", async () => {
    setRpcResult(dates(today()));
    expect((await getTrainingConsistency(7)).daysPerformed).toBe(1);
    expect((await getWeeklyTrainingDays())[0].daysPerformed).toBe(1);
    expect(rpc.mock.calls.every((call) => (call as unknown[])[0] === "performed_workout_dates")).toBe(true);
  });
});
