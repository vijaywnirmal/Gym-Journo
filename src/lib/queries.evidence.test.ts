import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// End-to-end check of getTrainingEvidence against a small in-memory stand-in for the Supabase
// query builder (eq, lt, lte, gte, order, limit, maybeSingle, plus the embedded-exercise inner
// filter) across the tables the evidence reads. It models the intended behaviour; it is not the
// real service. "Today" is pinned to Sep 21, 2026 (a Monday).

type Row = Record<string, unknown>;
type SetRow = { id: string; set_number: number; reps: number | null; weight: number | null; weight_unit: string };
type ExerciseRow = { id: string; exercise_id: string; position: number; logged_sets: SetRow[] };
type LogRow = { id: string; user_id: string; date: string; completed_at: string | null; logged_exercises: ExerciseRow[] };

const db: { workout_logs: LogRow[]; profiles: Row[]; body_measurements: Row[]; exercises: Row[] } = {
  workout_logs: [],
  profiles: [],
  body_measurements: [],
  exercises: [],
};
let signedIn = true;

function query(table: keyof typeof db) {
  const filters: ((row: Row) => boolean)[] = [];
  let embeddedExerciseId: string | null = null;
  let orderBy: { column: string; ascending: boolean } | null = null;
  let max: number | null = null;

  const builder = {
    eq(column: string, value: unknown) {
      if (column === "logged_exercises.exercise_id") embeddedExerciseId = value as string;
      else if (column !== "user_id") filters.push((row) => row[column] === value);
      return builder;
    },
    gte(column: string, value: string) {
      filters.push((row) => (row[column] as string) >= value);
      return builder;
    },
    lte(column: string, value: string) {
      filters.push((row) => (row[column] as string) <= value);
      return builder;
    },
    lt(column: string, value: string) {
      filters.push((row) => (row[column] as string) < value);
      return builder;
    },
    order(column: string, options?: { ascending: boolean }) {
      orderBy = { column, ascending: options?.ascending ?? true };
      return builder;
    },
    limit(n: number) {
      max = n;
      return builder;
    },
    run(): Row[] {
      let rows = (db[table] as Row[]).filter((row) => filters.every((f) => f(row)));
      if (embeddedExerciseId) {
        const id = embeddedExerciseId;
        rows = rows
          .map((row) => ({
            ...row,
            logged_exercises: (row.logged_exercises as ExerciseRow[]).filter((le) => le.exercise_id === id),
          }))
          .filter((row) => (row.logged_exercises as ExerciseRow[]).length > 0);
      }
      if (orderBy) {
        const { column, ascending } = orderBy;
        rows = [...rows].sort((a, b) => ((a[column] as string) < (b[column] as string) ? -1 : 1) * (ascending ? 1 : -1));
      }
      return max === null ? rows : rows.slice(0, max);
    },
    async maybeSingle() {
      return { data: builder.run()[0] ?? null, error: null };
    },
    then(resolve: (value: { data: Row[]; error: null }) => unknown) {
      return Promise.resolve({ data: builder.run(), error: null }).then(resolve);
    },
  };
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: "user-1" } : null } }) },
    from: (table: keyof typeof db) => ({ select: () => query(table) }),
  }),
}));

const { getTrainingEvidence, getPerformedWorkoutDates, getWeeklyTrainingDays } = await import("./queries");
const { recentPerformedExerciseIds } = await import("@/lib/analyze/exerciseSessions");

const BENCH = "ex-bench";
const ROW = "ex-row";
const SQUAT = "ex-squat";

function sets(...values: [number | null, number | null, string?][]): SetRow[] {
  return values.map(([reps, weight, unit], i) => ({
    id: `s${i}`,
    set_number: i + 1,
    reps,
    weight,
    weight_unit: unit ?? "kg",
  }));
}
const exercise = (exerciseId: string, setRows: SetRow[], position = 0): ExerciseRow => ({
  id: `le-${exerciseId}-${position}`,
  exercise_id: exerciseId,
  position,
  logged_sets: setRows,
});
const log = (date: string, exercises: ExerciseRow[], completed = false): LogRow => ({
  id: `log-${date}`,
  user_id: "user-1",
  date,
  completed_at: completed ? `${date}T18:00:00Z` : null,
  logged_exercises: exercises,
});

function seed() {
  signedIn = true;
  db.exercises = [
    { id: BENCH, user_id: null, name: "Bench Press", equipment: null, notes: null, exercise_muscle_groups: [] },
    { id: ROW, user_id: null, name: "Barbell Row", equipment: null, notes: null, exercise_muscle_groups: [] },
    { id: SQUAT, user_id: null, name: "Back Squat", equipment: null, notes: null, exercise_muscle_groups: [] },
  ];
  db.profiles = [
    { id: "user-1", primary_goal: "build_muscle", experience_level: "intermediate", training_days_per_week: 4, target_weight_kg: 75 },
  ];
  db.body_measurements = [
    { id: "m1", user_id: "user-1", date: "2026-07-02", weight_kg: 70, notes: null, created_at: "", updated_at: "" },
    { id: "m2", user_id: "user-1", date: "2026-09-18", weight_kg: 72, notes: null, created_at: "", updated_at: "" },
    { id: "m3", user_id: "user-1", date: "2026-09-30", weight_kg: 99, notes: null, created_at: "", updated_at: "" }, // future
  ];
  db.workout_logs = [
    log("2026-09-25", [exercise(BENCH, sets([5, 100]))]), // future
    log("2026-09-20", [exercise(BENCH, sets([8, 82.5], [7, 82.5])), exercise(ROW, sets([null, null]), 1)]), // Row is blank-only
    log("2026-09-17", [exercise(BENCH, sets([null, null]))]), // blank only
    log("2026-09-15", [exercise(BENCH, sets([6, 80], [7, 80])), exercise(SQUAT, sets([5, 100]), 1)], true),
    log("2026-09-08", [exercise(BENCH, sets([6, 77.5]))]),
    log("2026-06-12", [exercise(BENCH, sets([5, 70])), exercise(ROW, sets([8, 60]), 1)]), // older than the 28-day window
  ];
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 21, 12, 0, 0));
});
afterAll(() => vi.useRealTimers());

describe("recentPerformedExerciseIds", () => {
  const withSets = (...v: [number | null, number | null][]) => v.map(([reps, weight]) => ({ reps, weight }));

  it("lists each exercise once, most recently performed first", () => {
    const ids = recentPerformedExerciseIds(
      [
        { date: "2026-09-10", logged_exercises: [{ exercise_id: "a", logged_sets: withSets([5, 50]) }] },
        { date: "2026-09-18", logged_exercises: [{ exercise_id: "b", logged_sets: withSets([5, 50]) }, { exercise_id: "a", logged_sets: withSets([5, 50]) }] },
        { date: "2026-09-12", logged_exercises: [{ exercise_id: "c", logged_sets: withSets([5, 50]) }] },
      ],
      "2026-09-21"
    );
    // a and b were both last performed Sep 18 (tie broken by id); c on Sep 12.
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("ignores blank-only occurrences and future dates", () => {
    const ids = recentPerformedExerciseIds(
      [
        { date: "2026-09-18", logged_exercises: [{ exercise_id: "blank", logged_sets: withSets([null, null]) }, { exercise_id: "real", logged_sets: withSets([5, 50]) }] },
        { date: "2026-09-30", logged_exercises: [{ exercise_id: "future", logged_sets: withSets([5, 50]) }] },
      ],
      "2026-09-21"
    );
    expect(ids).toEqual(["real"]);
  });
});

describe("getPerformedWorkoutDates / getWeeklyTrainingDays", () => {
  it("returns distinct performed, non-future dates ascending, from the given date", async () => {
    seed();
    expect(await getPerformedWorkoutDates("2026-09-01")).toEqual(["2026-09-08", "2026-09-15", "2026-09-20"]);
  });

  it("returns null when signed out, so 'no workouts' and 'couldn't read' stay distinguishable", async () => {
    seed();
    signedIn = false;
    expect(await getPerformedWorkoutDates("2026-09-01")).toBeNull();
    expect(await getWeeklyTrainingDays()).toEqual([]);
  });

  it("the weekly breakdown is built from the same dates", async () => {
    seed();
    const weeks = await getWeeklyTrainingDays();
    expect(weeks[0]).toMatchObject({ weekStart: "2026-09-20", daysPerformed: 1, performedDates: ["2026-09-20"] });
    expect(weeks[1]).toMatchObject({ weekStart: "2026-09-13", daysPerformed: 1, performedDates: ["2026-09-15"] });
  });
});

describe("getTrainingEvidence", () => {
  it("assembles evidence from canonical-definition data only", async () => {
    seed();
    const evidence = (await getTrainingEvidence())!;
    expect(evidence.asOf).toBe("2026-09-21");

    // Goal
    expect(evidence.goal).toMatchObject({ primaryGoal: "build_muscle", trainingDaysPerWeek: 4, targetWeightKg: 75 });

    // Training: blank Sep 17 and future Sep 25 are not workout days.
    expect(evidence.training.recent.rolling[0]).toMatchObject({ windowDays: 7, daysPerformed: 2 }); // Sep 15, Sep 20
    expect(evidence.training.recent.rolling[1]).toMatchObject({ windowDays: 28, daysPerformed: 3 }); // + Sep 8
    expect(evidence.training.recent.lastPerformedWorkoutDate).toBe("2026-09-20");
    expect(evidence.training.weekly.completedWeeks[0]).toMatchObject({
      weekStart: "2026-09-13",
      daysPerformed: 1,
      differenceFromTarget: -3,
    });

    // Body weight: future measurement ignored.
    expect(evidence.bodyWeight).toMatchObject({
      latest: { date: "2026-09-18", weightKg: 72 },
      earliest: { date: "2026-07-02", weightKg: 70 },
      changeKg: 2,
      distanceToTargetKg: -3,
    });
  });

  it("includes only exercises performed in the last 28 days, most recent first, with full-history counts", async () => {
    seed();
    const { exercises } = (await getTrainingEvidence())!;
    // Bench (Sep 20), Squat (Sep 15). Row was only ever blank inside the window; its June session is outside it.
    expect(exercises.map((e) => e.exerciseId)).toEqual([BENCH, SQUAT]);
    const bench = exercises[0];
    expect(bench.name).toBe("Bench Press");
    // Performed Bench sessions: Sep 20, 15, 8 and Jun 12 — not the blank Sep 17 or the future Sep 25.
    expect(bench).toMatchObject({ sessionsPerformed: 4, firstPerformedDate: "2026-06-12", lastPerformedDate: "2026-09-20" });
    expect(bench.recentSessions.map((s) => s.date)).toEqual(["2026-09-20", "2026-09-15", "2026-09-08", "2026-06-12"]);
    expect(bench.recentSessions[0].daysSincePrevious).toBe(5);
    expect(bench.recentSessions[0].sets[0].changeVsPreviousSession).toEqual({
      weight: { type: "delta", delta: 2.5, unit: "kg" },
      reps: { type: "delta", delta: 2 },
    });
  });

  it("is plain JSON and free of evaluative language end to end", async () => {
    seed();
    const evidence = (await getTrainingEvidence())!;
    expect(JSON.parse(JSON.stringify(evidence))).toEqual(evidence);
    expect(JSON.stringify(evidence).toLowerCase()).not.toMatch(/(?<!in )progress|improv|plateau|on track|recommend|should/);
  });

  it("degrades to empty facts for a user with no data, not an error", async () => {
    seed();
    db.workout_logs = [];
    db.body_measurements = [];
    const evidence = (await getTrainingEvidence())!;
    expect(evidence.exercises).toEqual([]);
    expect(evidence.bodyWeight).toBeNull();
    expect(evidence.training.recent.rolling.every((w) => w.daysPerformed === 0)).toBe(true);
    expect(evidence.training.recent.lastPerformedWorkoutDate).toBeNull();
  });

  it("returns null when signed out", async () => {
    seed();
    signedIn = false;
    expect(await getTrainingEvidence()).toBeNull();
  });

  it("caps the exercise list and says so", async () => {
    seed();
    const ids = Array.from({ length: 14 }, (_, i) => `ex-${String(i).padStart(2, "0")}`);
    db.exercises = ids.map((id) => ({ id, user_id: null, name: id, equipment: null, notes: null, exercise_muscle_groups: [] }));
    db.workout_logs = ids.map((id, i) => log(`2026-09-${String(20 - i).padStart(2, "0")}`, [exercise(id, sets([5, 50]))]));
    const evidence = (await getTrainingEvidence())!;
    expect(evidence.exercises).toHaveLength(12);
    expect(evidence.exercises[0].exerciseId).toBe("ex-00"); // performed most recently
    expect(evidence.globalLimitations).toContain("exercise_list_truncated");
  });
});
