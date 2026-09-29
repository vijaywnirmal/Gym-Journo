import type { WeeklyTrainingDays } from "./weeklyTraining";

// Weekly insights for the Today screen. Pure — no I/O.
//
// Muscle volume: "hard sets" per muscle group — performed sets (reps or weight recorded) that are
// not warm-ups. A set counts once toward every muscle group its exercise is tagged with (the tags
// carry no primary/secondary distinction). Only logs dated within the week, never future dates.
// The counting itself runs in the database (muscle_set_counts, migration 0026); this module
// shapes and orders its rows.

export const WEEKLY_SET_RANGE = { min: 10, max: 20 } as const;

export type MuscleSets = { muscleGroupId: string; name: string; sets: number };

// A row of muscle_set_counts.
export type MuscleSetCountRow = { muscle_group_id: string; name: string; sets: number };

// Most sets first, ties by name.
export function toMuscleSets(rows: MuscleSetCountRow[]): MuscleSets[] {
  return rows
    .filter((row) => row.sets > 0)
    .map((row) => ({ muscleGroupId: row.muscle_group_id, name: row.name, sets: row.sets }))
    .sort((a, b) => b.sets - a.sets || a.name.localeCompare(b.name));
}

export type VolumeStatus = "below" | "within" | "above";

export function volumeStatus(sets: number, range = WEEKLY_SET_RANGE): VolumeStatus {
  if (sets < range.min) return "below";
  if (sets > range.max) return "above";
  return "within";
}

// Consecutive weeks meeting the weekly goal, counting back from the most recent completed week.
// The current week only adds to the streak once it has already met the goal — an unfinished week
// never breaks it. `weeks` is newest first (buildWeeklyTrainingDays). A goal of null or < 1 means
// "train at least once a week".
export function weeklyStreak(weeks: WeeklyTrainingDays[], goalDaysPerWeek: number | null): number {
  const goal = goalDaysPerWeek && goalDaysPerWeek >= 1 ? goalDaysPerWeek : 1;
  let streak = 0;
  for (const week of weeks) {
    const met = week.daysPerformed >= goal;
    if (week.isCurrentWeek) {
      if (met) streak++;
      continue;
    }
    if (!met) break;
    streak++;
  }
  return streak;
}

export type PlanAdherence = { planned: number; performed: number };

// Of the planned training days (rest days excluded) on or before today, how many have a workout.
// Null when nothing was planned, so there is no ratio to show.
export function planAdherence(
  plannedTrainingDates: Iterable<string>,
  performedDates: ReadonlySet<string>,
  todayStr: string
): PlanAdherence | null {
  const planned = [...new Set(plannedTrainingDates)].filter((d) => d <= todayStr);
  if (planned.length === 0) return null;
  return { planned: planned.length, performed: planned.filter((d) => performedDates.has(d)).length };
}
