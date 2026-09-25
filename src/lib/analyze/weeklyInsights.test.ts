import { describe, expect, it } from "vitest";
import { countMuscleSets, planAdherence, volumeStatus, weeklyStreak, type MuscleSetsLog } from "./weeklyInsights";
import type { WeeklyTrainingDays } from "./weeklyTraining";

const chest = { id: "c", name: "Chest" };
const triceps = { id: "t", name: "Triceps" };
const back = { id: "b", name: "Back" };
const set = (reps: number | null, weight: number | null, set_type?: string) => ({ reps, weight, set_type });

describe("countMuscleSets", () => {
  const logs: MuscleSetsLog[] = [
    {
      date: "2026-09-21",
      logged_exercises: [
        { muscle_groups: [chest, triceps], logged_sets: [set(10, 40, "warmup"), set(5, 100), set(5, 100)] },
        { muscle_groups: [back], logged_sets: [set(null, null), set(8, 60, "drop")] },
      ],
    },
    { date: "2026-09-23", logged_exercises: [{ muscle_groups: [chest], logged_sets: [set(8, 30)] }] },
    { date: "2026-09-19", logged_exercises: [{ muscle_groups: [back], logged_sets: [set(8, 60)] }] },
    { date: "2026-09-30", logged_exercises: [{ muscle_groups: [back], logged_sets: [set(8, 60)] }] },
  ];

  it("counts hard sets per muscle within the window, excluding warm-ups and blank sets", () => {
    expect(countMuscleSets(logs, "2026-09-20", "2026-09-26")).toEqual([
      { muscleGroupId: "c", name: "Chest", sets: 3 },
      { muscleGroupId: "t", name: "Triceps", sets: 2 },
      { muscleGroupId: "b", name: "Back", sets: 1 },
    ]);
  });

  it("returns nothing for an empty window", () => {
    expect(countMuscleSets(logs, "2026-10-05", "2026-10-11")).toEqual([]);
  });

  it("never double counts a duplicated date", () => {
    const dup = [logs[1], logs[1]];
    expect(countMuscleSets(dup, "2026-09-20", "2026-09-26")[0].sets).toBe(1);
  });
});

describe("volumeStatus", () => {
  it("classifies against the 10–20 range inclusively", () => {
    expect(volumeStatus(9)).toBe("below");
    expect(volumeStatus(10)).toBe("within");
    expect(volumeStatus(20)).toBe("within");
    expect(volumeStatus(21)).toBe("above");
  });
});

const week = (daysPerformed: number, isCurrentWeek = false): WeeklyTrainingDays => ({
  weekStart: "",
  weekEnd: "",
  daysPerformed,
  performedDates: [],
  isCurrentWeek,
});

describe("weeklyStreak", () => {
  it("counts completed weeks meeting the goal until the first miss", () => {
    expect(weeklyStreak([week(1, true), week(3), week(4), week(2), week(3)], 3)).toBe(2);
  });

  it("adds the current week only once it has met the goal", () => {
    expect(weeklyStreak([week(3, true), week(3)], 3)).toBe(2);
    expect(weeklyStreak([week(0, true), week(3)], 3)).toBe(1);
  });

  it("treats a missing goal as at least one day a week", () => {
    expect(weeklyStreak([week(0, true), week(1), week(1), week(0)], null)).toBe(2);
  });

  it("is zero when the last completed week missed", () => {
    expect(weeklyStreak([week(5, false), week(0)].reverse(), 3)).toBe(0);
  });
});

describe("planAdherence", () => {
  it("counts planned days up to today that have a workout", () => {
    const performed = new Set(["2026-09-21", "2026-09-24"]);
    expect(planAdherence(["2026-09-21", "2026-09-22", "2026-09-24", "2026-09-28"], performed, "2026-09-25")).toEqual({
      planned: 3,
      performed: 2,
    });
  });

  it("is null when nothing was planned", () => {
    expect(planAdherence(["2026-09-28"], new Set(), "2026-09-25")).toBeNull();
  });
});
