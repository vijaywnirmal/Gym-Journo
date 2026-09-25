import { fromKg, toKg } from "@/lib/units";
import { countsTowardProgress } from "@/lib/setData";
import { isPerformedSet } from "./definitions";
import type { ExerciseSession, PerformedSet } from "./exerciseSessions";
import { bestEstimatedOneRepMax, heaviestSet } from "./progress";

// Personal records: does the current session beat every earlier performed session of the same
// exercise? Pure — no I/O. All weights are compared in kg (logged_sets stores a unit per set).
//
// Rules:
// - A PR needs history to beat: the first-ever session of an exercise is never a PR, so a brand
//   new exercise doesn't flood the logger with "records".
// - Strictly greater than the previous best (with a small tolerance so a kg/lb round-trip of the
//   same weight never counts). Matching a best is not a record.
// - Only sets with both reps and weight count, and never warm-ups, same as progress.ts.

export type PersonalRecordKind = "weight" | "e1rm" | "volume";

export type PersonalRecord = {
  kind: PersonalRecordKind;
  valueKg: number;
  previousKg: number;
  // Only for "weight": the reps done at the record weight.
  reps: number | null;
};

// Absorbs float noise from lb->kg conversion (e.g. 225 lb vs 102.06 kg); well below any real plate.
const TOLERANCE_KG = 0.01;

function sessionVolumeKg(sets: PerformedSet[]): number | null {
  let volume = 0;
  let counted = false;
  for (const set of sets) {
    if (set.weight === null || set.reps === null || !countsTowardProgress(set)) continue;
    volume += toKg(set.weight, set.weightUnit) * set.reps;
    counted = true;
  }
  return counted ? volume : null;
}

export function detectPersonalRecords(
  previousSessions: ExerciseSession[],
  currentSets: PerformedSet[]
): PersonalRecord[] {
  const performed = currentSets.filter(isPerformedSet);
  if (previousSessions.length === 0 || performed.length === 0) return [];

  const current: ExerciseSession[] = [{ date: "", sets: performed }];
  const records: PersonalRecord[] = [];

  const prevHeaviest = heaviestSet(previousSessions);
  const curHeaviest = heaviestSet(current);
  if (prevHeaviest && curHeaviest && curHeaviest.weightKg > prevHeaviest.weightKg + TOLERANCE_KG) {
    records.push({
      kind: "weight",
      valueKg: curHeaviest.weightKg,
      previousKg: prevHeaviest.weightKg,
      reps: curHeaviest.reps,
    });
  }

  const prevE1rm = bestEstimatedOneRepMax(previousSessions);
  const curE1rm = bestEstimatedOneRepMax(current);
  if (prevE1rm && curE1rm && curE1rm.e1rmKg > prevE1rm.e1rmKg + TOLERANCE_KG) {
    records.push({ kind: "e1rm", valueKg: curE1rm.e1rmKg, previousKg: prevE1rm.e1rmKg, reps: null });
  }

  let prevVolume: number | null = null;
  for (const session of previousSessions) {
    const v = sessionVolumeKg(session.sets);
    if (v !== null && (prevVolume === null || v > prevVolume)) prevVolume = v;
  }
  const curVolume = sessionVolumeKg(performed);
  if (prevVolume !== null && curVolume !== null && curVolume > prevVolume + TOLERANCE_KG) {
    records.push({ kind: "volume", valueKg: curVolume, previousKg: prevVolume, reps: null });
  }

  return records;
}

const KIND_LABEL: Record<PersonalRecordKind, string> = {
  weight: "Heaviest weight",
  e1rm: "Best estimated 1RM",
  volume: "Best session volume",
};

function formatWeight(valueKg: number, unit: string): string {
  const value = Math.round(fromKg(valueKg, unit) * 10) / 10;
  return `${value.toLocaleString("en-US")} ${unit === "lb" ? "lb" : "kg"}`;
}

// One line for the logger, in the unit the person is logging in: "Heaviest weight: 90 kg × 5
// (was 80 kg)".
export function describePersonalRecord(record: PersonalRecord, unit: string): string {
  const reps = record.kind === "weight" && record.reps !== null ? ` × ${record.reps}` : "";
  return `${KIND_LABEL[record.kind]}: ${formatWeight(record.valueKg, unit)}${reps} (was ${formatWeight(
    record.previousKg,
    unit
  )})`;
}
