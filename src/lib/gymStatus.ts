// How the gym's screens describe members. Pure, so the rules are tested in one place.

import { joinName } from "@/lib/names";
import type { GymMemberRow } from "@/lib/types";

export const QUIET_AFTER_DAYS = 7;

export type MemberFilter = "all" | "needs-trainer" | "quiet";

export function isQuiet(row: Pick<GymMemberRow, "days_since_last_workout">): boolean {
  return row.days_since_last_workout === null || row.days_since_last_workout >= QUIET_AFTER_DAYS;
}

// No trainer yet, and none suggested that the member is still deciding on.
export function needsTrainer(row: Pick<GymMemberRow, "trainer_id" | "offered_trainer_id" | "has_own_trainer">): boolean {
  return !row.trainer_id && !row.offered_trainer_id && !row.has_own_trainer;
}

export function filterMembers(rows: GymMemberRow[], filter: MemberFilter): GymMemberRow[] {
  if (filter === "needs-trainer") return rows.filter(needsTrainer);
  if (filter === "quiet") return rows.filter(isQuiet);
  return rows;
}

export function lastWorkoutLabel(row: Pick<GymMemberRow, "days_since_last_workout">): string {
  const days = row.days_since_last_workout;
  if (days === null) return "No workouts yet";
  if (days <= 0) return "Last workout today";
  if (days === 1) return "Last workout yesterday";
  return `Last workout ${days} days ago`;
}

export function trainerLabel(
  row: Pick<GymMemberRow, "trainer_name" | "offered_trainer_name" | "declined_trainer_name" | "has_own_trainer">
): string {
  if (row.trainer_name) return row.trainer_name;
  if (row.has_own_trainer) return "Own trainer";
  if (row.offered_trainer_name) return `Suggested ${row.offered_trainer_name}`;
  if (row.declined_trainer_name) return `Needs a trainer · declined ${row.declined_trainer_name}`;
  return "Needs a trainer";
}

export function memberName(row: Pick<GymMemberRow, "first_name" | "last_name">): string {
  return joinName(row.first_name, row.last_name) || "Member";
}
