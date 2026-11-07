import { describe, expect, it } from "vitest";
import { buildExportDocument, planBlocks, workoutBlocks } from "./dataExport";
import type { WorkoutLog, WorkoutPlan } from "./types";

const set = (n: number, values: Record<string, unknown>) => ({
  id: `s${n}`,
  logged_exercise_id: "le",
  set_number: n,
  reps: null,
  weight: null,
  weight_unit: "kg",
  notes: null,
  ...values,
});

const log = (date: string, exercises: WorkoutLog["logged_exercises"], notes: string | null = null): WorkoutLog => ({
  id: date,
  user_id: "u",
  plan_id: null,
  date,
  notes,
  completed_at: null,
  logged_exercises: exercises,
});

describe("workoutBlocks", () => {
  it("lists each day newest first, exercises in order, performed sets only", () => {
    const blocks = workoutBlocks([
      log("2026-11-01", [
        {
          id: "a", log_id: "l", exercise_id: "e1", position: 1, exercise: { name: "Plank" } as never,
          logged_sets: [set(1, { duration_seconds: 90 })],
        },
        {
          id: "b", log_id: "l", exercise_id: "e2", position: 0, exercise: { name: "Bench Press" } as never,
          notes: "Felt strong",
          logged_sets: [set(2, { weight: 60, reps: 8, rpe: 8 }), set(1, { weight: 40, reps: 10, set_type: "warmup" }), set(3, {})],
        },
      ]),
      log("2026-11-03", [
        {
          id: "c", log_id: "l", exercise_id: "e3", position: 0, exercise: { name: "Treadmill Run" } as never,
          logged_sets: [set(1, { distance: 5, duration_seconds: 1710, distance_unit: "km" })],
        },
      ], "Easy run"),
    ]);
    expect(blocks).toEqual([
      { heading: "Tue 3 Nov 2026", lines: ["Treadmill Run: 5 km in 28:30 (5:42 /km)", "Workout note: Easy run"] },
      {
        heading: "Sun 1 Nov 2026",
        lines: ["Bench Press: 40kg × 10 (Warm-up), 60kg × 8 (RPE 8)", "    Note: Felt strong", "Plank: 1:30"],
      },
    ]);
  });

  it("leaves out days with nothing recorded", () => {
    const empty = { id: "a", log_id: "l", exercise_id: "e", position: 0, exercise: { name: "Squat" } as never, logged_sets: [set(1, {})] };
    expect(workoutBlocks([log("2026-11-01", [empty])])).toEqual([]);
  });
});

describe("planBlocks", () => {
  const plan = (values: Partial<WorkoutPlan>): WorkoutPlan =>
    ({ id: "p", user_id: "u", date: "2026-11-05", title: null, is_rest_day: false, planned_exercises: [], ...values }) as WorkoutPlan;

  it("shows targets, rest days and titles", () => {
    expect(
      planBlocks([
        plan({
          title: "Push",
          planned_exercises: [
            { id: "1", plan_id: "p", exercise_id: "e", position: 0, target_sets: 3, target_reps: 8, target_weight: 60, target_weight_unit: "kg", exercise: { name: "Bench Press" } as never },
            { id: "2", plan_id: "p", exercise_id: "f", position: 1, target_sets: 3, target_reps: null, target_weight: null, target_weight_unit: "kg", exercise: { name: "Plank" } as never },
          ],
        }),
        plan({ date: "2026-11-06", is_rest_day: true, off_kind: "rest" }),
        plan({ date: "2026-11-07", is_rest_day: true, off_kind: "absence", title: "Sick" }),
      ])
    ).toEqual([
      { heading: "Sat 7 Nov 2026 · Sick", lines: ["Day off"] },
      { heading: "Fri 6 Nov 2026", lines: ["Rest day"] },
      { heading: "Thu 5 Nov 2026 · Push", lines: ["Bench Press: 3 × 8 at 60 kg", "Plank: 3 sets"] },
    ]);
  });
});

describe("buildExportDocument", () => {
  it("names the person and says when nothing is there yet", () => {
    const doc = buildExportDocument({ name: "Robin Tester", generatedOn: "2026-11-07", logs: [], plans: [], bodyWeight: [] });
    expect(doc.subtitle).toBe("Robin Tester · Downloaded Sat 7 Nov 2026");
    expect(doc.sections.map((s) => [s.heading, s.blocks.length])).toEqual([
      ["Workouts", 0],
      ["Plans", 0],
      ["Body weight", 0],
    ]);
  });

  it("lists body weight newest first with notes", () => {
    const entry = (date: string, weight_kg: number, notes: string | null = null) =>
      ({ id: date, user_id: "u", date, weight_kg, notes, created_at: "", updated_at: "" });
    const doc = buildExportDocument({
      name: null,
      generatedOn: "2026-11-07",
      logs: [],
      plans: [],
      bodyWeight: [entry("2026-10-01", 72.5), entry("2026-11-01", 71.8, "after holiday")],
    });
    expect(doc.subtitle).toBe("Downloaded Sat 7 Nov 2026");
    expect(doc.sections[2].blocks[0].lines).toEqual(["Sun 1 Nov 2026: 71.8 kg (after holiday)", "Thu 1 Oct 2026: 72.5 kg"]);
  });
});
