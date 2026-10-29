import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  equipmentLabel,
  personaliseQuickWorkout,
  QUICK_EXERCISE_NAMES,
  QUICK_WORKOUTS,
  quickTargetWeight,
  rankQuickWorkouts,
  sortUsual,
  toSetsByMuscle,
  type ExerciseInfo,
  type QuickWorkout,
  type UsualExercise,
} from "./quickWorkouts";

const library = (() => {
  const sql = readFileSync(
    path.join(__dirname, "../../supabase/migrations/0021_expand_exercise_library.sql"),
    "utf8"
  ).replace(/\r\n/g, "\n");
  const json = sql.slice(sql.indexOf("library jsonb := '") + "library jsonb := '".length, sql.indexOf("';\nbegin"));
  return JSON.parse(json.replace(/''/g, "'")) as { name: string; equipment: string; muscles: string[] }[];
})();

// The library as the database returns it, with each exercise's name standing in for its id.
const info = (name: string): ExerciseInfo => {
  const e = library.find((x) => x.name === name);
  if (!e) throw new Error(`Not in the library: ${name}`);
  return { id: name, name, equipment: e.equipment, muscles: e.muscles };
};
const libraryMap = new Map(QUICK_EXERCISE_NAMES.map((name) => [name, info(name)]));
const usual = (name: string, sessions = 3, lastDate = "2026-10-01"): UsualExercise => ({ ...info(name), sessions, lastDate });
const session = (id: string) => QUICK_WORKOUTS.find((w) => w.id === id) as QuickWorkout;
const names = (w: { exercises: { name: string }[] }) => w.exercises.map((e) => e.name);

describe("QUICK_WORKOUTS", () => {
  it("only uses exercises that exist in the shared library", () => {
    const known = new Set(library.map((e) => e.name));
    expect(QUICK_EXERCISE_NAMES.filter((n) => !known.has(n))).toEqual([]);
  });

  it("focus only on muscle groups the library uses", () => {
    const muscles = new Set(library.flatMap((e) => e.muscles));
    expect(QUICK_WORKOUTS.flatMap((w) => w.focus).filter((m) => !muscles.has(m))).toEqual([]);
  });

  it("name a main muscle for each exercise that the exercise trains", () => {
    const wrong = QUICK_WORKOUTS.flatMap((w) => w.exercises).filter((e) => !info(e.name).muscles.includes(e.muscle));
    expect(wrong).toEqual([]);
  });

  it("are short: unique ids, a handful of exercises, modest sets and reps", () => {
    expect(new Set(QUICK_WORKOUTS.map((w) => w.id)).size).toBe(QUICK_WORKOUTS.length);
    for (const w of QUICK_WORKOUTS) {
      expect(w.minutes).toBeLessThanOrEqual(30);
      expect(w.exercises.length).toBeGreaterThanOrEqual(3);
      expect(w.exercises.length).toBeLessThanOrEqual(6);
      for (const e of w.exercises) {
        expect(e.sets).toBeGreaterThanOrEqual(1);
        expect(e.sets).toBeLessThanOrEqual(3);
        expect(e.reps).toBeGreaterThanOrEqual(5);
      }
    }
  });
});

describe("rankQuickWorkouts", () => {
  it("leads with the full-body reset when there's no history", () => {
    expect(rankQuickWorkouts(QUICK_WORKOUTS, new Map())[0].id).toBe("full-body-reset");
  });

  it("puts the session for the least-trained muscles first", () => {
    const upperHeavy = new Map([
      ["Chest", 14],
      ["Back", 12],
      ["Shoulders", 10],
      ["Core", 6],
    ]);
    expect(rankQuickWorkouts(QUICK_WORKOUTS, upperHeavy)[0].id).toBe("lower-express");
    const legHeavy = new Map([
      ["Quads", 30],
      ["Glutes", 20],
    ]);
    expect(rankQuickWorkouts(QUICK_WORKOUTS, legHeavy)[0].id).toBe("upper-express");
  });

  it("after a break, puts the session with the most usual exercises first", () => {
    const sessions = [
      { id: "neglected", focus: ["Calves"], usualCount: 0 },
      { id: "familiar", focus: ["Chest"], usualCount: 3 },
      { id: "some", focus: ["Back"], usualCount: 1 },
    ];
    const trained = new Map([
      ["Chest", 20],
      ["Back", 10],
    ]);
    expect(rankQuickWorkouts(sessions, trained, true).map((w) => w.id)).toEqual(["familiar", "some", "neglected"]);
    // On a normal day the neglected muscles still come first.
    expect(rankQuickWorkouts(sessions, trained).map((w) => w.id)).toEqual(["neglected", "some", "familiar"]);
  });

  it("after a break with no usual exercises, falls back to the least-trained muscles", () => {
    const upperHeavy = new Map([["Chest", 14]]);
    expect(rankQuickWorkouts(QUICK_WORKOUTS, upperHeavy, true)[0].id).toBe(rankQuickWorkouts(QUICK_WORKOUTS, upperHeavy)[0].id);
  });

  it("always returns every session exactly once", () => {
    const ranked = rankQuickWorkouts(QUICK_WORKOUTS, new Map([["Quads", 20]]));
    expect(ranked.map((w) => w.id).sort()).toEqual(QUICK_WORKOUTS.map((w) => w.id).sort());
  });
});

describe("toSetsByMuscle", () => {
  it("adds up sets per muscle", () => {
    const totals = toSetsByMuscle([
      { name: "Chest", sets: 6 },
      { name: "Chest", sets: 4 },
      { name: "Quads", sets: 8 },
    ]);
    expect(totals.get("Chest")).toBe(10);
    expect(totals.get("Quads")).toBe(8);
  });
});

describe("sortUsual", () => {
  it("puts the most-done exercise first, then the most recent", () => {
    const sorted = sortUsual([
      usual("Push-Up", 2, "2026-10-20"),
      usual("Back Squat", 5, "2026-10-01"),
      usual("Deadlift", 2, "2026-10-25"),
    ]);
    expect(sorted.map((u) => u.name)).toEqual(["Back Squat", "Deadlift", "Push-Up"]);
  });
});

describe("personaliseQuickWorkout", () => {
  it("is the plain session when the person has no usual exercises", () => {
    const w = personaliseQuickWorkout(session("full-body-reset"), libraryMap, []);
    expect(names(w)).toEqual(session("full-body-reset").exercises.map((e) => e.name));
    expect(w.exercises[0]).toMatchObject({ exerciseId: "Goblet Squat", sets: 2, reps: 10, usual: false });
    expect(w.usualCount).toBe(0);
    expect(w.equipmentLabel).toBe("Dumbbells");
  });

  it("swaps in a usual exercise that does the same job, keeping the session's sets and reps", () => {
    const w = personaliseQuickWorkout(session("full-body-reset"), libraryMap, [usual("Barbell Bench Press")]);
    expect(names(w)).toContain("Barbell Bench Press");
    expect(names(w)).not.toContain("Dumbbell Bench Press");
    expect(w.exercises.find((e) => e.name === "Barbell Bench Press")).toMatchObject({ sets: 2, reps: 10, usual: true });
    expect(w.usualCount).toBe(1);
    expect(w.equipmentLabel).toBe("Dumbbells, Barbell");
  });

  it("doesn't swap in an exercise that trains other muscles (a deadlift isn't a row)", () => {
    const w = personaliseQuickWorkout(session("full-body-reset"), libraryMap, [usual("Deadlift")]);
    expect(names(w)).not.toContain("Deadlift");
  });

  it("marks the session's own exercise as usual and keeps it", () => {
    const w = personaliseQuickWorkout(session("lower-express"), libraryMap, [usual("Goblet Squat"), usual("Back Squat")]);
    expect(w.exercises[0]).toMatchObject({ name: "Goblet Squat", usual: true });
    // The squat slot is already the person's own, so Back Squat takes the next quads slot.
    expect(names(w)).toEqual(["Goblet Squat", "Back Squat", "Glute Bridge", "Standing Calf Raise"]);
  });

  it("uses each usual exercise once", () => {
    const w = personaliseQuickWorkout(session("upper-express"), libraryMap, [usual("Front Raise")]);
    expect(names(w).filter((n) => n === "Front Raise")).toHaveLength(1);
    expect(names(w)).toContain("Lateral Raise");
  });

  it("only swaps bodyweight exercises into the no-equipment circuit", () => {
    const w = personaliseQuickWorkout(session("no-equipment"), libraryMap, [usual("Barbell Bench Press"), usual("Diamond Push-Up")]);
    expect(names(w)).not.toContain("Barbell Bench Press");
    expect(names(w)).toContain("Diamond Push-Up");
    expect(w.equipmentLabel).toBe("No equipment");
  });

  it("leaves out an exercise the library doesn't have", () => {
    const partial = new Map(libraryMap);
    partial.delete("Dead Bug");
    expect(names(personaliseQuickWorkout(session("full-body-reset"), partial, []))).not.toContain("Dead Bug");
  });
});

describe("equipmentLabel", () => {
  it("names the equipment, or says none is needed", () => {
    expect(equipmentLabel([])).toBe("No equipment");
    expect(equipmentLabel(["Dumbbell", "Machine", "Barbell"])).toBe("Dumbbells, Machines, Barbell");
  });
});

describe("quickTargetWeight", () => {
  const sets = [
    { weight: 40, weightUnit: "kg", setType: "warmup" },
    { weight: 100, weightUnit: "kg", setType: "working" },
    { weight: 95, weightUnit: "kg" },
  ];

  it("takes the heaviest working set from last time", () => {
    expect(quickTargetWeight(sets, false)).toEqual({ weight: 100, unit: "kg" });
  });

  it("goes about 10% lighter after a break, rounded to a plate step", () => {
    expect(quickTargetWeight(sets, true)).toEqual({ weight: 90, unit: "kg" });
    expect(quickTargetWeight([{ weight: 135, weightUnit: "lb" }], true)).toEqual({ weight: 120, unit: "lb" });
  });

  it("is null when last time had no weights, or only warm-ups", () => {
    expect(quickTargetWeight([], false)).toBeNull();
    expect(quickTargetWeight([{ weight: null, weightUnit: "kg" }], false)).toBeNull();
    expect(quickTargetWeight([{ weight: 20, weightUnit: "kg", setType: "warmup" }], false)).toBeNull();
  });
});
