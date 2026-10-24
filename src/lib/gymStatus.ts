// How the gym's screens describe members. Pure, so the rules are tested in one place.

import { joinName } from "@/lib/names";
import type { GymMemberRow } from "@/lib/types";

export const QUIET_AFTER_DAYS = 7;

export type MemberFilter = "all" | "needs-trainer" | "quiet" | "fees-due";

export function isQuiet(row: Pick<GymMemberRow, "days_since_last_workout">): boolean {
  return row.days_since_last_workout === null || row.days_since_last_workout >= QUIET_AFTER_DAYS;
}

// No trainer yet, and none suggested that the member is still deciding on.
export function needsTrainer(row: Pick<GymMemberRow, "trainer_id" | "offered_trainer_id" | "has_own_trainer">): boolean {
  return !row.trainer_id && !row.offered_trainer_id && !row.has_own_trainer;
}

// feeDue: whether a member's fee is due or overdue (fees come from their own table, 0040).
export function filterMembers(
  rows: GymMemberRow[],
  filter: MemberFilter,
  feeDue: (row: GymMemberRow) => boolean = () => false
): GymMemberRow[] {
  if (filter === "needs-trainer") return rows.filter(needsTrainer);
  if (filter === "quiet") return rows.filter(isQuiet);
  if (filter === "fees-due") return rows.filter(feeDue);
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

export type GymSummary = {
  members: number;
  joinedThisWeek: number;
  trainedThisWeek: number;
  notTraining: number;
  needTrainer: number;
  waitingToAccept: number;
};

// The dashboard's numbers. "Joined this week" is the last 7 days; "trained this week" is Monday to
// Sunday in each member's time zone, as the list counts it.
export function gymSummary(rows: GymMemberRow[], now: Date = new Date()): GymSummary {
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  return {
    members: rows.length,
    joinedThisWeek: rows.filter((r) => new Date(r.joined_at).getTime() > weekAgo).length,
    trainedThisWeek: rows.filter((r) => r.workouts_this_week > 0).length,
    notTraining: rows.filter(isQuiet).length,
    needTrainer: rows.filter(needsTrainer).length,
    waitingToAccept: rows.filter((r) => r.offered_trainer_id !== null).length,
  };
}
