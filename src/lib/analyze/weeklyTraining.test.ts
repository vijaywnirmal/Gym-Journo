import { describe, expect, it } from "vitest";
import { buildWeeklyTrainingDays, COMPLETED_WEEKS, oldestWeekStart } from "./weeklyTraining";
import { performedWorkoutDates } from "./definitions";

// 2026-09-21 is a Monday, so its Sunday–Saturday week is Sep 20–26.
const MONDAY = "2026-09-21";

const weeks = (dates: string[], todayStr = MONDAY) =>
  buildWeeklyTrainingDays(new Set(dates), todayStr);
const byStart = (result: ReturnType<typeof weeks>, weekStart: string) =>
  result.find((w) => w.weekStart === weekStart)!;

describe("buildWeeklyTrainingDays — week structure", () => {
  it("returns the current week plus the 8 completed weeks before it, newest first", () => {
    const result = weeks([]);
    expect(COMPLETED_WEEKS).toBe(8);
    expect(result).toHaveLength(9);
    expect(result[0]).toMatchObject({ weekStart: "2026-09-20", weekEnd: "2026-09-26", isCurrentWeek: true });
    expect(result[1]).toMatchObject({ weekStart: "2026-09-13", weekEnd: "2026-09-19", isCurrentWeek: false });
    expect(result[8]).toMatchObject({ weekStart: "2026-07-26", weekEnd: "2026-08-01", isCurrentWeek: false });
    expect(result.filter((w) => w.isCurrentWeek)).toHaveLength(1);
  });

  it("every week runs Sunday to Saturday", () => {
    for (const w of weeks([])) {
      expect(new Date(`${w.weekStart}T00:00:00`).getDay()).toBe(0);
      expect(new Date(`${w.weekEnd}T00:00:00`).getDay()).toBe(6);
    }
  });

  it("a Sunday today starts the current week on that day", () => {
    expect(buildWeeklyTrainingDays(new Set(), "2026-09-20")[0]).toMatchObject({
      weekStart: "2026-09-20",
      weekEnd: "2026-09-26",
    });
  });

  it("a Saturday today ends the current week on that day", () => {
    expect(buildWeeklyTrainingDays(new Set(), "2026-09-26")[0]).toMatchObject({
      weekStart: "2026-09-20",
      weekEnd: "2026-09-26",
    });
  });

  it("oldestWeekStart is the Sunday starting the oldest completed week", () => {
    expect(oldestWeekStart(MONDAY, 8)).toBe("2026-07-26");
    expect(oldestWeekStart(MONDAY, 1)).toBe("2026-09-13");
  });
});

describe("buildWeeklyTrainingDays — counting", () => {
  it("1. a performed workout day is counted in its week", () => {
    expect(byStart(weeks(["2026-09-15"]), "2026-09-13").daysPerformed).toBe(1);
  });

  it("2. several workout days in one week are counted individually, each date once", () => {
    const result = weeks(["2026-09-14", "2026-09-16", "2026-09-18"]);
    expect(byStart(result, "2026-09-13").daysPerformed).toBe(3);
  });

  it("5. Sunday belongs to the week it starts, not the week before", () => {
    const result = weeks(["2026-09-13"]);
    expect(byStart(result, "2026-09-13").daysPerformed).toBe(1);
    expect(byStart(result, "2026-09-06").daysPerformed).toBe(0);
  });

  it("6. Saturday belongs to the week it ends, not the week after", () => {
    const result = weeks(["2026-09-12"]);
    expect(byStart(result, "2026-09-06").daysPerformed).toBe(1);
    expect(byStart(result, "2026-09-13").daysPerformed).toBe(0);
  });

  it("7. a week crossing a month boundary counts days on both sides (Jul 26–Aug 1)", () => {
    const result = weeks(["2026-07-31", "2026-08-01", "2026-08-02"]);
    expect(byStart(result, "2026-07-26").daysPerformed).toBe(2);
    expect(byStart(result, "2026-08-02").daysPerformed).toBe(1);
  });

  it("8. a week crossing a year boundary counts days on both sides (Dec 28–Jan 3)", () => {
    const result = buildWeeklyTrainingDays(new Set(["2025-12-31", "2026-01-02", "2026-01-04"]), "2026-01-07");
    expect(result[1]).toMatchObject({ weekStart: "2025-12-28", weekEnd: "2026-01-03", daysPerformed: 2 });
    expect(result[0]).toMatchObject({ weekStart: "2026-01-04", daysPerformed: 1 });
  });

  it("9. a week with no activity has zero performed days", () => {
    const result = weeks(["2026-09-15"]);
    expect(byStart(result, "2026-09-06").daysPerformed).toBe(0);
    expect(weeks([]).every((w) => w.daysPerformed === 0)).toBe(true);
  });

  it("dates older than the oldest completed week are not counted anywhere", () => {
    expect(weeks(["2026-07-25"]).every((w) => w.daysPerformed === 0)).toBe(true);
  });

  it("4. future dates never count, even if supplied", () => {
    const result = weeks(["2026-09-22", "2026-09-26", "2026-10-03"]);
    expect(result[0].daysPerformed).toBe(0);
  });

  it("14. the current week counts only days up to today and is flagged as in progress", () => {
    const result = weeks(["2026-09-20", "2026-09-21", "2026-09-23"]);
    expect(result[0].daysPerformed).toBe(2); // Sep 20 and 21; Sep 23 is still in the future
    expect(result[0].isCurrentWeek).toBe(true);
    expect(result[1].isCurrentWeek).toBe(false);
  });
});

describe("performedWorkoutDates — the canonical workout-day set feeding the weeks", () => {
  const set = (reps: number | null, weight: number | null) => ({ reps, weight });

  it("1. a log with a performed set contributes its date", () => {
    const dates = performedWorkoutDates(
      [{ date: "2026-09-15", logged_exercises: [{ logged_sets: [set(5, 80)] }] }],
      MONDAY
    );
    expect([...dates]).toEqual(["2026-09-15"]);
  });

  it("2. several exercises on one date make one workout day", () => {
    const dates = performedWorkoutDates(
      [
        {
          date: "2026-09-15",
          logged_exercises: [{ logged_sets: [set(5, 80)] }, { logged_sets: [set(8, 60)] }, { logged_sets: [set(10, null)] }],
        },
      ],
      MONDAY
    );
    expect(dates.size).toBe(1);
  });

  it("2. the same date appearing on several logs is still one workout day", () => {
    const log = { date: "2026-09-15", logged_exercises: [{ logged_sets: [set(5, 80)] }] };
    expect(performedWorkoutDates([log, log], MONDAY).size).toBe(1);
  });

  it("3. blank-only and empty logs do not count", () => {
    const dates = performedWorkoutDates(
      [
        { date: "2026-09-14", logged_exercises: [{ logged_sets: [set(null, null), set(null, null)] }] },
        { date: "2026-09-15", logged_exercises: [] },
        { date: "2026-09-16" },
      ],
      MONDAY
    );
    expect(dates.size).toBe(0);
  });

  it("4. future-dated logs do not count", () => {
    const dates = performedWorkoutDates(
      [{ date: "2026-09-22", logged_exercises: [{ logged_sets: [set(5, 80)] }] }],
      MONDAY
    );
    expect(dates.size).toBe(0);
  });
});
