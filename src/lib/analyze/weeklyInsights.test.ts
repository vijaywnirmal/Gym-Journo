import { describe, expect, it } from "vitest";
import { planAdherence, toMuscleSets, volumeStatus, weeklyStreak } from "./weeklyInsights";
import type { WeeklyTrainingDays } from "./weeklyTraining";

describe("toMuscleSets", () => {
  it("maps database rows and orders by most sets, then name", () => {
    expect(
      toMuscleSets([
        { muscle_group_id: "b", name: "Back", sets: 1 },
        { muscle_group_id: "t", name: "Triceps", sets: 2 },
        { muscle_group_id: "c", name: "Chest", sets: 3 },
        { muscle_group_id: "a", name: "Abs", sets: 2 },
      ])
    ).toEqual([
      { muscleGroupId: "c", name: "Chest", sets: 3 },
      { muscleGroupId: "a", name: "Abs", sets: 2 },
      { muscleGroupId: "t", name: "Triceps", sets: 2 },
      { muscleGroupId: "b", name: "Back", sets: 1 },
    ]);
  });

  it("returns nothing for an empty week", () => {
    expect(toMuscleSets([])).toEqual([]);
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

const week = (daysPerformed: number, isCurrentWeek = false, absenceDays = 0): WeeklyTrainingDays => ({
  weekStart: "",
  weekEnd: "",
  daysPerformed,
  performedDates: [],
  absenceDates: Array.from({ length: absenceDays }, (_, i) => `absent-${i}`),
  isCurrentWeek,
});
const absent = (daysPerformed: number, absenceDays: number) => week(daysPerformed, false, absenceDays);

describe("weeklyStreak", () => {
  it("counts completed weeks meeting the goal until the first miss", () => {
    expect(weeklyStreak([week(1, true), week(3), week(4), week(2), week(3)], 3)).toEqual({ weeks: 2, pausedWeeks: 0 });
  });

  it("adds the current week only once it has met the goal", () => {
    expect(weeklyStreak([week(3, true), week(3)], 3).weeks).toBe(2);
    expect(weeklyStreak([week(0, true), week(3)], 3).weeks).toBe(1);
  });

  it("treats a missing goal as at least one day a week", () => {
    expect(weeklyStreak([week(0, true), week(1), week(1), week(0)], null).weeks).toBe(2);
  });

  it("is zero when the last completed week missed", () => {
    expect(weeklyStreak([week(5, false), week(0)].reverse(), 3).weeks).toBe(0);
  });

  it("pauses a short week whose absence days cover the shortfall, without counting it", () => {
    // 3 weeks met, with one week of 1 workout + 2 absence days (goal 3) in between.
    expect(weeklyStreak([week(0, true), week(3), absent(1, 2), week(3), week(3), week(0)], 3)).toEqual({
      weeks: 3,
      pausedWeeks: 1,
    });
  });

  it("breaks when the absences don't cover the shortfall", () => {
    expect(weeklyStreak([week(0, true), week(3), absent(0, 2), week(3)], 3)).toEqual({ weeks: 1, pausedWeeks: 0 });
  });

  it("allows at most 2 paused weeks in any 4 completed weeks", () => {
    // Two pauses in a row are fine...
    expect(weeklyStreak([week(3), absent(0, 3), absent(0, 3), week(3), week(0)], 3)).toEqual({ weeks: 2, pausedWeeks: 2 });
    // ...a third within the same 4 weeks ends the streak there.
    expect(weeklyStreak([week(3), absent(0, 3), absent(0, 3), absent(0, 3), week(3)], 3)).toEqual({
      weeks: 1,
      pausedWeeks: 0,
    });
    // Pauses spread further apart all count.
    expect(
      weeklyStreak([week(3), absent(0, 3), week(3), week(3), week(3), absent(0, 3), week(3), week(0)], 3)
    ).toEqual({ weeks: 5, pausedWeeks: 2 });
  });

  it("doesn't count paused weeks beyond the oldest week that met the goal", () => {
    expect(weeklyStreak([week(3), absent(0, 3), week(0)], 3)).toEqual({ weeks: 1, pausedWeeks: 0 });
  });

  it("never pauses the current week — it just doesn't add to the streak yet", () => {
    expect(weeklyStreak([week(0, true, 3), week(3)], 3)).toEqual({ weeks: 1, pausedWeeks: 0 });
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
