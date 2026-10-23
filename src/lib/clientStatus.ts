// How a trainer's screens describe a client's days. Pure, so the rules are tested in one place.

import { addDays, format, parseISO } from "date-fns";
import { DATE_FMT } from "@/lib/date";
import { joinName } from "@/lib/names";
import { PRIMARY_GOAL_LABELS } from "@/lib/ai-plan-prompt";
import type { ClientLog, ClientOverview, ClientPlan, MuscleGroup, WorkoutPlan } from "@/lib/types";

export type DayStatus = "done" | "today" | "planned" | "missed" | "rest" | "absence" | "none";

export const DAY_STATUS_LABEL: Record<DayStatus, string> = {
  done: "Done",
  today: "Planned",
  planned: "Planned",
  missed: "Missed",
  rest: "Rest day",
  absence: "Day off",
  none: "Nothing planned",
};

// A performed set has reps or weight recorded (a recorded 0 counts), as in performed_workout_dates.
export function isPerformed(log: ClientLog | null | undefined): boolean {
  return !!log?.exercises.some((ex) => ex.sets.some((s) => s.reps !== null || s.weight !== null));
}

// One day of the client's week, judged against the client's today.
export function dayStatus(plan: ClientPlan | null | undefined, log: ClientLog | null | undefined, date: string, today: string): DayStatus {
  if (isPerformed(log)) return "done";
  if (plan?.off_kind === "absence") return "absence";
  if (plan?.is_rest_day) return "rest";
  if (!plan) return "none";
  if (date < today) return "missed";
  return date === today ? "today" : "planned";
}

// The dashboard's line for today.
export function todayStatus(row: Pick<ClientOverview, "today_plan" | "today_done">): DayStatus {
  if (row.today_done) return "done";
  if (row.today_plan === "rest") return "rest";
  if (row.today_plan === "absence") return "absence";
  return row.today_plan === "workout" ? "today" : "none";
}

export function clientName(row: Pick<ClientOverview, "first_name" | "last_name">): string {
  return joinName(row.first_name, row.last_name) || "Client";
}

// "Build muscle · Beginner · 3 days a week", leaving out what the client hasn't filled in.
export function clientSummary(
  row: Pick<ClientOverview, "primary_goal" | "experience_level" | "training_days_per_week">
): string {
  return [
    row.primary_goal ? (PRIMARY_GOAL_LABELS[row.primary_goal] ?? row.primary_goal) : null,
    row.experience_level ? row.experience_level[0].toUpperCase() + row.experience_level.slice(1) : null,
    row.training_days_per_week ? `${row.training_days_per_week} days a week` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

// The Monday on or before a date: trainer weeks run Monday to Sunday, like the dashboard's counts.
export function mondayOf(date: string): string {
  const d = parseISO(date);
  return format(addDays(d, -((d.getDay() + 6) % 7)), DATE_FMT);
}

export function weekFrom(monday: string): string[] {
  const d = parseISO(monday);
  return Array.from({ length: 7 }, (_, i) => format(addDays(d, i), DATE_FMT));
}

// A client plan in the shape the schedule form edits.
export function toWorkoutPlan(plan: ClientPlan, clientId: string, muscleGroups: MuscleGroup[]): WorkoutPlan {
  const ids = new Set(plan.muscle_group_ids);
  return {
    id: plan.id,
    user_id: clientId,
    date: plan.date,
    title: plan.title,
    is_rest_day: plan.is_rest_day,
    off_kind: plan.off_kind,
    off_marked_late: plan.off_marked_late,
    muscle_groups: muscleGroups.filter((mg) => ids.has(mg.id)).sort((a, b) => a.name.localeCompare(b.name)),
    planned_exercises: plan.exercises.map((ex) => ({
      id: ex.id,
      plan_id: plan.id,
      exercise_id: ex.exercise_id,
      position: ex.position,
      target_sets: ex.target_sets,
      target_reps: ex.target_reps,
      target_weight: ex.target_weight,
      target_weight_unit: ex.target_weight_unit,
      // Only the name and equipment are shown; whose exercise it is doesn't matter here.
      exercise: { id: ex.exercise_id, user_id: null, name: ex.name, equipment: ex.equipment, notes: null },
    })),
  };
}
