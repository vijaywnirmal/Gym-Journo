import { describe, expect, it, vi, beforeEach } from "vitest";

const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } });

type QueryResult = { data: unknown; error: unknown };

// getLogHistory awaits the query builder directly (no .single()/.maybeSingle()), so the builder
// itself must be thenable. getLogForDate still terminates with .maybeSingle(). This mock
// supports both shapes and records every filter call so tests can assert on them.
function makeBuilder(result: QueryResult) {
  const calls: Record<string, unknown[][]> = { eq: [], order: [], limit: [], lt: [] };
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

const { getLogHistory, getLogForDate, getExerciseRecurrence } = await import("./queries");

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

describe("getLogHistory exercise filter + pagination interaction", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("filters at the query level (inner-joins logged_exercises) rather than post-fetch", async () => {
    nextResult = { data: [], error: null };
    await getLogHistory({ exerciseId: "ex-1", pageSize: 30 });
    expect(lastSelectArg).toContain("logged_exercises!inner");
    expect(lastBuilder!.calls.eq).toContainEqual(["logged_exercises.exercise_id", "ex-1"]);
  });

  it("uses a plain (non-inner) embed when no exercise filter is set", async () => {
    nextResult = { data: [], error: null };
    await getLogHistory({});
    expect(lastSelectArg).not.toContain("logged_exercises!inner");
  });

  it("combines the exercise filter with a before cursor correctly", async () => {
    nextResult = { data: [], error: null };
    await getLogHistory({ exerciseId: "ex-1", before: "2026-09-05", pageSize: 30 });
    expect(lastBuilder!.calls.eq).toContainEqual(["logged_exercises.exercise_id", "ex-1"]);
    expect(lastBuilder!.calls.lt).toEqual([["date", "2026-09-05"]]);
    // The limit(pageSize + 1) trick must still be used for accurate hasMore under a filter.
    expect(lastBuilder!.calls.limit).toEqual([[31]]);
  });
});

describe("getLogHistory per-exercise session isolation (Phase 12)", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("keeps only the selected exercise's logged_exercises entry, dropping same-day siblings", async () => {
    nextResult = {
      data: [
        loggedLog({
          id: "log-1",
          date: "2026-09-10",
          logged_exercises: [
            loggedExercise({
              id: "le-bench",
              exercise_id: "ex-bench",
              position: 0,
              exercise: { id: "ex-bench", name: "Bench Press" },
              logged_sets: [loggedSet({ id: "s1", set_number: 1, weight: 80, reps: 5 })],
            }),
            loggedExercise({
              id: "le-row",
              exercise_id: "ex-row",
              position: 1,
              exercise: { id: "ex-row", name: "Barbell Row" },
              logged_sets: [loggedSet({ id: "s2", set_number: 1, weight: 60, reps: 8 })],
            }),
          ],
        }),
      ],
      error: null,
    };

    const result = await getLogHistory({ exerciseId: "ex-bench" });
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0].logged_exercises).toHaveLength(1);
    expect(result.logs[0].logged_exercises?.[0].exercise_id).toBe("ex-bench");
    expect(result.logs[0].logged_exercises?.some((le) => le.exercise_id === "ex-row")).toBe(false);
  });

  it("preserves set order (by set_number) within the isolated exercise", async () => {
    nextResult = {
      data: [
        loggedLog({
          logged_exercises: [
            loggedExercise({
              exercise_id: "ex-bench",
              logged_sets: [
                loggedSet({ id: "s3", set_number: 3, weight: 80, reps: 5 }),
                loggedSet({ id: "s1", set_number: 1, weight: 82.5, reps: 5 }),
                loggedSet({ id: "s2", set_number: 2, weight: 80, reps: 6 }),
              ],
            }),
          ],
        }),
      ],
      error: null,
    };

    const result = await getLogHistory({ exerciseId: "ex-bench" });
    const setNumbers = result.logs[0].logged_exercises?.[0].logged_sets?.map((s) => s.set_number);
    expect(setNumbers).toEqual([1, 2, 3]);
  });

  it("preserves weight, weight_unit, and reps values exactly, without inventing missing ones", async () => {
    nextResult = {
      data: [
        loggedLog({
          logged_exercises: [
            loggedExercise({
              exercise_id: "ex-bench",
              logged_sets: [
                loggedSet({ id: "s1", set_number: 1, weight: 82.5, reps: 5, weight_unit: "kg" }),
                loggedSet({ id: "s2", set_number: 2, weight: null, reps: null, weight_unit: "kg" }),
              ],
            }),
          ],
        }),
      ],
      error: null,
    };

    const result = await getLogHistory({ exerciseId: "ex-bench" });
    const sets = result.logs[0].logged_exercises?.[0].logged_sets;
    expect(sets?.[0]).toMatchObject({ weight: 82.5, reps: 5, weight_unit: "kg" });
    expect(sets?.[1]).toMatchObject({ weight: null, reps: null, weight_unit: "kg" });
  });

  it("renders multiple sessions, each isolated to the selected exercise", async () => {
    nextResult = {
      data: [
        loggedLog({
          id: "log-recent",
          date: "2026-09-17",
          logged_exercises: [
            loggedExercise({
              exercise_id: "ex-bench",
              logged_sets: [
                loggedSet({ id: "a1", set_number: 1, weight: 82.5, reps: 5 }),
                loggedSet({ id: "a2", set_number: 2, weight: 80, reps: 6 }),
                loggedSet({ id: "a3", set_number: 3, weight: 80, reps: 5 }),
              ],
            }),
          ],
        }),
        loggedLog({
          id: "log-older",
          date: "2026-09-10",
          logged_exercises: [
            loggedExercise({
              exercise_id: "ex-bench",
              logged_sets: [
                loggedSet({ id: "b1", set_number: 1, weight: 80, reps: 5 }),
                loggedSet({ id: "b2", set_number: 2, weight: 80, reps: 5 }),
              ],
            }),
          ],
        }),
      ],
      error: null,
    };

    const result = await getLogHistory({ exerciseId: "ex-bench" });
    expect(result.logs.map((l) => l.date)).toEqual(["2026-09-17", "2026-09-10"]);
    expect(result.logs[0].logged_exercises?.[0].logged_sets).toHaveLength(3);
    expect(result.logs[1].logged_exercises?.[0].logged_sets).toHaveLength(2);
  });

  it("does not filter logged_exercises when no exerciseId is given (unfiltered History unchanged)", async () => {
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

  it("returns an empty page (not an error) when the exercise has no matching sessions", async () => {
    nextResult = { data: [], error: null };
    const result = await getLogHistory({ exerciseId: "ex-never-logged" });
    expect(result).toEqual({ logs: [], hasMore: false });
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

describe("getExerciseRecurrence (Phase 17)", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    from.mockClear();
  });

  it("inner-joins logged_exercises and filters by exercise_id, with no page cursor or limit", async () => {
    nextResult = { data: [], error: null };
    await getExerciseRecurrence("ex-bench");
    expect(lastSelectArg).toContain("logged_exercises!inner");
    expect(lastBuilder!.calls.eq).toContainEqual(["user_id", "user-1"]);
    expect(lastBuilder!.calls.eq).toContainEqual(["logged_exercises.exercise_id", "ex-bench"]);
    expect(lastBuilder!.calls.lt).toEqual([]);
    expect(lastBuilder!.calls.limit).toEqual([]);
  });

  it("6. does not apply a before cursor — full history, not the current History page", async () => {
    nextResult = {
      data: [{ date: "2026-09-17" }, { date: "2026-09-10" }, { date: "2026-08-12" }],
      error: null,
    };
    const result = await getExerciseRecurrence("ex-bench");
    expect(result).toEqual({ count: 3, lastDate: "2026-09-17" });
    expect(lastBuilder!.calls.lt).toEqual([]);
    expect(lastBuilder!.calls.limit).toEqual([]);
  });

  it("4. duplicate dates on the query result count as one session", async () => {
    nextResult = {
      data: [{ date: "2026-09-17" }, { date: "2026-09-17" }, { date: "2026-09-10" }],
      error: null,
    };
    const result = await getExerciseRecurrence("ex-bench");
    expect(result).toEqual({ count: 2, lastDate: "2026-09-17" });
  });

  it("does not filter by completed_at", async () => {
    nextResult = { data: [{ date: "2026-09-17" }], error: null };
    await getExerciseRecurrence("ex-bench");
    const filteredColumns = lastBuilder!.calls.eq.map((c) => c[0]);
    expect(filteredColumns).not.toContain("completed_at");
  });

  it("1. returns null when the exercise has no sessions", async () => {
    nextResult = { data: [], error: null };
    expect(await getExerciseRecurrence("ex-never-logged")).toBeNull();
  });

  it("returns null when signed out without querying", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await getExerciseRecurrence("ex-bench");
    expect(result).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("8. unfiltered History query path is unchanged (plain embed, not inner join)", async () => {
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
