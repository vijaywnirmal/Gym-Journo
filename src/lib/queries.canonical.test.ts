import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// End-to-end checks of the canonical R2-S1 semantics against a tiny in-memory stand-in for the
// Supabase query builder. Only the operators these queries use are implemented (eq, not, lt, lte,
// order, limit, maybeSingle, plus the embedded-exercise inner filter). It models the intended
// PostgREST behaviour; it is not the real service. "Today" is pinned to Sep 21, 2026.

type SetRow = { id: string; set_number: number; reps: number | null; weight: number | null; weight_unit: string };
type ExerciseRow = { id: string; exercise_id: string; position: number; logged_sets: SetRow[] };
type LogRow = {
  id: string;
  user_id: string;
  date: string;
  notes: string | null;
  completed_at: string | null;
  plan: null;
  logged_exercises: ExerciseRow[];
};

let logs: LogRow[] = [];

function query() {
  const filters: ((row: LogRow) => boolean)[] = [];
  let embeddedExerciseId: string | null = null;
  let descending = false;
  let max: number | null = null;

  const builder = {
    eq(column: string, value: unknown) {
      if (column === "logged_exercises.exercise_id") embeddedExerciseId = value as string;
      return builder;
    },
    not(column: string, _op: string, value: unknown) {
      filters.push((row) => (row as unknown as Record<string, unknown>)[column] !== value);
      return builder;
    },
    lt(column: string, value: string) {
      filters.push((row) => (row as unknown as Record<string, string>)[column] < value);
      return builder;
    },
    lte(column: string, value: string) {
      filters.push((row) => (row as unknown as Record<string, string>)[column] <= value);
      return builder;
    },
    order(_column: string, options: { ascending: boolean }) {
      descending = !options.ascending;
      return builder;
    },
    limit(n: number) {
      max = n;
      return builder;
    },
    run() {
      let rows = logs.filter((row) => filters.every((f) => f(row)));
      if (embeddedExerciseId) {
        const id = embeddedExerciseId;
        rows = rows
          .map((row) => ({ ...row, logged_exercises: row.logged_exercises.filter((le) => le.exercise_id === id) }))
          .filter((row) => row.logged_exercises.length > 0);
      }
      rows = [...rows].sort((a, b) => (a.date < b.date ? -1 : 1) * (descending ? -1 : 1));
      return max === null ? rows : rows.slice(0, max);
    },
    async maybeSingle() {
      return { data: builder.run()[0] ?? null, error: null };
    },
    then(resolve: (value: { data: LogRow[]; error: null }) => unknown) {
      return Promise.resolve({ data: builder.run(), error: null }).then(resolve);
    },
  };
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from: () => ({ select: () => query() }),
  }),
}));

const { getLastCompletedLog, getLogHistory, getExerciseSessions, getPreviousPerformance } = await import("./queries");
const { buildSessionViews, pageSessionViews } = await import("@/lib/analyze/exerciseSessions");
const { formatExerciseRecurrence, summarizeExerciseRecurrence } = await import("@/app/history/exerciseRecurrence");
const { formatSetChange } = await import("@/app/history/exerciseHistoryFormat");

const BENCH = "ex-bench";
const ROW = "ex-row";

function sets(...values: [number | null, number | null][]): SetRow[] {
  return values.map(([reps, weight], i) => ({
    id: `s${i}`,
    set_number: i + 1,
    reps,
    weight,
    weight_unit: "kg",
  }));
}
function exercise(exerciseId: string, setRows: SetRow[], position = 0): ExerciseRow {
  return { id: `le-${exerciseId}-${position}`, exercise_id: exerciseId, position, logged_sets: setRows };
}
function log(date: string, exercises: ExerciseRow[], completed = false): LogRow {
  return {
    id: `log-${date}`,
    user_id: "user-1",
    date,
    notes: null,
    completed_at: completed ? `${date}T18:00:00Z` : null,
    plan: null,
    logged_exercises: exercises,
  };
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 21, 12, 0, 0)); // Sep 21, 2026, local noon
});
afterAll(() => {
  vi.useRealTimers();
});

describe("getLastCompletedLog — future-dated completed logs (correction pass)", () => {
  it("6. returns Sep 18, never the future-dated Sep 22 completed log (today = Sep 21)", async () => {
    logs = [
      log("2026-09-22", [exercise(BENCH, sets([5, 80]))], true), // future, completed
      log("2026-09-18", [exercise(BENCH, sets([5, 80]))], true), // past, completed
    ];
    expect(await getLastCompletedLog()).toEqual({ date: "2026-09-18", title: null });
  });

  it("a completed log dated today is still eligible", async () => {
    logs = [log("2026-09-21", [], true), log("2026-09-18", [], true)];
    expect((await getLastCompletedLog())?.date).toBe("2026-09-21");
  });

  it("still requires completed_at — a newer incomplete log is ignored", async () => {
    logs = [log("2026-09-20", [exercise(BENCH, sets([5, 80]))], false), log("2026-09-18", [], true)];
    expect((await getLastCompletedLog())?.date).toBe("2026-09-18");
  });

  it("completion is not redefined by performed sets — a completed log with no sets still counts", async () => {
    logs = [log("2026-09-19", [exercise(BENCH, sets([null, null]))], true)];
    expect((await getLastCompletedLog())?.date).toBe("2026-09-19");
  });

  it("returns null when the only completed log is in the future", async () => {
    logs = [log("2026-09-22", [], true)];
    expect(await getLastCompletedLog()).toBeNull();
  });
});

describe("filtered History — longitudinal facts and comparisons over performed sessions", () => {
  const dataset = () => [
    log("2026-09-25", [exercise(BENCH, sets([5, 100]))]), // future, performed
    log("2026-09-19", [exercise(BENCH, sets([8, 82.5], [7, 82.5]))]), // performed
    log("2026-09-17", [exercise(BENCH, sets([null, null], [null, null]))]), // blank only
    log("2026-09-15", [exercise(BENCH, sets([6, 80], [null, null], [5, 80]))]), // performed + blank rows
    log("2026-09-10", [exercise(BENCH, sets([5, 77.5])), exercise(ROW, sets([8, 60]), 1)]),
    log("2026-09-01", [exercise(BENCH, sets([5, 75]))]),
    log("2026-08-20", [exercise(ROW, sets([8, 60]))]), // never benched
  ];

  it("full-history facts come only from performed, non-future sessions", async () => {
    logs = dataset();
    const sessions = await getExerciseSessions(BENCH);
    expect(sessions.map((s) => s.date)).toEqual(["2026-09-19", "2026-09-15", "2026-09-10", "2026-09-01"]);
    const recurrence = summarizeExerciseRecurrence(sessions.map((s) => s.date));
    expect(recurrence).toEqual({ count: 4, firstDate: "2026-09-01", lastDate: "2026-09-19" });
    expect(formatExerciseRecurrence(recurrence)).toEqual({
      countLine: "4 sessions performed",
      firstLine: "First performed: Sep 1, 2026",
      lastLine: "Last performed: Sep 19, 2026",
    });
  });

  it("12. pagination pages over performed sessions; facts and comparisons don't depend on the page", async () => {
    logs = dataset();
    const sessions = await getExerciseSessions(BENCH);
    const views = buildSessionViews(sessions);

    const first = pageSessionViews(views, { pageSize: 2 });
    expect(first.views.map((v) => v.date)).toEqual(["2026-09-19", "2026-09-15"]);
    expect(first.hasMore).toBe(true);
    // The oldest card on page 1 (Sep 15) is compared with Sep 10, which is on page 2 — and the
    // blank Sep 17 log between Sep 19 and Sep 15 is not a session, so Sep 19 compares with Sep 15.
    expect(first.views[0].previousDate).toBe("2026-09-15");
    expect(first.views[0].daysSincePrevious).toBe(4);
    expect(first.views[1].previousDate).toBe("2026-09-10");
    expect(first.views[1].daysSincePrevious).toBe(5);

    const second = pageSessionViews(views, { before: "2026-09-15", pageSize: 2 });
    expect(second.views.map((v) => v.date)).toEqual(["2026-09-10", "2026-09-01"]);
    expect(second.hasMore).toBe(false);

    // Same facts whichever page is on screen.
    expect(summarizeExerciseRecurrence(sessions.map((s) => s.date))?.count).toBe(4);
  });

  it("10. compares same-numbered sets with the previous real performed session (blank Sep 17 skipped)", async () => {
    logs = dataset();
    const [latest] = buildSessionViews(await getExerciseSessions(BENCH));
    // Sep 19: set 1 = 8 × 82.5, set 2 = 7 × 82.5.  Previous performed (Sep 15): set 1 = 6 × 80, set 3 = 5 × 80.
    expect(formatSetChange(latest.sets[0].comparison)).toBe("+2.5 kg · +2 reps");
    // Sep 15 has no set 2 (blank), so Sep 19's set 2 has nothing to compare against.
    expect(latest.sets[1].comparison).toBeNull();
  });

  it("13. an exercise whose only sessions are blank has no history and no facts", async () => {
    logs = [log("2026-09-17", [exercise(BENCH, sets([null, null]))])];
    const sessions = await getExerciseSessions(BENCH);
    expect(sessions).toEqual([]);
    expect(summarizeExerciseRecurrence(sessions.map((s) => s.date))).toBeNull();
    expect(pageSessionViews(buildSessionViews(sessions), { pageSize: 30 })).toEqual({ views: [], hasMore: false });
  });

  it("the selected exercise's history ignores a performed same-day sibling", async () => {
    logs = [log("2026-09-10", [exercise(BENCH, sets([null, null]), 0), exercise(ROW, sets([8, 60]), 1)])];
    expect(await getExerciseSessions(BENCH)).toEqual([]);
    expect((await getExerciseSessions(ROW)).map((s) => s.date)).toEqual(["2026-09-10"]);
  });

  it("14. unfiltered History is unchanged — the raw log list still includes blank and future logs", async () => {
    logs = dataset();
    const page = await getLogHistory({ pageSize: 30 });
    expect(page.logs.map((l) => l.date)).toEqual([
      "2026-09-25",
      "2026-09-19",
      "2026-09-17",
      "2026-09-15",
      "2026-09-10",
      "2026-09-01",
      "2026-08-20",
    ]);
  });

  it("15. the logger's previous-performance lookup (Phase 11) skips the blank latest session and matches the same performed sets", async () => {
    logs = dataset();
    const previous = await getPreviousPerformance(BENCH, "2026-09-19");
    expect(previous?.date).toBe("2026-09-15"); // not the blank Sep 17
    expect(previous?.sets.map((s) => s.setNumber)).toEqual([1, 3]);
    // The History comparison and the logger's lookup agree on the previous real session.
    const [latest] = buildSessionViews(await getExerciseSessions(BENCH));
    expect(latest.previousDate).toBe(previous?.date);
  });
});
