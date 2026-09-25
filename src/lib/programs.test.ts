import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildProgramSchedule, findProgram, PROGRAMS, type Program } from "./programs";

const libraryNames = (() => {
  const sql = readFileSync(
    path.join(__dirname, "../../supabase/migrations/0021_expand_exercise_library.sql"),
    "utf8"
  );
  const json = sql.slice(sql.indexOf("library jsonb := '") + "library jsonb := '".length, sql.indexOf("';\nbegin"));
  return new Set((JSON.parse(json.replace(/''/g, "'")) as { name: string }[]).map((e) => e.name));
})();

describe("PROGRAMS", () => {
  it("only uses exercises that exist in the shared library", () => {
    const missing = PROGRAMS.flatMap((p) => p.days.flatMap((d) => d.exercises.map((e) => e.name))).filter(
      (n) => !libraryNames.has(n)
    );
    expect(missing).toEqual([]);
  });

  it("have unique ids, sane defaults and sensible set/rep targets", () => {
    expect(new Set(PROGRAMS.map((p) => p.id)).size).toBe(PROGRAMS.length);
    for (const p of PROGRAMS) {
      expect(p.days.length).toBeGreaterThan(0);
      expect(p.defaultWeekdays.length).toBeGreaterThan(0);
      for (const d of p.days) {
        for (const e of d.exercises) {
          expect(e.sets).toBeGreaterThanOrEqual(1);
          expect(e.reps).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it("finds programs by id", () => {
    expect(findProgram("push-pull-legs")?.name).toBe("Push / Pull / Legs");
    expect(findProgram("nope")).toBeNull();
  });
});

const ab: Program = {
  id: "t",
  name: "T",
  summary: "",
  level: "Beginner",
  defaultWeekdays: [1, 3, 5],
  defaultWeeks: 2,
  days: [
    { title: "A", exercises: [] },
    { title: "B", exercises: [] },
  ],
};

describe("buildProgramSchedule", () => {
  it("places days on the chosen weekdays from the start date, continuing the rotation across weeks", () => {
    // 2026-09-28 is a Monday.
    const schedule = buildProgramSchedule(ab, "2026-09-28", [1, 3, 5], 2);
    expect(schedule.map((s) => `${s.date} ${s.day.title}`)).toEqual([
      "2026-09-28 A",
      "2026-09-30 B",
      "2026-10-02 A",
      "2026-10-05 B",
      "2026-10-07 A",
      "2026-10-09 B",
    ]);
  });

  it("starts from the first matching weekday on or after a mid-week start", () => {
    // 2026-09-25 is a Friday.
    const schedule = buildProgramSchedule(ab, "2026-09-25", [1, 5], 1);
    expect(schedule.map((s) => s.date)).toEqual(["2026-09-25", "2026-09-28"]);
  });

  it("ignores duplicate and invalid weekdays, and returns nothing without valid days or weeks", () => {
    expect(buildProgramSchedule(ab, "2026-09-28", [1, 1, 9, -1], 1)).toHaveLength(1);
    expect(buildProgramSchedule(ab, "2026-09-28", [], 4)).toEqual([]);
    expect(buildProgramSchedule(ab, "2026-09-28", [1], 0)).toEqual([]);
  });

  it("crosses a daylight-saving change without skipping or doubling a day", () => {
    // US DST ends 2026-11-01; EU on 2026-10-25.
    const schedule = buildProgramSchedule(ab, "2026-10-19", [0, 1, 2, 3, 4, 5, 6], 3);
    expect(schedule).toHaveLength(21);
    expect(new Set(schedule.map((s) => s.date)).size).toBe(21);
  });
});
