import { beforeEach, describe, expect, it, vi } from "vitest";
import { shiftDate, today } from "./date";
import { HISTORY_WEEKS, QUICK_WORKOUTS } from "./quickWorkouts";

const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } });

type QueryResult = { data: unknown; error: unknown };

// getPersonalQuickWorkouts reads the exercises table twice (the sessions' exercises by name, then
// the person's usual ones by id), so results are routed by table and by the column filtered on.
let resultFor: (table: string, filters: Record<string, unknown>) => QueryResult = () => ({ data: [], error: null });
let rpcFor: (fn: string) => QueryResult = () => ({ data: [], error: null });
const calls: { table: string; filters: Record<string, unknown> }[] = [];
const rpcCalls: [string, Record<string, string>][] = [];

function makeBuilder(table: string) {
  const filters: Record<string, unknown> = {};
  const builder: Record<string, unknown> = {};
  for (const name of ["eq", "gte", "lte", "in", "is"]) {
    builder[name] = (column: string, value: unknown) => {
      filters[`${name}:${column}`] = value;
      return builder;
    };
  }
  builder.then = (resolve: (v: QueryResult) => unknown) => {
    calls.push({ table, filters });
    return Promise.resolve(resultFor(table, filters)).then(resolve);
  };
  return builder;
}

const from = vi.fn((table: string) => ({ select: () => makeBuilder(table) }));
const rpc = vi.fn((fn: string, args: Record<string, string>) => {
  rpcCalls.push([fn, args]);
  return Promise.resolve(rpcFor(fn));
});

vi.mock("@/lib/userDate", async () => {
  const { today } = await import("./date");
  return { getToday: async () => today() };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from, rpc }),
}));

const { getPersonalQuickWorkouts } = await import("./queries");

const todayStr = today();
const from8Weeks = shiftDate(todayStr, -(HISTORY_WEEKS * 7 - 1));

const exerciseRow = (name: string, equipment: string, muscles: string[]) => ({
  id: `id-${name}`,
  name,
  equipment,
  exercise_muscle_groups: muscles.map((m) => ({ muscle_group: { name: m } })),
});
const LIBRARY = [
  exerciseRow("Goblet Squat", "Dumbbell", ["Quads", "Glutes"]),
  exerciseRow("Dumbbell Bench Press", "Dumbbell", ["Chest", "Triceps", "Shoulders"]),
  exerciseRow("Single-Arm Dumbbell Row", "Dumbbell", ["Back", "Biceps"]),
  exerciseRow("Glute Bridge", "Bodyweight", ["Glutes", "Hamstrings"]),
  exerciseRow("Dead Bug", "Bodyweight", ["Core"]),
];
const BENCH = exerciseRow("Barbell Bench Press", "Barbell", ["Chest", "Triceps", "Shoulders"]);

const set = (reps: number | null, weight: number | null, set_type = "working") => ({ reps, weight, set_type });
const log = (date: string, exercises: { exercise_id: string; logged_sets: ReturnType<typeof set>[] }[]) => ({
  date,
  logged_exercises: exercises,
});

describe("getPersonalQuickWorkouts", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    calls.length = 0;
    rpcCalls.length = 0;
    rpcFor = () => ({ data: [], error: null });
  });

  it("reads the last 8 weeks of the person's own logs and set counts", async () => {
    resultFor = (table, f) => (table === "exercises" && f["in:name"] ? { data: LIBRARY, error: null } : { data: [], error: null });
    await getPersonalQuickWorkouts(false);

    expect(rpcCalls).toEqual([["muscle_set_counts", { p_from: from8Weeks, p_to: todayStr }]]);
    const logs = calls.find((c) => c.table === "workout_logs");
    expect(logs?.filters).toEqual({ "eq:user_id": "user-1", "gte:date": from8Weeks, "lte:date": todayStr });
    const library = calls.find((c) => c.table === "exercises" && c.filters["in:name"]);
    expect(library?.filters["is:user_id"]).toBeNull();
  });

  it("swaps in an exercise done in two sessions, but not one whose second session was only warm-ups", async () => {
    resultFor = (table, f) => {
      if (table === "exercises" && f["in:name"]) return { data: LIBRARY, error: null };
      if (table === "exercises" && f["in:id"]) {
        const ids = f["in:id"] as string[];
        return { data: [BENCH].filter((e) => ids.includes(e.id)), error: null };
      }
      if (table === "workout_logs") {
        return {
          data: [
            log(shiftDate(todayStr, -20), [{ exercise_id: BENCH.id, logged_sets: [set(8, 60)] }]),
            log(shiftDate(todayStr, -13), [{ exercise_id: BENCH.id, logged_sets: [set(8, 62.5)] }]),
            // Warm-ups only: doesn't make the squat a usual exercise.
            log(shiftDate(todayStr, -13), [{ exercise_id: "id-Back Squat", logged_sets: [set(5, 40, "warmup")] }]),
            log(shiftDate(todayStr, -6), [{ exercise_id: "id-Back Squat", logged_sets: [set(5, 80)] }]),
          ],
          error: null,
        };
      }
      return { data: [], error: null };
    };

    const workouts = await getPersonalQuickWorkouts(false);
    const usualQuery = calls.find((c) => c.table === "exercises" && c.filters["in:id"]);
    expect(usualQuery?.filters["in:id"]).toEqual([BENCH.id]);

    const fullBody = workouts.find((w) => w.id === "full-body-reset");
    expect(fullBody?.exercises.map((e) => e.name)).toEqual([
      "Goblet Squat",
      "Barbell Bench Press",
      "Single-Arm Dumbbell Row",
      "Glute Bridge",
      "Dead Bug",
    ]);
    expect(fullBody?.usualCount).toBe(1);
  });

  it("counts a session once when the exercise appears twice in one log", async () => {
    resultFor = (table, f) => {
      if (table === "exercises" && f["in:name"]) return { data: LIBRARY, error: null };
      if (table === "workout_logs") {
        const twice = { exercise_id: BENCH.id, logged_sets: [set(8, 60)] };
        return { data: [log(shiftDate(todayStr, -3), [twice, twice])], error: null };
      }
      return { data: [], error: null };
    };
    await getPersonalQuickWorkouts(false);
    expect(calls.some((c) => c.table === "exercises" && c.filters["in:id"])).toBe(false);
  });

  it("falls back to the plain sessions, in list order, when the history can't be read", async () => {
    resultFor = (table, f) =>
      table === "exercises" && f["in:name"] ? { data: LIBRARY, error: null } : { data: null, error: { message: "boom" } };
    rpcFor = () => ({ data: null, error: { message: "boom" } });

    const workouts = await getPersonalQuickWorkouts(true);
    expect(workouts.map((w) => w.id)).toEqual(QUICK_WORKOUTS.map((w) => w.id));
    expect(workouts.every((w) => w.usualCount === 0)).toBe(true);
  });

  it("only reads the shared library when signed out", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    resultFor = () => ({ data: LIBRARY, error: null });
    const workouts = await getPersonalQuickWorkouts(false);
    expect(rpcCalls).toEqual([]);
    expect(calls.map((c) => c.table)).toEqual(["exercises"]);
    expect(workouts[0].id).toBe("full-body-reset");
  });
});
