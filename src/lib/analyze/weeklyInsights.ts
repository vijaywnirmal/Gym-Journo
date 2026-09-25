import { countsTowardProgress } from "@/lib/setData";
import { isPerformedSet } from "./definitions";
import type { WeeklyTrainingDays } from "./weeklyTraining";

// Weekly insights for the Today screen. Pure — no I/O.
//
// Muscle volume: "hard sets" per muscle group — performed sets (reps or weight recorded) that are
// not warm-ups. A set counts once toward every muscle group its exercise is tagged with (the tags
// carry no primary/secondary distinction). Only logs dated within [from, to] count, never future
// dates.

export const WEEKLY_SET_RANGE = { min: 10, max: 20 } as const;

export type MuscleSetsLog = {
  date: string;
  logged_exercises?:
    | {
        muscle_groups: { id: string; name: string }[];
        logged_sets?: { reps: number | null; weight: number | null; set_type?: string | null }[] | null;
      }[]
    | null;
};

export type MuscleSets = { muscleGroupId: string; name: string; sets: number };

export function countMuscleSets(logs: MuscleSetsLog[], from: string, to: string): MuscleSets[] {
  const byId = new Map<string, MuscleSets>();
  const seenDates = new Set<string>();
  for (const log of logs) {
    // workout_logs is unique per (user, date); guard anyway so a duplicate can't double count.
    if (log.date < from || log.date > to || seenDates.has(log.date)) continue;
    seenDates.add(log.date);
    for (const le of log.logged_exercises ?? []) {
      const hardSets = (le.logged_sets ?? []).filter(
        (s) => isPerformedSet(s) && countsTowardProgress({ setType: s.set_type })
      ).length;
      if (hardSets === 0) continue;
      for (const mg of le.muscle_groups) {
        const entry = byId.get(mg.id) ?? { muscleGroupId: mg.id, name: mg.name, sets: 0 };
        entry.sets += hardSets;
        byId.set(mg.id, entry);
      }
    }
  }
  return [...byId.values()].sort((a, b) => b.sets - a.sets || a.name.localeCompare(b.name));
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
