import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findQuickWorkout, QUICK_WORKOUTS, rankQuickWorkouts, recentSetsByMuscle } from "./quickWorkouts";

const library = (() => {
  const sql = readFileSync(
    path.join(__dirname, "../../supabase/migrations/0021_expand_exercise_library.sql"),
    "utf8"
  ).replace(/\r\n/g, "\n");
  const json = sql.slice(sql.indexOf("library jsonb := '") + "library jsonb := '".length, sql.indexOf("';\nbegin"));
  return JSON.parse(json.replace(/''/g, "'")) as { name: string; muscles: string[] }[];
})();

describe("QUICK_WORKOUTS", () => {
  it("only uses exercises that exist in the shared library", () => {
    const names = new Set(library.map((e) => e.name));
    const missing = QUICK_WORKOUTS.flatMap((w) => w.exercises.map((e) => e.name)).filter((n) => !names.has(n));
    expect(missing).toEqual([]);
  });

  it("focus only on muscle groups the library uses", () => {
    const muscles = new Set(library.flatMap((e) => e.muscles));
    expect(QUICK_WORKOUTS.flatMap((w) => w.focus).filter((m) => !muscles.has(m))).toEqual([]);
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

describe("findQuickWorkout", () => {
  it("finds a session by id, and nothing for an unknown or missing id", () => {
    expect(findQuickWorkout("full-body-reset")?.name).toBe("Full-body reset");
    expect(findQuickWorkout("nope")).toBeNull();
    expect(findQuickWorkout(undefined)).toBeNull();
  });
});

describe("rankQuickWorkouts", () => {
  it("leads with the full-body reset when nothing was trained recently (the comeback case)", () => {
    expect(rankQuickWorkouts(new Map())[0].id).toBe("full-body-reset");
  });

  it("puts the session for the least-trained muscles first", () => {
    const upperHeavy = new Map([
      ["Chest", 14],
      ["Back", 12],
      ["Shoulders", 10],
      ["Core", 6],
    ]);
    expect(rankQuickWorkouts(upperHeavy)[0].id).toBe("lower-express");
  });

  it("always returns every session exactly once", () => {
    const ranked = rankQuickWorkouts(new Map([["Quads", 20]]));
    expect(ranked.map((w) => w.id).sort()).toEqual(QUICK_WORKOUTS.map((w) => w.id).sort());
  });
});

describe("recentSetsByMuscle", () => {
  it("adds this week's and last week's sets per muscle", () => {
    const totals = recentSetsByMuscle({
      thisWeek: [{ name: "Chest", sets: 6 }],
      lastWeek: [
        { name: "Chest", sets: 4 },
        { name: "Quads", sets: 8 },
      ],
    });
    expect(totals.get("Chest")).toBe(10);
    expect(totals.get("Quads")).toBe(8);
  });

  it("is empty without insights", () => {
    expect(recentSetsByMuscle(null).size).toBe(0);
  });
});
