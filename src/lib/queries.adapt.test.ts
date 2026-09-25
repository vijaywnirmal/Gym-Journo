import { describe, expect, it, vi, beforeEach } from "vitest";
import { shiftDate, today } from "./date";

const getUser = vi.fn();
type QueryResult = { data: unknown; error: unknown };
let resultFor: (table: string) => QueryResult = () => ({ data: [], error: null });

function makeBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  for (const name of ["eq", "gte", "lte", "lt", "order", "limit", "in", "is"]) builder[name] = () => builder;
  builder.then = (resolve: (v: QueryResult) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}
const from = vi.fn((table: string) => ({ select: () => makeBuilder(resultFor(table)) }));

vi.mock("@/lib/userDate", async () => {
  const { today } = await import("./date");
  return { getToday: async () => today(), getUserTimeZone: async () => ({ signedIn: true, timeZone: null }) };
});
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser }, from }) }));

const { getAdaptSuggestions } = await import("./queries");

const t = today();
const pe = (id: string, exercise_id: string, target_weight: number | null = null) => ({
  id,
  exercise_id,
  position: 0,
  target_sets: 3,
  target_reps: 5,
  target_weight,
  target_weight_unit: "kg",
  exercise: { name: exercise_id === "sq" ? "Back Squat" : "Bench" },
});
const logRow = (date: string, exercise_id: string, weight: number, reps = 5) => ({
  date,
  logged_exercises: [
    {
      exercise_id,
      position: 0,
      logged_sets: [1, 2, 3].map((n) => ({ set_number: n, reps, weight, weight_unit: "kg", set_type: "working" })),
    },
  ],
});

describe("getAdaptSuggestions", () => {
  beforeEach(() => getUser.mockResolvedValue({ data: { user: { id: "user-1" } } }));

  it("suggests once per exercise, for its next planned occurrence, from earlier sessions only", async () => {
    resultFor = (table) => {
      if (table === "workout_plans")
        return {
          data: [
            { date: shiftDate(t, 1), title: "Legs", planned_exercises: [pe("pe-a", "sq")] },
            { date: shiftDate(t, 4), title: "Legs", planned_exercises: [pe("pe-b", "sq")] },
          ],
          error: null,
        };
      if (table === "recommendations") return { data: [], error: null };
      return { data: [logRow(shiftDate(t, -3), "sq", 100)], error: null };
    };
    const result = await getAdaptSuggestions();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      plannedExerciseId: "pe-a",
      exerciseName: "Back Squat",
      suggestion: { kind: "increase", proposedWeight: 102.5 },
    });
  });

  it("skips planned exercises that were already decided", async () => {
    resultFor = (table) => {
      if (table === "workout_plans") return { data: [{ date: shiftDate(t, 1), title: null, planned_exercises: [pe("pe-a", "sq")] }], error: null };
      if (table === "recommendations") return { data: [{ planned_exercise_id: "pe-a" }], error: null };
      return { data: [logRow(shiftDate(t, -3), "sq", 100)], error: null };
    };
    expect(await getAdaptSuggestions()).toEqual([]);
  });

  it("returns [] when signed out, with no plans, or on errors", async () => {
    resultFor = () => ({ data: null, error: { message: "boom" } });
    expect(await getAdaptSuggestions()).toEqual([]);
    resultFor = () => ({ data: [], error: null });
    expect(await getAdaptSuggestions()).toEqual([]);
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await getAdaptSuggestions()).toEqual([]);
  });
});
