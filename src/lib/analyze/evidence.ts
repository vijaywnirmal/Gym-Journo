import { getTargetWeightKg } from "@/lib/home";
import { distanceToTargetKg, summarizeBodyWeight } from "./bodyWeight";
import { weightVersusEarliest, weightVersusTarget, workoutDaysVersusTarget } from "./differenceWording";
import { windowStart } from "./definitions";
import { buildSessionViews, type ExerciseSession } from "./exerciseSessions";
import type { ValueComparison } from "./setComparison";
import { buildWeeklyTrainingDays } from "./weeklyTraining";

// The evidence a future Coach layer would read instead of raw database text.
//
//   raw records -> Analyze (the deterministic functions in this folder) -> EVIDENCE -> Coach
//
// Evidence is descriptive facts only, each section carrying (a) `basis` — plainly what was
// counted, (b) `sourceDates` — the log/measurement dates it was derived from, so any statement can
// be checked against the records, and (c) `limitations` — codes for the known reasons the facts
// should be read cautiously, defined once in LIMITATIONS. It contains no interpretation (no
// "progress", "plateau", "on track") and is plain JSON: nothing but strings, numbers, booleans,
// null, arrays and objects.
//
// buildTrainingEvidence is pure; getTrainingEvidence (queries.ts) only fetches its inputs.

export const LIMITATIONS = {
  records_are_editable:
    "Workout logs and body measurements can be edited after the fact and no audit history is kept, so these facts describe the records as they currently stand.",
  no_effort_data:
    "Effort (RPE/RIR), duration, recovery and pain are not recorded, so nothing here says how hard a set was or how the person felt.",
  today_uses_server_timezone:
    "\"Today\" and calendar weeks follow the server's timezone, which is not verified to match the person's.",
  goal_is_current_state_only:
    "Goal, target weight and the training-days target are the person's current settings. Their history is not kept, so they are not necessarily what applied in past weeks.",
  set_matching_is_positional:
    "Sets are compared by set number within a session. Warm-up versus working sets, and added or removed sets, are not distinguished, so a same-numbered set is not necessarily the same kind of set.",
  mixed_units:
    "Some sets are recorded in different weight units (kg and lb). Weight is never converted, so weight changes across those sets are unavailable.",
  single_measurement: "Only one body-weight measurement is recorded, so no change can be stated.",
  exercise_list_truncated: "Only the most recently performed exercises are included.",
} as const;

export type LimitationCode = keyof typeof LIMITATIONS;

export const EVIDENCE_DEFINITIONS = {
  performedSet: "A set with reps or weight recorded. Blank placeholder sets are not performed.",
  workoutDay:
    "A date on or before today whose log has at least one performed set. Several logs or exercises on one date are one workout day.",
  window: "\"Last N days\" means N calendar days including today.",
  week: "Calendar weeks run Sunday to Saturday; the current week is in progress.",
} as const;

export const RECENT_EXERCISE_WINDOW_DAYS = 28;
export const MAX_EVIDENCE_EXERCISES = 12;
export const RECENT_SESSIONS_PER_EXERCISE = 4;
const ROLLING_WINDOW_DAYS = [7, 28] as const;

type EvidenceRef = {
  id: string;
  basis: string;
  sourceDates: string[];
  limitations: LimitationCode[];
};

export type WeekEvidence = {
  weekStart: string;
  weekEnd: string;
  daysPerformed: number;
  performedDates: string[];
  // performed − target for a completed week; null for the in-progress week or with no target.
  differenceFromTarget: number | null;
  // The same difference in words ("5 fewer workout days than the target"), for Coach to quote.
  differenceFromTargetWords: string | null;
};

export type SetEvidence = {
  setNumber: number;
  reps: number | null;
  weight: number | null;
  weightUnit: string;
  // Against the same-numbered set in the previous performed session; null when there is none.
  changeVsPreviousSession: { weight: ValueComparison; reps: ValueComparison } | null;
};

export type ExerciseEvidence = EvidenceRef & {
  exerciseId: string;
  name: string;
  sessionsPerformed: number;
  firstPerformedDate: string;
  lastPerformedDate: string;
  recentSessions: {
    date: string;
    daysSincePrevious: number | null;
    sets: SetEvidence[];
  }[];
};

// Sections that would normally be present but have no records. Lets a statement about an absence
// ("no body weight is recorded") be cited and checked, instead of resting on an unrelated section.
export type NotRecordedId = "body.weight" | "exercises.recent";

export type TrainingEvidence = {
  asOf: string;
  definitions: typeof EVIDENCE_DEFINITIONS;
  goal: EvidenceRef & {
    primaryGoal: string | null;
    experienceLevel: string | null;
    trainingDaysPerWeek: number | null;
    targetWeightKg: number | null;
  };
  training: {
    recent: EvidenceRef & {
      rolling: { windowDays: number; windowStart: string; windowEnd: string; daysPerformed: number }[];
      lastPerformedWorkoutDate: string | null;
    };
    weekly: EvidenceRef & {
      targetDaysPerWeek: number | null;
      currentWeek: WeekEvidence;
      completedWeeks: WeekEvidence[];
    };
  };
  bodyWeight:
    | (EvidenceRef & {
        measurementCount: number;
        earliest: { date: string; weightKg: number };
        latest: { date: string; weightKg: number };
        changeKg: number | null;
        // latest − earliest, in words.
        changeWords: string | null;
        targetWeightKg: number | null;
        // latest − target; positive means the latest weight is above the target.
        distanceToTargetKg: number | null;
        // The same distance in words ("4 kg above the target weight").
        distanceToTargetWords: string | null;
      })
    | null;
  exercises: ExerciseEvidence[];
  notRecorded: NotRecordedId[];
  // Limitations that apply to everything below, then the wording of every code used anywhere.
  globalLimitations: LimitationCode[];
  limitations: Partial<Record<LimitationCode, string>>;
};

export type TrainingEvidenceInput = {
  todayStr: string;
  profile: {
    primary_goal: string | null;
    experience_level: string | null;
    training_days_per_week: number | null;
    target_weight_kg: number | null;
  } | null;
  // Workout days (see performedWorkoutDates) from at least the start of the oldest weekly bucket.
  performedDates: string[];
  lastPerformedWorkoutDate: string | null;
  bodyMeasurements: { date: string; weight_kg: number; updated_at?: string }[];
  // Most recently performed first, each with its full performed history.
  exercises: { exerciseId: string; name: string; sessions: ExerciseSession[] }[];
  exercisesTruncated: boolean;
};

const unique = <T>(values: T[]): T[] => [...new Set(values)];
const ascending = (dates: string[]) => [...new Set(dates)].sort();

export function buildTrainingEvidence(input: TrainingEvidenceInput): TrainingEvidence {
  const { todayStr, profile } = input;
  const target = profile?.training_days_per_week ?? null;
  const targetWeightKg = profile
    ? getTargetWeightKg(profile.primary_goal, profile.target_weight_kg)
    : null;
  const performedDates = new Set(input.performedDates.filter((d) => d <= todayStr));

  // --- Training: rolling windows and weeks, all from the same set of workout days.
  const rolling = ROLLING_WINDOW_DAYS.map((windowDays) => {
    const start = windowStart(windowDays, todayStr);
    return {
      windowDays,
      windowStart: start,
      windowEnd: todayStr,
      daysPerformed: [...performedDates].filter((d) => d >= start).length,
    };
  });
  const longestStart = windowStart(Math.max(...ROLLING_WINDOW_DAYS), todayStr);

  const weeks = buildWeeklyTrainingDays(performedDates, todayStr);
  const toWeekEvidence = (w: (typeof weeks)[number]): WeekEvidence => ({
    weekStart: w.weekStart,
    weekEnd: w.weekEnd,
    daysPerformed: w.daysPerformed,
    performedDates: w.performedDates,
    differenceFromTarget: w.isCurrentWeek || target === null ? null : w.daysPerformed - target,
    differenceFromTargetWords:
      w.isCurrentWeek || target === null ? null : workoutDaysVersusTarget(w.daysPerformed - target),
  });
  const currentWeek = weeks.find((w) => w.isCurrentWeek)!;
  const completedWeeks = weeks.filter((w) => !w.isCurrentWeek);

  // --- Body weight.
  const weightFacts = summarizeBodyWeight(input.bodyMeasurements, todayStr);

  // --- Exercises.
  const exercises: ExerciseEvidence[] = input.exercises
    .filter((e) => e.sessions.length > 0)
    .map(({ exerciseId, name, sessions }) => {
      const views = buildSessionViews(sessions).slice(0, RECENT_SESSIONS_PER_EXERCISE);
      const units = unique(views.flatMap((v) => v.sets.map((s) => s.set.weightUnit)));
      const limitations: LimitationCode[] = [];
      if (sessions.length >= 2) limitations.push("set_matching_is_positional");
      if (units.length > 1) limitations.push("mixed_units");

      return {
        id: `exercise.${exerciseId}`,
        basis: `Performed sessions of this exercise across the full history; the ${RECENT_SESSIONS_PER_EXERCISE} most recent are listed.`,
        sourceDates: ascending(views.map((v) => v.date)),
        limitations,
        exerciseId,
        name,
        sessionsPerformed: sessions.length,
        firstPerformedDate: sessions[sessions.length - 1].date,
        lastPerformedDate: sessions[0].date,
        recentSessions: views.map((v) => ({
          date: v.date,
          daysSincePrevious: v.daysSincePrevious,
          sets: v.sets.map(({ set, comparison }) => ({
            setNumber: set.setNumber,
            reps: set.reps,
            weight: set.weight,
            weightUnit: set.weightUnit,
            changeVsPreviousSession: comparison,
          })),
        })),
      };
    });

  const evidence: TrainingEvidence = {
    asOf: todayStr,
    definitions: EVIDENCE_DEFINITIONS,
    goal: {
      id: "goal",
      basis: "The person's current profile settings.",
      sourceDates: [],
      limitations: ["goal_is_current_state_only"],
      primaryGoal: profile?.primary_goal ?? null,
      experienceLevel: profile?.experience_level ?? null,
      trainingDaysPerWeek: target,
      targetWeightKg,
    },
    training: {
      recent: {
        id: "training.recent",
        basis: `Workout days in the last ${ROLLING_WINDOW_DAYS.join(" and ")} calendar days including today.`,
        sourceDates: ascending([...performedDates].filter((d) => d >= longestStart)),
        limitations: [],
        rolling,
        lastPerformedWorkoutDate: input.lastPerformedWorkoutDate,
      },
      weekly: {
        id: "training.weekly",
        basis: `Workout days per Sunday–Saturday week: the current week (in progress) and the ${completedWeeks.length} completed weeks before it.`,
        sourceDates: ascending(weeks.flatMap((w) => w.performedDates)),
        limitations: target === null ? [] : ["goal_is_current_state_only"],
        targetDaysPerWeek: target,
        currentWeek: toWeekEvidence(currentWeek),
        completedWeeks: completedWeeks.map(toWeekEvidence),
      },
    },
    bodyWeight: weightFacts
      ? {
          id: "body.weight",
          basis: `All body-weight measurements dated on or before ${todayStr} (${weightFacts.measurementCount} recorded); earliest and latest are by date.`,
          sourceDates: ascending([weightFacts.earliest.date, weightFacts.latest.date]),
          limitations: weightFacts.measurementCount === 1 ? ["single_measurement"] : [],
          measurementCount: weightFacts.measurementCount,
          earliest: weightFacts.earliest,
          latest: weightFacts.latest,
          changeKg: weightFacts.changeKg,
          changeWords: weightFacts.changeKg === null ? null : weightVersusEarliest(weightFacts.changeKg),
          targetWeightKg,
          distanceToTargetKg:
            targetWeightKg === null
              ? null
              : distanceToTargetKg(weightFacts.latest.weightKg, targetWeightKg),
          distanceToTargetWords:
            targetWeightKg === null
              ? null
              : weightVersusTarget(distanceToTargetKg(weightFacts.latest.weightKg, targetWeightKg)),
        }
      : null,
    exercises,
    notRecorded: [
      ...(weightFacts ? [] : ["body.weight" as const]),
      ...(exercises.length === 0 ? ["exercises.recent" as const] : []),
    ],
    globalLimitations: ["records_are_editable", "no_effort_data", "today_uses_server_timezone"],
    limitations: {},
  };

  if (input.exercisesTruncated) evidence.globalLimitations.push("exercise_list_truncated");

  // The catalog carries the wording of exactly the codes referenced somewhere in this evidence.
  const used = unique([
    ...evidence.globalLimitations,
    ...evidence.goal.limitations,
    ...evidence.training.recent.limitations,
    ...evidence.training.weekly.limitations,
    ...(evidence.bodyWeight?.limitations ?? []),
    ...evidence.exercises.flatMap((e) => e.limitations),
  ]);
  for (const code of used) evidence.limitations[code] = LIMITATIONS[code];

  return evidence;
}
