import { describe, expect, it, vi, beforeEach } from "vitest";
import { today } from "./date";

const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } });
const maybeSingle = vi.fn();

type QueryResult = { data: unknown; error: unknown };

// A single reusable chainable mock: every intermediate call (eq/not/lt/order/limit) returns the
// same chain object. getLastCompletedLog terminates with maybeSingle() (whose resolved value each
// test configures); getPreviousPerformance awaits the chain directly, so the chain is also
// thenable, consuming the next queued page result per request.
const chain: Record<string, unknown> = {};
let pages: QueryResult[] = [];
let requestCount = 0;
const eq = vi.fn(() => chain);
const not = vi.fn(() => chain);
const lt = vi.fn(() => chain);
const lte = vi.fn(() => chain);
const order = vi.fn(() => chain);
const limit = vi.fn(() => chain);
Object.assign(chain, {
  eq,
  not,
  lt,
  lte,
  order,
  limit,
  maybeSingle,
  then: (resolve: (v: QueryResult) => unknown) => {
    requestCount++;
    return Promise.resolve(pages.shift() ?? { data: [], error: null }).then(resolve);
  },
});

const select = vi.fn(() => chain);
const from = vi.fn(() => ({ select }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from,
  }),
}));

const { getLastCompletedLog, getPreviousPerformance } = await import("./queries");
const { compareSets } = await import("@/app/log/[date]/ExerciseLogPanel");

describe("getLastCompletedLog", () => {
  beforeEach(() => {
    maybeSingle.mockReset();
  });

  it("returns the most recent completed log with its plan title", async () => {
    maybeSingle.mockResolvedValue({
      data: { date: "2026-09-14", plan: { title: "Push Day" } },
      error: null,
    });
    const result = await getLastCompletedLog();
    expect(result).toEqual({ date: "2026-09-14", title: "Push Day" });
    expect(not).toHaveBeenCalledWith("completed_at", "is", null);
  });

  it("falls back to a null title for a freeform (planless) log", async () => {
    maybeSingle.mockResolvedValue({ data: { date: "2026-09-14", plan: null }, error: null });
    const result = await getLastCompletedLog();
    expect(result).toEqual({ date: "2026-09-14", title: null });
  });

  it("returns null when no completed log exists", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await getLastCompletedLog();
    expect(result).toBeNull();
  });

  it("20. keeps its explicit completion meaning — keyed on completed_at, not on performed sets", async () => {
    maybeSingle.mockResolvedValue({ data: { date: "2026-09-14", plan: null }, error: null });
    await getLastCompletedLog();
    expect(select).toHaveBeenLastCalledWith("date, plan:workout_plans(title)");
    expect(not).toHaveBeenLastCalledWith("completed_at", "is", null);
  });

  it("is bounded above by today so a future-dated completed log cannot be returned", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await getLastCompletedLog();
    expect(lte).toHaveBeenLastCalledWith("date", today());
  });
});

function sessionRow(
  date: string,
  sets: { set_number: number; reps: number | null; weight: number | null; weight_unit?: string }[],
  exerciseId = "ex-1"
) {
  return {
    date,
    logged_exercises: [
      {
        exercise_id: exerciseId,
        logged_sets: sets.map((s) => ({ weight_unit: "kg", ...s })),
      },
    ],
  };
}

describe("getPreviousPerformance", () => {
  beforeEach(() => {
    pages = [];
    requestCount = 0;
    eq.mockClear();
    lt.mockClear();
    order.mockClear();
    limit.mockClear();
  });

  it("returns the most recent prior log's performed sets for that exercise, in set-number order", async () => {
    pages = [
      {
        data: [
          sessionRow("2026-09-10", [
            { set_number: 2, reps: 9, weight: 60 },
            { set_number: 1, reps: 10, weight: 60 },
          ]),
        ],
        error: null,
      },
    ];
    const result = await getPreviousPerformance("ex-1", "2026-09-16");
    expect(result).toEqual({
      date: "2026-09-10",
      sets: [
        { setNumber: 1, reps: 10, weight: 60, weightUnit: "kg" },
        { setNumber: 2, reps: 9, weight: 60, weightUnit: "kg" },
      ],
    });
    expect(eq).toHaveBeenCalledWith("logged_exercises.exercise_id", "ex-1");
    expect(lt).toHaveBeenCalledWith("date", "2026-09-16");
    expect(order).toHaveBeenCalledWith("date", { ascending: false });
  });

  it("17. skips a blank-only latest session and returns the earlier real one", async () => {
    pages = [
      {
        data: [
          sessionRow("2026-09-14", [
            { set_number: 1, reps: null, weight: null },
            { set_number: 2, reps: null, weight: null },
          ]),
          sessionRow("2026-09-07", [{ set_number: 1, reps: 8, weight: 70 }]),
        ],
        error: null,
      },
    ];
    const result = await getPreviousPerformance("ex-1", "2026-09-16");
    expect(result?.date).toBe("2026-09-07");
    expect(result?.sets).toEqual([{ setNumber: 1, reps: 8, weight: 70, weightUnit: "kg" }]);
  });

  it("18. falls back across several blank sessions to the earlier real session", async () => {
    pages = [
      {
        data: [
          sessionRow("2026-09-14", [{ set_number: 1, reps: null, weight: null }]),
          sessionRow("2026-09-12", []),
          sessionRow("2026-09-05", [{ set_number: 1, reps: 6, weight: 75 }]),
        ],
        error: null,
      },
    ];
    expect((await getPreviousPerformance("ex-1", "2026-09-16"))?.date).toBe("2026-09-05");
  });

  it("returns only performed sets, keeping each one's own set_number", async () => {
    pages = [
      {
        data: [
          sessionRow("2026-09-10", [
            { set_number: 1, reps: 10, weight: 60 },
            { set_number: 2, reps: null, weight: null },
            { set_number: 3, reps: 8, weight: 60 },
          ]),
        ],
        error: null,
      },
    ];
    const result = await getPreviousPerformance("ex-1", "2026-09-16");
    expect(result?.sets.map((s) => s.setNumber)).toEqual([1, 3]);
  });

  it("treats reps-only and weight-only sets as performed", async () => {
    pages = [
      {
        data: [
          sessionRow("2026-09-10", [
            { set_number: 1, reps: 12, weight: null },
            { set_number: 2, reps: null, weight: 20 },
          ]),
        ],
        error: null,
      },
    ];
    const result = await getPreviousPerformance("ex-1", "2026-09-16");
    expect(result?.sets).toHaveLength(2);
  });

  it("ignores same-day sibling exercises that were embedded alongside the requested one", async () => {
    pages = [
      {
        data: [
          {
            date: "2026-09-10",
            logged_exercises: [
              { exercise_id: "ex-other", logged_sets: [{ set_number: 1, reps: 5, weight: 100, weight_unit: "kg" }] },
              { exercise_id: "ex-1", logged_sets: [{ set_number: 1, reps: 10, weight: 60, weight_unit: "kg" }] },
            ],
          },
        ],
        error: null,
      },
    ];
    const result = await getPreviousPerformance("ex-1", "2026-09-16");
    expect(result?.sets).toEqual([{ setNumber: 1, reps: 10, weight: 60, weightUnit: "kg" }]);
  });

  it("keeps paging back when a full page holds only blank sessions", async () => {
    const blankPage = Array.from({ length: 20 }, (_, i) =>
      sessionRow(`2026-08-${String(30 - i).padStart(2, "0")}`, [{ set_number: 1, reps: null, weight: null }])
    );
    pages = [
      { data: blankPage, error: null },
      { data: [sessionRow("2026-06-01", [{ set_number: 1, reps: 5, weight: 50 }])], error: null },
    ];
    const result = await getPreviousPerformance("ex-1", "2026-09-16");
    expect(result?.date).toBe("2026-06-01");
    expect(requestCount).toBe(2);
    expect(lt).toHaveBeenLastCalledWith("date", blankPage[19].date);
  });

  it("returns null when every prior session is blank", async () => {
    pages = [
      {
        data: [sessionRow("2026-09-10", [{ set_number: 1, reps: null, weight: null }])],
        error: null,
      },
    ];
    expect(await getPreviousPerformance("ex-1", "2026-09-16")).toBeNull();
  });

  it("returns null when there is no prior log for that exercise", async () => {
    pages = [{ data: [], error: null }];
    expect(await getPreviousPerformance("ex-1", "2026-09-16")).toBeNull();
  });

  it("returns null on a query error", async () => {
    pages = [{ data: null, error: { message: "boom" } }];
    expect(await getPreviousPerformance("ex-1", "2026-09-16")).toBeNull();
  });

  it("returns null when signed out", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await getPreviousPerformance("ex-1", "2026-09-16");
    expect(result).toBeNull();
  });

  it("19. mixed units stay unavailable for weight comparison (units preserved, never converted)", async () => {
    pages = [
      {
        data: [sessionRow("2026-09-10", [{ set_number: 1, reps: 6, weight: 176, weight_unit: "lb" }])],
        error: null,
      },
    ];
    const previous = await getPreviousPerformance("ex-1", "2026-09-16");
    expect(previous?.sets[0].weightUnit).toBe("lb");
    const [comparison] = compareSets([{ reps: "6", weight: "80", weightUnit: "kg" }], previous);
    expect(comparison?.weight).toEqual({ type: "unavailable" });
    expect(comparison?.reps).toEqual({ type: "same" });
  });

  it("preserves same-set-number matching after blank sets are dropped", async () => {
    pages = [
      {
        data: [
          sessionRow("2026-09-10", [
            { set_number: 1, reps: null, weight: null },
            { set_number: 2, reps: 8, weight: 60 },
          ]),
        ],
        error: null,
      },
    ];
    const previous = await getPreviousPerformance("ex-1", "2026-09-16");
    const comparisons = compareSets(
      [
        { reps: "8", weight: "62.5", weightUnit: "kg" },
        { reps: "8", weight: "62.5", weightUnit: "kg" },
      ],
      previous
    );
    expect(comparisons[0]).toBeNull();
    expect(comparisons[1]?.weight).toEqual({ type: "delta", delta: 2.5, unit: "kg" });
  });
});
