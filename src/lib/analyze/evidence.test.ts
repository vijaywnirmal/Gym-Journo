import { describe, expect, it } from "vitest";
import {
  buildTrainingEvidence,
  EVIDENCE_DEFINITIONS,
  LIMITATIONS,
  MAX_EVIDENCE_EXERCISES,
  RECENT_SESSIONS_PER_EXERCISE,
  type TrainingEvidence,
  type TrainingEvidenceInput,
} from "./evidence";
import type { ExerciseSession } from "./exerciseSessions";

// 2026-09-21 is a Monday; its Sunday–Saturday week is Sep 20–26.
const TODAY = "2026-09-21";

const session = (date: string, ...sets: [number | null, number | null, string?][]): ExerciseSession => ({
  date,
  sets: sets.map(([reps, weight, unit], i) => ({
    setNumber: i + 1,
    reps,
    weight,
    weightUnit: unit ?? "kg",
  })),
});

function input(over: Partial<TrainingEvidenceInput> = {}): TrainingEvidenceInput {
  return {
    todayStr: TODAY,
    profile: {
      primary_goal: "build_muscle",
      experience_level: "intermediate",
      training_days_per_week: 4,
      target_weight_kg: 75,
    },
    performedDates: [],
    lastPerformedWorkoutDate: null,
    bodyMeasurements: [],
    exercises: [],
    exercisesTruncated: false,
    ...over,
  };
}

const build = (over: Partial<TrainingEvidenceInput> = {}): TrainingEvidence => buildTrainingEvidence(input(over));

describe("buildTrainingEvidence — structure", () => {
  it("is plain JSON: it survives a serialize/parse round trip unchanged", () => {
    const evidence = build({
      performedDates: ["2026-09-15", "2026-09-18", "2026-09-21"],
      lastPerformedWorkoutDate: "2026-09-21",
      bodyMeasurements: [
        { date: "2026-07-02", weight_kg: 70 },
        { date: "2026-09-18", weight_kg: 72 },
      ],
      exercises: [
        {
          exerciseId: "ex-bench",
          name: "Bench Press",
          sessions: [session("2026-09-18", [8, 80], [7, 80]), session("2026-09-11", [6, 80], [7, 80])],
        },
      ],
    });
    expect(JSON.parse(JSON.stringify(evidence))).toEqual(evidence);
  });

  it("states the as-of date and the canonical definitions it was built on", () => {
    const evidence = build();
    expect(evidence.asOf).toBe(TODAY);
    expect(evidence.definitions).toEqual(EVIDENCE_DEFINITIONS);
  });

  it("every section has a unique id, a plain-language basis and source dates", () => {
    const evidence = build({
      performedDates: ["2026-09-18"],
      bodyMeasurements: [{ date: "2026-09-18", weight_kg: 72 }],
      exercises: [{ exerciseId: "ex-bench", name: "Bench Press", sessions: [session("2026-09-18", [8, 80])] }],
    });
    const refs = [
      evidence.goal,
      evidence.training.recent,
      evidence.training.weekly,
      evidence.bodyWeight!,
      ...evidence.exercises,
    ];
    expect(new Set(refs.map((r) => r.id)).size).toBe(refs.length);
    for (const ref of refs) {
      expect(ref.basis.length).toBeGreaterThan(10);
      expect(Array.isArray(ref.sourceDates)).toBe(true);
    }
  });

  it("contains no evaluative, trend or coaching language anywhere", () => {
    const text = JSON.stringify(
      build({
        performedDates: ["2026-09-15", "2026-09-18"],
        bodyMeasurements: [{ date: "2026-09-18", weight_kg: 72 }],
        exercises: [
          { exerciseId: "ex-bench", name: "Bench Press", sessions: [session("2026-09-18", [8, 82.5, "lb"]), session("2026-09-11", [6, 80])] },
        ],
        exercisesTruncated: true,
      })
    ).toLowerCase();
    // "in progress" describes the current week's status; "progress" as a verdict is what is banned.
    expect(text.replace(/in progress/g, "")).not.toContain("progress");
    for (const forbidden of [
      "improv",
      "plateau",
      "stronger",
      "declin",
      "on track",
      "behind",
      "adheren",
      "recommend",
      "should",
      "great",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe("buildTrainingEvidence — goal", () => {
  it("carries the current profile settings and marks them as current-state only", () => {
    const { goal } = build();
    expect(goal).toMatchObject({
      primaryGoal: "build_muscle",
      experienceLevel: "intermediate",
      trainingDaysPerWeek: 4,
      targetWeightKg: 75,
      limitations: ["goal_is_current_state_only"],
    });
  });

  it("gates the target weight by the same goal rule as the rest of the app", () => {
    const maintain = build({
      profile: { primary_goal: "maintain", experience_level: null, training_days_per_week: 3, target_weight_kg: 75 },
    });
    expect(maintain.goal.targetWeightKg).toBeNull();
    expect(maintain.goal.trainingDaysPerWeek).toBe(3);
  });

  it("a missing profile yields nulls, not an error", () => {
    const evidence = build({ profile: null });
    expect(evidence.goal).toMatchObject({
      primaryGoal: null,
      experienceLevel: null,
      trainingDaysPerWeek: null,
      targetWeightKg: null,
    });
    expect(evidence.training.weekly.targetDaysPerWeek).toBeNull();
  });
});

describe("buildTrainingEvidence — training", () => {
  it("counts workout days in the inclusive 7- and 28-day windows, with their start dates", () => {
    const evidence = build({
      performedDates: ["2026-08-24", "2026-08-25", "2026-09-14", "2026-09-15", "2026-09-21"],
    });
    const [w7, w28] = evidence.training.recent.rolling;
    expect(w7).toEqual({ windowDays: 7, windowStart: "2026-09-15", windowEnd: TODAY, daysPerformed: 2 });
    expect(w28).toEqual({ windowDays: 28, windowStart: "2026-08-25", windowEnd: TODAY, daysPerformed: 4 });
  });

  it("ignores future dates entirely", () => {
    const evidence = build({ performedDates: ["2026-09-22", "2026-09-30", "2026-09-21"] });
    expect(evidence.training.recent.rolling[0].daysPerformed).toBe(1);
    expect(evidence.training.recent.sourceDates).toEqual(["2026-09-21"]);
    expect(evidence.training.weekly.currentWeek.performedDates).toEqual(["2026-09-21"]);
  });

  it("reports the last performed workout date it was given", () => {
    expect(build({ lastPerformedWorkoutDate: "2026-09-18" }).training.recent.lastPerformedWorkoutDate).toBe("2026-09-18");
    expect(build().training.recent.lastPerformedWorkoutDate).toBeNull();
  });

  it("keeps the in-progress week apart from the 8 completed weeks, newest first", () => {
    const { weekly } = build({ performedDates: ["2026-09-20", "2026-09-15", "2026-09-16", "2026-09-17"] }).training;
    expect(weekly.currentWeek).toMatchObject({ weekStart: "2026-09-20", weekEnd: "2026-09-26", daysPerformed: 1 });
    expect(weekly.completedWeeks).toHaveLength(8);
    expect(weekly.completedWeeks[0]).toMatchObject({ weekStart: "2026-09-13", weekEnd: "2026-09-19", daysPerformed: 3 });
    expect(weekly.completedWeeks[7].weekStart).toBe("2026-07-26");
  });

  it("difference from target is performed − target for completed weeks only", () => {
    const { weekly } = build({
      performedDates: ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-06", "2026-09-21"],
    }).training;
    expect(weekly.targetDaysPerWeek).toBe(4);
    expect(weekly.completedWeeks[0].differenceFromTarget).toBe(1); // 5 performed − 4
    expect(weekly.completedWeeks[1].differenceFromTarget).toBe(-3); // 1 performed − 4
    expect(weekly.completedWeeks[2].differenceFromTarget).toBe(-4); // none
    expect(weekly.currentWeek.differenceFromTarget).toBeNull(); // in progress
  });

  it("with no training-days target there are no differences and no goal limitation on the weeks", () => {
    const evidence = build({
      profile: { primary_goal: "maintain", experience_level: null, training_days_per_week: null, target_weight_kg: null },
      performedDates: ["2026-09-15"],
    });
    expect(evidence.training.weekly.completedWeeks.every((w) => w.differenceFromTarget === null)).toBe(true);
    expect(evidence.training.weekly.limitations).toEqual([]);
  });

  it("source dates are the workout dates the counts were built from, ascending and unique", () => {
    const evidence = build({ performedDates: ["2026-09-18", "2026-09-15", "2026-09-18", "2026-08-01"] });
    expect(evidence.training.weekly.sourceDates).toEqual(["2026-08-01", "2026-09-15", "2026-09-18"]);
    expect(evidence.training.recent.sourceDates).toEqual(["2026-09-15", "2026-09-18"]);
  });
});

describe("buildTrainingEvidence — body weight", () => {
  it("is null when there are no measurements", () => {
    expect(build().bodyWeight).toBeNull();
  });

  it("gives dated earliest/latest, the raw change, the target and the signed distance", () => {
    const { bodyWeight } = build({
      bodyMeasurements: [
        { date: "2026-09-18", weight_kg: 72 },
        { date: "2026-07-02", weight_kg: 70 },
        { date: "2026-09-30", weight_kg: 99 }, // future — never the latest
      ],
    });
    expect(bodyWeight).toMatchObject({
      measurementCount: 2,
      earliest: { date: "2026-07-02", weightKg: 70 },
      latest: { date: "2026-09-18", weightKg: 72 },
      changeKg: 2,
      targetWeightKg: 75,
      distanceToTargetKg: -3,
      sourceDates: ["2026-07-02", "2026-09-18"],
    });
  });

  it("no target: the target and distance are null", () => {
    const { bodyWeight } = build({
      profile: { primary_goal: "maintain", experience_level: null, training_days_per_week: 3, target_weight_kg: 75 },
      bodyMeasurements: [{ date: "2026-09-18", weight_kg: 72 }, { date: "2026-09-01", weight_kg: 71 }],
    });
    expect(bodyWeight?.targetWeightKg).toBeNull();
    expect(bodyWeight?.distanceToTargetKg).toBeNull();
  });

  it("a single measurement has no change and says so", () => {
    const { bodyWeight } = build({ bodyMeasurements: [{ date: "2026-09-18", weight_kg: 72 }] });
    expect(bodyWeight?.changeKg).toBeNull();
    expect(bodyWeight?.limitations).toEqual(["single_measurement"]);
  });
});

describe("buildTrainingEvidence — exercises", () => {
  const bench = (sessions: ExerciseSession[]) => ({ exerciseId: "ex-bench", name: "Bench Press", sessions });

  it("summarizes the full history and lists the most recent sessions with same-set changes", () => {
    const { exercises } = build({
      exercises: [bench([session("2026-09-18", [10, 80], [7, 80], [8, 75]), session("2026-09-11", [8, 80], [7, 80], [8, 80]), session("2026-06-12", [6, 70])])],
    });
    expect(exercises).toHaveLength(1);
    const [e] = exercises;
    expect(e).toMatchObject({
      exerciseId: "ex-bench",
      name: "Bench Press",
      sessionsPerformed: 3,
      firstPerformedDate: "2026-06-12",
      lastPerformedDate: "2026-09-18",
    });
    expect(e.recentSessions.map((s) => s.date)).toEqual(["2026-09-18", "2026-09-11", "2026-06-12"]);
    expect(e.recentSessions[0].daysSincePrevious).toBe(7);
    expect(e.recentSessions[0].sets[0]).toEqual({
      setNumber: 1,
      reps: 10,
      weight: 80,
      weightUnit: "kg",
      changeVsPreviousSession: { weight: { type: "same" }, reps: { type: "delta", delta: 2 } },
    });
    expect(e.recentSessions[0].sets[2].changeVsPreviousSession?.weight).toEqual({ type: "delta", delta: -5, unit: "kg" });
    expect(e.recentSessions[2].sets[0].changeVsPreviousSession).toBeNull(); // oldest listed has no previous
    expect(e.sourceDates).toEqual(["2026-06-12", "2026-09-11", "2026-09-18"]);
  });

  it("lists at most the 4 most recent sessions, but counts them all", () => {
    const dates = ["2026-09-18", "2026-09-11", "2026-09-04", "2026-08-28", "2026-08-21", "2026-08-14"];
    const [e] = build({ exercises: [bench(dates.map((d) => session(d, [5, 80])))] }).exercises;
    expect(RECENT_SESSIONS_PER_EXERCISE).toBe(4);
    expect(e.sessionsPerformed).toBe(6);
    expect(e.recentSessions.map((s) => s.date)).toEqual(dates.slice(0, 4));
    expect(e.firstPerformedDate).toBe("2026-08-14");
  });

  it("flags positional set matching once there is more than one session", () => {
    const two = build({ exercises: [bench([session("2026-09-18", [8, 80]), session("2026-09-11", [8, 80])])] }).exercises[0];
    expect(two.limitations).toContain("set_matching_is_positional");
    const one = build({ exercises: [bench([session("2026-09-18", [8, 80])])] }).exercises[0];
    expect(one.limitations).toEqual([]);
  });

  it("flags mixed units and keeps that weight change unavailable rather than converting", () => {
    const [e] = build({ exercises: [bench([session("2026-09-18", [8, 176, "lb"]), session("2026-09-11", [6, 80, "kg"])])] }).exercises;
    expect(e.limitations).toContain("mixed_units");
    expect(e.recentSessions[0].sets[0].changeVsPreviousSession).toEqual({
      weight: { type: "unavailable" },
      reps: { type: "delta", delta: 2 },
    });
  });

  it("omits an exercise with no performed sessions and keeps the input order (most recent first)", () => {
    const { exercises } = build({
      exercises: [
        { exerciseId: "ex-a", name: "A", sessions: [session("2026-09-20", [5, 50])] },
        { exerciseId: "ex-empty", name: "Empty", sessions: [] },
        { exerciseId: "ex-b", name: "B", sessions: [session("2026-09-01", [5, 50])] },
      ],
    });
    expect(exercises.map((e) => e.exerciseId)).toEqual(["ex-a", "ex-b"]);
  });

  it("MAX_EVIDENCE_EXERCISES is a sensible cap", () => {
    expect(MAX_EVIDENCE_EXERCISES).toBe(12);
  });
});

describe("buildTrainingEvidence — limitations", () => {
  it("always carries the global limitations, with their wording in the catalog", () => {
    const evidence = build();
    expect(evidence.globalLimitations).toEqual(["records_are_editable", "no_effort_data", "today_uses_server_timezone"]);
    for (const code of evidence.globalLimitations) expect(evidence.limitations[code]).toBe(LIMITATIONS[code]);
  });

  it("the catalog contains exactly the codes referenced somewhere", () => {
    const evidence = build({
      bodyMeasurements: [{ date: "2026-09-18", weight_kg: 72 }],
      exercises: [{ exerciseId: "ex-bench", name: "Bench Press", sessions: [session("2026-09-18", [8, 80]), session("2026-09-11", [8, 80])] }],
    });
    expect(Object.keys(evidence.limitations).sort()).toEqual(
      [
        "goal_is_current_state_only",
        "no_effort_data",
        "records_are_editable",
        "set_matching_is_positional",
        "single_measurement",
        "today_uses_server_timezone",
      ].sort()
    );
  });

  it("notes when the exercise list was truncated", () => {
    const evidence = build({ exercisesTruncated: true });
    expect(evidence.globalLimitations).toContain("exercise_list_truncated");
    expect(evidence.limitations.exercise_list_truncated).toBe(LIMITATIONS.exercise_list_truncated);
    expect(build().globalLimitations).not.toContain("exercise_list_truncated");
  });

  it("every code's wording is descriptive, not evaluative", () => {
    for (const text of Object.values(LIMITATIONS)) {
      expect(text.toLowerCase()).not.toMatch(/progress|improv|should|recommend|plateau/);
    }
  });
});
