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

const { getLastCompletedLog, getLogHistory, getExerciseRecurrence } = await import("./queries");
const { summarizePerformedSessions, formatSessionSummary } = await import("@/app/history/sessionSummary");
const { formatExerciseRecurrence } = await import("@/app/history/exerciseRecurrence");

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

describe("filtered History — Phase 16 'shown' and Phase 17 'performed' share one definition", () => {
  const dataset = () => [
    log("2026-09-25", [exercise(BENCH, sets([5, 100]))]), // future, performed
    log("2026-09-19", [exercise(BENCH, sets([5, 80]))]), // performed
    log("2026-09-17", [exercise(BENCH, sets([null, null], [null, null]))]), // blank only
    log("2026-09-15", [exercise(BENCH, sets([5, 80]), 0), exercise(BENCH, sets([6, 80]), 1)]), // duplicate rows
    log("2026-09-10", [exercise(BENCH, sets([5, 77.5])), exercise(ROW, sets([8, 60]), 1)]),
    log("2026-09-01", [exercise(BENCH, sets([5, 75]))]),
    log("2026-08-20", [exercise(ROW, sets([8, 60]))]), // never benched
  ];

  it("5. the page summary and the full-history recurrence agree on which sessions are performed", async () => {
    logs = dataset();
    const page = await getLogHistory({ exerciseId: BENCH, pageSize: 30 });
    const shown = summarizePerformedSessions(page.logs, BENCH);
    const recurrence = await getExerciseRecurrence(BENCH);

    // Performed Bench sessions: Sep 19, 15, 10, 1 — not the blank Sep 17 or the future Sep 25.
    expect(shown).toEqual({ count: 4, earliestDate: "2026-09-01", latestDate: "2026-09-19" });
    expect(recurrence).toEqual({ count: 4, lastDate: "2026-09-19" });
    expect(formatSessionSummary(shown)).toBe("4 sessions shown · Tue, Sep 1 – Sat, Sep 19");
    expect(formatExerciseRecurrence(recurrence)).toBe("4 sessions performed · last on Sat, Sep 19");
  });

  it("7. pagination is unchanged (cursor over raw log dates); each page's line covers only its own performed sessions", async () => {
    logs = dataset();

    const first = await getLogHistory({ exerciseId: BENCH, pageSize: 4 });
    expect(first.logs.map((l) => l.date)).toEqual(["2026-09-25", "2026-09-19", "2026-09-17", "2026-09-15"]);
    expect(first.hasMore).toBe(true);
    // Sep 25 (future) and Sep 17 (blank) are on the page but are not performed sessions.
    expect(summarizePerformedSessions(first.logs, BENCH)).toEqual({
      count: 2,
      earliestDate: "2026-09-15",
      latestDate: "2026-09-19",
    });

    const second = await getLogHistory({ exerciseId: BENCH, before: "2026-09-15", pageSize: 4 });
    expect(second.logs.map((l) => l.date)).toEqual(["2026-09-10", "2026-09-01"]);
    expect(second.hasMore).toBe(false);
    expect(summarizePerformedSessions(second.logs, BENCH)).toEqual({
      count: 2,
      earliestDate: "2026-09-01",
      latestDate: "2026-09-10",
    });

    // Full history is independent of the page cursor and equals the pages' performed total.
    expect((await getExerciseRecurrence(BENCH))?.count).toBe(4);
  });

  it("an exercise with only blank sessions shows no 'shown' line and no recurrence line", async () => {
    logs = [log("2026-09-17", [exercise(BENCH, sets([null, null]))])];
    const page = await getLogHistory({ exerciseId: BENCH, pageSize: 30 });
    expect(page.logs).toHaveLength(1); // the raw card list is unchanged
    expect(summarizePerformedSessions(page.logs, BENCH)).toBeNull();
    expect(await getExerciseRecurrence(BENCH)).toBeNull();
  });

  it("the selected exercise's page summary ignores a performed same-day sibling", async () => {
    logs = [log("2026-09-10", [exercise(BENCH, sets([null, null]), 0), exercise(ROW, sets([8, 60]), 1)])];
    const page = await getLogHistory({ exerciseId: BENCH, pageSize: 30 });
    expect(summarizePerformedSessions(page.logs, BENCH)).toBeNull();
  });
});
