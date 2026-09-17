import { describe, expect, it, vi, beforeEach } from "vitest";
import { today, shiftDate } from "./date";

const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } });

type QueryResult = { data: unknown; error: unknown };

// Both getTrainingConsistency and getBodyWeightWindow await the query builder directly (no
// .single()/.maybeSingle()), so the builder itself must be thenable — same shape as the mock
// already used in queries.history.test.ts.
function makeBuilder(result: QueryResult) {
  const calls: Record<string, unknown[][]> = { eq: [], gte: [], order: [], limit: [] };
  const builder = {
    calls,
    eq: vi.fn((...args: unknown[]) => {
      calls.eq.push(args);
      return builder;
    }),
    gte: vi.fn((...args: unknown[]) => {
      calls.gte.push(args);
      return builder;
    }),
    order: vi.fn((...args: unknown[]) => {
      calls.order.push(args);
      return builder;
    }),
    limit: vi.fn((...args: unknown[]) => {
      calls.limit.push(args);
      return builder;
    }),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (v: QueryResult) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

let nextResult: QueryResult = { data: [], error: null };
let lastBuilder: ReturnType<typeof makeBuilder> | null = null;
const select = vi.fn(() => {
  lastBuilder = makeBuilder(nextResult);
  return lastBuilder;
});
const from = vi.fn(() => ({ select }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from }),
}));

const { getTrainingConsistency, getBodyWeightWindow, getLastWorkoutDate } = await import(
  "./queries"
);

describe("getTrainingConsistency", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    from.mockClear();
  });

  it("uses the canonical today()/shiftDate() for the 28-day window boundary", async () => {
    nextResult = { data: [], error: null };
    await getTrainingConsistency(28);
    expect(lastBuilder!.calls.gte).toEqual([["date", shiftDate(today(), -28)]]);
  });

  it("respects a custom window size", async () => {
    nextResult = { data: [], error: null };
    await getTrainingConsistency(7);
    expect(lastBuilder!.calls.gte).toEqual([["date", shiftDate(today(), -7)]]);
  });

  it("counts each returned row as one logged day (dates are already unique per user)", async () => {
    nextResult = {
      data: [{ date: "2026-09-01" }, { date: "2026-09-03" }, { date: "2026-09-10" }],
      error: null,
    };
    const result = await getTrainingConsistency(28);
    expect(result).toEqual({ windowDays: 28, daysLogged: 3 });
  });

  it("does not filter by plan_id or completed_at — planned, freeform, and incomplete logs all count", async () => {
    nextResult = { data: [{ date: "2026-09-01" }], error: null };
    await getTrainingConsistency(28);
    const filteredColumns = [...lastBuilder!.calls.eq, ...lastBuilder!.calls.gte].map((c) => c[0]);
    expect(filteredColumns).not.toContain("plan_id");
    expect(filteredColumns).not.toContain("completed_at");
  });

  it("returns zero for a signed-out user without querying", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await getTrainingConsistency(28);
    expect(result).toEqual({ windowDays: 28, daysLogged: 0 });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns zero when no logs fall in the window", async () => {
    nextResult = { data: [], error: null };
    const result = await getTrainingConsistency(28);
    expect(result.daysLogged).toBe(0);
  });
});

describe("getBodyWeightWindow", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    from.mockClear();
  });

  it("uses the canonical today()/shiftDate() for the 28-day window boundary", async () => {
    nextResult = { data: [], error: null };
    await getBodyWeightWindow(28);
    expect(lastBuilder!.calls.gte).toEqual([["date", shiftDate(today(), -28)]]);
    expect(lastBuilder!.calls.order).toEqual([["date", { ascending: true }]]);
  });

  it("picks the first row as earliest and the last row as latest", async () => {
    nextResult = {
      data: [
        { date: "2026-09-01", weight_kg: 80 },
        { date: "2026-09-10", weight_kg: 79 },
        { date: "2026-09-20", weight_kg: 78.5 },
      ],
      error: null,
    };
    const result = await getBodyWeightWindow(28);
    expect(result.measurementCount).toBe(3);
    expect(result.earliest).toEqual({ date: "2026-09-01", weightKg: 80 });
    expect(result.latest).toEqual({ date: "2026-09-20", weightKg: 78.5 });
  });

  it("returns the same row as both earliest and latest when exactly one measurement exists", async () => {
    nextResult = { data: [{ date: "2026-09-15", weight_kg: 79 }], error: null };
    const result = await getBodyWeightWindow(28);
    expect(result.measurementCount).toBe(1);
    expect(result.earliest).toEqual({ date: "2026-09-15", weightKg: 79 });
    expect(result.latest).toEqual({ date: "2026-09-15", weightKg: 79 });
  });

  it("returns nulls and a zero count when no measurements fall in the window", async () => {
    nextResult = { data: [], error: null };
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

describe("getLastWorkoutDate", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    from.mockClear();
  });

  it("orders by date descending and takes the single most recent row", async () => {
    nextResult = { data: { date: "2026-09-10" }, error: null };
    await getLastWorkoutDate();
    expect(lastBuilder!.calls.order).toEqual([["date", { ascending: false }]]);
    expect(lastBuilder!.calls.limit).toEqual([[1]]);
  });

  it("does not filter by completed_at — log existence alone determines the last workout date", async () => {
    nextResult = { data: { date: "2026-09-10" }, error: null };
    await getLastWorkoutDate();
    const filteredColumns = lastBuilder!.calls.eq.map((c) => c[0]);
    expect(filteredColumns).not.toContain("completed_at");
  });

  it("returns the most recent date when a log exists", async () => {
    nextResult = { data: { date: "2026-09-10" }, error: null };
    const result = await getLastWorkoutDate();
    expect(result).toEqual({ date: "2026-09-10" });
  });

  it("returns null when no workout has ever been logged", async () => {
    nextResult = { data: null, error: null };
    const result = await getLastWorkoutDate();
    expect(result).toEqual({ date: null });
  });

  it("returns null for a signed-out user without querying", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await getLastWorkoutDate();
    expect(result).toEqual({ date: null });
    expect(from).not.toHaveBeenCalled();
  });

  it("is scoped to the authenticated user", async () => {
    nextResult = { data: { date: "2026-09-10" }, error: null };
    await getLastWorkoutDate();
    expect(lastBuilder!.calls.eq).toEqual([["user_id", "user-1"]]);
  });
});
