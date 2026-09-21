import { describe, expect, it, vi, beforeEach } from "vitest";
import { today, shiftDate } from "./date";

const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } });

type QueryResult = { data: unknown; error: unknown };

// The queries under test await the query builder directly (no .single()/.maybeSingle()), so the
// builder itself must be thenable — same shape as the mock in queries.history.test.ts. Every
// select() consumes the next queued result (falling back to the last one), so multi-page walks
// (getLastPerformedWorkoutDate) can be given a different page per request.
function makeBuilder(result: QueryResult) {
  const calls: Record<string, unknown[][]> = {
    eq: [],
    gte: [],
    lte: [],
    lt: [],
    order: [],
    limit: [],
    in: [],
  };
  const record = (name: string) =>
    vi.fn((...args: unknown[]) => {
      calls[name].push(args);
      return builder;
    });
  const builder = {
    calls,
    eq: record("eq"),
    gte: record("gte"),
    lte: record("lte"),
    lt: record("lt"),
    order: record("order"),
    limit: record("limit"),
    in: record("in"),
    then: (resolve: (v: QueryResult) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
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

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from }),
}));

const { getTrainingConsistency, getBodyWeightWindow, getLastPerformedWorkoutDate, getWeekOverview } =
  await import("./queries");

const set = (reps: number | null, weight: number | null) => ({ reps, weight });
const performedLog = (date: string) => ({
  date,
  logged_exercises: [{ logged_sets: [set(5, 80)] }],
});
const blankLog = (date: string) => ({
  date,
  logged_exercises: [{ logged_sets: [set(null, null), set(null, null)] }],
});
const emptyLog = (date: string) => ({ date, logged_exercises: [] });

describe("getTrainingConsistency", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    from.mockClear();
  });

  it("queries an inclusive N-calendar-day window ending today — 28 days is today − 27", async () => {
    setResults({ data: [], error: null });
    await getTrainingConsistency(28);
    expect(builders[0].calls.gte).toEqual([["date", shiftDate(today(), -27)]]);
    expect(builders[0].calls.lte).toEqual([["date", today()]]);
  });

  it("2. last 7 days is today − 6", async () => {
    setResults({ data: [], error: null });
    await getTrainingConsistency(7);
    expect(builders[0].calls.gte).toEqual([["date", shiftDate(today(), -6)]]);
  });

  it("1. last 1 day is today only", async () => {
    setResults({ data: [], error: null });
    await getTrainingConsistency(1);
    expect(builders[0].calls.gte).toEqual([["date", today()]]);
    expect(builders[0].calls.lte).toEqual([["date", today()]]);
  });

  it("fetches sets alongside dates so blank logs can be excluded", async () => {
    setResults({ data: [], error: null });
    await getTrainingConsistency(7);
    expect(lastSelectArg).toContain("logged_sets(reps, weight)");
  });

  it("counts each performed log as one workout day", async () => {
    setResults({
      data: [
        performedLog(shiftDate(today(), -1)),
        performedLog(shiftDate(today(), -3)),
        performedLog(shiftDate(today(), -5)),
      ],
      error: null,
    });
    const result = await getTrainingConsistency(28);
    expect(result).toEqual({ windowDays: 28, daysPerformed: 3 });
  });

  it("4. a performed log dated today is counted", async () => {
    setResults({ data: [performedLog(today())], error: null });
    expect((await getTrainingConsistency(7)).daysPerformed).toBe(1);
  });

  it("8. an empty workout log (no exercises) is not counted", async () => {
    setResults({ data: [emptyLog(shiftDate(today(), -1))], error: null });
    expect((await getTrainingConsistency(7)).daysPerformed).toBe(0);
  });

  it("9. a log holding only blank planned sets is not counted", async () => {
    setResults({
      data: [blankLog(shiftDate(today(), -1)), performedLog(shiftDate(today(), -2))],
      error: null,
    });
    expect((await getTrainingConsistency(7)).daysPerformed).toBe(1);
  });

  it("7. a future-dated log is not counted even if it comes back from the query", async () => {
    setResults({
      data: [performedLog(shiftDate(today(), 1)), performedLog(shiftDate(today(), -1))],
      error: null,
    });
    expect((await getTrainingConsistency(7)).daysPerformed).toBe(1);
  });

  it("15. the same date appearing twice counts once", async () => {
    setResults({
      data: [performedLog(shiftDate(today(), -1)), performedLog(shiftDate(today(), -1))],
      error: null,
    });
    expect((await getTrainingConsistency(7)).daysPerformed).toBe(1);
  });

  it("20. counts a performed but never-completed log, and doesn't filter on completed_at", async () => {
    setResults({ data: [{ ...performedLog(shiftDate(today(), -1)), completed_at: null }], error: null });
    const result = await getTrainingConsistency(7);
    expect(result.daysPerformed).toBe(1);
    const filteredColumns = [...builders[0].calls.eq, ...builders[0].calls.gte].map((c) => c[0]);
    expect(filteredColumns).not.toContain("completed_at");
    expect(filteredColumns).not.toContain("plan_id");
  });

  it("returns zero for a signed-out user without querying", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await getTrainingConsistency(28);
    expect(result).toEqual({ windowDays: 28, daysPerformed: 0 });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns zero on a query error", async () => {
    setResults({ data: null, error: { message: "boom" } });
    expect((await getTrainingConsistency(28)).daysPerformed).toBe(0);
  });

  it("returns zero when no logs fall in the window", async () => {
    setResults({ data: [], error: null });
    expect((await getTrainingConsistency(28)).daysPerformed).toBe(0);
  });
});

describe("getBodyWeightWindow", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    from.mockClear();
  });

  it("uses the inclusive N-calendar-day window — 28 days is today − 27", async () => {
    setResults({ data: [], error: null });
    await getBodyWeightWindow(28);
    expect(builders[0].calls.gte).toEqual([["date", shiftDate(today(), -27)]]);
    expect(builders[0].calls.order).toEqual([["date", { ascending: true }]]);
  });

  it("picks the first row as earliest and the last row as latest", async () => {
    setResults({
      data: [
        { date: "2026-09-01", weight_kg: 80 },
        { date: "2026-09-10", weight_kg: 79 },
        { date: "2026-09-20", weight_kg: 78.5 },
      ],
      error: null,
    });
    const result = await getBodyWeightWindow(28);
    expect(result.measurementCount).toBe(3);
    expect(result.earliest).toEqual({ date: "2026-09-01", weightKg: 80 });
    expect(result.latest).toEqual({ date: "2026-09-20", weightKg: 78.5 });
  });

  it("returns the same row as both earliest and latest when exactly one measurement exists", async () => {
    setResults({ data: [{ date: "2026-09-15", weight_kg: 79 }], error: null });
    const result = await getBodyWeightWindow(28);
    expect(result.measurementCount).toBe(1);
    expect(result.earliest).toEqual({ date: "2026-09-15", weightKg: 79 });
    expect(result.latest).toEqual({ date: "2026-09-15", weightKg: 79 });
  });

  it("returns nulls and a zero count when no measurements fall in the window", async () => {
    setResults({ data: [], error: null });
    const result = await getBodyWeightWindow(28);
    expect(result).toEqual({ windowDays: 28, measurementCount: 0, earliest: null, latest: null });
  });

  it("returns nulls for a signed-out user without querying", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await getBodyWeightWindow(28);
    expect(result).toEqual({ windowDays: 28, measurementCount: 0, earliest: null, latest: null });
    expect(from).not.toHaveBeenCalled();
  });
});

describe("getLastPerformedWorkoutDate", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    from.mockClear();
  });

  it("orders by date descending, bounded above by today, scoped to the user", async () => {
    setResults({ data: [performedLog("2026-09-10")], error: null });
    await getLastPerformedWorkoutDate();
    expect(builders[0].calls.order).toEqual([["date", { ascending: false }]]);
    expect(builders[0].calls.lte).toEqual([["date", today()]]);
    expect(builders[0].calls.eq).toEqual([["user_id", "user-1"]]);
  });

  it("returns the most recent performed date", async () => {
    setResults({ data: [performedLog("2026-09-10"), performedLog("2026-09-01")], error: null });
    expect(await getLastPerformedWorkoutDate()).toEqual({ date: "2026-09-10" });
  });

  it("skips a more recent blank log and empty log in favour of the last performed one", async () => {
    setResults({
      data: [emptyLog("2026-09-12"), blankLog("2026-09-11"), performedLog("2026-09-10")],
      error: null,
    });
    expect(await getLastPerformedWorkoutDate()).toEqual({ date: "2026-09-10" });
  });

  it("skips a future-dated log even if it comes back from the query", async () => {
    setResults({
      data: [performedLog(shiftDate(today(), 2)), performedLog("2026-09-10")],
      error: null,
    });
    expect(await getLastPerformedWorkoutDate()).toEqual({ date: "2026-09-10" });
  });

  it("20. does not require completed_at — a performed but incomplete log counts", async () => {
    setResults({ data: [{ ...performedLog("2026-09-10"), completed_at: null }], error: null });
    const result = await getLastPerformedWorkoutDate();
    expect(result).toEqual({ date: "2026-09-10" });
    expect(builders[0].calls.eq.map((c) => c[0])).not.toContain("completed_at");
  });

  it("keeps walking back a page at a time when a full page holds only blank logs", async () => {
    const blankPage = Array.from({ length: 30 }, (_, i) => blankLog(shiftDate("2026-09-01", -i)));
    setResults(
      { data: blankPage, error: null },
      { data: [performedLog("2026-07-01")], error: null }
    );
    expect(await getLastPerformedWorkoutDate()).toEqual({ date: "2026-07-01" });
    expect(builders).toHaveLength(2);
    expect(builders[1].calls.lt).toEqual([["date", blankPage[29].date]]);
  });

  it("returns null when there is no performed workout at all", async () => {
    setResults({ data: [blankLog("2026-09-10"), emptyLog("2026-09-09")], error: null });
    expect(await getLastPerformedWorkoutDate()).toEqual({ date: null });
  });

  it("returns null for a signed-out user without querying", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await getLastPerformedWorkoutDate()).toEqual({ date: null });
    expect(from).not.toHaveBeenCalled();
  });
});

describe("getWeekOverview — performed and completed are separate facts", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    from.mockClear();
  });

  const d1 = shiftDate(today(), -3);
  const d2 = shiftDate(today(), -2);
  const d3 = shiftDate(today(), -1);
  const d4 = shiftDate(today(), 2);
  const dates = [d1, d2, d3, d4, today()];

  it("20. reports performed and completed independently for each day", async () => {
    setResults(
      { data: [{ date: d1, title: "Push", is_rest_day: false }], error: null },
      {
        data: [
          { ...performedLog(d1), completed_at: "2026-09-01T10:00:00Z" }, // performed + completed
          { ...performedLog(d2), completed_at: null }, // performed, not completed
          { ...blankLog(d3), completed_at: "2026-09-02T10:00:00Z" }, // completed, nothing performed
        ],
        error: null,
      }
    );
    const overview = await getWeekOverview(dates);
    expect(overview.get(d1)).toEqual({ title: "Push", performed: true, completed: true, isRestDay: false });
    expect(overview.get(d2)).toEqual({ title: null, performed: true, completed: false, isRestDay: false });
    expect(overview.get(d3)).toEqual({ title: null, performed: false, completed: true, isRestDay: false });
    expect(overview.get(today())).toEqual({ title: null, performed: false, completed: false, isRestDay: false });
  });

  it("an empty log (no exercises) is not performed", async () => {
    setResults(
      { data: [], error: null },
      { data: [{ ...emptyLog(d1), completed_at: null }], error: null }
    );
    expect((await getWeekOverview(dates)).get(d1)?.performed).toBe(false);
  });

  it("a future-dated performed log is not marked performed", async () => {
    setResults({ data: [], error: null }, { data: [{ ...performedLog(d4), completed_at: null }], error: null });
    expect((await getWeekOverview(dates)).get(d4)?.performed).toBe(false);
  });

  it("returns an empty overview for a signed-out user without querying", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await getWeekOverview(dates)).size).toBe(0);
    expect(from).not.toHaveBeenCalled();
  });
});
