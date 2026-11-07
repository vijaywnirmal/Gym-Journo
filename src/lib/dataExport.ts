import { format, parseISO } from "date-fns";
import type { BodyMeasurement, WorkoutLog, WorkoutPlan } from "@/lib/types";
import { isPerformedSet } from "@/lib/analyze/definitions";
import { formatPace, formatSetValue } from "@/lib/measure";
import { formatSetDetail } from "@/lib/setData";
import { dayTypeOf } from "@/lib/dayType";

// "Download my data" (story I5.1): someone's workouts, plans and body weight as a document, newest
// first. Pure: the route reads the rows, this arranges them, exportPdf.ts draws them.

export type ExportBlock = { heading: string; lines: string[] };
export type ExportSection = { heading: string; empty: string; blocks: ExportBlock[] };
export type ExportDocument = { title: string; subtitle: string; sections: ExportSection[] };

function day(date: string): string {
  return format(parseISO(date), "EEE d MMM yyyy");
}

const byDateDesc = (a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date);
const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;

// "60kg × 8 (Warm-up · RPE 7)", "1:30", "5 km in 28:30 (5:42 /km)".
function setText(set: NonNullable<NonNullable<WorkoutLog["logged_exercises"]>[number]["logged_sets"]>[number]): string {
  const pace = formatPace(set.distance ?? null, set.duration_seconds ?? null, set.distance_unit ?? "km");
  const value = pace ? `${formatSetValue(set)} (${pace})` : formatSetValue(set);
  const detail = formatSetDetail(set.set_type, set.rpe);
  return detail ? `${value} (${detail})` : value;
}

export function workoutBlocks(logs: WorkoutLog[]): ExportBlock[] {
  const blocks: ExportBlock[] = [];
  for (const log of [...logs].sort(byDateDesc)) {
    const lines: string[] = [];
    for (const le of [...(log.logged_exercises ?? [])].sort(byPosition)) {
      const sets = [...(le.logged_sets ?? [])].filter(isPerformedSet).sort((a, b) => a.set_number - b.set_number);
      if (sets.length === 0 && !le.notes?.trim()) continue;
      const name = le.exercise?.name ?? "Exercise";
      lines.push(sets.length > 0 ? `${name}: ${sets.map(setText).join(", ")}` : name);
      if (le.notes?.trim()) lines.push(`    Note: ${le.notes.trim()}`);
    }
    if (log.notes?.trim()) lines.push(`Workout note: ${log.notes.trim()}`);
    // A day opened but nothing recorded isn't a workout.
    if (lines.length > 0) blocks.push({ heading: day(log.date), lines });
  }
  return blocks;
}

// "3 × 8 at 60 kg", "3 sets", or "" without targets.
function targetText(pe: NonNullable<WorkoutPlan["planned_exercises"]>[number]): string {
  const parts: string[] = [];
  if (pe.target_sets && pe.target_reps) parts.push(`${pe.target_sets} × ${pe.target_reps}`);
  else if (pe.target_sets) parts.push(`${pe.target_sets} sets`);
  else if (pe.target_reps) parts.push(`${pe.target_reps} reps`);
  if (pe.target_weight !== null && pe.target_weight !== undefined) parts.push(`at ${Number(pe.target_weight)} ${pe.target_weight_unit}`);
  return parts.join(" ");
}

export function planBlocks(plans: WorkoutPlan[]): ExportBlock[] {
  return [...plans].sort(byDateDesc).map((plan) => {
    const heading = plan.title?.trim() ? `${day(plan.date)} · ${plan.title.trim()}` : day(plan.date);
    // An absence's reason (Sick, Travel, ...) is its title, already in the heading.
    if (plan.is_rest_day) return { heading, lines: [dayTypeOf(plan) === "absence" ? "Day off" : "Rest day"] };
    const lines = [...(plan.planned_exercises ?? [])].sort(byPosition).map((pe) => {
      const target = targetText(pe);
      const name = pe.exercise?.name ?? "Exercise";
      return target ? `${name}: ${target}` : name;
    });
    return { heading, lines: lines.length > 0 ? lines : ["No exercises"] };
  });
}

export function bodyWeightBlock(entries: BodyMeasurement[]): ExportBlock[] {
  if (entries.length === 0) return [];
  const lines = [...entries]
    .sort(byDateDesc)
    .map((m) => `${day(m.date)}: ${Number(m.weight_kg)} kg${m.notes?.trim() ? ` (${m.notes.trim()})` : ""}`);
  return [{ heading: "", lines }];
}

export function buildExportDocument(input: {
  name: string | null;
  generatedOn: string;
  logs: WorkoutLog[];
  plans: WorkoutPlan[];
  bodyWeight: BodyMeasurement[];
}): ExportDocument {
  const who = input.name?.trim() ? `${input.name.trim()} · ` : "";
  return {
    title: "Your GymJourno data",
    subtitle: `${who}Downloaded ${day(input.generatedOn)}`,
    sections: [
      { heading: "Workouts", empty: "No workouts logged yet.", blocks: workoutBlocks(input.logs) },
      { heading: "Plans", empty: "No plans yet.", blocks: planBlocks(input.plans) },
      { heading: "Body weight", empty: "No body weight entries yet.", blocks: bodyWeightBlock(input.bodyWeight) },
    ],
  };
}
