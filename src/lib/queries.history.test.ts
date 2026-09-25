import { describe, expect, it, vi, beforeEach } from "vitest";
import { today, shiftDate } from "./date";

const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } });

type QueryResult = { data: unknown; error: unknown };

// getLogHistory awaits the query builder directly (no .single()/.maybeSingle()), so the builder
// itself must be thenable. getLogForDate still terminates with .maybeSingle(). This mock
// supports both shapes and records every filter call so tests can assert on them.
function makeBuilder(result: QueryResult) {
  const calls: Record<string, unknown[][]> = { eq: [], order: [], limit: [], lt: [], lte: [] };
  const builder = {
    calls,
    eq: vi.fn((...args: unknown[]) => {
      calls.eq.push(args);
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
    lt: vi.fn((...args: unknown[]) => {
      calls.lt.push(args);
      return builder;
    }),
    lte: vi.fn((...args: unknown[]) => {
      calls.lte.push(args);
      return builder;
    }),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (resolve: (v: QueryResult) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

let nextResult: QueryResult = { data: [], error: null };
let lastBuilder: ReturnType<typeof makeBuilder> | null = null;
let lastSelectArg = "";
const select = vi.fn((arg: string) => {
  lastSelectArg = arg;
  lastBuilder = makeBuilder(nextResult);
  return lastBuilder;
});
const from = vi.fn(() => ({ select }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from }),
}));

const { getLogHistory, getLogForDate, getExerciseSessions } = await import("./queries");

function loggedLog(
  overrides: Partial<{
    id: string;
    date: string;
    notes: string | null;
    plan: { title: string | null } | null;
    logged_exercises: unknown[];
  }> = {}
) {
  return {
    id: overrides.id ?? "log-1",
    date: overrides.date ?? "2026-09-10",
    notes: overrides.notes ?? null,
    completed_at: null,
    plan: overrides.plan ?? null,
    logged_exercises: overrides.logged_exercises ?? [],
  };
}

function loggedExercise(
  overrides: Partial<{
    id: string;
    exercise_id: string;
    position: number;
    exercise: { id: string; name: string };
    logged_sets: unknown[];
  }> = {}
) {
  return {
    id: overrides.id ?? "le-1",
    exercise_id: overrides.exercise_id ?? "ex-1",
    position: overrides.position ?? 0,
    exercise: overrides.exercise ?? { id: overrides.exercise_id ?? "ex-1", name: "Bench Press" },
    logged_sets: overrides.logged_sets ?? [],
  };
}

function loggedSet(
  overrides: Partial<{ id: string; set_number: number; reps: number | null; weight: number | null; weight_unit: string }> = {}
) {
  return {
    id: overrides.id ?? "set-1",
    set_number: overrides.set_number ?? 1,
    // `?? default` would silently replace an explicit `null` (a real, meaningful "no value
    // recorded" state) with the default — use `in` so tests can assert null is passed through.
    reps: "reps" in overrides ? overrides.reps! : 5,
    weight: "weight" in overrides ? overrides.weight! : 80,
    weight_unit: overrides.weight_unit ?? "kg",
  };
}

describe("getLogHistory pagination", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("requests pageSize + 1 rows and reports hasMore when the extra row comes back", async () => {
    nextResult = {
      data: [loggedLog({ id: "1", date: "2026-09-10" }), loggedLog({ id: "2", date: "2026-09-09" }), loggedLog({ id: "3", date: "2026-09-08" })],
      error: null,
    };
    const result = await getLogHistory({ pageSize: 2 });
    expect(result.logs).toHaveLength(2);
    expect(result.hasMore).toBe(true);
    expect(lastBuilder!.calls.limit).toEqual([[3]]);
    expect(lastBuilder!.calls.order).toEqual([["date", { ascending: false }]]);
  });

  it("reports hasMore=false when there is no extra row beyond the page", async () => {
    nextResult = { data: [loggedLog({ id: "1" }), loggedLog({ id: "2" })], error: null };
    const result = await getLogHistory({ pageSize: 2 });
    expect(result.logs).toHaveLength(2);
    expect(result.hasMore).toBe(false);
  });

  it("applies a before cursor via lt(date, before)", async () => {
    nextResult = { data: [], error: null };
    await getLogHistory({ before: "2026-09-01" });
    expect(lastBuilder!.calls.lt).toEqual([["date", "2026-09-01"]]);
  });

  it("does not filter by date when no cursor is given", async () => {
    nextResult = { data: [], error: null };
    await getLogHistory({});
    expect(lastBuilder!.calls.lt).toEqual([]);
  });
});

describe("getLogHistory is the unfiltered raw log list", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  // Exercise-specific History is built from performed sessions (getExerciseSessions), not from
  // this query — so it never inner-joins or filters by exercise.
  it("uses a plain (non-inner) embed and no exercise filter", async () => {
    nextResult = { data: [], error: null };
    await getLogHistory({});
    expect(lastSelectArg).not.toContain("logged_exercises!inner");
    expect(lastBuilder!.calls.eq.map((c) => c[0])).toEqual(["user_id"]);
  });

  it("keeps every logged exercise on each log", async () => {
    nextResult = {
      data: [
        loggedLog({
          logged_exercises: [
            loggedExercise({ exercise_id: "ex-bench" }),
            loggedExercise({ exercise_id: "ex-row" }),
          ],
        }),
      ],
      error: null,
    };

    const result = await getLogHistory({});
    expect(result.logs[0].logged_exercises).toHaveLength(2);
  });

  it("orders each log's exercises by position and sets by set_number", async () => {
    nextResult = {
      data: [
        loggedLog({
          logged_exercises: [
            loggedExercise({
              id: "le-2",
              exercise_id: "ex-row",
              position: 1,
              logged_sets: [loggedSet({ id: "b", set_number: 2 }), loggedSet({ id: "a", set_number: 1 })],
            }),
            loggedExercise({ id: "le-1", exercise_id: "ex-bench", position: 0 }),
          ],
        }),
      ],
      error: null,
    };

    const result = await getLogHistory({});
    expect(result.logs[0].logged_exercises?.map((le) => le.id)).toEqual(["le-1", "le-2"]);
    expect(result.logs[0].logged_exercises?.[1].logged_sets?.map((s) => s.set_number)).toEqual([1, 2]);
  });

  it("preserves null reps/weight rather than inventing values", async () => {
    nextResult = {
      data: [
        loggedLog({
          logged_exercises: [
            loggedExercise({ logged_sets: [loggedSet({ reps: null, weight: null })] }),
          ],
        }),
      ],
      error: null,
    };
    const set = (await getLogHistory({})).logs[0].logged_exercises?.[0].logged_sets?.[0];
    expect(set?.reps).toBeNull();
    expect(set?.weight).toBeNull();
  });
});

describe("getLogHistory workout title / freeform context", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("attaches the joined plan's title as planTitle", async () => {
    nextResult = { data: [loggedLog({ plan: { title: "Push Day" } })], error: null };
    const result = await getLogHistory({});
    expect(result.logs[0].planTitle).toBe("Push Day");
  });

  it("falls back to null planTitle for a freeform (planless) log", async () => {
    nextResult = { data: [loggedLog({ plan: null })], error: null };
    const result = await getLogHistory({});
    expect(result.logs[0].planTitle).toBeNull();
  });
});

describe("getLogHistory notes visibility", () => {
  it("passes non-empty notes through unchanged", async () => {
    nextResult = { data: [loggedLog({ notes: "Felt strong today" })], error: null };
    const result = await getLogHistory({});
    expect(result.logs[0].notes).toBe("Felt strong today");
  });

  it("returns an empty page with hasMore=false when signed out", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await getLogHistory({});
    expect(result).toEqual({ logs: [], hasMore: false });
  });
});

describe("getExerciseSessions (full performed history for one exercise)", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    from.mockClear();
  });

  type SetInput = { set_number: number; reps: number | null; weight: number | null; weight_unit?: string };
  const performedSets: SetInput[] = [{ set_number: 1, reps: 5, weight: 80 }];
  const blankSets: SetInput[] = [
    { set_number: 1, reps: null, weight: null },
    { set_number: 2, reps: null, weight: null },
  ];
  const session = (date: string, logged_sets: SetInput[], exercise_id = "ex-bench", position = 0) => ({
    date,
    logged_exercises: [
      {
        exercise_id,
        position,
        logged_sets: logged_sets.map((s) => ({ weight_unit: "kg", ...s })),
      },
    ],
  });

  it("inner-joins logged_exercises, filters by exercise_id, is bounded above by today, newest first — no page cursor or limit", async () => {
    nextResult = { data: [], error: null };
    await getExerciseSessions("ex-bench");
    expect(lastSelectArg).toContain("logged_exercises!inner");
    expect(lastSelectArg).toContain("logged_sets(set_number, reps, weight, weight_unit, set_type)");
    expect(lastBuilder!.calls.eq).toContainEqual(["user_id", "user-1"]);
    expect(lastBuilder!.calls.eq).toContainEqual(["logged_exercises.exercise_id", "ex-bench"]);
    expect(lastBuilder!.calls.lte).toEqual([["date", today()]]);
    expect(lastBuilder!.calls.order).toEqual([["date", { ascending: false }]]);
    expect(lastBuilder!.calls.lt).toEqual([]);
    expect(lastBuilder!.calls.limit).toEqual([]);
  });

  it("returns performed sessions with only their performed sets", async () => {
    nextResult = {
      data: [
        session("2026-09-17", [
          { set_number: 1, reps: 8, weight: 80 },
          { set_number: 2, reps: null, weight: null },
          { set_number: 3, reps: 6, weight: 80 },
        ]),
        session("2026-09-10", performedSets),
      ],
      error: null,
    };
    const result = await getExerciseSessions("ex-bench");
    expect(result.map((s) => s.date)).toEqual(["2026-09-17", "2026-09-10"]);
    expect(result[0].sets.map((s) => s.setNumber)).toEqual([1, 3]);
  });

  it("does not apply a before cursor — full history, not the current History page", async () => {
    nextResult = {
      data: [session("2026-09-17", performedSets), session("2026-09-10", performedSets), session("2026-08-12", performedSets)],
      error: null,
    };
    expect(await getExerciseSessions("ex-bench")).toHaveLength(3);
    expect(lastBuilder!.calls.lt).toEqual([]);
  });

  it("excludes blank-only sessions", async () => {
    nextResult = { data: [session("2026-09-17", blankSets), session("2026-09-10", performedSets)], error: null };
    expect((await getExerciseSessions("ex-bench")).map((s) => s.date)).toEqual(["2026-09-10"]);
  });

  it("excludes an exercise with no sets at all", async () => {
    nextResult = { data: [session("2026-09-17", [])], error: null };
    expect(await getExerciseSessions("ex-bench")).toEqual([]);
  });

  it("excludes future-dated logs even if they come back from the query", async () => {
    nextResult = {
      data: [session(shiftDate(today(), 3), performedSets), session("2026-09-10", performedSets)],
      error: null,
    };
    expect((await getExerciseSessions("ex-bench")).map((s) => s.date)).toEqual(["2026-09-10"]);
  });

  it("duplicate exercise rows on one date count as one session", async () => {
    nextResult = {
      data: [
        {
          date: "2026-09-17",
          logged_exercises: [
            { exercise_id: "ex-bench", position: 0, logged_sets: [{ set_number: 1, reps: 5, weight: 80, weight_unit: "kg" }] },
            { exercise_id: "ex-bench", position: 1, logged_sets: [{ set_number: 1, reps: 5, weight: 80, weight_unit: "kg" }] },
          ],
        },
        session("2026-09-10", performedSets),
      ],
      error: null,
    };
    expect(await getExerciseSessions("ex-bench")).toHaveLength(2);
  });

  it("a set with reps only or weight only makes the session performed", async () => {
    nextResult = {
      data: [session("2026-09-17", [{ set_number: 1, reps: 12, weight: null }]), session("2026-09-10", [{ set_number: 1, reps: null, weight: 20 }])],
      error: null,
    };
    expect(await getExerciseSessions("ex-bench")).toHaveLength(2);
  });

  it("only counts the selected exercise's own sets, not a same-day sibling's", async () => {
    nextResult = {
      data: [
        {
          date: "2026-09-17",
          logged_exercises: [
            { exercise_id: "ex-other", position: 0, logged_sets: performedSets },
            { exercise_id: "ex-bench", position: 1, logged_sets: blankSets },
          ],
        },
      ],
      error: null,
    };
    expect(await getExerciseSessions("ex-bench")).toEqual([]);
  });

  it("does not filter by completed_at — an incomplete performed session still counts", async () => {
    nextResult = { data: [{ ...session("2026-09-17", performedSets), completed_at: null }], error: null };
    expect(await getExerciseSessions("ex-bench")).toHaveLength(1);
    expect(lastBuilder!.calls.eq.map((c) => c[0])).not.toContain("completed_at");
  });

  it("13. returns an empty history when the exercise has no sessions", async () => {
    nextResult = { data: [], error: null };
    expect(await getExerciseSessions("ex-never-logged")).toEqual([]);
  });

  it("returns an empty history on a query error", async () => {
    nextResult = { data: null, error: { message: "boom" } };
    expect(await getExerciseSessions("ex-bench")).toEqual([]);
  });

  it("returns an empty history when signed out, without querying", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await getExerciseSessions("ex-bench")).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it("14. unfiltered History query path is unchanged (plain embed, not inner join)", async () => {
    nextResult = { data: [], error: null };
    await getLogHistory({});
    expect(lastSelectArg).not.toContain("logged_exercises!inner");
  });
});

describe("getLogForDate plan title (for the historical day-summary view)", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("returns planTitle from the log's own plan join", async () => {
    nextResult = { data: { ...loggedLog({ plan: { title: "Leg Day" } }) }, error: null };
    const result = await getLogForDate("2026-09-10");
    expect(result?.planTitle).toBe("Leg Day");
  });

  it("returns null planTitle for a freeform log", async () => {
    nextResult = { data: { ...loggedLog({ plan: null }) }, error: null };
    const result = await getLogForDate("2026-09-10");
    expect(result?.planTitle).toBeNull();
  });
});
